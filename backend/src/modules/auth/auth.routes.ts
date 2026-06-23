import { Router, Response } from 'express';
import multer from 'multer';
import { login, refresh, logout, getProfile, getUsers, getUser, createUser, updateUser, deleteUser, getDepartments, createDepartment, updateDepartment, deleteDepartment, getPositions, createPosition, updatePosition, deletePosition, getConfigs, setConfig, deleteConfig, getPublicAcademies, getAcademies, getAcademy, createAcademy, updateAcademy, deleteAcademy, getAcademyUsers, addAcademyUser, removeAcademyUser, getLecturers, createLecturer, updateLecturer, deleteLecturer, importUsers, exportUserTemplate } from './auth.controller';
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

// Import/Export users
router.post('/users/import', authMiddleware, upload.single('file'), (req: any, res: Response) => importUsers(req, res));
router.get('/users/template', authMiddleware, exportUserTemplate);

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

export default router;
