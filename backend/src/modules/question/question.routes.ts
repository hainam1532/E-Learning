import { Router } from "express";
import multer from "multer";
import * as path from "path";
import { randomUUID } from "crypto";
import * as questionController from "./question.controller";

const router = Router();

// Configure multer for Excel file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: (req, file, cb) => {
    const uuid = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `questions_${uuid}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith(".xlsx") || file.originalname.endsWith(".xls")) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only Excel files (.xlsx, .xls) are allowed."));
    }
  },
});

// Question Category routes (must be before /:id to avoid route conflict)
router.get("/categories", questionController.getQuestionCategories);
router.post("/categories", questionController.createQuestionCategory);
router.put("/categories/:id", questionController.updateQuestionCategory);
router.delete("/categories/:id", questionController.deleteQuestionCategory);

// Question routes
router.get("/", questionController.getQuestions);
router.post("/", questionController.createQuestion);
router.put("/:id", questionController.updateQuestion);
router.delete("/:id", questionController.deleteQuestion);

// Excel upload/download routes
router.get("/template", questionController.getQuestionTemplate);
router.post("/upload", upload.single("file"), questionController.uploadQuestionsFromExcel);

export default router;
