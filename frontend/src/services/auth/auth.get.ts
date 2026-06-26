import api from '../api';

// GET requests for Auth module
export const authGet = {
  /**
   * Get current user profile
   */
  getProfile: () => api.get('/auth/profile'),

  /**
   * Get all users (Admin)
   */
  getUsers: () => api.get('/auth/users'),

  /**
   * Get all departments (Admin)
   */
  getDepartments: () => api.get('/auth/departments'),

  /**
   * Get all positions (Admin)
   */
  getPositions: () => api.get('/auth/positions'),

  /**
   * Get all system configs (Admin)
   */
  getConfigs: () => api.get('/auth/configs'),

  /**
   * Get public academies (no auth required) - for dropdown
   */
  getPublicAcademies: () => api.get('/auth/academies/public'),

  /**
   * Get all academies (Admin)
   */
  getAcademies: () => api.get('/auth/academies'),

/**
   * Get academy users (Admin)
   */
  getAcademyUsers: (academyId: number) => api.get(`/auth/academies/${academyId}/users`),

/**
   * Get all lecturers (Admin)
   */
  getLecturers: (search?: string, type?: string) => api.get('/auth/lecturers', { params: { search, type } }),

  /**
   * Get all question categories (Admin)
   */
  getQuestionCategories: (academyId?: number, search?: string) => api.get('/auth/question-categories', { params: { academyId, search } }),

  /**
   * Get questions by category (Admin)
   */
  getQuestions: (categoryId: number) => api.get(`/auth/question-categories/${categoryId}/questions`),

  /**
   * Download question import template (Admin)
   */
  getQuestionTemplate: () =>
    api.get('/auth/questions/template', {
      responseType: 'blob',
    }),

  /**
   * Get exam sessions (Admin)
   */
  getExamSessions: (academyId?: number, search?: string) =>
    api.get('/auth/exam-sessions', { params: { academyId, search } }),

  /**
   * Get learning overview report (Admin)
   */
  getLearningOverviewReport: (params?: { usercode?: string; departmentId?: number }) =>
    api.get('/auth/reports/overview', { params }),

  /**
   * Export learning overview report to Excel (Admin)
   */
  exportLearningOverviewReport: (params?: { usercode?: string; departmentId?: number }) =>
    api.get('/auth/reports/overview/export', {
      params,
      responseType: 'blob',
    }),
};
