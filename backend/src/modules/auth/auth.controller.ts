import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { prisma } from '../../config/db';
import { redisClient } from '../../config/redis';

// Multer file type (since we're using memory storage)
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

// Helper: Lấy mật khẩu mặc định từ cấu hình hệ thống
async function getDefaultPassword(): Promise<string> {
  const config = await prisma.systemConfig.findUnique({
    where: { configKey: 'DEFAULT_USER_PASSWORD' },
  });
  return config?.configValue || '123456';
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-key-12345';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 phút
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // 7 ngày

// User roles
type UserRole = 'USER' | 'ADMIN';

export const register = async (req: Request, res: Response) => {
  try {
    const { usercode, password, fullName, email, role } = req.body;

    if (!usercode) {
      res.status(400).json({ message: req.t('USERCODE_REQUIRED') });
      return;
    }
    if (!password) {
      res.status(400).json({ message: req.t('PASSWORD_REQUIRED') });
      return;
    }

    // Kiểm tra trùng lặp usercode
    const existingUser = await prisma.user.findUnique({
      where: { usercode },
    });
    if (existingUser) {
      res.status(400).json({ message: req.t('USERCODE_EXISTS') });
      return;
    }

    // Kiểm tra trùng lặp email (nếu có nhập)
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        res.status(400).json({ message: req.t('EMAIL_EXISTS') });
        return;
      }
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Xác định vai trò (Role: ADMIN hoặc USER)
    const userRole = role === 'ADMIN' ? 'ADMIN' : 'USER';

    // Tạo người dùng trong cơ sở dữ liệu
    const user = await prisma.user.create({
      data: {
        usercode,
        password: hashedPassword,
        fullName,
        email: email || null,
        role: userRole,
      },
    });

    res.status(201).json({
      message: req.t('REGISTER_SUCCESS'),
      user: {
        id: user.id,
        usercode: user.usercode,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { usercode, password } = req.body;

    if (!usercode) {
      res.status(400).json({ message: req.t('USERCODE_REQUIRED') });
      return;
    }
    if (!password) {
      res.status(400).json({ message: req.t('PASSWORD_REQUIRED') });
      return;
    }

// Tìm kiếm user bằng usercode (include department and position)
    const user = await prisma.user.findUnique({
      where: { usercode },
      include: {
        department: true,
        position: true,
      },
    });
    if (!user) {
      res.status(401).json({ message: req.t('INVALID_CREDENTIALS') });
      return;
    }

    // Xác thực mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: req.t('INVALID_CREDENTIALS') });
      return;
    }

    // --- XỬ LÝ SINGLE ACTIVE SESSION ---
    // 1. Tạo sessionId ngẫu nhiên mới
    const sessionId = crypto.randomUUID();

    // 2. Ghi đè sessionId hiện tại trên Redis (hạn 7 ngày)
    const redisKey = `user_session:${user.id}`;
    await redisClient.set(redisKey, sessionId, {
      EX: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
    });

    // 3. Xóa các Refresh Token cũ của user này trong CSDL
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    // --- CẤP TOKEN MỚI ---
    // Access Token (15 phút)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        usercode: user.usercode,
        role: user.role,
        sessionId,
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Refresh Token (7 ngày)
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
      data: {
        token: rawRefreshToken,
        userId: user.id,
        expiresAt,
      },
    });

res.status(200).json({
      message: req.t('LOGIN_SUCCESS'),
      user: {
        id: user.id,
        usercode: user.usercode,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department ? {
          id: user.department.id,
          name_vi: user.department.name_vi,
          name_en: user.department.name_en,
          name_zh: user.department.name_zh,
          code: user.department.code,
        } : null,
        position: user.position ? {
          id: user.position.id,
          name_vi: user.position.name_vi,
          name_en: user.position.name_en,
          name_zh: user.position.name_zh,
          code: user.position.code,
        } : null,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ message: req.t('REFRESH_TOKEN_INVALID') });
      return;
    }

    // Tìm kiếm Refresh Token trong CSDL
    const dbToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    // Nếu không tìm thấy hoặc đã hết hạn
    if (!dbToken || dbToken.expiresAt < new Date()) {
      res.status(401).json({ message: req.t('REFRESH_TOKEN_INVALID') });
      return;
    }

    const user = dbToken.user;

    // Lấy sessionId hiện tại của người dùng từ Redis
    let sessionId = await redisClient.get(`user_session:${user.id}`);
    
    // Nếu session bị xóa do một nguyên nhân nào đó, tạo lại sessionId mới
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      await redisClient.set(`user_session:${user.id}`, sessionId, {
        EX: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
      });
    }

    // Cấp Access Token mới
    const accessToken = jwt.sign(
      {
        userId: user.id,
        usercode: user.usercode,
        role: user.role,
        sessionId,
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    res.status(200).json({
      accessToken,
    });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    if (req.user) {
      // Xóa session trên Redis
      await redisClient.del(`user_session:${req.user.id}`);
      
      // Xóa tất cả Refresh Token của user trong CSDL
      await prisma.refreshToken.deleteMany({
        where: { userId: req.user.id },
      });
    }

    res.status(200).json({ message: req.t('LOGOUT_SUCCESS') });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: req.t('UNAUTHORIZED') });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        department: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            code: true,
          },
        },
        position: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            code: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ message: req.t('UNAUTHORIZED') });
      return;
    }

    res.status(200).json({
      user: {
        id: user.id,
        usercode: user.usercode,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
        position: user.position,
      },
    });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// ============ ADMIN USER MANAGEMENT FUNCTIONS ============

// Get all users (Admin only)
export const getUsers = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

