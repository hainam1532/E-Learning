import express from "express";
import cors from "cors";
import multer from "multer";
import * as path from "path";
import i18nMiddleware from "./middlewares/i18n";
import authRoutes from "./modules/auth/auth.routes";
import videoRoutes from "./modules/video/video.routes";
import courseRoutes from "./modules/course/course.routes";

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

// Test endpoint
app.get("/api/ping", (req, res) => {
  res.json({ message: "pong", lang: req.language });
});

export default app;