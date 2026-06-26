import { Router, Response } from 'express';
import multer from 'multer';
import { login, refresh, logout, getProfile, getUsers, getUser, createUser, updateUser, deleteUser, getDepartments, createDepartment, updateDepartment, deleteDepartment, getPositions, createPosition, updatePosition, deletePosition, getConfigs, setConfig, deleteConfig, getPublicAcademies, getAcademies, getAcademy, createAcademy, updateAcademy, deleteAcademy, getAcademyUsers, addAcademyUser, removeAcademyUser, getLecturers, createLecturer, updateLecturer, deleteLecturer, importUsers, exportUserTemplate, getQuestionCategories, createQuestionCategory, updateQuestionCategory, deleteQuestionCategory, getQuestions, createQuestion, updateQuestion, deleteQuestion, importQuestions, exportQuestionTemplate, getLearningOverviewReport, exportLearningOverviewReportExcel } from './auth.controller';
import { getLearningTimeReport, getLearningTimeReportDetail, exportLearningTimeReportExcel } from './reportTime.controller';
import { getAdminDashboardReport } from './dashboard.controller';
import { getExamSessions, createExamSession, updateExamSession, deleteExamSession } from './examSession.controller';
import { authMiddleware } from '../../middlewares/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Các route không cần đăng nhập
router.post('/login', login);
router.post('/refresh', refresh);

// Các route cần đăng nhập
router.post('/logout', authMiddleware, logout);
router.get('/profile', authMiddleware, getProfile);

// ============ ADMIN USER MANAGEMENT ROUTES (Yêu cầu quyền ADMIN) ============
// Import/Export users - NOTE: template must be BEFORE :id routes to avoid being caught as :id
router.get('/users/template', authMiddleware, exportUserTemplate);
router.post('/users/import', authMiddleware, upload.single('file'), (req: any, res: Response) => importUsers(req, res));

// Lấy danh sách user
router.get('/users', authMiddleware, getUsers);
// Lấy thông tin 1 user
router.get('/users/:id', authMiddleware, getUser);
// Tạo user mới
router.post('/users', authMiddleware, createUser);
// Cập nhật user
router.put('/users/:id', authMiddleware, updateUser);
// Xóa user
router.delete('/users/:id', authMiddleware, deleteUser);

// ============ DEPARTMENT MANAGEMENT ============
router.get('/departments', authMiddleware, getDepartments);
router.post('/departments', authMiddleware, createDepartment);
router.put('/departments/:id', authMiddleware, updateDepartment);
router.delete('/departments/:id', authMiddleware, deleteDepartment);

// ============ POSITION MANAGEMENT ============
router.get('/positions', authMiddleware, getPositions);
router.post('/positions', authMiddleware, createPosition);
router.put('/positions/:id', authMiddleware, updatePosition);
router.delete('/positions/:id', authMiddleware, deletePosition);

// ============ SYSTEM CONFIG MANAGEMENT ============
router.get('/configs', authMiddleware, getConfigs);
router.post('/configs', authMiddleware, setConfig);
router.delete('/configs/:key', authMiddleware, deleteConfig);

// ============ ACADEMY MANAGEMENT ============
// Public academies (no auth required) - for dropdown
router.get('/academies/public', getPublicAcademies);
// Admin only academies
router.get('/academies', authMiddleware, getAcademies);
router.get('/academies/:id', authMiddleware, getAcademy);
router.post('/academies', authMiddleware, createAcademy);
router.put('/academies/:id', authMiddleware, updateAcademy);
router.delete('/academies/:id', authMiddleware, deleteAcademy);
router.get('/academies/:id/users', authMiddleware, getAcademyUsers);
router.post('/academies/:id/users', authMiddleware, addAcademyUser);
router.delete('/academies/:id/users/:userId', authMiddleware, removeAcademyUser);

// ============ LECTURER MANAGEMENT ============
router.get('/lecturers', authMiddleware, getLecturers);
router.post('/lecturers', authMiddleware, createLecturer);
router.put('/lecturers/:id', authMiddleware, updateLecturer);
router.delete('/lecturers/:id', authMiddleware, deleteLecturer);

// ============ QUESTION BANK MANAGEMENT ============
// Question Categories
router.get('/question-categories', authMiddleware, getQuestionCategories);
router.post('/question-categories', authMiddleware, createQuestionCategory);
router.put('/question-categories/:id', authMiddleware, updateQuestionCategory);
router.delete('/question-categories/:id', authMiddleware, deleteQuestionCategory);

// Questions (by category)
router.get('/question-categories/:categoryId/questions', authMiddleware, getQuestions);
router.post('/question-categories/:categoryId/questions', authMiddleware, createQuestion);
router.put('/questions/:id', authMiddleware, updateQuestion);
router.delete('/questions/:id', authMiddleware, deleteQuestion);

// Excel Import/Export
router.post('/question-categories/:categoryId/import', authMiddleware, upload.single('file'), importQuestions);
router.get('/questions/template', authMiddleware, exportQuestionTemplate);

// ============ EXAM SESSION MANAGEMENT ============
router.get('/exam-sessions', authMiddleware, getExamSessions);
router.post('/exam-sessions', authMiddleware, createExamSession);
router.put('/exam-sessions/:id', authMiddleware, updateExamSession);
router.delete('/exam-sessions/:id', authMiddleware, deleteExamSession);

// ============ REPORTS ============
router.get('/reports/dashboard', authMiddleware, getAdminDashboardReport);
router.get('/reports/overview', authMiddleware, getLearningOverviewReport);
router.get('/reports/overview/export', authMiddleware, exportLearningOverviewReportExcel);
router.get('/reports/time', authMiddleware, getLearningTimeReport);
router.get('/reports/time/detail', authMiddleware, getLearningTimeReportDetail);
router.get('/reports/time/export', authMiddleware, exportLearningTimeReportExcel);

export default router;
