export type UserRole = 'admin' | 'student' | 'guest';

export interface UserDepartment {
  id: number;
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  code: string;
}

export interface UserPosition {
  id: number;
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  code: string;
}

export interface User {
  id: string;
  usercode: string;  // Changed from email - user's unique code like GV001, HV100
  name: string;
  email?: string;
  role: UserRole;
  avatar?: string;
  department?: UserDepartment | null;
  position?: UserPosition | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usercode: string, password: string) => Promise<void>;
  register: (data: { usercode: string; password: string; fullName?: string; email?: string; role?: string }) => Promise<void>;
  logout: () => Promise<void>;
}
