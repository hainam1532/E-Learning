import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { HomeOutlined, LogoutOutlined } from '@ant-design/icons';

export default function Unauthorized() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-slate-50 rounded-3xl p-6 shadow-sm border border-slate-100">
      <Result
        status="403"
        title="403"
        subTitle={
          <div className="space-y-2">
            <p className="text-lg font-bold text-slate-800">Truy cập bị từ chối</p>
            <p className="text-slate-500">Bạn không có quyền truy cập vào trang quản trị này. Vui lòng liên hệ quản trị viên hoặc đăng nhập bằng tài khoản có quyền.</p>
          </div>
        }
        extra={
          <div className="flex flex-wrap gap-4 justify-center mt-6">
            <Button
              type="primary"
              icon={<HomeOutlined />}
              onClick={() => navigate('/')}
              className="bg-blue-600 hover:bg-blue-700 border-none font-semibold h-10 px-6 rounded-lg"
            >
              Về Trang Chủ
            </Button>
            <Button
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              danger
              className="font-semibold h-10 px-6 rounded-lg"
            >
              Đăng xuất & Đăng nhập lại
            </Button>
          </div>
        }
      />
    </div>
  );
}
