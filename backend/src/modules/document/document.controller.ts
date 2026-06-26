import { Request, Response } from "express";
import { randomUUID } from "crypto";
import multer from "multer";
import * as path from "path";
import { prisma } from "../../config/db";
import { minioClient } from "../../config/minio";
import {
  DOCUMENT_BUCKET,
  ALLOWED_DOCUMENT_EXTENSIONS,
  getDocumentTypeFromExtension,
  ensureDocumentBucket,
  uploadDocumentFile,
  removeDocumentObject,
  getDocumentUrl,
} from "./document.config";

// Helper to parse ID safely
function parseId(value: string | string[] | undefined): number | null {
  if (!value) return null;
  const str = Array.isArray(value) ? value[0] : value;
  const num = parseInt(str);
  return isNaN(num) ? null : num;
}

// Configure multer for document uploads
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
    fileSize: 100 * 1024 * 1024, // 100MB limit for documents
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only Excel, Word, PDF, and PowerPoint files are allowed."
        )
      );
    }
  },
});

/**
 * Upload document
 */
export const uploadDocument = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        message: "No document file provided",
      });
      return;
    }

const name = req.body.name as string | undefined;

    // Ensure bucket exists
    await ensureDocumentBucket();

    // Generate object name
    const objectName = `documents/${randomUUID()}${path.extname(file.originalname)}`;

    // Upload to MinIO
    await uploadDocumentFile(objectName, file.path, file.mimetype);

// Get document type from extension
    const ext = path.extname(file.originalname).toLowerCase();
    const docType = getDocumentTypeFromExtension(ext);

// Create document record in database
    const document = await prisma.document.create({
      data: {
        name: name?.trim() || file.originalname,
        type: docType,
        size: file.size,
        bucket: DOCUMENT_BUCKET,
        path: objectName,
      },
    });

    // Clean up local file
    const fs = await import("fs");
    fs.unlinkSync(file.path);

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: {
        id: document.id,
        name: document.name,
        type: document.type,
        size: document.size,
        url: getDocumentUrl(objectName),
      },
    });
  } catch (error) {
    console.error("Upload document error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Upload failed",
    });
  }
};

/**
 * Get all documents
 */
export const getDocuments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const documents = await prisma.document.findMany({
      orderBy: {
        id: "desc",
      },
    });

    // Add URL to each document
    const documentsWithUrl = documents.map((doc) => ({
      ...doc,
      url: getDocumentUrl(doc.path),
    }));

    res.json({
      success: true,
      data: documentsWithUrl,
    });
  } catch (error) {
    console.error("Get documents error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get documents",
    });
  }
};

/**
 * Get document by ID
 */
export const getDocument = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = parseId(req.params.id);

    if (id === null) {
      res.status(400).json({
        success: false,
        message: "Invalid document ID",
      });
      return;
    }

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        message: "Document not found",
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...document,
        url: getDocumentUrl(document.path),
      },
    });
  } catch (error) {
    console.error("Get document error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get document",
    });
  }
};

/**
 * Stream document content for inline preview/download through backend.
 * This avoids third-party viewer failures on private/local MinIO URLs.
 */
export const getDocumentContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = parseId(req.params.id);

    if (id === null) {
      res.status(400).json({
        success: false,
        message: "Invalid document ID",
      });
      return;
    }

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        message: "Document not found",
      });
      return;
    }

    const objectStream = await minioClient.getObject(document.bucket, document.path);

    const rawName = (document.name || `document-${document.id}`).replace(/[\r\n]/g, "");
    const asciiFileName = rawName
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/["\\]/g, "")
      .trim() || `document-${document.id}.${document.type || "bin"}`;
    const utf8FileName = encodeURIComponent(rawName);
    const contentType =
      document.type === "pdf"
        ? "application/pdf"
        : document.type === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : document.type === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : document.type === "pptx"
              ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
              : "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename=\"${asciiFileName}\"; filename*=UTF-8''${utf8FileName}`
    );
    res.setHeader("Cache-Control", "no-store");

    objectStream.on("error", (error) => {
      console.error("Document stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Failed to stream document" });
      }
    });

    objectStream.pipe(res);
  } catch (error) {
    console.error("Get document content error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get document content",
    });
  }
};

/**
 * Delete document
 */
export const deleteDocument = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = parseId(req.params.id);

    if (id === null) {
      res.status(400).json({
        success: false,
        message: "Invalid document ID",
      });
      return;
    }

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      res.status(404).json({
        success: false,
        message: "Document not found",
      });
      return;
    }

    // Delete from MinIO
    await removeDocumentObject(document.path);

    // Delete from database
    await prisma.document.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete document",
    });
  }
};

// Export multer middleware
export { upload };
