import { Client } from "minio";

// MinIO v8 uses named export 'Client'
// MINIO_PORT should be the S3 API port (default 9000)
// The console typically runs on port 9001 but that's different from the S3 API
export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT || "9000"),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin"
});
