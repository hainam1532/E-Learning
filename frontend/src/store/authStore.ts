import { create } from 'zustand';
import type { AuthState, User } from '../types/auth';
import { authPost } from '../services/auth';

const getInitialUser = (): User | null => {
  const storedUser = localStorage.getItem('el_user');
  if (storedUser) {
    try {
      return JSON.parse(storedUser);
    } catch {
      return null;
    }
  }
  return null;
};

const getInitialToken = (): string | null => {
  return localStorage.getItem('el_token');
};

const getInitialRefreshToken = (): string | null => {
  return localStorage.getItem('el_refreshToken');
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getInitialUser(),
  token: getInitialToken(),
  refreshToken: getInitialRefreshToken(),
  isAuthenticated: !!getInitialToken(),
  isLoading: false,

  login: async (usercode: string, password: string) => {
    set({ isLoading: true });

    try {
      const response = await authPost.login(usercode, password);

const { user, accessToken, refreshToken } = response.data;

      // Normalize user data from API
      const normalizedUser: User = {
        id: String(user.id),
        usercode: user.usercode,
        name: user.fullName || user.usercode,
        email: user.email,
        role: user.role === 'ADMIN' ? 'admin' : 'student',
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.usercode}`,
        department: user.department || null,
        position: user.position || null,
      };

      // Store in localStorage
      localStorage.setItem('el_user', JSON.stringify(normalizedUser));
      localStorage.setItem('el_token', accessToken);
      localStorage.setItem('el_refreshToken', refreshToken);

      set({
        user: normalizedUser,
        token: accessToken,
        refreshToken: refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    await authPost.createUser(data);
  },

  logout: async () => {
    try {
      await authPost.logout();
    } catch {
      // Ignore logout API error - just clear local state
    } finally {
      localStorage.removeItem('el_user');
      localStorage.removeItem('el_token');
      localStorage.removeItem('el_refreshToken');
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
      });
    }
  },
}));
