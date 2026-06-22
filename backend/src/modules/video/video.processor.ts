import { spawn } from "child_process";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { minioClient } from "../../config/minio";
import { VIDEO_BUCKET } from "./video.config";

// Video processing job result
export interface VideoJobResult {
  success: boolean;
  outputPath: string;
  duration?: number;
  error?: string;
}

// Check if FFmpeg is installed
// We check every time because PATH might change between restarts
async function checkFFmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ffmpeg = spawn("ffmpeg", ["-version"]);
      
      ffmpeg.on("close", (code) => {
        resolve(code === 0);
      });
      
      ffmpeg.on("error", () => {
        resolve(false);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        ffmpeg.kill();
        resolve(false);
      }, 5000);
    } catch {
      resolve(false);
    }
  });
}

// Initialize FFmpeg check on module load - log the result for debugging
checkFFmpeg().then((available) => {
  if (available) {
    console.log("✓ FFmpeg is available for video processing");
  } else {
    console.error("✗ FFmpeg is NOT installed. Video processing will fail.");
    console.error("Please install FFmpeg to enable video processing:");
    console.error("  Windows: choco install ffmpeg");
    console.error("  macOS: brew install ffmpeg");
    console.error("  Linux: sudo apt-get install ffmpeg");
  }
}).catch(() => {
  console.error("✗ FFmpeg check failed");
});

// Video processing job data
export interface VideoJobData {
  videoId: number;
  lessonId: number;
  originalFileName: string;
  objectName: string;
  bucket: string;
}

// FFmpeg options for HLS conversion
interface FFmpegOptions {
  resolution?: string; // e.g., "1920x1080", "1280x720", "854x480", "640x360", "426x240"
  videoBitrate?: string; // e.g., "5000k", "2500k", "1000k", "500k", "300k"
  audioBitrate?: string; // e.g., "128k", "96k"
  segmentDuration?: number; // segment duration in seconds
}

// Default transcoding profiles
const TRANSCODING_PROFILES: FFmpegOptions[] = [
  { resolution: "1920x1080", videoBitrate: "5000k", audioBitrate: "128k", segmentDuration: 6 },
  { resolution: "1280x720", videoBitrate: "2500k", audioBitrate: "128k", segmentDuration: 6 },
  { resolution: "854x480", videoBitrate: "1000k", audioBitrate: "96k", segmentDuration: 6 },
  { resolution: "640x360", videoBitrate: "500k", audioBitrate: "96k", segmentDuration: 6 },
];

// Temp directory for processing
const TEMP_DIR = path.join(os.tmpdir(), "video-processing");

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Download video from MinIO to local temp file
 */
async function downloadFromMinIO(objectName: string, localPath: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await minioClient.getObject(VIDEO_BUCKET, objectName);
      const writeStream = fs.createWriteStream(localPath);
      
      stream.pipe(writeStream);
      
      writeStream.on("finish", () => {
        writeStream.close();
        resolve();
      });
      
      stream.on("error", (err) => {
        writeStream.close();
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Upload HLS files to MinIO recursively
 */
async function uploadToMinIO(localDir: string, objectPrefix: string): Promise<void> {
  // Upload all files recursively including subdirectories
  await uploadDirectoryRecursive(localDir, objectPrefix);
}

/**
 * Recursively upload directory contents to MinIO
 */
async function uploadDirectoryRecursive(localDir: string, objectPrefix: string): Promise<void> {
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  
  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively upload subdirectory
      await uploadDirectoryRecursive(localPath, `${objectPrefix}/${entry.name}`);
    } else {
      // Upload file
      const objectName = `${objectPrefix}/${entry.name}`;
      await minioClient.fPutObject(VIDEO_BUCKET, objectName, localPath, {});
    }
  }
}

/**
 * Get video duration using FFprobe
 */
async function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);
    
    let output = "";
    let errorOutput = "";
    
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });
    
    ffprobe.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });
    
    ffprobe.on("close", (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        if (!isNaN(duration)) {
          resolve(duration);
        } else {
          resolve(0);
        }
      } else {
        console.error("FFprobe error:", errorOutput);
        resolve(0);
      }
    });
    
    ffprobe.on("error", (err) => {
      console.error("FFprobe spawn error:", err);
      resolve(0);
    });
  });
}

/**
 * Convert video to HLS format using FFmpeg
 */
