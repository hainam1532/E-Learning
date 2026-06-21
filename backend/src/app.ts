import express from "express";
import cors from "cors";
import i18nMiddleware from "./middlewares/i18n";
import authRoutes from "./modules/auth/auth.routes";

const app = express();

// 1. Cấu hình CORS
app.use(cors());

// 2. Phân tích JSON body
app.use(express.json());

// 3. Tích hợp Đa ngôn ngữ (i18n) cho toàn bộ request
app.use(i18nMiddleware);

// 4. Các tuyến đường API
app.use("/api/auth", authRoutes);

// Test endpoint
app.get("/api/ping", (req, res) => {
  res.json({ message: "pong", lang: req.language });
});

export default app;