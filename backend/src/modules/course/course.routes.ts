import { Router } from "express";
import * as courseController from "./course.controller";

const router = Router();

// Course category routes - MUST be before /:id to avoid route conflict
router.get("/categories", courseController.getCourseCategories);
router.post("/categories", courseController.createCourseCategory);
router.put("/categories/:id", courseController.updateCourseCategory);
router.delete("/categories/:id", courseController.deleteCourseCategory);

// Course-category relationship routes
router.get("/categories/:categoryId/courses", courseController.getCoursesByCategory);
router.post("/categories/:categoryId/courses", courseController.addCourseToCategory);
router.delete("/categories/:categoryId/courses", courseController.removeCourseFromCategory);

// Course Tag routes - MUST be before /:id to avoid route conflict
router.get("/tags", courseController.getCourseTags);
router.post("/tags", courseController.createCourseTag);
router.put("/tags/:id", courseController.updateCourseTag);
router.delete("/tags/:id", courseController.deleteCourseTag);

// Special topic routes - MUST be before /:id to avoid route conflict
router.get("/special-topics/home", courseController.getHomeSpecialTopics);
router.get("/special-topics", courseController.getSpecialTopics);
router.post("/special-topics", courseController.createSpecialTopic);
router.put("/special-topics/reorder", courseController.reorderSpecialTopics);
router.put("/special-topics/:id", courseController.updateSpecialTopic);
router.delete("/special-topics/:id", courseController.deleteSpecialTopic);
router.get("/special-topics/:topicId/courses", courseController.getCoursesBySpecialTopic);
router.post("/special-topics/:topicId/courses", courseController.addCourseToSpecialTopic);
router.delete("/special-topics/:topicId/courses", courseController.removeCourseFromSpecialTopic);
router.put("/special-topics/:topicId/courses/reorder", courseController.reorderSpecialTopicCourses);

// Course routes
router.get("/", courseController.getCourses);
router.get("/featured", courseController.getFeaturedCourses);
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
