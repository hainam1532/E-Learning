import { Router } from "express";
import * as videoController from "./video.controller";
import { upload, thumbnailMiddleware } from "./video.controller";

const router = Router();

// Upload video (multipart/form-data)
router.post("/upload", upload.single("video"), videoController.uploadVideo);

// Get all videos
router.get("/", videoController.getVideos);

// Get video by ID
router.get("/:id", videoController.getVideo);

// Get video streaming URL
router.get("/:id/stream", videoController.getVideoStreamUrl);

// Update video (name, thumbnail)
router.put("/:id", videoController.updateVideo);

// Upload thumbnail
router.post("/:id/thumbnail", thumbnailMiddleware.single("thumbnail"), videoController.uploadThumbnail);

// Re-process video
router.post("/:id/reprocess", videoController.reprocessVideo);

// Delete video
router.delete("/:id", videoController.deleteVideo);

export default router;
