import { Request, Response } from "express";
import { randomUUID } from "crypto";
import multer from "multer";
import * as path from "path";
import { prisma } from "../../config/db";
import {
  VIDEO_BUCKET,
  generateVideoObjectName,
  ensureVideoBucket,
  uploadVideoFile,
  listVideoObjects,
  removeVideoObjects,
  getVideoStreamingUrl,
} from "./video.config";
import { createVideoQueue, VideoJobData } from "./video.queue";
import IORedis from "ioredis";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: (req, file, cb) => {
    const uuid = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uuid}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "video/mp4",
      "video/mpeg",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-ms-wmv",
      "video/webm",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only video files are allowed."));
    }
  },
});

// Redis connection for BullMQ
const createRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });
};

// Create video queue
let videoQueue: ReturnType<typeof createVideoQueue>;
let redisConnection: IORedis;

const getVideoQueue = () => {
  if (!videoQueue) {
    redisConnection = createRedisConnection();
    videoQueue = createVideoQueue(redisConnection);
  }
  return videoQueue;
};

// Helper to parse ID safely
function parseId(value: string | string[] | undefined): number | null {
  if (!value) return null;
  const str = Array.isArray(value) ? value[0] : value;
  const num = parseInt(str);
  return isNaN(num) ? null : num;
}

/**
 * Upload video - handles raw video upload and queues processing
 * lessonId is optional - if provided, video is attached to a lesson
 * if not provided, video is stored in library without lesson attachment
 */
export const uploadVideo = async (req: Request, res: Response): Promise<void> => {
  try {
const { lessonId } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        message: "No video file provided",
      });
      return;
    }

    let lessonIdNum: number | null = null;
    let lesson: any = null;

    // If lessonId is provided, validate it
    if (lessonId) {
      lessonIdNum = parseId(lessonId);
      if (lessonIdNum === null) {
        res.status(400).json({
          success: false,
          message: "Invalid lesson ID",
        });
        return;
      }

      // Check if lesson exists
      lesson = await prisma.lesson.findUnique({
        where: { id: lessonIdNum },
      });

      if (!lesson) {
        res.status(404).json({
          success: false,
          message: "Lesson not found",
        });
        return;
      }

      // Check if video already exists for this lesson
      const existingVideo = await prisma.video.findUnique({
        where: { lessonId: lessonIdNum },
      });

      if (existingVideo) {
        res.status(400).json({
          success: false,
          message: "Video already exists for this lesson. Please delete the existing video first.",
        });
        return;
      }
    }

    // Ensure bucket exists
    await ensureVideoBucket();

    // Generate object name
    const objectName = generateVideoObjectName(file.originalname);

    // Upload to MinIO
    await uploadVideoFile(objectName, file.path);

// Get video name from request body (optional)
    const { name } = req.body as { name?: string };

    // Create video record in database (lessonId can be null for library storage)
    const videoCreateData: any = {
      bucket: VIDEO_BUCKET,
      path: objectName,
      name: name?.trim() || null,
    };
    // Only add lessonId if it has a valid value
    if (lessonIdNum !== null && lessonIdNum !== undefined) {
      videoCreateData.lessonId = lessonIdNum;
    }

    console.log("Creating video record with data:", videoCreateData);
    console.log("VIDEO_BUCKET:", VIDEO_BUCKET);
    console.log("objectName:", objectName);


    const video = await prisma.video.create({
      data: videoCreateData,
    });

    // Queue video processing job
    const queue = getVideoQueue();
    const jobData: VideoJobData = {
      videoId: video.id,
      lessonId: lessonIdNum || 0,
      originalFileName: file.originalname,
      objectName: objectName,
      bucket: VIDEO_BUCKET,
    };

    await queue.add("process-video", jobData);

    // Clean up local file
    const fs = await import("fs");
    fs.unlinkSync(file.path);

    res.status(201).json({
      success: true,
      message: lessonIdNum 
        ? "Video uploaded successfully. Processing started." 
        : "Video uploaded to library. Processing started.",
      data: {
        videoId: video.id,
        lessonId: video.lessonId,
        status: "processing",
      },
    });
  } catch (error) {
    console.error("Upload video error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Upload failed",
    });
  }
};

