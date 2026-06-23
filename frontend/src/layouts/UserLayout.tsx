import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Dropdown, Avatar, Button, Select, type MenuProps, Drawer, Menu } from 'antd';
import { UserOutlined, LogoutOutlined, AppstoreOutlined, HomeOutlined, MenuOutlined } from '@ant-design/icons';
import LanguageSelector from '../components/LanguageSelector';
import { authGet } from '../services/auth/auth.get';
import type { Academy } from '../services/course';

export default function UserLayout() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [selectedAcademy, setSelectedAcademy] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter academies based on user permission
  const filterAcademiesForUser = (allAcademies: Academy[], currentUserId?: string): Academy[] => {
    if (!currentUserId) {
      return allAcademies.filter(a => a.isPublic);
    }
    return allAcademies.filter(a => {
      if (a.isPublic) return true;
      const assignedUserIds = a.users?.map(u => u.id) || [];
      return assignedUserIds.includes(Number(currentUserId));
    });
  };

  // Get academy name based on language
  const getAcademyName = (academy: Academy): string => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return academy.name_en || academy.name_vi || '';
    if (lang === 'zh') return academy.name_zh || academy.name_vi || '';
    return academy.name_vi || '';
  };

// Fetch academies on mount
  useEffect(() => {
    const fetchAcademies = async () => {
      try {
        let data: Academy[];
        
        // Use admin endpoint only for admin users, public endpoint for everyone else
        if (isAuthenticated && user?.role === 'admin') {
          const response = await authGet.getAcademies();
          data = response.data.academies;
        } else {
          const response = await authGet.getPublicAcademies();
          data = response.data.academies;
        }
        
        const filteredAcademies = filterAcademiesForUser(data, user?.id);
        setAcademies(filteredAcademies);
      } catch (error) {
        console.error('Failed to fetch academies:', error);
      }
    };
    fetchAcademies();
  }, [user?.id, user?.role, isAuthenticated]);

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAcademyChange = (value: number | null) => {
    setSelectedAcademy(value);
    if (value) {
      navigate(`/?academy=${value}`);
    } else {
      navigate('/');
    }
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
      icon: <AppstoreOutlined />,
      label: <Link to="/admin">Trang Quản Trị</Link>,
    }] : []),
    {
      key: 'logout',
      danger: true,
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      onClick: handleLogout,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-100 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-blue-500/30 transform group-hover:scale-105 transition-transform duration-200">
              E+
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Learning
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-slate-600 hover:text-blue-600 font-medium transition-colors flex items-center gap-1.5">
              <HomeOutlined /> Trang chủ
            </Link>
            <Link to="/profile" className="text-slate-600 hover:text-blue-600 font-medium transition-colors flex items-center gap-1.5">
              <UserOutlined /> Cá nhân
            </Link>
            {academies.length > 0 && (
              <Select
                value={selectedAcademy}
                onChange={handleAcademyChange}
                placeholder="Chọn học viện"
                allowClear
                showSearch
                optionFilterProp="children"
                className="min-w-[180px]"
                popupMatchSelectWidth={false}
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                options={academies.map(a => ({
                  value: a.id,
                  label: getAcademyName(a),
                }))}
              />
            )}
          </nav>

{/* Mobile Menu Button - chỉ hiện trên mobile */}
          <div className="md:hidden">
            <Button 
              type="text" 
              icon={<MenuOutlined />} 
              onClick={() => setMobileMenuOpen(true)}
            />
          </div>

          {/* Mobile Navigation Drawer - chỉ hiện trên mobile */}
          <div className="md:hidden">
            <Drawer
              title={
                <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg">
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
                    label: <Link to="/" onClick={() => setMobileMenuOpen(false)}>Trang chủ</Link>,
                  },
                  {
                    key: '/profile',
                    icon: <UserOutlined />,
                    label: <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>Cá nhân</Link>,
                  },
                  ...(academies.length > 0 ? [{
                    key: 'academies',
                    icon: <AppstoreOutlined />,
                    label: 'Học viện',
                    children: academies.map(a => ({
                      key: `/?academy=${a.id}`,
                      label: <Link to={`/?academy=${a.id}`} onClick={() => setMobileMenuOpen(false)}>{getAcademyName(a)}</Link>,
                    })),
                  }] : []),
                ]}
              />
            </Drawer>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Language Selector */}
          <LanguageSelector />

          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-slate-800 leading-tight">{user.name}</p>
                <p className="text-xs text-slate-500 capitalize">{user.role === 'admin' ? 'Quản trị viên' : 'Học viên'}</p>
              </div>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
                <Avatar
                  src={user.avatar}
                  icon={<UserOutlined />}
                  className="cursor-pointer border-2 border-blue-100 hover:border-blue-500 transition-colors shadow-sm"
                  size="large"
                />
              </Dropdown>
            </div>
) : (
            <div className="flex items-center gap-2">
              <Button type="text" onClick={() => navigate('/login')} className="font-medium text-slate-600 hover:text-blue-600">
                Đăng nhập
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-8 text-center text-slate-400 text-sm">
        <p>© {new Date().getFullYear()} E+ Learning Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
