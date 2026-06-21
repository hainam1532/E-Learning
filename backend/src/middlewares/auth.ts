import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redisClient } from '../config/redis';

const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-key-12345';

interface JwtPayload {
  userId: number;
  usercode: string;
  role: string;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        usercode: string;
        role: string;
        sessionId: string;
      };
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: req.t('UNAUTHORIZED') });
      return;
    }

    const token = authHeader.split(' ')[1];
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (err) {
      res.status(401).json({ message: req.t('UNAUTHORIZED') });
      return;
    }

    const { userId, usercode, role, sessionId } = decoded;

    // Kiểm tra session ID trùng khớp trên Redis (chống đăng nhập đồng thời)
    const activeSessionId = await redisClient.get(`user_session:${userId}`);
    if (!activeSessionId || activeSessionId !== sessionId) {
      res.status(401).json({
        code: 'SESSION_EXPIRED_DUPLICATE_LOGIN',
        message: req.t('SESSION_EXPIRED_DUPLICATE_LOGIN'),
      });
      return;
    }

    // Gán thông tin user vào request
    req.user = {
      id: userId,
      usercode,
      role,
      sessionId,
    };

    next();
  } catch (error) {
    res.status(500).json({ message: req.t('INTERNAL_SERVER_ERROR') });
  }
};

export default authMiddleware;