/**
 * Get all videos
 */
export const getVideos = async (req: Request, res: Response): Promise<void> => {
  try {
    const videos = await prisma.video.findMany({
      include: {
        lesson: {
          include: {
            course: true,
          },
        },
      },
      orderBy: {
        id: "desc",
      },
    });

// For completed videos, construct HLS streaming URL with quality profile
    // The HLS files are stored at hls/{videoId}/p0/index.m3u8 (360p), p1 (720p), etc.
    // Use hlsPath if available, otherwise fall back to videoId-based path
    const videosWithUrl = videos.map((video) => ({
      ...video,
      streamingUrl: video.status === "COMPLETED" && video.hlsPath
        ? getVideoStreamingUrl(`${video.hlsPath}/p0/index.m3u8`)
        : null,
    }));

    res.json({
      success: true,
      data: videosWithUrl,
    });
  } catch (error) {
    console.error("Get videos error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get videos",
    });
  }
};

/**
 * Get video by ID
 */
export const getVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const videoId = parseId(req.params.id);

    if (videoId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid video ID",
      });
      return;
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        lesson: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!video) {
      res.status(404).json({
        success: false,
        message: "Video not found",
      });
      return;
    }

// For completed videos, construct HLS streaming URL with quality profile
    // Use hlsPath if available, otherwise fall back to videoId-based path
    res.json({
      success: true,
      data: {
        ...video,
        streamingUrl: video.status === "COMPLETED" && video.hlsPath
          ? getVideoStreamingUrl(`${video.hlsPath}/p0/index.m3u8`)
          : null,
      },
    });
  } catch (error) {
    console.error("Get video error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get video",
    });
  }
};

/**
 * Delete video
 */
export const deleteVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const videoId = parseId(req.params.id);

    if (videoId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid video ID",
      });
      return;
    }

const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      res.status(404).json({
        success: false,
        message: "Video not found",
      });
      return;
    }

    // Delete from MinIO
    const objectsToDelete = [video.path];
    // Add HLS segments if they exist
    const hlsObjects = await listVideoObjects(`hls/${videoId}/`);
    objectsToDelete.push(...hlsObjects);

    await removeVideoObjects(objectsToDelete);

    // Delete from database
    await prisma.video.delete({
      where: { id: videoId },
    });

    res.json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (error) {
    console.error("Delete video error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete video",
    });
  }
};

/**
 * Get video streaming URL
 */
export const getVideoStreamUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const videoId = parseId(req.params.id);

    if (videoId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid video ID",
      });
      return;
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      res.status(404).json({
        success: false,
        message: "Video not found",
      });
      return;
    }

// Return HLS index.m3u8 URL with quality profile (p0 = 360p SD for broad compatibility)
    // Use hlsPath if available, otherwise fall back to videoId-based path
    const hlsPath = video.hlsPath 
      ? `${video.hlsPath}/p0/index.m3u8`
      : `hls/${videoId}/p0/index.m3u8`;
    const streamUrl = getVideoStreamingUrl(hlsPath);

    res.json({
      success: true,
      data: {
        streamUrl,
        videoId: video.id,
        duration: video.duration,
      },
    });
  } catch (error) {
    console.error("Get streaming URL error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get streaming URL",
    });
  }
};

/**
 * Re-process video (retry processing)
 */
export const reprocessVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const videoId = parseId(req.params.id);

    if (videoId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid video ID",
      });
      return;
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

if (!video) {
      res.status(404).json({
        success: false,
        message: "Video not found",
      });
      return;
    }

    // Reset status to PROCESSING and progress to 0 before reprocessing
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "PROCESSING",
        progress: 0,
      },
    });

    // Queue video processing job
    const queue = getVideoQueue();
    const jobData: VideoJobData = {
      videoId: video.id,
      lessonId: video.lessonId || 0,
      originalFileName: "",
      objectName: video.path,
      bucket: video.bucket,
    };

    await queue.add("process-video", jobData);

    res.json({
      success: true,
      message: "Video processing job queued",
      data: {
        status: "PROCESSING",
        progress: 0,
      },
    });
  } catch (error) {
    console.error("Reprocess video error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to queue processing",
    });
  }
};

