import { Request, Response } from "express";
import { prisma } from "../../config/db";
import multer from "multer";
import * as path from "path";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";

// Types for question data
type QuestionType = "FILL_BLANK" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";

// Get all question categories with optional filters
export const getQuestionCategories = async (req: Request, res: Response) => {
  try {
    const { academyId, search } = req.query;

    const where: any = {};
    
    if (academyId) {
      where.academyId = Number(academyId);
    }
    
    if (search) {
      where.OR = [
        { name_vi: { contains: String(search), mode: "insensitive" } },
        { name_en: { contains: String(search), mode: "insensitive" } },
        { name_zh: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const categories = await prisma.questionCategory.findMany({
      where,
      include: {
        academy: true,
        questions: {
          include: {
            options: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error("Error getting question categories:", error);
    res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
};

// Create a new question category
export const createQuestionCategory = async (req: Request, res: Response) => {
  try {
    const { name_vi, name_en, name_zh, description, academyId } = req.body;

    if (!academyId) {
      return res.status(400).json({ success: false, message: "Academy is required" });
    }

    const category = await prisma.questionCategory.create({
      data: {
        name_vi,
        name_en,
        name_zh,
        description,
        academyId: Number(academyId),
      },
      include: {
        academy: true,
      },
    });

    res.json({ success: true, data: category });
  } catch (error) {
    console.error("Error creating question category:", error);
    res.status(500).json({ success: false, message: "Failed to create category" });
  }
};

// Update a question category
export const updateQuestionCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name_vi, name_en, name_zh, description } = req.body;

    const category = await prisma.questionCategory.update({
      where: { id: Number(id) },
      data: {
        name_vi,
        name_en,
        name_zh,
        description,
      },
      include: {
        academy: true,
      },
    });

    res.json({ success: true, data: category });
  } catch (error) {
    console.error("Error updating question category:", error);
    res.status(500).json({ success: false, message: "Failed to update category" });
  }
};

// Delete a question category
export const deleteQuestionCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.questionCategory.delete({
      where: { id: Number(id) },
    });

    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting question category:", error);
    res.status(500).json({ success: false, message: "Failed to delete category" });
  }
};

// Get all questions with filters
export const getQuestions = async (req: Request, res: Response) => {
  try {
    const { categoryId, academyId, search } = req.query;

    const where: any = {};

    if (categoryId) {
      where.categoryId = Number(categoryId);
    }

    if (academyId) {
      where.category = {
        academyId: Number(academyId),
      };
    }

    if (search) {
      where.OR = [
        { question_vi: { contains: String(search), mode: "insensitive" } },
        { question_en: { contains: String(search), mode: "insensitive" } },
        { question_zh: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const questions = await prisma.question.findMany({
      where,
      include: {
        category: {
          include: {
            academy: true,
          },
        },
        options: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: questions });
  } catch (error) {
    console.error("Error getting questions:", error);
    res.status(500).json({ success: false, message: "Failed to fetch questions" });
  }
};

// Create a new question
export const createQuestion = async (req: Request, res: Response) => {
  try {
    const {
      question_vi,
      question_en,
      question_zh,
      type,
      difficulty,
      correctAnswer,
      categoryId,
      options,
    } = req.body;

    const question = await prisma.question.create({
      data: {
        question_vi,
        question_en,
        question_zh,
        type: type as QuestionType,
        difficulty: difficulty as QuestionDifficulty || "MEDIUM",
        correctAnswer,
        categoryId: Number(categoryId),
        options: options
          ? {
              create: options.map((opt: any, index: number) => ({
                option_vi: opt.option_vi,
                option_en: opt.option_en,
                option_zh: opt.option_zh,
                order: opt.order ?? index,
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        options: true,
      },
    });

    res.json({ success: true, data: question });
  } catch (error) {
    console.error("Error creating question:", error);
    res.status(500).json({ success: false, message: "Failed to create question" });
  }
};

// Update a question
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      question_vi,
      question_en,
      question_zh,
      type,
      difficulty,
      correctAnswer,
      options,
    } = req.body;

    // Delete existing options if new options provided
    if (options) {
      await prisma.questionOption.deleteMany({
        where: { questionId: Number(id) },
      });
    }

    const question = await prisma.question.update({
      where: { id: Number(id) },
      data: {
        question_vi,
        question_en,
        question_zh,
        type: type as QuestionType,
        difficulty: difficulty as QuestionDifficulty,
        correctAnswer,
        options: options
          ? {
              create: options.map((opt: any, index: number) => ({
                option_vi: opt.option_vi,
                option_en: opt.option_en,
                option_zh: opt.option_zh,
                order: opt.order ?? index,
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        options: true,
      },
    });

    res.json({ success: true, data: question });
  } catch (error) {
    console.error("Error updating question:", error);
    res.status(500).json({ success: false, message: "Failed to update question" });
  }
};

// Delete a question
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Options will be cascade deleted due to onDelete: Cascade in schema
    await prisma.question.delete({
      where: { id: Number(id) },
    });

    res.json({ success: true, message: "Question deleted successfully" });
  } catch (error) {
    console.error("Error deleting question:", error);
    res.status(500).json({ success: false, message: "Failed to delete question" });
  }
};

// Upload questions from Excel file
export const uploadQuestionsFromExcel = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    if (!categoryId) {
      return res.status(400).json({ success: false, message: "Category ID is required" });
    }

    // Read Excel file
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ success: false, message: "Excel file is empty" });
    }

    let createdCount = 0;
    let errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      try {
        // Map Excel columns to question fields
        const question_vi = row["Câu hỏi (Tiếng Việt)"] || row["question_vi"] || "";
        const question_en = row["Question (English)"] || row["question_en"] || "";
        const question_zh = row["问题 (中文)"] || row["question_zh"] || "";
        const type = row["Loại câu hỏi"] || row["type"] || "SINGLE_CHOICE";
        const difficulty = row["Độ khó"] || row["difficulty"] || "MEDIUM";
        const correctAnswer = row["Đáp án đúng"] || row["correct_answer"] || "";

        // Validate required fields
        if (!question_vi) {
          errors.push(`Row ${i + 2}: Missing question text (Vietnamese)`);
          continue;
        }

        // Map type string to enum
        let questionType: QuestionType = "SINGLE_CHOICE";
        if (type === "FILL_BLANK" || type === "Điền câu từ") {
          questionType = "FILL_BLANK";
        } else if (type === "SINGLE_CHOICE" || type === "Trắc nghiệm 1 lựa chọn") {
          questionType = "SINGLE_CHOICE";
        } else if (type === "MULTIPLE_CHOICE" || type === "Trắc nghiệm nhiều lựa chọn") {
          questionType = "MULTIPLE_CHOICE";
        } else if (type === "TRUE_FALSE" || type === "Chọn đúng sai") {
          questionType = "TRUE_FALSE";
        }

        // Map difficulty string to enum
        let questionDifficulty: QuestionDifficulty = "MEDIUM";
        if (difficulty === "EASY" || difficulty === "Dễ") {
          questionDifficulty = "EASY";
        } else if (difficulty === "MEDIUM" || difficulty === "Trung bình") {
          questionDifficulty = "MEDIUM";
        } else if (difficulty === "HARD" || difficulty === "Khó") {
          questionDifficulty = "HARD";
        }

        // Create options based on type
        const optionsData: any[] = [];
        if (questionType === "SINGLE_CHOICE" || questionType === "MULTIPLE_CHOICE") {
          // Look for option columns
          for (let optNum = 1; optNum <= 10; optNum++) {
            const optVi = row[`Lựa chọn ${optNum} (VN)`] || row[`option${optNum}_vi`];
            const optEn = row[`Option ${optNum} (EN)`] || row[`option${optNum}_en`];
            const optZh = row[`选项 ${optNum} (ZH)`] || row[`option${optNum}_zh`];

            if (optVi) {
              optionsData.push({
                option_vi: optVi,
                option_en: optEn || optVi,
                option_zh: optZh || optVi,
                order: optNum - 1,
              });
            }
          }
        }

        // Determine correct answer (could be single or array)
        let correctAnswerData: string | string[] = correctAnswer;
        if (questionType === "MULTIPLE_CHOICE" && correctAnswer.includes(",")) {
          correctAnswerData = correctAnswer.split(",").map((s: string) => s.trim());
        }

        // Create question
        await prisma.question.create({
          data: {
            question_vi,
            question_en: question_en || question_vi,
            question_zh: question_zh || question_vi,
            type: questionType,
            difficulty: questionDifficulty,
            correctAnswer: correctAnswerData,
            categoryId: Number(categoryId),
            options: optionsData.length > 0 ? { create: optionsData } : undefined,
          },
        });

        createdCount++;
      } catch (rowError: any) {
        errors.push(`Row ${i + 2}: ${rowError.message || "Unknown error"}`);
      }
    }

    res.json({
      success: true,
      data: {
        created: createdCount,
        errors,
      },
      message: `Successfully imported ${createdCount} questions`,
    });
  } catch (error) {
    console.error("Error uploading questions from Excel:", error);
    res.status(500).json({ success: false, message: "Failed to upload questions" });
  }
};

// Download Excel template
export const getQuestionTemplate = async (req: Request, res: Response) => {
  try {
    // Create template data
    const templateData = [
      {
        "Câu hỏi (Tiếng Việt)": "Ví dụ câu hỏi tiếng Việt",
        "Question (English)": "Example question in English",
        "问题 (中文)": "中文问题示例",
        "Loại câu hỏi": "SINGLE_CHOICE",
        "Độ khó": "MEDIUM",
        "Đáp án đúng": "A",
        "Lựa chọn 1 (VN)": "Đáp án A",
        "Lựa chọn 2 (VN)": "Đáp án B",
        "Lựa chọn 3 (VN)": "Đáp án C",
        "Lựa chọn 4 (VN)": "Đáp án D",
        "Option 1 (EN)": "Option A",
        "Option 2 (EN)": "Option B",
        "Option 3 (EN)": "Option C",
        "Option 4 (EN)": "Option D",
        "选项 1 (ZH)": "选项A",
        "选项 2 (ZH)": "选项B",
        "选项 3 (ZH)": "选项C",
        "选项 4 (ZH)": "选项D",
      },
    ];

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions Template");

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=question_template.xlsx"
    );

    res.send(buffer);
  } catch (error) {
    console.error("Error generating template:", error);
    res.status(500).json({ success: false, message: "Failed to generate template" });
  }
};

// Multer middleware for file upload
export const uploadMiddleware = (req: Request, res: Response, next: Function) => {
  // File upload is handled by multer in routes
  next();
};
