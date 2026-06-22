import { Router } from "express";
import * as courseController from "./course.controller";

const router = Router();

// Course category routes - MUST be before /:id to avoid route conflict
router.get("/categories", courseController.getCourseCategories);
router.post("/categories", courseController.createCourseCategory);
router.put("/categories/:id", courseController.updateCourseCategory);
router.delete("/categories/:id", courseController.deleteCourseCategory);

// Course routes
router.get("/", courseController.getCourses);
router.get("/:id", courseController.getCourse);
router.post("/", courseController.createCourse);
router.put("/:id", courseController.updateCourse);
router.post("/:id/cover", courseController.coverMiddleware.single("cover"), courseController.uploadCover);
router.delete("/:id", courseController.deleteCourse);

// Course video routes
router.post("/:id/videos", courseController.addVideoToCourse);
router.delete("/:id/videos", courseController.removeVideoFromCourse);

// Lesson routes (kept for backward compatibility)
router.get("/lessons", courseController.getLessons);
router.get("/:courseId/lessons", courseController.getLessonsByCourse);

export default router;
