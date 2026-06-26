import express from "express";
import cors from "cors";
import multer from "multer";
import * as path from "path";
import i18nMiddleware from "./middlewares/i18n";
import authRoutes from "./modules/auth/auth.routes";
import videoRoutes from "./modules/video/video.routes";
import courseRoutes from "./modules/course/course.routes";
import progressRoutes from "./modules/progress/progress.routes";
import trainingRoutes from "./modules/training/training.routes";
import documentRoutes from "./modules/document/document.routes";
import questionRoutes from "./modules/question/question.routes";
import { prisma } from "./config/db";
import { redisClient } from "./config/redis";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

const app = express();

// 1. Cấu hình CORS
app.use(cors());

// 2. Phân tích JSON body
app.use(express.json());

// 3. Enable JSON parsing for nested objects
app.use(express.urlencoded({ extended: true }));

// 4. Tích hợp Đa ngôn ngữ (i18n) cho toàn bộ request
app.use(i18nMiddleware);

// 5. Các tuyến đường API
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/training", trainingRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/questions", questionRoutes);

// Test endpoint
app.get("/api/ping", (req, res) => {
  res.json({ message: "pong", lang: req.language });
});

// Health check endpoint - verify database and Redis connections
app.get("/api/health", async (req, res) => {
  const health = {
    status: 'ok',
    database: 'unhealthy',
    redis: 'unhealthy',
    timestamp: new Date().toISOString(),
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    health.database = 'healthy';
  } catch (error) {
    health.status = 'unhealthy';
    console.error('Database health check failed:', error);
  }

  try {
    // Check Redis connection
    await redisClient.ping();
    health.redis = 'healthy';
  } catch (error) {
    health.status = 'unhealthy';
    console.error('Redis health check failed:', error);
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default app;