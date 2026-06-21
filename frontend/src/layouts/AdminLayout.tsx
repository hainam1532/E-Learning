import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Dropdown, Avatar, Button, Drawer, type MenuProps } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  HomeOutlined,
  DashboardOutlined,
  BookOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  UserAddOutlined,
  SafetyOutlined,
  SettingOutlined,
  BankOutlined,
  IdcardOutlined,
  VideoCameraOutlined,
  CreditCardOutlined,
  AppstoreOutlined,
  FolderOutlined,
  ReadOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  SolutionOutlined,
  TeamOutlined,
  AuditOutlined,
  FileTextOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  TagOutlined,
  KeyOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useState, type ReactNode, useEffect } from 'react';
import LanguageSelector from '../components/LanguageSelector';

// TypeScript interfaces for menu structure
interface MenuChildItem {
  key: string;
  path: string;
  name: string;
  icon: ReactNode;
}

interface MenuItem {
  key: string;
  path?: string;
  name: string;
  icon: ReactNode;
  children?: MenuChildItem[];
}

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Accordion behavior - only one submenu open at a time
  const handleOpenChange = (keys: string[]) => {
    if (keys.length > 1) {
      setOpenKeys([keys[keys.length - 1]]);
    } else {
      setOpenKeys(keys);
    }
  };

  const handleMenuClick = () => {
    if (isMobile) setMobileOpen(false);
  };

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
    {
      key: 'home',
      icon: <HomeOutlined />,
      label: <Link to="/">Trang Học Viên</Link>,
    },
    {
      key: 'logout',
      danger: true,
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      onClick: handleLogout,
    },
  ];

  const menuItems: MenuItem[] = [
    {
      key: 'dashboard',
      path: '/admin',
      name: 'Tổng quan',
      icon: <DashboardOutlined />
    },
    {
      key: 'system',
      name: 'Quản lý hệ thống',
      icon: <SettingOutlined />,
      children: [
        { key: 'users', path: '/admin/users', name: 'Quản lý User', icon: <UserAddOutlined /> },
        { key: 'departments', path: '/admin/departments', name: 'Phòng ban', icon: <BankOutlined /> },
        { key: 'positions', path: '/admin/positions', name: 'Chức vụ', icon: <IdcardOutlined /> },
        { key: 'roles', path: '/admin/roles', name: 'Phân quyền', icon: <SafetyOutlined /> },
        { key: 'config', path: '/admin/config', name: 'Cấu hình', icon: <KeyOutlined /> },
      ],
    },
    {
      key: 'courses',
      name: 'Quản lý khóa học',
      icon: <BookOutlined />,
      children: [
        { key: 'courses-list', path: '/admin/courses', name: 'Danh sách khóa học', icon: <AppstoreOutlined /> },
        { key: 'courses-video', path: '/admin/courses/videos', name: 'Thư viện video', icon: <VideoCameraOutlined /> },
        { key: 'courses-card', path: '/admin/courses/cards', name: 'Thẻ khóa học', icon: <CreditCardOutlined /> },
        { key: 'courses-category', path: '/admin/courses/categories', name: 'Danh mục khóa học', icon: <FolderOutlined /> },
        { key: 'courses-special', path: '/admin/courses/special-topics', name: 'Chủ đề đặc biệt', icon: <TagOutlined /> },
      ],
    },
    {
      key: 'training',
      name: 'Quản lý đào tạo',
      icon: <ReadOutlined />,
      children: [
        { key: 'training-path', path: '/admin/training/paths', name: 'Lộ trình học tập', icon: <SolutionOutlined /> },
        { key: 'training-doc', path: '/admin/training/documents', name: 'Thư viện tài liệu', icon: <FileTextOutlined /> },
        { key: 'training-location', path: '/admin/training/locations', name: 'Địa điểm đào tạo', icon: <EnvironmentOutlined /> },
        { key: 'training-plan', path: '/admin/training/plans', name: 'Kế hoạch đào tạo', icon: <CalendarOutlined /> },
        { key: 'training-class', path: '/admin/training/classes', name: 'Quản lý lớp học', icon: <TeamOutlined /> },
        { key: 'training-instructor', path: '/admin/training/instructors', name: 'Quản lý giảng viên', icon: <AuditOutlined /> },
      ],
    },
    {
      key: 'exam',
      name: 'Quản lý kỳ thi',
      icon: <SolutionOutlined />,
      children: [
        { key: 'exam-questions', path: '/admin/exam/questions', name: 'Ngân hàng câu hỏi', icon: <ReadOutlined /> },
        { key: 'exam-papers', path: '/admin/exam/papers', name: 'Quản lý đề thi', icon: <FileTextOutlined /> },
        { key: 'exam-sessions', path: '/admin/exam/sessions', name: 'Quản lý kỳ thi', icon: <CalendarOutlined /> },
      ],
    },
    {
      key: 'reports',
      name: 'Báo cáo dữ liệu',
      icon: <BarChartOutlined />,
      children: [
        { key: 'reports-overview', path: '/admin/reports/overview', name: 'Báo cáo tổng quan học tập', icon: <BarChartOutlined /> },
        { key: 'reports-time', path: '/admin/reports/time', name: 'Báo cáo thời gian học tập', icon: <ClockCircleOutlined /> },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans">
{/* Sidebar - Desktop */}
      <aside className="hidden md:flex bg-white text-slate-700 flex-col border-r border-slate-200 shadow-sm transition-all duration-300">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 bg-white">
          <Link to="/admin" className="flex items-center gap-2 overflow-hidden">
            <div className="w-9 h-9 min-w-9 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20">
              A
            </div>
            {!collapsed && (
              <span className="text-lg font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent truncate whitespace-nowrap animate-fade-in">
                Admin Panel
              </span>
            )}
          </Link>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
          {!collapsed ? (
            <div className="flex flex-col gap-1">
              {menuItems.map((item) => {
                if (item.children) {
                  const isOpen = openKeys.includes(item.key);
                  return (
                    <div key={item.key} className="flex flex-col">
                      <button
                        onClick={() => handleOpenChange(isOpen ? [] : [item.key])}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150 ${
                          isOpen
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg flex items-center">{item.icon}</span>
                          <span className="truncate">{item.name}</span>
                        </div>
                        <span className={`text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                      </button>
                      {isOpen && (
                        <div className="flex flex-col gap-0.5 ml-3 mt-0.5 border-l border-blue-200 pl-2">
                          {item.children.map((child) => {
                            const isActive = location.pathname === child.path;
                            return (
                              <Link
                                key={child.path}
                                to={child.path}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-150 ${
                                  isActive
                                    ? 'bg-blue-500 text-white'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <span className="text-base flex items-center">{child.icon}</span>
                                <span className="truncate">{child.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                const path = item.path || '/admin';
                const isActive = location.pathname === path;
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-lg flex items-center">{item.icon}</span>
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            menuItems.map((item) => {
              if (item.children) {
                return (
                  <div key={item.key} className="relative group">
                    <button
                      onClick={() => {}}
                      className="flex items-center justify-center py-2.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer w-full"
                    >
                      <span className="text-lg flex items-center">{item.icon}</span>
                    </button>
                  </div>
                );
              }
              const path = item.path || '/admin';
              const isActive = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center justify-center py-2.5 rounded-lg font-medium text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-lg flex items-center">{item.icon}</span>
                </Link>
              );
            })
          )}
        </nav>

        {/* Sidebar Footer / Back to User Site */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 font-medium text-sm transition-colors"
          >
            <span className="text-lg flex items-center"><HomeOutlined /></span>
            {!collapsed && <span>Về Trang Chủ</span>}
          </Link>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
{/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shadow-sm sticky top-0 z-40">
          {/* Mobile: menu button / Desktop: collapse button */}
          {isMobile ? (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileOpen(true)}
              className="text-slate-600 text-lg hover:bg-slate-100 rounded-lg h-9 w-9 flex items-center justify-center"
            />
          ) : (
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="text-slate-600 text-lg hover:bg-slate-100 rounded-lg h-9 w-9 flex items-center justify-center"
            />
          )}

          <div className="flex items-center gap-4">
            {/* Language Selector */}
            <LanguageSelector />

            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                Administrator
              </span>
            </div>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <Avatar
                src={user?.avatar}
                icon={<UserOutlined />}
                className="cursor-pointer border border-slate-200 hover:border-blue-500 transition-colors shadow-sm"
                size="large"
              />
            </Dropdown>
          </div>
        </header>

{/* Page Working Content Area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer Menu */}
<Drawer
        title={
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-black text-sm">
              A
            </div>
            <span className="text-lg font-bold text-slate-800">Admin Panel</span>
          </Link>
        }
        placement="left"
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        size={280}
        className="md:hidden"
      >
        <div className="flex flex-col gap-1">
          {menuItems.map((item) => {
            if (item.children) {
              const isOpen = openKeys.includes(item.key);
              return (
                <div key={item.key} className="flex flex-col">
                  <button
                    onClick={() => handleOpenChange(isOpen ? [] : [item.key])}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150 ${
                      isOpen
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg flex items-center">{item.icon}</span>
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className={`text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-0.5 ml-3 mt-0.5 border-l border-blue-200 pl-2">
                      {item.children.map((child) => {
                        const isActive = location.pathname === child.path;
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={handleMenuClick}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-150 ${
                              isActive
                                ? 'bg-blue-500 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span className="text-base flex items-center">{child.icon}</span>
                            <span className="truncate">{child.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const path = item.path || '/admin';
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={handleMenuClick}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-lg flex items-center">{item.icon}</span>
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Mobile Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200 bg-slate-50">
          <Link
            to="/"
            onClick={handleMenuClick}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 font-medium text-sm transition-colors"
          >
            <span className="text-lg flex items-center"><HomeOutlined /></span>
            <span>Về Trang Chủ</span>
          </Link>
        </div>
      </Drawer>
    </div>
  );
}
