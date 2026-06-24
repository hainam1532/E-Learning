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
  Progress,
  message
} from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  BookOutlined, 
  HeartOutlined,
  HeartFilled,
  HistoryOutlined, 
  BarChartOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  CrownOutlined,
  CalendarOutlined,
  ReadOutlined
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getCourses } from '../../services/course';
import { getMyTrainingPlans, isTrainingPlanExpired, formatDateRange, getStatusDisplayText } from '../../services/training';
import { getWatchHistory, getMyStats, getMyLikedVideos } from '../../services/progress';
import type { WatchHistoryItem, LearningStats, LikedVideoItem } from '../../services/progress';
import type { Course } from '../../services/course';
import type { UserTrainingPlan } from '../../services/training';

const { Title, Text, Paragraph } = Typography;

// Helper function to format duration (seconds) to human-readable string
const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} giây`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins} phút`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}p` : `${hours} giờ`;
  }
};

// Helper function to format time (seconds to MM:SS) for watch position display
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Helper function to format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'Vừa xem';
  } else if (diffMins < 60) {
    return `${diffMins} phút trước`;
  } else if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  } else if (diffDays === 1) {
    return 'Hôm qua';
  } else if (diffDays < 7) {
    return `${diffDays} ngày trước`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} tuần trước`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} tháng trước`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} năm trước`;
  }
};

// Helper function to check if training plan is expired based on endDate
// Returns true if:
// - endDate exists AND
// - status is ACTIVE (not already COMPLETED/CANCELLED) AND
// - endDate is before today (or today but before current time)
const isPlanExpired = (endDate: string | null | undefined, status: string): boolean => {
  if (!endDate || status !== 'ACTIVE') return false;
  
  const end = new Date(endDate);
  const now = new Date();
  
  // Reset time to midnight for accurate date comparison
  const endDateMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // If endDate is before today, it's expired
  // If endDate is today, check if it's already passed (before check) - for safety, consider today as valid until end of day
  return endDateMidnight < nowDate;
};

// Helper function to get display status for training plan
const getPlanDisplayStatus = (
  endDate: string | null | undefined,
  status: string
): { text: string; color: string } => {
  // If already completed or cancelled, show original status
  if (status === 'COMPLETED') {
    return { text: 'Hoàn thành', color: 'green' };
  }
  if (status === 'CANCELLED') {
    return { text: 'Đã hủy', color: 'red' };
  }
  if (status === 'DRAFT') {
    return { text: 'Nháp', color: 'gold' };
  }
  
  // For ACTIVE status, check if expired
  if (endDate) {
    const end = new Date(endDate);
    const now = new Date();
    if (end < now) {
      return { text: 'Hết hạn', color: 'red' };
    }
  }
  
  return { text: 'Hoạt động', color: 'green' };
};

export default function Profile() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('training');
  const [courses, setCourses] = useState<Course[]>([]);
  const [trainingPlans, setTrainingPlans] = useState<UserTrainingPlan[]>([]);
  const [loadingTrainingPlans, setLoadingTrainingPlans] = useState(false);
  
