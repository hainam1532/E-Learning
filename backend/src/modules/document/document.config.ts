import { minioClient } from "../../config/minio";
import { randomUUID } from "crypto";

// Document bucket name in MinIO
export const DOCUMENT_BUCKET = "elearning-documents";

// Allowed document file types
export const ALLOWED_DOCUMENT_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel", // xls
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword", // doc
  "application/pdf", // pdf
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/vnd.ms-powerpoint", // ppt
];

// Allowed document extensions
export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".xlsx",
  ".xls",
  ".docx",
  ".doc",
  ".pdf",
  ".pptx",
  ".ppt",
];

// Mapping file extension to display type
export function getDocumentTypeFromExtension(ext: string): string {
  const extLower = ext.toLowerCase();
  switch (extLower) {
    case ".xlsx":
    case ".xls":
      return "xlsx";
    case ".docx":
    case ".doc":
      return "docx";
    case ".pdf":
      return "pdf";
    case ".pptx":
    case ".ppt":
      return "pptx";
    default:
      return extLower.replace(".", "");
  }
}

// Get display name for document type
export function getDocumentTypeName(type: string): string {
  switch (type) {
    case "xlsx":
      return "Excel";
    case "docx":
      return "Word";
    case "pdf":
      return "PDF";
    case "pptx":
      return "PowerPoint";
    default:
      return type.toUpperCase();
  }
}

// Ensure document bucket exists and set public read policy
export async function ensureDocumentBucket(): Promise<void> {
  const bucketExists = await minioClient.bucketExists(DOCUMENT_BUCKET);
  if (!bucketExists) {
    await minioClient.makeBucket(DOCUMENT_BUCKET, "us-east-1");
    console.log(`Created document bucket: ${DOCUMENT_BUCKET}`);
  }

  // Set bucket policy to allow public read access
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: "*",
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${DOCUMENT_BUCKET}/*`],
      },
    ],
  };

  try {
    await minioClient.setBucketPolicy(DOCUMENT_BUCKET, JSON.stringify(policy));
    console.log(`Set bucket policy for: ${DOCUMENT_BUCKET}`);
  } catch (err) {
    console.error("Failed to set bucket policy:", err);
  }
}

// Generate unique document object name
export function generateDocumentObjectName(originalFilename: string): string {
  const ext = originalFilename.split(".").pop();
  const uuid = randomUUID();
  return `documents/${uuid}.${ext}`;
}

// Upload file to MinIO
export async function uploadDocumentFile(
  objectName: string,
  filePath: string,
  contentType: string
): Promise<void> {
  await minioClient.fPutObject(DOCUMENT_BUCKET, objectName, filePath, {
    "Content-Type": contentType,
  });
}

// List document objects in bucket
export async function listDocumentObjects(prefix: string = ""): Promise<string[]> {
  const objects = await minioClient.listObjects(DOCUMENT_BUCKET, prefix, true);
  const objectNames: string[] = [];

  for await (const obj of objects) {
    if (obj.name) {
      objectNames.push(obj.name);
    }
  }

  return objectNames;
}

// Remove object from bucket
export async function removeDocumentObject(objectName: string): Promise<void> {
  await minioClient.removeObject(DOCUMENT_BUCKET, objectName);
}

// Get document URL
export function getDocumentUrl(objectName: string): string {
  const endpoint = process.env.MINIO_ENDPOINT || "localhost";
  const port = process.env.MINIO_PORT || "9000";
  return `http://${endpoint}:${port}/${DOCUMENT_BUCKET}/${objectName}`;
}
