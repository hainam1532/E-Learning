import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth";
import * as progressController from "./progress.controller";

const router = Router();

// Progress routes - ALL require authentication via authMiddleware
router.get("/my", authMiddleware, progressController.getMyProgress);
router.get("/my/academy-courses", authMiddleware, progressController.getMyAcademyCourses);
router.get("/my/stats", authMiddleware, progressController.getMyStats);
router.get("/my/likes", authMiddleware, progressController.getMyLikedVideos);
router.get("/history", authMiddleware, progressController.getWatchHistory);
router.get("/like/:videoId", authMiddleware, progressController.getVideoLikeStatus);
router.get("/course/:courseId", authMiddleware, progressController.getCourseProgress);
router.get("/lesson/:lessonId", authMiddleware, progressController.getLessonProgress);
router.post("/", authMiddleware, progressController.updateProgress);
router.post("/complete", authMiddleware, progressController.markLessonCompleted);
router.post("/like", authMiddleware, progressController.toggleVideoLike);

export default router;