// Watch history state
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
// Learning stats state
  const [stats, setStats] = useState<LearningStats>({
    monthlyDuration: 0,
    totalDuration: 0,
    coursesCompleted: 0,
    coursesInProgress: 0,
    totalCourses: 0,
    monthlyDurationByMonth: [],
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Liked videos state
  const [likedVideos, setLikedVideos] = useState<LikedVideoItem[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await getCourses();
        setCourses(data.slice(0, 6));
      } catch (error) {
        console.error('Failed to fetch courses:', error);
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    const fetchTrainingPlans = async () => {
      try {
        setLoadingTrainingPlans(true);
        const data = await getMyTrainingPlans();
        setTrainingPlans(data);
      } catch (error) {
        console.error('Failed to fetch training plans:', error);
        setTrainingPlans([]);
      } finally {
        setLoadingTrainingPlans(false);
      }
    };
    fetchTrainingPlans();
  }, []);

// Fetch watch history when history tab is active
  useEffect(() => {
    const fetchWatchHistory = async () => {
      if (activeTab !== 'history') return;
      
      try {
        setLoadingHistory(true);
        const data = await getWatchHistory();
        console.log('[Profile] Watch history raw data:', data.map(item => ({
          id: item.id,
          lessonId: item.lessonId,
          videoId: item.videoId,
          lessonTitle: item.lessonTitle,
          courseId: item.course?.id,
          courseTitle: item.course?.title_vi,
          videoName: item.video?.name
        })));
        setWatchHistory(data);
      } catch (error) {
        console.error('Failed to fetch watch history:', error);
        setWatchHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };
fetchWatchHistory();
  }, [activeTab]);

  // Fetch learning stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const data = await getMyStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  // Fetch liked videos
  useEffect(() => {
    const fetchLikedVideos = async () => {
      try {
        setLoadingLikes(true);
        const data = await getMyLikedVideos();
        setLikedVideos(data);
      } catch (error) {
        console.error('Failed to fetch liked videos:', error);
        setLikedVideos([]);
      } finally {
        setLoadingLikes(false);
      }
    };
    fetchLikedVideos();
  }, []);

  const menuItems = [
    { key: 'training', icon: <BookOutlined />, label: 'Đào tạo của tôi', count: courses.length },
    { key: 'favorites', icon: <HeartOutlined />, label: 'Yêu thích', count: likedVideos.length },
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
<Text>{stats.totalCourses}</Text>
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
                <Text strong className="text-blue-600">{formatDuration(stats.monthlyDuration)}</Text>
                <Text className="text-blue-500 block text-xs">học tháng này</Text>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3">
                <TrophyOutlined className="text-yellow-500 mr-2" />
                <Text strong className="text-yellow-600">{formatDuration(stats.totalDuration)}</Text>
                <Text className="text-yellow-600 block text-xs">tổng thời gian</Text>
              </div>
            </div>

{/* Department/Position */}
            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="mb-2">
                <TeamOutlined className="text-cyan-500 mr-2" />
                <Text type="secondary">Bộ phận</Text>
                <div className="font-medium">{user?.department?.name_vi || user?.department?.name_en || user?.department?.code || '---'}</div>
              </div>
              <div>
                <CrownOutlined className="text-purple-500 mr-2" />
                <Text type="secondary">Chức vụ</Text>
                <div className="font-medium">{user?.position?.name_vi || user?.position?.name_en || user?.position?.code || '---'}</div>
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
{/* Training Tab - Shows Training Plans with Progress */}
            {activeTab === 'training' && (
              <div>
                <Title level={5} className="!mb-4">Kế hoạch đào tạo của tôi</Title>
                {loadingTrainingPlans ? (
                  <div className="text-center py-12">
                    <Progress type="circle" percent={0} />
                  </div>
                ) : trainingPlans.length > 0 ? (
<div className="space-y-4">
{trainingPlans.map((plan) => {
// Check if plan is expired or completed - both cases should not allow access
                      // isExpired checks for ACTIVE status with passed endDate
                      const isExpired = isPlanExpired(plan.endDate, plan.status);
                      // If status is COMPLETED (either manually set or auto-expired by backend), don't allow access
                      const isCompleted = plan.status === 'COMPLETED';
                      const canAccess = !isExpired && !isCompleted;
                      // Get display status for showing badge
                      const displayStatus = getPlanDisplayStatus(plan.endDate, plan.status);
                      
return (
<div 
                        key={plan.id}
                        className="rounded-lg border overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          if (!canAccess) {
                            // Show warning message when trying to access expired/completed plan
                            if (isExpired) {
                              message.warning('Kế hoạch đào tạo đã hết hạn. Vui lòng liên hệ quản trị viên để được thêm vào lớp học mới.');
                            } else if (isCompleted) {
                              message.info('Kế hoạch đào tạo đã hoàn thành.');
                            }
                            return;
                          }
                          // Navigate to the first course in the plan
                          const firstCourseResource = plan.resources?.find(r => r.type === 'COURSE' && r.refId);
                          if (firstCourseResource?.refId) {
                            navigate(`/learn/${firstCourseResource.refId}`);
                          }
                        }}
                      >
                        <div className="flex flex-col md:flex-row">
{/* Cover Image - Priority: plan.coverImage -> resource.course?.coverImage -> placeholder */}
                          <div className="w-full md:w-48 h-32 flex-shrink-0">
                            {(() => {
                              // Get image from first course resource if exists
                              const firstCourseResource = plan.resources?.find(r => r.type === 'COURSE' && r.course?.coverImage);
                              const imgSrc = plan.coverImage || firstCourseResource?.course?.coverImage;
                              return (
                                <img 
                                  alt={plan.title_vi} 
                                  src={imgSrc || `https://via.placeholder.com/300x150?text=${encodeURIComponent(plan.trainingClass?.name_vi || 'Training')}`} 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    // Fallback when image fails to load
                                    e.currentTarget.src = `https://via.placeholder.com/300x150?text=${encodeURIComponent(plan.trainingClass?.name_vi || 'Training')}`;
                                  }}
                                />
                              );
                            })()}
                          </div>
                          
                          {/* Plan Info */}
                          <div className="flex-1 p-4">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                              <div className="flex-1">
                                <Paragraph ellipsis={{ rows: 2 }} className="!mb-2 text-base font-medium">
                                  {plan.title_vi || 'Kế hoạch đào tạo'}
                                </Paragraph>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                                  {plan.trainingClass && (
                                    <Tag icon={<BookOutlined />} color="blue">
                                      {plan.trainingClass.name_vi || plan.trainingClass.name_en || plan.trainingClass.code}
                                    </Tag>
                                  )}
                                  {plan.academy && (
                                    <Tag icon={<CalendarOutlined />} color="purple">
                                      {plan.academy.name_vi || plan.academy.name_en || plan.academy.code}
                                    </Tag>
                                  )}
                                </div>
                              </div>
                              
                              {/* Progress & Status */}
                              <div className="flex flex-col items-end">
                                <Tag color={displayStatus.color as any} className="!mb-1">
                                  {displayStatus.text}
                                </Tag>
                                <div className="text-lg font-semibold text-blue-600">
                                  {plan.progressPercent}%
                                </div>
                                <Text type="secondary" className="text-xs">
                                  {plan.completedVideos}/{plan.totalVideos} video
                                </Text>
                              </div>
                            </div>
                            
{/* Date Range Display with Badges */}
{(plan.startDate || plan.endDate) && (
  <div className="mt-2 flex flex-wrap gap-2">
    {plan.startDate && (
      <Tag color="blue" icon={<CalendarOutlined />} className="text-xs">
        Bắt đầu: {new Date(plan.startDate).toLocaleDateString('vi-VN')}
      </Tag>
    )}
    {plan.endDate && (
      <Tag 
        color={isExpired ? 'red' : 'green'} 
        icon={<CalendarOutlined />}
        className="text-xs"
      >
        {isExpired ? 'Hết hạn: ' : 'Kết thúc: '} 
        {new Date(plan.endDate).toLocaleDateString('vi-VN')}
      </Tag>
    )}
  </div>
)}
                            
{/* Progress Bar */}
                            <Progress 
                              percent={plan.progressPercent} 
                              size="small" 
                              className="!mt-3"
                              strokeColor={plan.progressPercent === 100 ? '#22c55e' : '#1890ff'}
                            />
                            
                            {/* Resources/Courses in this plan */}
                            {plan.resources && plan.resources.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-100">
                                <Text type="secondary" className="text-xs block !mb-2">Nội dung khóa học:</Text>
                                <div className="flex flex-wrap gap-2">
                                  {plan.resources.slice(0, 3).map((resource, idx) => (
                                    <Tag 
                                      key={resource.id} 
                                      icon={<ReadOutlined />}
                                      color={resource.progressPercent === 100 ? 'success' : resource.progressPercent > 0 ? 'processing' : 'default'}
                                    >
                                      {resource.course?.title_vi || resource.title_vi || `Khóa ${idx + 1}`}
                                      {resource.progressPercent > 0 && ` (${resource.progressPercent}%)`}
                                    </Tag>
                                  ))}
                                  {plan.resources.length > 3 && (
                                    <Tag>+{plan.resources.length - 3} khác</Tag>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <BookOutlined className="text-4xl mb-2" />
                    <p>Chưa có kế hoạch đào tạo nào</p>
                    <Text type="secondary" className="text-sm">Vui lòng liên hệ quản trị viên để được thêm vào lớp học</Text>
                  </div>
                )}
              </div>
            )}

            {/* Favorites Tab */}
            {activeTab === 'favorites' && (
              <div>
                <Title level={5} className="!mb-4">Video yêu thích</Title>
                {loadingLikes ? (
                  <div className="text-center py-12 text-slate-400">
                    <ReadOutlined className="text-4xl mb-2" />
                    <p>Đang tải...</p>
                  </div>
                ) : likedVideos.length > 0 ? (
                  <Row gutter={[16, 16]}>
                    {likedVideos.map((item) => (
                      <Col xs={24} sm={12} md={8} key={item.likeId}>
                        <div
                          className="rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            if (item.courseId && item.lessonId) {
                              navigate(`/learn/${item.courseId}?lessonId=${item.lessonId}&videoId=${item.videoId}`);
                            } else if (item.courseId) {
                              navigate(`/learn/${item.courseId}/${item.videoId}`);
                            }
                          }}
                        >
                          <div className="relative h-32 bg-slate-900">
                            {item.thumbnailUrl ? (
                              <img
                                alt={item.videoName || ''}
                                src={item.thumbnailUrl}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <PlayCircleOutlined className="text-slate-400 text-3xl" />
                              </div>
                            )}
                            <HeartFilled className="absolute top-2 right-2 text-red-500 text-lg" />
                            {item.duration && (
                              <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                                {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <Paragraph ellipsis={{ rows: 2 }} className="!mb-1 text-sm font-medium">
                              {item.videoName || 'Video'}
                            </Paragraph>
                            {item.course && (
                              <Text type="secondary" className="text-xs block truncate">
                                {item.course.title_vi || item.course.title_en}
                              </Text>
                            )}
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <HeartOutlined className="text-4xl mb-2" />
                    <p>Chưa có video yêu thích</p>
                    <Text type="secondary" className="text-xs">Like video trong trang học để lưu vào đây</Text>
                  </div>
                )}
              </div>
            )}

{/* History Tab */}
            {activeTab === 'history' && (
              <div>
                <Title level={5} className="!mb-4">Lịch sử xem gần đây</Title>
                {loadingHistory ? (
                  <div className="text-center py-12">
                    <Progress type="circle" percent={0} />
                  </div>
                ) : watchHistory.length > 0 ? (
<div className="space-y-3">
{watchHistory.map((item) => {
                      // Get thumbnail - try video first, then course cover
                      const thumbnailSrc = item.video?.thumbnailUrl || item.course?.coverImage || 'https://via.placeholder.com/100x80';
// Video name - priority: video.name -> lessonTitle -> fallback
                      const videoName = item.video?.name || item.lessonTitle || 'Video';
                      const courseTitle = item.course?.title_vi || item.course?.title_en || item.course?.title_zh || 'Khóa học';
                      const courseId = item.course?.id;
                      const lessonId = item.lessonId;
                      const videoId = item.videoId;
                      
                      return (
<div 
                          key={item.id} 
                          className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:shadow-md cursor-pointer"
onClick={() => {
                            // Navigate to course with lessonId and videoId in query string
                            if (courseId) {
                              const params = new URLSearchParams();
                              if (lessonId) params.set('lessonId', String(lessonId));
                              if (videoId) params.set('videoId', String(videoId));
                              const queryString = params.toString();
                              navigate(`/learn/${courseId}${queryString ? `?${queryString}` : ''}`);
                            }
                          }}
                        >
                          <div className="w-24 h-16 rounded overflow-hidden flex-shrink-0">
                            <img 
                              src={thumbnailSrc} 
                              alt={courseTitle}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'https://via.placeholder.com/100x80';
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Video name - more prominent */}
                            <Paragraph ellipsis={{ rows: 1 }} className="!mb-0 font-medium text-blue-600">
                              {videoName}
                            </Paragraph>
                            {/* Course name - secondary */}
                            <Text type="secondary" className="text-xs block">
                              Khóa: {courseTitle}
                            </Text>
                            {/* Watch status */}
                            <div className="flex items-center gap-2 mt-1">
                              <Progress percent={item.progressPercent} size="small" className="!mb-0 w-20" />
                              <Text type="secondary" className="text-xs">
                                {item.completed 
                                  ? 'Đã xem xong' 
                                  : `Dừng lại ${formatTime(item.watchedSeconds)}`
                                }
                              </Text>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Text type="secondary" className="text-xs">
                              {formatRelativeTime(item.updatedAt)}
                            </Text>
<Button 
                              type="primary" 
                              icon={<PlayCircleOutlined />} 
                              className="flex-shrink-0"
                              size="small"
onClick={(e) => {
                                e.stopPropagation();
                                // Debug log
                                console.log('[Profile] Navigate to learn:', {
                                  courseId,
                                  lessonId,
                                  videoId,
                                  url: `/learn/${courseId}${lessonId ? `?lessonId=${lessonId}${videoId ? `&videoId=${videoId}` : ''}` : videoId ? `/${videoId}` : ''}`
                                });
                                // Navigate to course - with lessonId and videoId if available
                                // Prefer using lessonId to find the correct video position in course
                                if (courseId) {
                                  const params = new URLSearchParams();
                                  if (lessonId) params.set('lessonId', String(lessonId));
                                  if (videoId) params.set('videoId', String(videoId));
                                  const queryString = params.toString();
                                  navigate(`/learn/${courseId}${queryString ? `?${queryString}` : ''}`);
                                }
                              }}
                            >
                              {item.completed ? 'Xem lại' : 'Tiếp tục'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <HistoryOutlined className="text-4xl mb-2" />
                    <p>Chưa có lịch sử xem</p>
                    <Text type="secondary" className="text-sm">Hãy bắt đầu xem video để theo dõi tiến trình</Text>
                  </div>
                )}
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
                      <div className="text-2xl font-bold">{formatDuration(stats.monthlyDuration)}</div>
                      <div className="text-sm opacity-80">tháng này</div>
                    </div>
                  </Col>
                  <Col xs={12} md={6}>
                    <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl p-4 text-white">
                      <TrophyOutlined className="text-2xl mb-2" />
                      <div className="text-2xl font-bold">{formatDuration(stats.totalDuration)}</div>
                      <div className="text-sm opacity-80">tích lũy</div>
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
                  <Title level={5} className="!mb-4">Hoạt động học tập (6 tháng gần nhất)</Title>
                  {stats.monthlyDurationByMonth && stats.monthlyDurationByMonth.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={stats.monthlyDurationByMonth.map(item => ({
                            // Convert seconds to minutes for display (more accurate for small values)
                            minutes: Math.round(item.duration / 60 * 10) / 10,
                            // Format month for display (YYYY-MM -> MM/Y)
                            label: item.month.split('-')[1] + '/' + item.month.split('-')[0].slice(2)
                          }))}
                          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis 
                            dataKey="label" 
                            tick={{ fontSize: 12 }} 
                            stroke="#64748b"
                          />
<YAxis 
                            tick={{ fontSize: 12 }} 
                            stroke="#64748b"
                            tickFormatter={(value) => value ? `${value}p` : '0p'}
                          />
                          <Tooltip 
                            formatter={(value) => [
                              formatDuration(Math.round((value as number) * 60)),
                              'Thời gian học'
                            ]}
                            labelFormatter={(label) => `Tháng ${label}`}
                            contentStyle={{ 
                              backgroundColor: '#fff', 
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px'
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="minutes" 
                            name="Thời gian học"
                            stroke="#1890ff" 
                            strokeWidth={2}
                            dot={{ fill: '#1890ff', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: '#1890ff' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <BarChartOutlined className="text-4xl mb-2" />
                      <p>Chưa có dữ liệu học tập</p>
                      <Text type="secondary" className="text-sm">Hãy bắt đầu xem video để theo dõi tiến trình</Text>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