// Configure multer for thumbnail uploads
const storageThumbnail = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: (req, file, cb) => {
    const uuid = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `thumb_${uuid}${ext}`);
  },
});

const thumbnailMiddleware = multer({
  storage: storageThumbnail,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only image files are allowed."));
    }
  },
});

// Thumbnail bucket
const THUMBNAIL_BUCKET = "elearning-pictures";

/**
 * Update video name
 */
export const updateVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const videoId = parseId(req.params.id);

    if (videoId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid video ID",
      });
      return;
    }

    const { name } = req.body;

    // Validate input
    if (name !== undefined && typeof name !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid name",
      });
      return;
    }

    // Check if video exists
    const existingVideo = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!existingVideo) {
      res.status(404).json({
        success: false,
        message: "Video not found",
      });
      return;
    }

    // Update video
    const updateData: any = {};
    if (name !== undefined) {
      updateData.name = name.trim() || null;
    }

    const video = await prisma.video.update({
      where: { id: videoId },
      data: updateData,
    });

    res.json({
      success: true,
      message: "Video updated successfully",
      data: video,
    });
  } catch (error) {
    console.error("Update video error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Update failed",
    });
  }
};

/**
 * Upload thumbnail for video
 */
export const uploadThumbnail = async (req: Request, res: Response): Promise<void> => {
  try {
    const videoId = parseId(req.params.id);
    const file = req.file;

    if (videoId === null) {
      res.status(400).json({
        success: false,
        message: "Invalid video ID",
      });
      return;
    }

    if (!file) {
      res.status(400).json({
        success: false,
        message: "No thumbnail file provided",
      });
      return;
    }

    // Check if video exists
    const existingVideo = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!existingVideo) {
      res.status(404).json({
        success: false,
        message: "Video not found",
      });
      return;
    }

    // Ensure thumbnail bucket exists
    const minio = await import("minio");
    let thumbnailClient: any;
    try {
      thumbnailClient = new minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || "localhost",
        port: parseInt(process.env.MINIO_PORT || "9000"),
        useSSL: false,
        accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
        secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
      });
    } catch (e) {
      // Use existing minio client from config
      const { minioClient } = await import("../../config/minio");
      thumbnailClient = minioClient;
    }

    const bucketExists = await thumbnailClient.bucketExists(THUMBNAIL_BUCKET);
    if (!bucketExists) {
      await thumbnailClient.makeBucket(THUMBNAIL_BUCKET, "us-east-1");
      
      // Set public read policy
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${THUMBNAIL_BUCKET}/*`],
          },
        ],
      };
      await thumbnailClient.setBucketPolicy(THUMBNAIL_BUCKET, JSON.stringify(policy));
    }

    // Upload thumbnail to MinIO
    const objectName = `thumbnails/${videoId}_${Date.now()}${path.extname(file.originalname)}`;
    await thumbnailClient.fPutObject(THUMBNAIL_BUCKET, objectName, file.path, {
      "Content-Type": file.mimetype,
    });

    // Generate thumbnail URL
    const endpoint = process.env.MINIO_ENDPOINT || "localhost";
    const port = process.env.MINIO_PORT || "9000";
    const thumbnailUrl = `http://${endpoint}:${port}/${THUMBNAIL_BUCKET}/${objectName}`;

    // Update video with thumbnail URL
    await prisma.video.update({
      where: { id: videoId },
      data: { thumbnailUrl },
    });

    // Clean up local file
    const fs = await import("fs");
    fs.unlinkSync(file.path);

    res.json({
      success: true,
      message: "Thumbnail uploaded successfully",
      data: {
        thumbnailUrl,
      },
    });
  } catch (error) {
    console.error("Upload thumbnail error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Upload failed",
    });
  }
};

// Export multer middleware
export { upload, thumbnailMiddleware };
