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
};
