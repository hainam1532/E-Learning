import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
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

    // Tìm kiếm user bằng usercode
    const user = await prisma.user.findUnique({
      where: { usercode },
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

// Get all academies
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
