import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middlewares/auth';
import {
  getTrainingClasses,
  createTrainingClass,
  updateTrainingClass,
  deleteTrainingClass,
  getTrainingPlans,
  getTrainingPlan,
  createTrainingPlan,
  updateTrainingPlan,
  deleteTrainingPlan,
  uploadTrainingPlanCover,
  coverMiddleware,
  addTrainingResource,
  removeTrainingResource,
  getClassStudents,
  addStudentToClass,
  removeStudentFromClass,
  importStudentsToClass,
  generateClassReport,
  getMyTrainingEnrollments,
  getMyTrainingPlans,
} from './training.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ============ TRAINING CLASS ROUTES ============
// Get all training classes
router.get('/classes', authMiddleware, getTrainingClasses);
// Create training class
router.post('/classes', authMiddleware, createTrainingClass);
// Update training class
router.put('/classes/:id', authMiddleware, updateTrainingClass);
// Delete training class
router.delete('/classes/:id', authMiddleware, deleteTrainingClass);

// ============ TRAINING CLASS ENROLLMENT ROUTES ============
// Get students in class
router.get('/classes/:id/students', authMiddleware, getClassStudents);
// Add student to class
router.post('/classes/:id/students', authMiddleware, addStudentToClass);
// Remove student from class
router.delete('/classes/:id/students/:userId', authMiddleware, removeStudentFromClass);
// Import students from Excel
router.post('/classes/:id/students/import', authMiddleware, upload.single('file'), importStudentsToClass);
// Generate class report
router.get('/classes/:id/report', authMiddleware, generateClassReport);

// ============ TRAINING PLAN ROUTES (admin only) ============
// Get all training plans
router.get('/plans', authMiddleware, getTrainingPlans);
// Get single training plan
router.get('/plans/:id', authMiddleware, getTrainingPlan);
// Create training plan
router.post('/plans', authMiddleware, createTrainingPlan);
// Update training plan
router.put('/plans/:id', authMiddleware, updateTrainingPlan);
// Delete training plan
router.delete('/plans/:id', authMiddleware, deleteTrainingPlan);
// Upload cover image
router.post('/plans/:id/cover', authMiddleware, coverMiddleware.single('cover'), uploadTrainingPlanCover);

// ============ TRAINING RESOURCE ROUTES ============
// Add resource to training plan
router.post('/plans/:id/resources', authMiddleware, addTrainingResource);
// Remove resource from training plan
router.delete('/plans/:id/resources', authMiddleware, removeTrainingResource);

// ============ USER TRAINING ROUTES (for regular users) ============
// Get current user's training enrollments (classes user is enrolled in)
router.get('/my-enrollments', authMiddleware, getMyTrainingEnrollments);
// Get current user's training plans (plans linked to classes user is enrolled in)
router.get('/my-plans', authMiddleware, getMyTrainingPlans);

export default router;
