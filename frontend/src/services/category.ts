import api from "./api";

const API_URL = "/courses";

// Types
export interface CourseCategory {
  id: number;
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  code: string;
  description?: string;
  academyId: number;
  parentId?: number;
  academy?: {
    id: number;
    name_vi?: string;
    name_en?: string;
    name_zh?: string;
  };
  parent?: {
    id: number;
    name_vi?: string;
    name_en?: string;
    name_zh?: string;
  };
  children?: CourseCategory[];
  _count?: {
    courses: number;
    children: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCategoryPayload {
  name_vi: string;
  name_en?: string;
  name_zh?: string;
  code: string;
  description?: string;
  academyId: number;
  parentId?: number;
}

export interface UpdateCategoryPayload {
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  code?: string;
  description?: string;
  parentId?: number;
}

// API Functions

/**
 * Get all course categories (with optional filters)
 */
export const getCategories = async (params?: {
  academyId?: number;
  parentId?: number | null;
}): Promise<CourseCategory[]> => {
  const response = await api.get(`${API_URL}/categories`, { params });
  return response.data.data;
};

/**
 * Get courses by category ID
 */
export const getCoursesByCategory = async (categoryId: number): Promise<any[]> => {
  const response = await api.get(`${API_URL}/categories/${categoryId}/courses`);
  return response.data.data;
};

/**
 * Create a new course category
 */
export const createCategory = async (data: CreateCategoryPayload): Promise<CourseCategory> => {
  const response = await api.post(`${API_URL}/categories`, data);
  return response.data.data;
};

/**
 * Update a course category
 */
export const updateCategory = async (
  id: number,
  data: UpdateCategoryPayload
): Promise<CourseCategory> => {
  const response = await api.put(`${API_URL}/categories/${id}`, data);
  return response.data.data;
};

/**
 * Delete a course category
 */
export const deleteCategory = async (id: number): Promise<void> => {
  await api.delete(`${API_URL}/categories/${id}`);
};

/**
 * Add a course to a category
 */
export const addCourseToCategory = async (
  categoryId: number,
  courseId: number
): Promise<any> => {
  const response = await api.post(`${API_URL}/categories/${categoryId}/courses`, {
    courseId,
  });
  return response.data.data;
};

/**
 * Remove a course from a category
 */
export const removeCourseFromCategory = async (
  categoryId: number,
  courseId: number
): Promise<any> => {
  const response = await api.delete(`${API_URL}/categories/${categoryId}/courses`, {
    data: { courseId },
  });
  return response.data.data;
};
