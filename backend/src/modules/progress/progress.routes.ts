import { Router } from "express";
import * as progressController from "./progress.controller";

const router = Router();

// Progress routes - requires authentication
router.get("/my", progressController.getMyProgress);
router.get("/my/academy-courses", progressController.getMyAcademyCourses);
router.get("/course/:courseId", progressController.getCourseProgress);
router.post("/", progressController.updateProgress);
router.post("/complete", progressController.markLessonCompleted);

export default router;
