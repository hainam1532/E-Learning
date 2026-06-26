import { useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Dropdown, Avatar, Button, type MenuProps, Drawer, Menu } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  HomeOutlined,
  MenuOutlined,
  BookOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

export default function UserLayout() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: <span className="font-semibold">{user?.name}</span>,
      disabled: true,
    },
    {
      type: 'divider',
    },
    ...(user?.role === 'admin' ? [{
      key: 'admin-dashboard',
      icon: <BookOutlined />,
      label: <Link to="/admin">{t('common.adminPanel')}</Link>,
    }] : []),
    {
      key: 'logout',
      danger: true,
      icon: <LogoutOutlined />,
      label: t('common.logout'),
      onClick: handleLogout,
    },
  ];

return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-100 shadow-sm px-4 md:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 lg:gap-8 min-w-0">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-blue-500/30 transform group-hover:scale-105 transition-transform duration-200">
              E+
            </div>
            <span className="hidden sm:inline text-xl font-bold bg-linear-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Learning
            </span>
          </Link>

          {/* Desktop Navigation — chỉ hiện từ lg để tránh chen chật ở tablet */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-6">
            <Link to="/" className="text-slate-600 hover:text-blue-600 font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <HomeOutlined /> {t('common.home')}
            </Link>
            <Link to="/courses" className="text-slate-600 hover:text-blue-600 font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <BookOutlined /> {t('userLayout.courses')}
            </Link>
            <Link to="/topics" className="text-slate-600 hover:text-blue-600 font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <TagsOutlined /> {t('userLayout.topics')}
            </Link>
            <Link to="/profile" className="text-slate-600 hover:text-blue-600 font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap">
              <UserOutlined /> {t('userLayout.profile')}
            </Link>
          </nav>

{/* Mobile Menu Button - hiện dưới lg */}
          <div className="lg:hidden">
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileMenuOpen(true)}
            />
          </div>

          {/* Mobile Navigation Drawer - dùng dưới lg */}
          <div className="lg:hidden">
            <Drawer
              title={
                <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg">
                      E+
                    </div>
                    <span className="text-lg font-bold">Learning</span>
                  </div>
                </Link>
              }
              placement="left"
              onClose={() => setMobileMenuOpen(false)}
              open={mobileMenuOpen}
              styles={{ body: { padding: 0 } }}
            >
<Menu
                mode="inline"
                selectedKeys={[location.pathname]}
                items={[
                  {
                    key: '/',
                    icon: <HomeOutlined />,
                    label: <Link to="/" onClick={() => setMobileMenuOpen(false)}>{t('common.home')}</Link>,
                  },
                  ...(!isAuthenticated ? [{
                    key: '/login',
                    icon: <UserOutlined />,
                    label: <Link to="/login" onClick={() => setMobileMenuOpen(false)}>{t('common.login')}</Link>,
                  }] : []),
                  {
                    key: '/profile',
                    icon: <UserOutlined />,
                    label: <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>{t('userLayout.profile')}</Link>,
                  },
                  {
                    key: '/courses',
                    icon: <BookOutlined />,
                    label: <Link to="/courses" onClick={() => setMobileMenuOpen(false)}>{t('userLayout.courses')}</Link>,
                  },
                  {
                    key: '/topics',
                    icon: <TagsOutlined />,
                    label: <Link to="/topics" onClick={() => setMobileMenuOpen(false)}>{t('userLayout.topics')}</Link>,
                  },
                ]}
              />
            </Drawer>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Language Selector */}
          <LanguageSelector />

          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-slate-800 leading-tight max-w-[140px] truncate">{user.name}</p>
                <p className="text-xs text-slate-500 capitalize">{user.role === 'admin' ? t('dashboard.roleAdmin') : t('dashboard.roleStudent')}</p>
              </div>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
                <Avatar
                  src={user.avatar}
                  icon={<UserOutlined />}
                  className="cursor-pointer border-2 border-blue-100 hover:border-blue-500 transition-colors shadow-sm shrink-0"
                  size="large"
                />
              </Dropdown>
            </div>
) : (
            <div className="flex items-center gap-2">
              {/* Login button: ẩn dưới lg (đã có trong menu hamburger) */}
              <Button type="text" onClick={() => navigate('/login')} className="hidden lg:block font-medium text-slate-600 hover:text-blue-600 whitespace-nowrap">
                {t('common.login')}
              </Button>
            </div>
          )}
        </div>
      </header>

{/* Main Content Area */}
      <main className="flex-1 w-full px-4 md:px-8 py-8 overflow-x-hidden">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-8 text-center text-slate-400 text-sm">
        <p>{t('userLayout.footer', { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}
