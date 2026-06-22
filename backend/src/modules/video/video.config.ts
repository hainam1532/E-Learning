import { minioClient } from "../../config/minio";
import { randomUUID } from "crypto";

// Video bucket name in MinIO (from environment or default)
export const VIDEO_BUCKET = process.env.MINIO_VIDEO_BUCKET || "elearning-videos";

// Ensure video bucket exists and set public read policy
export async function ensureVideoBucket(): Promise<void> {
  const bucketExists = await minioClient.bucketExists(VIDEO_BUCKET);
  if (!bucketExists) {
    await minioClient.makeBucket(VIDEO_BUCKET, "us-east-1");
    console.log(`Created video bucket: ${VIDEO_BUCKET}`);
  }
  
  // Set bucket policy to allow public read access
  // This allows anyone to read video files without authentication
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: "*",
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${VIDEO_BUCKET}/*`],
      },
    ],
  };
  
  try {
    await minioClient.setBucketPolicy(VIDEO_BUCKET, JSON.stringify(policy));
    console.log(`Set bucket policy for: ${VIDEO_BUCKET}`);
  } catch (err) {
    console.error("Failed to set bucket policy:", err);
  }
}

// Generate unique video object name
export function generateVideoObjectName(originalFilename: string): string {
  const ext = originalFilename.split(".").pop();
  const uuid = randomUUID();
  return `uploads/${uuid}.${ext}`;
}

// Generate HLS output directory name
export function generateHlsObjectName(videoId: number): string {
  return `hls/${videoId}`;
}

// Upload file to MinIO
export async function uploadVideoFile(
  objectName: string,
  filePath: string
): Promise<void> {
  // MinIO v8 requires metadata object as 4th parameter
  await minioClient.fPutObject(VIDEO_BUCKET, objectName, filePath, {});
}

// Upload buffer to MinIO
export async function uploadVideoBuffer(
  objectName: string,
  buffer: Buffer,
  size: number,
  contentType: string
): Promise<void> {
  // MinIO v8 metadata: pass a metadata object
  await minioClient.putObject(VIDEO_BUCKET, objectName, buffer, size, {"Content-Type": contentType});
}

// Get object list in bucket
export async function listVideoObjects(prefix: string = ""): Promise<string[]> {
  const objects = await minioClient.listObjects(VIDEO_BUCKET, prefix, true);
  const objectNames: string[] = [];
  
  for await (const obj of objects) {
    if (obj.name) {
      objectNames.push(obj.name);
    }
  }
  
  return objectNames;
}

// Remove object from bucket
export async function removeVideoObject(objectName: string): Promise<void> {
  await minioClient.removeObject(VIDEO_BUCKET, objectName);
}

// Remove multiple objects
export async function removeVideoObjects(objectNames: string[]): Promise<void> {
  await minioClient.removeObjects(VIDEO_BUCKET, objectNames);
}

// Get streaming URL for video
export function getVideoStreamingUrl(objectName: string): string {
  const endpoint = process.env.MINIO_ENDPOINT || "localhost";
  const port = process.env.MINIO_PORT || 9000;
  return `http://${endpoint}:${port}/${VIDEO_BUCKET}/${objectName}`;
}
