import api from "./api";

// Types for Question Bank
export type QuestionType = "FILL_BLANK" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface Academy {
  id: number;
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  code: string;
}

export interface QuestionOption {
  id: number;
  option_vi?: string;
  option_en?: string;
  option_zh?: string;
  order: number;
}

export interface Question {
  id: number;
  question_vi?: string;
  question_en?: string;
  question_zh?: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  correctAnswer: string | string[];
  categoryId: number;
  category?: QuestionCategory;
  options?: QuestionOption[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestionCategory {
  id: number;
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  description?: string;
  academyId: number;
  academy?: Academy;
  questions?: Question[];
  createdAt: string;
  updatedAt: string;
}

// API Response types
interface QuestionCategoriesResponse {
  success: boolean;
  data: QuestionCategory[];
}

interface QuestionsResponse {
  success: boolean;
  data: Question[];
}

interface QuestionResponse {
  success: boolean;
  data: Question;
}

interface CategoryResponse {
  success: boolean;
  data: QuestionCategory;
}

// Question Category API
export async function getQuestionCategories(
  academyId?: number,
  search?: string
): Promise<QuestionCategory[]> {
  const params: any = {};
  if (academyId) params.academyId = academyId;
  if (search) params.search = search;

  const response = await api.get<QuestionCategoriesResponse>("/questions/categories", { params });
  return response.data.data;
}

export async function createQuestionCategory(
  data: Partial<QuestionCategory>
): Promise<QuestionCategory> {
  const response = await api.post<CategoryResponse>("/questions/categories", data);
  return response.data.data;
}

export async function updateQuestionCategory(
  id: number,
  data: Partial<QuestionCategory>
): Promise<QuestionCategory> {
  const response = await api.put<CategoryResponse>(`/questions/categories/${id}`, data);
  return response.data.data;
}

export async function deleteQuestionCategory(id: number): Promise<void> {
  await api.delete(`/questions/categories/${id}`);
}

// Question API
export async function getQuestions(
  categoryId?: number,
  academyId?: number,
  search?: string
): Promise<Question[]> {
  const params: any = {};
  if (categoryId) params.categoryId = categoryId;
  if (academyId) params.academyId = academyId;
  if (search) params.search = search;

  const response = await api.get<QuestionsResponse>("/questions", { params });
  return response.data.data;
}

export async function createQuestion(
  data: Partial<Question>
): Promise<Question> {
  const response = await api.post<QuestionResponse>("/questions", data);
  return response.data.data;
}

export async function updateQuestion(
  id: number,
  data: Partial<Question>
): Promise<Question> {
  const response = await api.put<QuestionResponse>(`/questions/${id}`, data);
  return response.data.data;
}

export async function deleteQuestion(id: number): Promise<void> {
  await api.delete(`/questions/${id}`);
}

// Excel Upload/Download API
export async function downloadQuestionTemplate(): Promise<Blob> {
  const response = await api.get("/questions/template", {
    responseType: "blob",
  });
  return response.data;
}

interface UploadResponse {
  success: boolean;
  data: {
    created: number;
    errors: string[];
  };
  message: string;
}

export async function uploadQuestionsFromExcel(
  file: File,
  categoryId: number
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("categoryId", categoryId.toString());

  const response = await api.post<UploadResponse>("/questions/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}
