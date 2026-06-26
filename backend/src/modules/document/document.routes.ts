import { Router } from "express";
import * as documentController from "./document.controller";
import { upload } from "./document.controller";

const router = Router();

// Upload document (multipart/form-data)
router.post("/upload", upload.single("document"), documentController.uploadDocument);

// Get all documents
router.get("/", documentController.getDocuments);

// Get document by ID
router.get("/:id", documentController.getDocument);

// Stream document content by ID
router.get("/:id/content", documentController.getDocumentContent);

// Delete document
router.delete("/:id", documentController.deleteDocument);

export default router;
