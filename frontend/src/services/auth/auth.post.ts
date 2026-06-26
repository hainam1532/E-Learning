import api from '../api';

// POST requests for Auth module
export const authPost = {
  /**
   * Login with user credentials
   */
  login: (usercode: string, password: string) =>
    api.post('/auth/login', { usercode, password }),

  /**
   * Logout current user
   */
  logout: () => api.post('/auth/logout'),

  /**
   * Refresh access token
   */
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),

  // ============ ADMIN USER MANAGEMENT ============
  /**
   * Create new user (Admin)
   */
  createUser: (data: { usercode: string; password?: string; fullName?: string; email?: string; role?: string; departmentId?: number; positionId?: number }) =>
    api.post('/auth/users', data),

  /**
   * Update user (Admin)
   */
  updateUser: (id: number, data: { usercode?: string; fullName?: string; email?: string; role?: string; password?: string; departmentId?: number; positionId?: number }) =>
    api.put(`/auth/users/${id}`, data),

  /**
   * Delete user (Admin)
   */
  deleteUser: (id: number) =>
    api.delete(`/auth/users/${id}`),

  // ============ DEPARTMENT MANAGEMENT ============
/**
   * Create department (Admin)
   */
  createDepartment: (data: { name_vi: string; name_en?: string; name_zh?: string; code: string; description?: string }) =>
    api.post('/auth/departments', data),

  /**
   * Update department (Admin)
   */
  updateDepartment: (id: number, data: { name_vi?: string; name_en?: string; name_zh?: string; description?: string }) =>
    api.put(`/auth/departments/${id}`, data),

  /**
   * Delete department (Admin)
   */
  deleteDepartment: (id: number) =>
    api.delete(`/auth/departments/${id}`),

// ============ POSITION MANAGEMENT ============
  /**
   * Create position (Admin)
   */
  createPosition: (data: { name_vi: string; name_en?: string; name_zh?: string; code: string; description?: string }) =>
    api.post('/auth/positions', data),

  /**
   * Update position (Admin)
   */
  updatePosition: (id: number, data: { name_vi?: string; name_en?: string; name_zh?: string; description?: string }) =>
    api.put(`/auth/positions/${id}`, data),

  /**
   * Delete position (Admin)
   */
  deletePosition: (id: number) =>
    api.delete(`/auth/positions/${id}`),

  // ============ SYSTEM CONFIG MANAGEMENT ============
  /**
   * Set config (Admin) - creates or updates
   */
  setConfig: (data: { configKey: string; configValue: string; description?: string }) =>
    api.post('/auth/configs', data),

  /**
   * Delete config (Admin)
   */
  deleteConfig: (key: string) =>
    api.delete(`/auth/configs/${key}`),

// ============ IMPORT USERS ============
  /**
   * Import users from Excel file (Admin)
   */
  importUsers: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/auth/users/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // ============ ACADEMY MANAGEMENT ============
  /**
   * Create academy (Admin)
   */
  createAcademy: (data: { name_vi: string; name_en?: string; name_zh?: string; code: string; description?: string; isPublic?: boolean }) =>
    api.post('/auth/academies', data),

  /**
   * Update academy (Admin)
   */
  updateAcademy: (id: number, data: { name_vi?: string; name_en?: string; name_zh?: string; description?: string; isPublic?: boolean }) =>
    api.put(`/auth/academies/${id}`, data),

  /**
   * Delete academy (Admin)
   */
  deleteAcademy: (id: number) =>
    api.delete(`/auth/academies/${id}`),

  /**
   * Add user to academy (Admin)
   */
  addUserToAcademy: (academyId: number, userId: number) =>
    api.post(`/auth/academies/${academyId}/users`, { userId }),

/**
   * Remove user from academy (Admin)
   */
  removeUserFromAcademy: (academyId: number, userId: number) =>
    api.delete(`/auth/academies/${academyId}/users/${userId}`),

  // ============ LECTURER MANAGEMENT ============
  /**
   * Create lecturer (Admin)
   */
  createLecturer: (data: { code: string; name?: string; type?: string; gender?: string; phone?: string; email?: string; address?: string }) =>
    api.post('/auth/lecturers', data),

  /**
   * Update lecturer (Admin)
   */
  updateLecturer: (id: number, data: { code?: string; name?: string; type?: string; gender?: string; phone?: string; email?: string; address?: string }) =>
    api.put(`/auth/lecturers/${id}`, data),

/**
   * Delete lecturer (Admin)
   */
  deleteLecturer: (id: number) =>
    api.delete(`/auth/lecturers/${id}`),

  // ============ QUESTION BANK MANAGEMENT ============
  /**
   * Create question category (Admin)
   */
  createQuestionCategory: (data: { name_vi: string; name_en?: string; name_zh?: string; description?: string; academyId: number }) =>
    api.post('/auth/question-categories', data),

  /**
   * Update question category (Admin)
   */
  updateQuestionCategory: (id: number, data: { name_vi?: string; name_en?: string; name_zh?: string; description?: string }) =>
    api.put(`/auth/question-categories/${id}`, data),

  /**
   * Delete question category (Admin)
   */
  deleteQuestionCategory: (id: number) =>
    api.delete(`/auth/question-categories/${id}`),

  /**
   * Create question (Admin)
   */
  createQuestion: (categoryId: number, data: { question_vi: string; question_en?: string; question_zh?: string; type: string; difficulty?: string; correctAnswer?: any }) =>
    api.post(`/auth/question-categories/${categoryId}/questions`, data),

  /**
   * Update question (Admin)
   */
  updateQuestion: (id: number, data: { question_vi?: string; question_en?: string; question_zh?: string; type?: string; difficulty?: string; correctAnswer?: any }) =>
    api.put(`/auth/questions/${id}`, data),

  /**
   * Delete question (Admin)
   */
  deleteQuestion: (id: number) =>
    api.delete(`/auth/questions/${id}`),

  /**
   * Import questions from Excel (Admin)
   */
  importQuestions: (categoryId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/auth/question-categories/${categoryId}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // ============ EXAM SESSION MANAGEMENT ============
  /**
   * Create exam session (Admin)
   */
  createExamSession: (data: {
    name_vi: string;
    name_en?: string;
    name_zh?: string;
    academyId: number;
    paperCategoryId: number;
    startAt: string;
    endAt: string;
    attemptLimit: number;
    passingScore: number;
    durationMinutes: number;
    antiCheat: boolean;
    requireFullscreen: boolean;
    detectTabSwitch: boolean;
    shuffleQuestions: boolean;
  }) => api.post('/auth/exam-sessions', data),

  /**
   * Update exam session (Admin)
   */
  updateExamSession: (id: number, data: {
    name_vi: string;
    name_en?: string;
    name_zh?: string;
    academyId: number;
    paperCategoryId: number;
    startAt: string;
    endAt: string;
    attemptLimit: number;
    passingScore: number;
    durationMinutes: number;
    antiCheat: boolean;
    requireFullscreen: boolean;
    detectTabSwitch: boolean;
    shuffleQuestions: boolean;
  }) => api.put(`/auth/exam-sessions/${id}`, data),

  /**
   * Delete exam session (Admin)
   */
  deleteExamSession: (id: number) => api.delete(`/auth/exam-sessions/${id}`),
};
