import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import i18n from '../utils/i18n';
import { useAuthStore } from '../store/authStore';

// Base API URL - adjust as needed for your environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach tokens and language
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('el_token');
    const lang = i18n.language || 'vi';

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach Accept-Language header for backend i18n
    config.headers = config.headers || {};
    (config.headers as Record<string, string>)['Accept-Language'] = lang;

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh and session conflicts
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string; message?: string }>) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle session expired / duplicate login (401 with SESSION_EXPIRED_DUPLICATE_LOGIN)
    if (error.response?.status === 401) {
      const errorCode = error.response?.data?.code;
      
      if (errorCode === 'SESSION_EXPIRED_DUPLICATE_LOGIN') {
        // Clear auth state and redirect to login
        const { logout } = useAuthStore.getState();
        logout();
        
        // Show error message
        const message = error.response?.data?.message || i18n.t('common.sessionExpired');
        console.error('Session expired:', message);
        
        // Redirect to login page
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // Try to refresh token if not already retried
      if (originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = localStorage.getItem('el_refreshToken');
          
          if (refreshToken) {
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            });

            const { accessToken } = response.data;
            
            if (accessToken) {
              localStorage.setItem('el_token', accessToken);
              
              // Retry the original request
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              }
              
              return api(originalRequest);
            }
          }
        } catch (refreshError) {
          // Refresh failed, logout user
          const { logout } = useAuthStore.getState();
          logout();
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Re-export from auth service for backwards compatibility
export { authPost } from './auth/auth.post';
export { authGet } from './auth/auth.get';