const users = await prisma.user.findMany({
      select: {
        id: true,
        usercode: true,
        fullName: true,
        email: true,
        role: true,
        departmentId: true,
        positionId: true,
        department: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            code: true,
          },
        },
        position: {
          select: {
            id: true,
            name_vi: true,
            name_en: true,
            name_zh: true,
            code: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Get single user (Admin only)
export const getUser = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = safeParamString(req.params.id);
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        usercode: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: req.t('USER_NOT_FOUND') });
      return;
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Helper to safely extract string from body
const safeBodyString = (val: any): string | undefined => {
  if (!val) return undefined;
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && val.length > 0) return String(val[0]);
  return String(val);
};

// Helper to safely extract param string
const safeParamString = (val: string | string[] | undefined): string => {
  if (!val) return '';
  return Array.isArray(val) ? val[0] : val;
};

type LearningOverviewRow = {
  userId: number;
  usercode: string;
  fullName: string;
  department: string;
  position: string;
  studyHours: number;
  completedCourses: number;
  passedExams: number;
};

const ensureReportExamAttemptsTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS exam_attempts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      exam_session_id INTEGER NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
      training_plan_id INTEGER REFERENCES training_plans(id) ON DELETE SET NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'ONGOING',
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMP,
      score NUMERIC(5,2),
      passed BOOLEAN,
      total_questions INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      unanswered_count INTEGER NOT NULL DEFAULT 0,
      cheat_warnings INTEGER NOT NULL DEFAULT 0,
      is_fraud BOOLEAN NOT NULL DEFAULT false,
      time_spent_seconds INTEGER NOT NULL DEFAULT 0,
      question_order JSONB NOT NULL DEFAULT '[]'::jsonb,
      answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
};

