import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { 
  Avatar, 
  Tag, 
  Button, 
  Typography, 
  Row, 
  Col,
  Rate,
  Progress
} from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  BookOutlined, 
  HeartOutlined, 
  HistoryOutlined, 
  BarChartOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  CrownOutlined
} from '@ant-design/icons';
import { getCourses } from '../../services/course';
import type { Course } from '../../services/course';

const { Title, Text, Paragraph } = Typography;

interface LearningStats {
  monthlyDuration: number;
  totalDuration: number;
  coursesCompleted: number;
  coursesInProgress: number;
}

interface WatchHistoryItem {
  id: number;
  courseTitle: string;
  videoTitle: string;
  watchedAt: string;
  progress: number;
  thumbnail?: string;
}

export default function Profile() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('training');
  const [courses, setCourses] = useState<Course[]>([]);
  const [favoriteCourses, setFavoriteCourses] = useState<Course[]>([]);
  
  const [stats] = useState<LearningStats>({
    monthlyDuration: 420,
    totalDuration: 2880,
    coursesCompleted: 5,
    coursesInProgress: 3,
  });

  const watchHistory: WatchHistoryItem[] = [
    { id: 1, courseTitle: 'ReactJS Cơ bản', videoTitle: 'Bài 1: Giới thiệu React', watchedAt: '2 giờ trước', progress: 100 },
    { id: 2, courseTitle: 'TypeScript Nâng cao', videoTitle: 'Bài 3: Generics', watchedAt: 'Hôm qua', progress: 75 },
    { id: 3, courseTitle: 'NodeJS Backend', videoTitle: 'Bài 2: Express Router', watchedAt: 'Hôm qua', progress: 100 },
    { id: 4, courseTitle: 'ReactJS Cơ bản', videoTitle: 'Bài 2: JSX', watchedAt: '2 ngày trước', progress: 100 },
  ];

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await getCourses();
        setCourses(data.slice(0, 6));
        setFavoriteCourses(data.slice(0, 4));
      } catch (error) {
        console.error('Failed to fetch courses:', error);
      }
    };
    fetchCourses();
  }, []);

  const menuItems = [
    { key: 'training', icon: <BookOutlined />, label: 'Đào tạo của tôi', count: courses.length },
    { key: 'favorites', icon: <HeartOutlined />, label: 'Yêu thích', count: favoriteCourses.length },
    { key: 'history', icon: <HistoryOutlined />, label: 'Lịch sử xem', count: watchHistory.length },
    { key: 'statistics', icon: <BarChartOutlined />, label: 'Thống kê', count: 0 },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Sidebar - User Info */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-white rounded-lg border border-slate-200 p-4 sticky top-4">
            {/* User Info */}
            <div className="text-center mb-4 font-semibold">
              <Avatar 
                size={80} 
                src={user?.avatar} 
                icon={<UserOutlined />}
                className="border-2 border-blue-100 mb-3"
              />
              <Title level={4} className="!mb-1 !mt-0">{user?.name}</Title>
              <Text type="secondary" className="text-sm block mb-2">
                {user?.role === 'admin' ? 'Quản trị viên' : 'Học viên'}
              </Text>
              <Tag icon={<UserOutlined />} color="blue">{user?.usercode}</Tag>
            </div>

            {/* Course Stats */}
            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <BookOutlined className="text-blue-500" />
                  <Text strong>Số lượng khóa học</Text>
                </div>
                <Text>{courses.length}</Text>
              </div>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircleOutlined className="text-green-500" />
                  <Text>Đã hoàn thành</Text>
                </div>
                <Text>{stats.coursesCompleted}</Text>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ClockCircleOutlined className="text-orange-500" />
                  <Text>Đang học</Text>
                </div>
                <Text>{stats.coursesInProgress}</Text>
              </div>
            </div>

            {/* Time Stats */}
            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="bg-blue-50 rounded-lg p-3 mb-2">
                <ClockCircleOutlined className="text-blue-500 mr-2" />
                <Text strong className="text-blue-600">{stats.monthlyDuration} phút</Text>
                <Text className="text-blue-500 block text-xs">học tháng này</Text>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3">
                <TrophyOutlined className="text-yellow-500 mr-2" />
                <Text strong className="text-yellow-600">{stats.totalDuration} phút</Text>
                <Text className="text-yellow-600 block text-xs">tổng thời gian</Text>
              </div>
            </div>

            {/* Department/Position */}
            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="mb-2">
                <TeamOutlined className="text-cyan-500 mr-2" />
                <Text type="secondary">Bộ phận</Text>
                <div className="font-medium">---</div>
              </div>
              <div>
                <CrownOutlined className="text-purple-500 mr-2" />
                <Text type="secondary">Chức vụ</Text>
                <div className="font-medium">---</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Tab Navigation */}
          <div className="bg-white rounded-lg border border-slate-200 mb-4">
            <div className="flex overflow-x-auto font-semibold">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === item.key 
                      ? 'border-blue-500 text-blue-600 bg-blue-50' 
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.count > 0 && (
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            {/* Training Tab */}
            {activeTab === 'training' && (
              <div>
                <Title level={5} className="!mb-4">Khóa học của tôi</Title>
                {courses.length > 0 ? (
                  <Row gutter={[16, 16]}>
                    {courses.map((course) => (
                      <Col xs={24} sm={12} md={8} key={course.id}>
                        <div 
                          className="rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => navigate(`/?course=${course.id}`)}
                        >
                          <div className="relative h-32">
                            <img 
                              alt={course.title_vi} 
                              src={course.coverImage || 'https://via.placeholder.com/300x150'} 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <PlayCircleOutlined className="text-white text-3xl" />
                            </div>
                          </div>
                          <div className="p-3">
                            <Paragraph ellipsis={{ rows: 2 }} className="!mb-2 text-sm font-medium">
                              {course.title_vi}
                            </Paragraph>
                            <div className="flex items-center justify-between">
                              <Rate disabled value={course.rating} className="text-xs" /> 
                              <Text type="secondary" className="text-xs">{course.rating}</Text>
                            </div>
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <BookOutlined className="text-4xl mb-2" />
                    <p>Chưa có khóa học nào</p>
                  </div>
                )}
              </div>
            )}

            {/* Favorites Tab */}
            {activeTab === 'favorites' && (
              <div>
                <Title level={5} className="!mb-4">Yêu thích</Title>
                {favoriteCourses.length > 0 ? (
                  <Row gutter={[16, 16]}>
                    {favoriteCourses.map((course) => (
                      <Col xs={24} sm={12} md={8} key={course.id}>
                        <div 
                          className="rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => navigate(`/?course=${course.id}`)}
                        >
                          <div className="relative h-32">
                            <img 
                              alt={course.title_vi} 
                              src={course.coverImage || 'https://via.placeholder.com/300x150'} 
                              className="w-full h-full object-cover"
                            />
                            <HeartOutlined className="absolute top-2 right-2 text-red-500 text-xl" />
                          </div>
                          <div className="p-3">
                            <Paragraph ellipsis={{ rows: 2 }} className="!mb-2 text-sm font-medium">
                              {course.title_vi}
                            </Paragraph>
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <HeartOutlined className="text-4xl mb-2" />
                    <p>Chưa có khóa yêu thích</p>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                <Title level={5} className="!mb-4">Lịch sử xem gần đây</Title>
                <div className="space-y-3">
                  {watchHistory.map((item) => (
                    <div 
                      key={item.id} 
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:shadow-md cursor-pointer"
                      onClick={() => navigate(`/?course=${item.id}`)}
                    >
                      <div className="w-24 h-16 rounded overflow-hidden flex-shrink-0">
                        <img 
                          src={item.thumbnail || 'https://via.placeholder.com/100x80'} 
                          alt={item.courseTitle}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Paragraph ellipsis={{ rows: 1 }} className="!mb-0 font-medium">
                          {item.courseTitle}
                        </Paragraph>
                        <Text type="secondary" className="text-xs">{item.videoTitle}</Text>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress percent={item.progress} size="small" className="!mb-0 w-20" />
                          <Text type="secondary" className="text-xs">{item.watchedAt}</Text>
                        </div>
                      </div>
                      <Button type="primary" icon={<PlayCircleOutlined />} className="flex-shrink-0">
                        Xem
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Statistics Tab */}
            {activeTab === 'statistics' && (
              <div>
                <Title level={5} className="!mb-4">Thống kê học tập</Title>
                <Row gutter={[16, 16]}>
                  <Col xs={12} md={6}>
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                      <ClockCircleOutlined className="text-2xl mb-2" />
                      <div className="text-2xl font-bold">{stats.monthlyDuration}</div>
                      <div className="text-sm opacity-80">phút tháng này</div>
                    </div>
                  </Col>
                  <Col xs={12} md={6}>
                    <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl p-4 text-white">
                      <TrophyOutlined className="text-2xl mb-2" />
                      <div className="text-2xl font-bold">{stats.totalDuration}</div>
                      <div className="text-sm opacity-80">phút tích lũy</div>
                    </div>
                  </Col>
                  <Col xs={12} md={6}>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                      <CheckCircleOutlined className="text-2xl mb-2" />
                      <div className="text-2xl font-bold">{stats.coursesCompleted}</div>
                      <div className="text-sm opacity-80">khóa hoàn thành</div>
                    </div>
                  </Col>
                  <Col xs={12} md={6}>
                    <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl p-4 text-white">
                      <TeamOutlined className="text-2xl mb-2" />
                      <div className="text-2xl font-bold">{stats.coursesInProgress}</div>
                      <div className="text-sm opacity-80">khóa đang học</div>
                    </div>
                  </Col>
                </Row>

                <div className="mt-6">
                  <Title level={5} className="!mb-4">Tiến độ học tập</Title>
                  <div className="space-y-4">
                    {courses.slice(0, 4).map((course, idx) => (
                      <div key={course.id} className="flex items-center gap-3">
                        <div className="w-32 truncate text-sm font-medium">{course.title_vi}</div>
                        <div className="flex-1">
                          <Progress 
                            percent={Math.floor(Math.random() * 100)} 
                            strokeColor="#1890ff"
                          />
                        </div>
                        <div className="w-12 text-right text-sm text-slate-500">
                          {Math.floor(Math.random() * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
