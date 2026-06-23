import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth";
import * as progressController from "./progress.controller";

const router = Router();

// Progress routes - ALL require authentication via authMiddleware
router.get("/my", authMiddleware, progressController.getMyProgress);
router.get("/my/academy-courses", authMiddleware, progressController.getMyAcademyCourses);
router.get("/course/:courseId", authMiddleware, progressController.getCourseProgress);
router.post("/", authMiddleware, progressController.updateProgress);
router.post("/complete", authMiddleware, progressController.markLessonCompleted);

export default router;
