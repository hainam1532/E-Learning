import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types/auth';
import { Spin } from 'antd';
import { useTranslation } from 'react-i18next';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children?: React.ReactNode;
}

export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Spin size="large" tip={t('common.loading')} />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Chuyển hướng đến trang đăng nhập và lưu vị trí hiện tại
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Người dùng đã đăng nhập nhưng không có vai trò phù hợp
    return <Navigate to="/unauthorized" replace />;
  }

  // Nếu hợp lệ, hiển thị các route con hoặc children
  return children ? <>{children}</> : <Outlet />;
}