async function convertToHLS(
  inputPath: string,
  outputDir: string,
  options: FFmpegOptions
): Promise<void> {
  const { resolution, videoBitrate, audioBitrate, segmentDuration } = options;
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Check input file size first
  const inputStats = fs.statSync(inputPath);
  if (inputStats.size < 1000) {
    throw new Error("Input video file is too small or empty");
  }
  
// FFmpeg arguments - more robust HLS encoding
    const ffmpegArgs = [
      "-i", inputPath,
      // Video encoding settings
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-maxrate", videoBitrate || "2000k",
      "-bufsize", "4000k",
      // Scale to target resolution
      "-vf", `scale=${resolution}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      // Audio encoding settings
      "-c:a", "aac",
      "-ab", audioBitrate || "128k",
      "-ar", "48000",
      // HLS specific options
      "-f", "hls",
      "-hls_time", String(segmentDuration || 6),
      "-hls_list_size", "0",
      "-hls_playlist_type", "vod",
      "-hls_segment_filename", path.join(outputDir, "segment_%03d.ts"),
      path.join(outputDir, "index.m3u8"),
    ];
  
  return new Promise((resolve, reject) => {
    console.log(`[FFmpeg] Running: ffmpeg ${ffmpegArgs.join(" ")}`);
    
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);
    
    let outputData = "";
    let errorOutput = "";
    
    ffmpeg.stdout.on("data", (data) => {
      outputData += data.toString();
    });
    
    ffmpeg.stderr.on("data", (data) => {
      errorOutput += data.toString();
      // Log progress
      const str = data.toString();
      if (str.includes("time=") || str.includes("frame=")) {
        console.log(`[FFmpeg] ${str.substring(0, 100)}`);
      }
    });
    
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        // Verify output file was created
        const outputFile = path.join(outputDir, "index.m3u8");
        if (!fs.existsSync(outputFile)) {
          reject(new Error("HLS output file was not created"));
          return;
        }
        
// Check for required tags
        const content = fs.readFileSync(outputFile, "utf8");
        let needsFix = false;
        
        if (!content.includes("#EXT-X-TARGETDURATION")) {
          console.warn("[FFmpeg] WARNING: Missing #EXT-X-TARGETDURATION, will add manually");
          needsFix = true;
        }
        
        // Always add #EXT-X-ENDLIST for VOD playback
        if (!content.includes("#EXT-X-ENDLIST")) {
          console.warn("[FFmpeg] WARNING: Missing #EXT-X-ENDLIST, will add manually");
          needsFix = true;
        }
        
        if (needsFix) {
          const fixedContent = fixM3U8Content(content);
          fs.writeFileSync(outputFile, fixedContent);
        }
        
        resolve();
      } else {
        console.error("FFmpeg error:", errorOutput);
        reject(new Error(`FFmpeg exited with code ${code}: ${errorOutput}`));
      }
    });
    
    ffmpeg.on("error", (err) => {
      console.error("FFmpeg spawn error:", err);
      reject(err);
    });
  });
}

/**
 * Fix M3U8 content if missing required tags
 */
function fixM3U8Content(content: string): string {
  const lines = content.split("\n");
  const fixedLines: string[] = [];
  
  // Find segment durations to calculate target duration
  let maxDuration = 6;
  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      const duration = parseFloat(line.split(",")[0].replace("#EXTINF:", ""));
      if (!isNaN(duration) && duration > maxDuration) {
        maxDuration = Math.ceil(duration);
      }
    }
  }
  
  // Add #EXT-X-TARGETDURATION if missing
  let addedTargetDuration = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Add target duration after #EXTM3U
    if (line.startsWith("#EXTM3U") && !addedTargetDuration) {
      fixedLines.push(line);
      fixedLines.push(`#EXT-X-TARGETDURATION:${maxDuration}`);
      addedTargetDuration = true;
    } else {
      fixedLines.push(line);
    }
  }
  
  return fixedLines.join("\n");
}

/**
 * Process video with multiple quality profiles
 * @param onProgress - callback for progress updates (0-100)
 */
export async function processVideo(
  jobData: VideoJobData,
  onProgress?: (progress: number) => void
): Promise<VideoJobResult> {
  const { videoId, objectName } = jobData;
  
  // Check if FFmpeg is installed first
  const isFFmpegInstalled = await checkFFmpeg();
  if (!isFFmpegInstalled) {
    const errorMessage = "FFmpeg is not installed on the system. Please install FFmpeg to process videos.";
    console.error("Video processing error:", errorMessage);
    return {
      success: false,
      outputPath: "",
      error: errorMessage,
    };
  }
  
  const jobId = randomUUID();
  const tempDir = path.join(TEMP_DIR, jobId);
  const inputFile = path.join(tempDir, "input");
  const outputDir = path.join(tempDir, "output");
  
  // Progress breakdown: download 10%, profiles 80% (20% each), upload 10%
const reportProgress = (percent: number) => {
    if (onProgress) {
      onProgress(Math.min(100, Math.max(0, percent)));
    }
  };
  
  try {
    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Download video from MinIO (0-10%)
    console.log(`Downloading video from MinIO: ${objectName}`);
    await downloadFromMinIO(objectName, inputFile);
    reportProgress(10);
    
    // Get video duration (10-20%)
    const duration = await getVideoDuration(inputFile);
    console.log(`Video duration: ${duration} seconds`);
    reportProgress(20);
    
    // Process with each quality profile (20% each = 80% total)
    for (let i = 0; i < TRANSCODING_PROFILES.length; i++) {
      const profile = TRANSCODING_PROFILES[i];
      const profileOutputDir = path.join(outputDir, `p${i}`);
      
      console.log(`Converting to HLS with profile: ${profile.resolution}`);
      await convertToHLS(inputFile, profileOutputDir, profile);
      reportProgress(20 + (i + 1) * 20);
    }
    
    // Upload HLS files to MinIO (90-100%)
    const hlsPrefix = `hls/${videoId}`;
    console.log(`Uploading HLS files to MinIO: ${hlsPrefix}`);
    await uploadToMinIO(outputDir, hlsPrefix);
    reportProgress(100);
    
    // Clean up temp files
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return {
      success: true,
      outputPath: hlsPrefix,
      duration: Math.round(duration),
    };
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Video processing error:", errorMessage);
    
    return {
      success: false,
      outputPath: "",
      error: errorMessage,
    };
  }
}

/**
 * Process video single quality (for simple cases)
 */
export async function processVideoSimple(
  inputPath: string,
  outputPrefix: string,
  options: FFmpegOptions = {}
): Promise<VideoJobResult> {
  const tempDir = path.join(TEMP_DIR, randomUUID());
  const outputDir = path.join(tempDir, "output");
  
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Get duration
    const duration = await getVideoDuration(inputPath);
    
    // Convert to HLS
    await convertToHLS(inputPath, outputDir, options);
    
    // Upload to MinIO
    await uploadToMinIO(outputDir, outputPrefix);
    
    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return {
      success: true,
      outputPath: outputPrefix,
      duration: Math.round(duration),
    };
  } catch (error) {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    return {
      success: false,
      outputPath: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