const buildLearningOverviewData = async (filters: { usercode?: string; departmentId?: number }) => {
  const users = await prisma.user.findMany({
    where: {
      ...(filters.usercode
        ? {
            usercode: {
              contains: filters.usercode,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    },
    select: {
      id: true,
      usercode: true,
      fullName: true,
      department: {
        select: {
          name_vi: true,
          code: true,
        },
      },
      position: {
        select: {
          name_vi: true,
          code: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (users.length === 0) {
    return {
      summary: {
        totalLearners: 0,
        totalStudyHours: 0,
        totalCompletedCourses: 0,
        totalPassedExams: 0,
      },
      rows: [] as LearningOverviewRow[],
    };
  }

  const userIds = users.map((user) => user.id);

  const [allLessons, progressRows] = await Promise.all([
    prisma.lesson.findMany({
      select: {
        id: true,
        courseId: true,
      },
    }),
    prisma.learningProgress.findMany({
      where: {
        userId: { in: userIds },
      },
      select: {
        userId: true,
        completed: true,
        watchedSeconds: true,
        lesson: {
          select: {
            courseId: true,
            video: {
              select: {
                duration: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const totalLessonsByCourse = new Map<number, number>();
  allLessons.forEach((lesson) => {
    const current = totalLessonsByCourse.get(lesson.courseId) || 0;
    totalLessonsByCourse.set(lesson.courseId, current + 1);
  });

  const completedLessonsByUserCourse = new Map<string, number>();
  const watchedSecondsByUser = new Map<number, number>();

  progressRows.forEach((row) => {
    const duration = row.lesson.video?.duration;
    const rawWatchedSeconds = Number(row.watchedSeconds || 0);
    const safeWatchedSeconds = duration && duration > 0
      ? Math.max(0, Math.min(rawWatchedSeconds, duration))
      : Math.max(0, rawWatchedSeconds);

    watchedSecondsByUser.set(row.userId, (watchedSecondsByUser.get(row.userId) || 0) + safeWatchedSeconds);

    if (!row.completed) {
      return;
    }

    const courseKey = `${row.userId}:${row.lesson.courseId}`;
    completedLessonsByUserCourse.set(courseKey, (completedLessonsByUserCourse.get(courseKey) || 0) + 1);
  });

  await ensureReportExamAttemptsTable();

  const examAttempts = await prisma.$queryRawUnsafe<Array<{ user_id: number; exam_session_id: number }>>(
    `
      SELECT DISTINCT user_id, exam_session_id
      FROM exam_attempts
      WHERE user_id IN (${userIds.join(',')})
        AND passed = true
        AND status <> 'ONGOING'
    `
  );

  const passedExamsByUser = new Map<number, number>();
  examAttempts.forEach((attempt) => {
    passedExamsByUser.set(attempt.user_id, (passedExamsByUser.get(attempt.user_id) || 0) + 1);
  });

  const rows: LearningOverviewRow[] = users.map((user) => {
    let completedCourses = 0;

    totalLessonsByCourse.forEach((totalLessons, courseId) => {
      if (totalLessons <= 0) return;
      const completedLessons = completedLessonsByUserCourse.get(`${user.id}:${courseId}`) || 0;
      if (completedLessons >= totalLessons) {
        completedCourses += 1;
      }
    });

    const studyHours = Number(((watchedSecondsByUser.get(user.id) || 0) / 3600).toFixed(2));

    return {
      userId: user.id,
      usercode: user.usercode,
      fullName: user.fullName || '',
      department: user.department?.name_vi || user.department?.code || '-',
      position: user.position?.name_vi || user.position?.code || '-',
      studyHours,
      completedCourses,
      passedExams: passedExamsByUser.get(user.id) || 0,
    };
  });

  const summary = {
    totalLearners: rows.length,
    totalStudyHours: Number(rows.reduce((sum, row) => sum + row.studyHours, 0).toFixed(2)),
    totalCompletedCourses: rows.reduce((sum, row) => sum + row.completedCourses, 0,
    ),
    totalPassedExams: rows.reduce((sum, row) => sum + row.passedExams, 0),
  };

  return {
    summary,
    rows,
  };
};

export const getLearningOverviewReport = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const usercode = safeParamString(req.query.usercode as string | string[] | undefined).trim();
    const departmentIdRaw = safeParamString(req.query.departmentId as string | string[] | undefined).trim();
    const departmentId = departmentIdRaw ? parseInt(departmentIdRaw, 10) : undefined;

    const reportData = await buildLearningOverviewData({
      usercode: usercode || undefined,
      departmentId: departmentId && !isNaN(departmentId) ? departmentId : undefined,
    });

    res.status(200).json(reportData);
  } catch (error) {
    console.error('getLearningOverviewReport error:', error);
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export const exportLearningOverviewReportExcel = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const usercode = safeParamString(req.query.usercode as string | string[] | undefined).trim();
    const departmentIdRaw = safeParamString(req.query.departmentId as string | string[] | undefined).trim();
    const departmentId = departmentIdRaw ? parseInt(departmentIdRaw, 10) : undefined;

    const reportData = await buildLearningOverviewData({
      usercode: usercode || undefined,
      departmentId: departmentId && !isNaN(departmentId) ? departmentId : undefined,
    });

    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Tổng quan');
    const detailSheet = workbook.addWorksheet('Chi tiết');

    summarySheet.columns = [
      { header: 'Chỉ số', key: 'metric', width: 30 },
      { header: 'Giá trị', key: 'value', width: 20 },
    ];

    summarySheet.addRows([
      { metric: 'Tổng số học viên', value: reportData.summary.totalLearners },
      { metric: 'Thời gian học (giờ)', value: reportData.summary.totalStudyHours },
      { metric: 'Số lượng khóa học', value: reportData.summary.totalCompletedCourses },
      { metric: 'Số lượng thi đạt', value: reportData.summary.totalPassedExams },
    ]);

    detailSheet.columns = [
      { header: 'Mã số', key: 'usercode', width: 18 },
      { header: 'Tên', key: 'fullName', width: 28 },
      { header: 'Phòng ban', key: 'department', width: 24 },
      { header: 'Chức vụ', key: 'position', width: 24 },
      { header: 'Số giờ đã học', key: 'studyHours', width: 18 },
      { header: 'Số lượng khóa học', key: 'completedCourses', width: 14 },
      { header: 'Số lượng thi đạt', key: 'passedExams', width: 12 },
    ];

    detailSheet.addRows(
      reportData.rows.map((row) => ({
        usercode: row.usercode,
        fullName: row.fullName,
        department: row.department,
        position: row.position,
        studyHours: row.studyHours,
        completedCourses: row.completedCourses,
        passedExams: row.passedExams,
      }))
    );

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `learning-overview-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('exportLearningOverviewReportExcel error:', error);
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Create new user (Admin only)
export const createUser = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const usercode = safeBodyString(req.body.usercode);
    const password = safeBodyString(req.body.password);
    const fullName = safeBodyString(req.body.fullName);
    const email = safeBodyString(req.body.email);
    const role = safeBodyString(req.body.role);
    const departmentId = req.body.departmentId ? parseInt(String(req.body.departmentId)) : null;
    const positionId = req.body.positionId ? parseInt(String(req.body.positionId)) : null;

    if (!usercode) {
      res.status(400).json({ message: req.t('USERCODE_REQUIRED') });
      return;
    }
    
    // Use default password if not provided
    const finalPassword = password || await getDefaultPassword();

    // Check duplicate usercode
    const existingUser = await prisma.user.findUnique({
      where: { usercode },
    });
    if (existingUser) {
      res.status(400).json({ message: req.t('USERCODE_EXISTS') });
      return;
    }

// Check duplicate email
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        res.status(400).json({ message: req.t('EMAIL_EXISTS') });
        return;
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    // Determine role
    const userRole: UserRole = role === 'ADMIN' ? 'ADMIN' : 'USER';

    // Create user
    const user = await prisma.user.create({
      data: {
        usercode,
        password: hashedPassword,
        fullName,
        email: email || null,
        role: userRole,
        departmentId: departmentId || null,
        positionId: positionId || null,
      },
      select: {
        id: true,
        usercode: true,
        fullName: true,
        email: true,
        role: true,
        departmentId: true,
        positionId: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: req.t('USER_CREATED_SUCCESS'),
      user,
    });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Update user (Admin only)
export const updateUser = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = safeParamString(req.params.id);
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

const usercode = safeBodyString(req.body.usercode);
    const fullName = safeBodyString(req.body.fullName);
    const email = safeBodyString(req.body.email);
    const role = safeBodyString(req.body.role);
    const password = safeBodyString(req.body.password);
    const departmentId = req.body.departmentId !== undefined ? (req.body.departmentId ? parseInt(String(req.body.departmentId)) : null) : undefined;
    const positionId = req.body.positionId !== undefined ? (req.body.positionId ? parseInt(String(req.body.positionId)) : null) : undefined;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      res.status(404).json({ message: req.t('USER_NOT_FOUND') });
      return;
    }

    // Check duplicate usercode (if changed)
    if (usercode && usercode !== existingUser.usercode) {
      const duplicateUser = await prisma.user.findUnique({
        where: { usercode },
      });
      if (duplicateUser) {
        res.status(400).json({ message: req.t('USERCODE_EXISTS') });
        return;
      }
    }

// Check duplicate email (if changed)
    if (email && email !== existingUser.email) {
      const duplicateEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (duplicateEmail) {
        res.status(400).json({ message: req.t('EMAIL_EXISTS') });
        return;
      }
    }

// Prepare update data
    const updateData: any = {};
    if (usercode) updateData.usercode = usercode;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email || null;
    if (role) updateData.role = role === 'ADMIN' ? 'ADMIN' : 'USER';
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (positionId !== undefined) updateData.positionId = positionId;

// Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        usercode: true,
        fullName: true,
        email: true,
        role: true,
        departmentId: true,
        positionId: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      message: req.t('USER_UPDATED_SUCCESS'),
      user,
    });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Delete user (Admin only)
export const deleteUser = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = safeParamString(req.params.id);
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      res.status(404).json({ message: req.t('USER_NOT_FOUND') });
      return;
    }

    // Prevent deleting yourself
    if (userId === req.user.id) {
      res.status(400).json({ message: req.t('CANNOT_DELETE_SELF') });
      return;
    }

    // Delete user (cascade will handle related records)
    // First delete refresh tokens
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // Then delete the user
    await prisma.user.delete({
      where: { id: userId },
    });

    res.status(200).json({ message: req.t('USER_DELETED_SUCCESS') });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// ============ DEPARTMENT MANAGEMENT ============

// Reuse safeBodyString for all string conversions
const getBodyString = safeBodyString;

// Get all departments
export const getDepartments = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const departments = await prisma.department.findMany({
      orderBy: { id: 'asc' },
    });

    res.status(200).json({ departments });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Create department
export const createDepartment = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const name_vi = getBodyString(req.body.name_vi);
    const name_en = getBodyString(req.body.name_en);
    const name_zh = getBodyString(req.body.name_zh);
    const code = getBodyString(req.body.code);
    const description = getBodyString(req.body.description);

    if (!name_vi || !code) {
      res.status(400).json({ message: 'name_vi and code are required' });
      return;
    }

    // Check duplicate code
    const existing = await prisma.department.findUnique({ where: { code } });
    if (existing) {
      res.status(400).json({ message: 'Department code already exists' });
      return;
    }

    const department = await prisma.department.create({
      data: { name_vi, name_en, name_zh, code, description },
    });

    res.status(201).json({ message: 'Department created successfully', department });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Update department
export const updateDepartment = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));
    const name_vi = getBodyString(req.body.name_vi);
    const name_en = getBodyString(req.body.name_en);
    const name_zh = getBodyString(req.body.name_zh);
    const description = getBodyString(req.body.description);

    const department = await prisma.department.update({
      where: { id },
      data: { name_vi, name_en, name_zh, description },
    });

    res.status(200).json({ message: 'Department updated successfully', department });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Delete department
export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));

    await prisma.department.delete({ where: { id } });

    res.status(200).json({ message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// ============ POSITION MANAGEMENT ============

// Get all positions
export const getPositions = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const positions = await prisma.position.findMany({
      orderBy: { id: 'asc' },
    });

    res.status(200).json({ positions });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Create position
export const createPosition = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const name_vi = getBodyString(req.body.name_vi);
    const name_en = getBodyString(req.body.name_en);
    const name_zh = getBodyString(req.body.name_zh);
    const code = getBodyString(req.body.code);
    const description = getBodyString(req.body.description);

    if (!name_vi || !code) {
      res.status(400).json({ message: 'name_vi and code are required' });
      return;
    }

    // Check duplicate code
    const existing = await prisma.position.findUnique({ where: { code } });
    if (existing) {
      res.status(400).json({ message: 'Position code already exists' });
      return;
    }

    const position = await prisma.position.create({
      data: { name_vi, name_en, name_zh, code, description },
    });

    res.status(201).json({ message: 'Position created successfully', position });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Update position
export const updatePosition = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));
    const name_vi = getBodyString(req.body.name_vi);
    const name_en = getBodyString(req.body.name_en);
    const name_zh = getBodyString(req.body.name_zh);
    const description = getBodyString(req.body.description);

    const position = await prisma.position.update({
      where: { id },
      data: { name_vi, name_en, name_zh, description },
    });

    res.status(200).json({ message: 'Position updated successfully', position });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Delete position
export const deletePosition = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));

    await prisma.position.delete({ where: { id } });

    res.status(200).json({ message: 'Position deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// ============ SYSTEM CONFIG MANAGEMENT ============

// Get all configs
export const getConfigs = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const configs = await prisma.systemConfig.findMany({
      orderBy: { configKey: 'asc' },
    });

    res.status(200).json({ configs });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Create or update config
export const setConfig = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const configKey = getBodyString(req.body.configKey);
    const configValue = getBodyString(req.body.configValue);
    const description = getBodyString(req.body.description);

    if (!configKey || !configValue) {
      res.status(400).json({ message: 'Config key and value are required' });
      return;
    }

    // Upsert - create or update
    const config = await prisma.systemConfig.upsert({
      where: { configKey },
      update: { configValue, description },
      create: { configKey, configValue, description },
    });

    res.status(200).json({ message: 'Config saved successfully', config });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Delete config
export const deleteConfig = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const configKey = String(req.params.key);

    if (!configKey) {
      res.status(400).json({ message: 'Config key is required' });
      return;
    }

    await prisma.systemConfig.delete({ where: { configKey } });

    res.status(200).json({ message: 'Config deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// ============ ACADEMY MANAGEMENT ============

// Get public academies (no auth required) - for public dropdown
export const getPublicAcademies = async (req: Request, res: Response) => {
  try {
    const academies = await prisma.academy.findMany({
      where: { isPublic: true },
      orderBy: { id: 'asc' },
    });

    res.status(200).json({ academies });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Get all academies (admin only)
export const getAcademies = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const academies = await prisma.academy.findMany({
      orderBy: { id: 'asc' },
      include: {
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
                usercode: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    // Transform to add users array
    const result = academies.map(academy => ({
      ...academy,
      users: academy.enrollments.map(e => e.user),
      enrollments: undefined, // Remove raw enrollments
    }));

    res.status(200).json({ academies: result });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Get single academy
export const getAcademy = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));

    if (isNaN(id)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    const academy = await prisma.academy.findUnique({
      where: { id },
    });

    if (!academy) {
      res.status(404).json({ message: 'Academy not found' });
      return;
    }

    res.status(200).json({ academy });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Create academy
export const createAcademy = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const name_vi = getBodyString(req.body.name_vi);
    const name_en = getBodyString(req.body.name_en);
    const name_zh = getBodyString(req.body.name_zh);
    const code = getBodyString(req.body.code);
    const description = getBodyString(req.body.description);
    const isPublic = req.body.isPublic === true;

    if (!name_vi || !code) {
      res.status(400).json({ message: 'name_vi and code are required' });
      return;
    }

    // Check duplicate code
    const existing = await prisma.academy.findUnique({ where: { code } });
    if (existing) {
      res.status(400).json({ message: 'Academy code already exists' });
      return;
    }

    const academy = await prisma.academy.create({
      data: { name_vi, name_en, name_zh, code, description, isPublic },
    });

    res.status(201).json({ message: 'Academy created successfully', academy });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Update academy
export const updateAcademy = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));
    const name_vi = getBodyString(req.body.name_vi);
    const name_en = getBodyString(req.body.name_en);
    const name_zh = getBodyString(req.body.name_zh);
    const description = getBodyString(req.body.description);
    const isPublic = req.body.isPublic !== undefined ? req.body.isPublic === true : undefined;

    const academy = await prisma.academy.update({
      where: { id },
      data: { name_vi, name_en, name_zh, description, isPublic },
    });

    res.status(200).json({ message: 'Academy updated successfully', academy });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Delete academy
export const deleteAcademy = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));

    // Delete enrollments first
    await prisma.academyEnrollment.deleteMany({ where: { academyId: id } });

    // Then delete academy
    await prisma.academy.delete({ where: { id } });

    res.status(200).json({ message: 'Academy deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Get academy users (when isPublic = false)
export const getAcademyUsers = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const academyId = parseInt(safeParamString(req.params.id));

    if (isNaN(academyId)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    const enrollments = await prisma.academyEnrollment.findMany({
      where: { academyId },
      include: {
        user: {
          select: {
            id: true,
            usercode: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json({ users: enrollments.map(e => e.user) });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Add user to academy
export const addAcademyUser = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const academyId = parseInt(safeParamString(req.params.id));
    const userId = req.body.userId ? parseInt(String(req.body.userId)) : null;

    if (isNaN(academyId) || !userId) {
      res.status(400).json({ message: 'academyId and userId are required' });
      return;
    }

    // Check if academy exists
    const academy = await prisma.academy.findUnique({ where: { id: academyId } });
    if (!academy) {
      res.status(404).json({ message: 'Academy not found' });
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Create enrollment
    const enrollment = await prisma.academyEnrollment.create({
      data: { academyId, userId },
      include: {
        user: {
          select: {
            id: true,
            usercode: true,
            fullName: true,
          },
        },
      },
    });

    res.status(201).json({ message: 'User added to academy', user: enrollment.user });
  } catch (error: any) {
    // P2002 is unique constraint violation (already exists)
    if (error.code === 'P2002') {
      res.status(400).json({ message: 'User already in academy' });
      return;
    }
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Remove user from academy
export const removeAcademyUser = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const academyId = parseInt(safeParamString(req.params.id));
    const userId = parseInt(safeParamString(req.params.userId));

    if (isNaN(academyId) || isNaN(userId)) {
      res.status(400).json({ message: 'academyId and userId are required' });
      return;
    }

    await prisma.academyEnrollment.deleteMany({
      where: { academyId, userId },
    });

    res.status(200).json({ message: 'User removed from academy' });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// ============ LECTURER MANAGEMENT ============

// Get all lecturers
export const getLecturers = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const { search, type } = req.query;
    
    // Build filter conditions
    const where: any = {};
    
    // Filter by type (INTERNAL or EXTERNAL)
    if (type && (type === 'INTERNAL' || type === 'EXTERNAL')) {
      where.type = type;
    }
    
    // Search by code (contains)
    if (search) {
      where.code = { contains: String(search), mode: 'insensitive' };
    }

    const lecturers = await prisma.lecturer.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    res.status(200).json({ lecturers });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Create lecturer
export const createLecturer = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const code = getBodyString(req.body.code);
    const name = getBodyString(req.body.name);
    const type = getBodyString(req.body.type) || 'INTERNAL';
    const gender = getBodyString(req.body.gender) || 'MALE';
    const phone = getBodyString(req.body.phone);
    const email = getBodyString(req.body.email);
    const address = getBodyString(req.body.address);

    if (!code) {
      res.status(400).json({ message: 'Lecturer code is required' });
      return;
    }

    // Check duplicate code
    const existing = await prisma.lecturer.findUnique({ where: { code } });
    if (existing) {
      res.status(400).json({ message: 'Lecturer code already exists' });
      return;
    }

    // Validate EXTERNAL requires email and address
    if (type === 'EXTERNAL' && !email) {
      res.status(400).json({ message: 'Email is required for external lecturers' });
      return;
    }

    const lecturer = await prisma.lecturer.create({
      data: {
        code,
        name,
        type: type as 'INTERNAL' | 'EXTERNAL',
        gender: gender as 'MALE' | 'FEMALE',
        phone,
        email: type === 'EXTERNAL' ? email : null,
        address: type === 'EXTERNAL' ? address : null,
      },
    });

    res.status(201).json({ message: 'Lecturer created successfully', lecturer });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Update lecturer
export const updateLecturer = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    const name = getBodyString(req.body.name);
    const type = getBodyString(req.body.type);
    const gender = getBodyString(req.body.gender);
    const phone = getBodyString(req.body.phone);
    const email = getBodyString(req.body.email);
    const address = getBodyString(req.body.address);

    // Check if lecturer exists
    const existing = await prisma.lecturer.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Lecturer not found' });
      return;
    }

    // Check duplicate code (if changed)
    const code = getBodyString(req.body.code);
    if (code && code !== existing.code) {
      const duplicate = await prisma.lecturer.findUnique({ where: { code } });
      if (duplicate) {
        res.status(400).json({ message: 'Lecturer code already exists' });
        return;
      }
    }

    // Validate EXTERNAL requires email
    const finalType = type || existing.type;
    if (finalType === 'EXTERNAL' && !email && !existing.email) {
      res.status(400).json({ message: 'Email is required for external lecturers' });
      return;
    }

    const lecturer = await prisma.lecturer.update({
      where: { id },
      data: {
        code: code || existing.code,
        name: name !== undefined ? name : existing.name,
        type: type ? (type as 'INTERNAL' | 'EXTERNAL') : undefined,
        gender: gender ? (gender as 'MALE' | 'FEMALE') : undefined,
        phone: phone !== undefined ? phone : existing.phone,
        email: finalType === 'EXTERNAL' ? (email || existing.email) : null,
        address: finalType === 'EXTERNAL' ? (address || existing.address) : null,
      },
    });

    res.status(200).json({ message: 'Lecturer updated successfully', lecturer });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Delete lecturer
export const deleteLecturer = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    // Check if lecturer exists
    const existing = await prisma.lecturer.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Lecturer not found' });
      return;
    }

    await prisma.lecturer.delete({ where: { id } });

    res.status(200).json({ message: 'Lecturer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// ============ QUESTION BANK MANAGEMENT ============

// Helper to get string value from any cell
const getCellValue = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) return String(val[0] || '').trim();
  return String(val).trim();
};

const normalizeHeaderKey = (key: string): string =>
  key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const getRowValue = (row: Record<string, any>, candidateKeys: string[]): string => {
  const normalizedMap = new Map<string, any>();

  Object.keys(row).forEach((k) => {
    normalizedMap.set(normalizeHeaderKey(k), row[k]);
  });

  for (const key of candidateKeys) {
    const value = normalizedMap.get(normalizeHeaderKey(key));
    const normalizedValue = getCellValue(value);
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return '';
};

// Get all question categories
export const getQuestionCategories = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const { academyId, search } = req.query;

    // Build filter
    const where: any = {};
    if (academyId) {
      where.academyId = parseInt(String(academyId));
    }
    if (search) {
      where.name_vi = { contains: String(search), mode: 'insensitive' };
    }

    const categories = await prisma.questionCategory.findMany({
      where,
      include: {
        academy: {
          select: { id: true, name_vi: true, name_en: true, name_zh: true, code: true },
        },
        _count: { select: { questions: true } },
      },
      orderBy: { id: 'desc' },
    });

    res.status(200).json({ categories });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Create question category
export const createQuestionCategory = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const name_vi = getBodyString(req.body.name_vi);
    const name_en = getBodyString(req.body.name_en);
    const name_zh = getBodyString(req.body.name_zh);
    const description = getBodyString(req.body.description);
    const academyId = req.body.academyId ? parseInt(String(req.body.academyId)) : null;

    if (!name_vi || !academyId) {
      res.status(400).json({ message: 'name_vi and academyId are required' });
      return;
    }

    // Check if academy exists
    const academy = await prisma.academy.findUnique({ where: { id: academyId } });
    if (!academy) {
      res.status(404).json({ message: 'Academy not found' });
      return;
    }

    const category = await prisma.questionCategory.create({
      data: { name_vi, name_en, name_zh, description, academyId },
    });

    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ message: 'Category name already exists for this academy' });
      return;
    }
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Update question category
export const updateQuestionCategory = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    const name_vi = getBodyString(req.body.name_vi);
    const name_en = getBodyString(req.body.name_en);
    const name_zh = getBodyString(req.body.name_zh);
    const description = getBodyString(req.body.description);

    const category = await prisma.questionCategory.update({
      where: { id },
      data: { name_vi, name_en, name_zh, description },
    });

    res.status(200).json({ message: 'Category updated successfully', category });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Delete question category
export const deleteQuestionCategory = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    // Delete all questions in this category first (cascade)
    await prisma.question.deleteMany({ where: { categoryId: id } });
    await prisma.questionCategory.delete({ where: { id } });

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Get questions by category
export const getQuestions = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const categoryId = parseInt(safeParamString(req.params.categoryId));
    if (isNaN(categoryId)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    const questions = await prisma.question.findMany({
      where: { categoryId },
      include: {
        options: { orderBy: { order: 'asc' } },
      },
      orderBy: { id: 'desc' },
    });

    res.status(200).json({ questions });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Create question
export const createQuestion = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const categoryId = parseInt(safeParamString(req.params.categoryId));
    if (isNaN(categoryId)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    const question_vi = getBodyString(req.body.question_vi);
    const question_en = getBodyString(req.body.question_en);
    const question_zh = getBodyString(req.body.question_zh);
    const type = getBodyString(req.body.type);
    const difficulty = getBodyString(req.body.difficulty) || 'MEDIUM';
    const correctAnswer = req.body.correctAnswer;

    if (!question_vi || !type) {
      res.status(400).json({ message: 'question_vi and type are required' });
      return;
    }

    // Validate question type
    const validTypes = ['FILL_BLANK', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ message: 'Invalid question type' });
      return;
    }

    const question = await prisma.question.create({
      data: {
        question_vi,
        question_en,
        question_zh,
        type: type as 'FILL_BLANK' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE',
        difficulty: difficulty as 'EASY' | 'MEDIUM' | 'HARD',
        correctAnswer: correctAnswer || null,
        categoryId,
      },
    });

    res.status(201).json({ message: 'Question created successfully', question });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Update question
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    const question_vi = getBodyString(req.body.question_vi);
    const question_en = getBodyString(req.body.question_en);
    const question_zh = getBodyString(req.body.question_zh);
    const type = getBodyString(req.body.type);
    const difficulty = getBodyString(req.body.difficulty);
    const correctAnswer = req.body.correctAnswer;

    const question = await prisma.question.update({
      where: { id },
      data: {
        question_vi,
        question_en,
        question_zh,
        type: type ? (type as 'FILL_BLANK' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE') : undefined,
        difficulty: difficulty ? (difficulty as 'EASY' | 'MEDIUM' | 'HARD') : undefined,
        correctAnswer,
      },
    });

    res.status(200).json({ message: 'Question updated successfully', question });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Delete question
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const id = parseInt(safeParamString(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ message: req.t('INVALID_ID') });
      return;
    }

    await prisma.question.delete({ where: { id } });

    res.status(200).json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Import questions from Excel
export const importQuestions = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const categoryId = parseInt(safeParamString(req.params.categoryId));
    if (isNaN(categoryId)) {
      res.status(400).json({ message: 'Invalid category ID' });
      return;
    }

    // Verify category exists
    const category = await prisma.questionCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
      res.status(404).json({ message: 'Category not found' });
      return;
    }

    // Parse Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

    if (!data || data.length === 0) {
      res.status(400).json({ message: 'Excel file is empty' });
      return;
    }

    const results = { success: 0, failed: 0, errors: [] as string[] };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;

      try {
        const question_vi = getRowValue(row, ['question_vi', 'Câu hỏi (VN)', 'Câu hỏi (Tiếng Việt)']);
        const question_en = getRowValue(row, ['question_en', 'Question (EN)', 'Question (English)']);
        const question_zh = getRowValue(row, ['question_zh', '问题 (CN)', '问题 (中文)']);
        const typeRaw = getRowValue(row, ['type', 'Loại câu hỏi']) || 'SINGLE_CHOICE';
        const difficultyRaw = getRowValue(row, ['difficulty', 'Độ khó']) || 'MEDIUM';
        const correctAnswerStr = getRowValue(row, ['correctAnswer', 'correct_answer', 'Đáp án đúng']);
        
        // Map question type
        let type = 'SINGLE_CHOICE';
        const typeMap: Record<string, string> = {
          'fill_blank': 'FILL_BLANK', 'điền câu từ': 'FILL_BLANK', 'fill blank': 'FILL_BLANK',
          'single_choice': 'SINGLE_CHOICE', 'trắc nghiệm 1 lựa chọn': 'SINGLE_CHOICE', 'single': 'SINGLE_CHOICE',
          'multiple_choice': 'MULTIPLE_CHOICE', 'trắc nghiệm nhiều lựa chọn': 'MULTIPLE_CHOICE', 'multiple': 'MULTIPLE_CHOICE',
          'true_false': 'TRUE_FALSE', 'chọn đúng sai': 'TRUE_FALSE', 'true/false': 'TRUE_FALSE',
        };
        if (typeMap[typeRaw.toLowerCase()]) {
          type = typeMap[typeRaw.toLowerCase()];
        }

        // Map difficulty
        let difficulty = 'MEDIUM';
        const diffMap: Record<string, string> = {
          'easy': 'EASY', 'dễ': 'EASY',
          'medium': 'MEDIUM', 'trung bình': 'MEDIUM', 'trungbinh': 'MEDIUM',
          'hard': 'HARD', 'khó': 'HARD',
        };
        if (diffMap[difficultyRaw.toLowerCase()]) {
          difficulty = diffMap[difficultyRaw.toLowerCase()];
        }

        if (!question_vi) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Missing question content`);
          continue;
        }

        // Parse correct answer - could be single value or array
        let correctAnswer: any = correctAnswerStr;
        if (type === 'MULTIPLE_CHOICE') {
          // Split by comma for multiple correct answers
          correctAnswer = correctAnswerStr.split(',').map((s: string) => s.trim());
        }

        // Create question
        const question = await prisma.question.create({
          data: {
            question_vi,
            question_en: question_en || null,
            question_zh: question_zh || null,
            type: type as 'FILL_BLANK' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE',
            difficulty: difficulty as 'EASY' | 'MEDIUM' | 'HARD',
            correctAnswer,
            categoryId,
          },
        });

        // Process options if needed (for choice types)
        if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE') {
          const option1 = getRowValue(row, ['option_a', 'option1_vi', 'Lựa chọn 1 (VN)', 'Đáp án A', 'Option A']);
          const option2 = getRowValue(row, ['option_b', 'option2_vi', 'Lựa chọn 2 (VN)', 'Đáp án B', 'Option B']);
          const option3 = getRowValue(row, ['option_c', 'option3_vi', 'Lựa chọn 3 (VN)', 'Đáp án C', 'Option C']);
          const option4 = getRowValue(row, ['option_d', 'option4_vi', 'Lựa chọn 4 (VN)', 'Đáp án D', 'Option D']);

          const optionFields = [
            option1,
            option2,
            option3,
            option4,
          ];

          const options = optionFields.filter(o => getCellValue(o)).map((opt: any, idx: number) => ({
            option_vi: getCellValue(opt),
            order: idx,
            questionId: question.id,
          }));

          if (options.length > 0) {
            await prisma.questionOption.createMany({ data: options });
          }
        }

        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: ${err.message}`);
      }
    }

    res.status(200).json({
      message: `Import completed: ${results.success} success, ${results.failed} failed`,
      imported: results.success,
      failed: results.failed,
      errors: results.errors,
      results,
    });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Export question template
export const exportQuestionTemplate = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const templateSheet = workbook.addWorksheet('Questions');
    const guideSheet = workbook.addWorksheet('HuongDan');

    const headers = [
      'question_vi',
      'question_en',
      'question_zh',
      'type',
      'difficulty',
      'correctAnswer',
      'option1_vi',
      'option2_vi',
      'option3_vi',
      'option4_vi',
    ];

    templateSheet.addRow(headers);
    templateSheet.addRow([
      'Câu hỏi mẫu tiếng Việt',
      'Sample question in English',
      '中文示例问题',
      'SINGLE_CHOICE',
      'EASY',
      'A',
      'Đáp án A',
      'Đáp án B',
      'Đáp án C',
      'Đáp án D',
    ]);
    templateSheet.addRow([
      'Câu hỏi điền từ mẫu',
      'Fill blank sample',
      '填空题示例',
      'FILL_BLANK',
      'MEDIUM',
      'Đáp án đúng',
      '',
      '',
      '',
      '',
    ]);

    templateSheet.columns = [
      { key: 'question_vi', width: 34 },
      { key: 'question_en', width: 34 },
      { key: 'question_zh', width: 28 },
      { key: 'type', width: 24 },
      { key: 'difficulty', width: 14 },
      { key: 'correctAnswer', width: 18 },
      { key: 'option1_vi', width: 24 },
      { key: 'option2_vi', width: 24 },
      { key: 'option3_vi', width: 24 },
      { key: 'option4_vi', width: 24 },
    ];

    const headerRow = templateSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1D4ED8' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    templateSheet.views = [{ state: 'frozen', ySplit: 1 }];

    const typeOptions = ['FILL_BLANK', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'];
    const difficultyOptions = ['EASY', 'MEDIUM', 'HARD'];

    for (let row = 2; row <= 500; row++) {
      templateSheet.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`"${typeOptions.join(',')}"`],
        showErrorMessage: true,
        error: 'Giá trị không hợp lệ. Hãy chọn trong danh sách.',
      };
      templateSheet.getCell(`E${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`"${difficultyOptions.join(',')}"`],
        showErrorMessage: true,
        error: 'Giá trị không hợp lệ. Hãy chọn trong danh sách.',
      };
    }

    ['D2:D500', 'E2:E500'].forEach((range) => {
      const [start, end] = range.split(':');
      const startRow = parseInt(start.replace(/^[A-Z]+/, ''), 10);
      const endRow = parseInt(end.replace(/^[A-Z]+/, ''), 10);
      const column = start.replace(/[0-9]/g, '');
      for (let r = startRow; r <= endRow; r++) {
        const cell = templateSheet.getCell(`${column}${r}`);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF7ED' },
        };
      }
    });

    const guideLines = [
      'HUONG DAN NHAP CAU HOI',
      '1) Bat buoc: question_vi, type, difficulty, correctAnswer.',
      '2) type chi nhan: FILL_BLANK | SINGLE_CHOICE | MULTIPLE_CHOICE | TRUE_FALSE.',
      '3) difficulty chi nhan: EASY | MEDIUM | HARD.',
      '4) SINGLE_CHOICE: correctAnswer = A/B/C/D va can option1_vi..option4_vi.',
      '5) MULTIPLE_CHOICE: correctAnswer = A,B hoac A,C,D.',
      '6) FILL_BLANK: dien correctAnswer la dap an chuoi.',
      '7) TRUE_FALSE: correctAnswer co the TRUE/FALSE.',
    ];
    guideLines.forEach((line) => guideSheet.addRow([line]));
    guideSheet.getColumn(1).width = 120;
    guideSheet.getCell('A1').font = { bold: true, size: 13, color: { argb: '1F2937' } };

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=question_template.xlsx');
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// ============ IMPORT USERS FROM EXCEL ============

export const importUsers = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

// Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

    if (!data || data.length === 0) {
      res.status(400).json({ message: 'Excel file is empty' });
      return;
    }

    // Get default password from config
    const defaultPassword = await getDefaultPassword();
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Get all departments and positions for mapping
    const departments = await prisma.department.findMany();
    const positions = await prisma.position.findMany();

    const departmentMap = new Map(departments.map(d => [d.code, d.id]));
    const positionMap = new Map(positions.map(p => [p.code, p.id]));

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Helper to get string value from any
const getStringValue = (val: any): string => {
      if (typeof val === 'string') return val.trim();
      if (Array.isArray(val)) return String(val[0] || '').trim();
      if (val) return String(val).trim();
      return '';
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; //Excel row number (1-indexed + header)

      try {
        const usercode = getStringValue(row.usercode || row.Usercode || row['Mã người dùng']);
        const fullName = getStringValue(row.fullName || row.FullName || row['Họ tên']);
        const emailRaw = row.email || row.Email || row['Email'];
        const email = emailRaw ? getStringValue(emailRaw) : null;
        const roleRaw = row.role || row.Role || row['Quyền'];
        const role = roleRaw ? getStringValue(roleRaw).toUpperCase() : 'USER';
        const deptCode = getStringValue(row.departmentCode || row['Mã phòng ban']);
        const positionCode = getStringValue(row.positionCode || row['Mã chức vụ']);

        if (!usercode) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Missing usercode`);
          continue;
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { usercode } });
        if (existingUser) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Usercode "${usercode}" already exists`);
          continue;
        }

        // Validate email if provided
        if (email) {
          const existingEmail = await prisma.user.findUnique({ where: { email } });
          if (existingEmail) {
            results.failed++;
            results.errors.push(`Row ${rowNum}: Email "${email}" already exists`);
            continue;
          }
        }

        // Map department and position
        const departmentId = deptCode && departmentMap.has(deptCode) ? departmentMap.get(deptCode) : null;
        const positionId = positionCode && positionMap.has(positionCode) ? positionMap.get(positionCode) : null;

        // Create user
        await prisma.user.create({
          data: {
            usercode,
            password: hashedPassword,
            fullName: fullName || null,
            email,
            role: role === 'ADMIN' ? 'ADMIN' : 'USER',
            departmentId,
            positionId,
          },
        });

        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: ${err.message}`);
      }
    }

    res.status(200).json({
      message: `Import completed: ${results.success} success, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

// Export user template
export const exportUserTemplate = async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ message: req.t('FORBIDDEN') });
      return;
    }

    // Create template data
    const templateData = [
      {
        usercode: 'HV001',
        fullName: 'Nguyễn Văn A',
        email: 'nguyenvana@example.com',
        role: 'USER',
        departmentCode: '',
        positionCode: '',
      },
    ];

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    // Generate buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=user_template.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};
