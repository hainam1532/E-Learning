import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Card, 
  Button, 
  Badge, 
  Typography, 
  Row, 
  Col, 
  Spin, 
  Avatar,
  Tag,
  Divider,
  message,
  Drawer,
  Tabs
} from 'antd';
import { 
  PlayCircleOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  BookOutlined,
  UserOutlined,
  StarOutlined,
  LockOutlined,
  GlobalOutlined,
  FileTextOutlined,
  SnippetsOutlined,
  HeartOutlined,
  HeartFilled
} from '@ant-design/icons';
import { getCourse, getCourseWithProgress } from '../../services/course';
import { getCourseProgress, markLessonCompleted, toggleVideoLike, getVideoLikeStatus } from '../../services/progress';
import { useAuthStore } from '../../store/authStore';
import VideoPlayer from '../../components/VideoPlayer';
import CourseProgressBar from '../../components/CourseProgressBar';
import type { Course, CourseVideo, Video } from '../../services/course';

const { Title, Text, Paragraph } = Typography;

export default function CourseLearn() {
const { courseId, videoId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get additional params from query string (lessonId)
  const lessonIdFromQuery = searchParams.get('lessonId');
  const videoIdFromQuery = searchParams.get('videoId');
  const { user, isAuthenticated } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [courseProgress, setCourseProgress] = useState<any>(null);
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
const [expandedLesson, setExpandedLesson] = useState<number | null>(null);
  const [contentDrawerOpen, setContentDrawerOpen] = useState(false);
  const [activeContentTab, setActiveContentTab] = useState('video');

  // Like state
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  // Determine if this is an academy course (has academyId) - progress tracking enabled
  const isAcademyCourse = useMemo(() => {
    return !!course?.academyId;
  }, [course?.academyId]);
  
  // Track progress only for academy courses
  const trackProgress = isAcademyCourse && isAuthenticated;

  // Parse course ID
  const courseIdNum = useMemo(() => {
    return courseId ? parseInt(courseId) : null;
  }, [courseId]);
  
// Parse video ID from params or use first video
  const videoIdNum = useMemo(() => {
    if (videoId) {
      const parsed = parseInt(videoId);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return null;
  }, [videoId]);

  // Fetch course data
  useEffect(() => {
    const fetchCourse = async () => {
      if (!courseIdNum) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Get course with progress if authenticated and academy course
        let courseData: Course;
        if (trackProgress) {
          courseData = await getCourseWithProgress(courseIdNum);
        } else {
          courseData = await getCourse(courseIdNum);
        }
        
        setCourse(courseData);
        
// Get progress for academy courses
        if (trackProgress) {
          const progress = await getCourseProgress(courseIdNum);
          setCourseProgress(progress);
        }
        
// Set current video - validate videoId exists in course
        // Also check lessons for videoId as fallback
        const lessonVideoIds = courseData.lessons?.map(l => l.videoId).filter(Boolean) || [];
        
        console.log('[CourseLearn] Setting video:', {
          videoIdNum,
          lessonIdFromQuery,
          videoIdFromQuery,
          courseVideoIds: courseData.courseVideos?.map(cv => cv.videoId),
          lessonVideoIds,
          lessonCount: courseData.lessons?.length,
          courseVideoCount: courseData.courseVideos?.length,
          lessons: courseData.lessons?.map(l => ({id: l.id, title: l.title, order: l.order, videoId: l.videoId}))
        });
        
        const courseVideoIds = courseData.courseVideos?.map(cv => cv.videoId) || [];
        
        // Priority 1: Use videoId from URL params if exists in course
        // Priority 2: Use lessonId from query string to find video by position
        let targetVideoId = null;
        
        // Try videoId from params first
        if (videoIdNum && courseVideoIds.includes(videoIdNum)) {
          console.log('[CourseLearn] Using videoId from params:', videoIdNum);
          targetVideoId = videoIdNum;
        }
        
        // Try videoId from query string
        if (!targetVideoId && videoIdFromQuery) {
          const parsedVideoId = parseInt(videoIdFromQuery);
          if (!isNaN(parsedVideoId) && courseVideoIds.includes(parsedVideoId)) {
            console.log('[CourseLearn] Using videoId from query:', parsedVideoId);
            targetVideoId = parsedVideoId;
          }
        }
        
        // Try lessonId from query string - find by lesson ID and get video
        if (!targetVideoId && lessonIdFromQuery) {
          const parsedLessonId = parseInt(lessonIdFromQuery);
          if (!isNaN(parsedLessonId)) {
            // Find lesson by ID
            const targetLesson = courseData.lessons?.find(l => l.id === parsedLessonId);
            if (targetLesson) {
              console.log('[CourseLearn] Found lesson by ID:', targetLesson);
              if (targetLesson.videoId && courseVideoIds.includes(targetLesson.videoId)) {
                targetVideoId = targetLesson.videoId;
              } else {
                // Map by order position
                const sortedVideos = [...(courseData.courseVideos || [])].sort((a, b) => a.order - b.order);
                const lessonIndex = courseData.lessons?.findIndex(l => l.id === parsedLessonId) ?? -1;
                if (lessonIndex >= 0 && sortedVideos[lessonIndex]) {
                  targetVideoId = sortedVideos[lessonIndex].videoId;
                  console.log('[CourseLearn] Mapped lesson to video by order:', { lessonIndex, targetVideoId });
                }
              }
            }
          }
        }
        
// Fallback: use first video if no videoId found
        if (!targetVideoId && courseData.courseVideos && courseData.courseVideos.length > 0) {
          const sortedVideos = [...courseData.courseVideos].sort((a, b) => a.order - b.order);
          targetVideoId = sortedVideos[0]?.videoId;
        } else if (!targetVideoId && lessonVideoIds.length > 0) {
          targetVideoId = lessonVideoIds[0];
        }
        
        console.log('[CourseLearn] Target videoId:', targetVideoId);
        
        if (targetVideoId) {
          setCurrentVideoId(targetVideoId);
        }
        
      } catch (error) {
        console.error('Failed to fetch course:', error);
        message.error('Failed to load course');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCourse();
  }, [courseIdNum, videoIdNum, trackProgress]);

  // Get video list from course
  const videoList = useMemo((): CourseVideo[] => {
    if (!course?.courseVideos) return [];
    return course.courseVideos.sort((a, b) => a.order - b.order);
  }, [course?.courseVideos]);

// Get current video data
  const currentCourseVideo = useMemo((): CourseVideo | null => {
    if (!currentVideoId || !videoList) return null;
    return videoList.find(v => v.videoId === currentVideoId) || null;
  }, [currentVideoId, videoList]);

  // Get lesson for current video
  const currentLesson = useMemo(() => {
    if (!currentCourseVideo) return null;
    // Find lesson directly matching videoId in the course lessons
    const lesson = course?.lessons?.find(l => l.videoId === currentCourseVideo.videoId);
    if (lesson) return lesson;
    // Fallback: try to find by index position
    const videoIndex = videoList.findIndex(v => v.videoId === currentCourseVideo.videoId);
    if (videoIndex >= 0 && course?.lessons?.[videoIndex]) {
      return course.lessons[videoIndex];
    }
    return null;
  }, [course?.lessons, currentCourseVideo, videoList]);

  // Handle video selection
  const handleSelectVideo = (videoId: number) => {
    setCurrentVideoId(videoId);
    setIsVideoPlaying(false);
    navigate(`/learn/${courseIdNum}/${videoId}`, { replace: true });
  };

  // Handle video completion
  const handleVideoComplete = async () => {
    if (!trackProgress || !currentLesson) return;
    
    try {
      await markLessonCompleted(currentLesson.id);
      
      // Refresh progress
      if (courseIdNum) {
        const progress = await getCourseProgress(courseIdNum);
        setCourseProgress(progress);
      }
      
      // Auto-play next video if available
      const currentIndex = videoList.findIndex(v => v.videoId === currentVideoId);
      if (currentIndex < videoList.length - 1) {
        const nextVideo = videoList[currentIndex + 1];
        handleSelectVideo(nextVideo.videoId);
      }
    } catch (error) {
      console.error('Failed to mark complete:', error);
    }
  };

  // Handle time update
  const handleTimeUpdate = (seconds: number) => {
    console.log('Time update:', seconds);
    // Could update a live progress indicator here
  };

  // Fetch like status when video changes
  useEffect(() => {
    const fetchLikeStatus = async () => {
      if (!currentVideoId || !isAuthenticated) return;
      try {
        const status = await getVideoLikeStatus(currentVideoId);
        setLiked(status.liked);
        setLikeCount(status.likeCount);
      } catch {
        setLiked(false);
        setLikeCount(0);
      }
    };
    fetchLikeStatus();
  }, [currentVideoId, isAuthenticated]);

  // Handle like toggle
  const handleLike = async () => {
    if (!currentVideoId || !isAuthenticated || likeLoading) return;
    setLikeLoading(true);
    try {
      const result = await toggleVideoLike(currentVideoId);
      setLiked(result.liked);
      setLikeCount(result.likeCount);
      message.success(result.liked ? 'Đã thêm vào yêu thích' : 'Đã bỏ yêu thích');
    } catch {
      message.error('Không thể cập nhật yêu thích');
    } finally {
      setLikeLoading(false);
    }
  };

  // Handle playing state change from VideoPlayer
  const handlePlayingChange = (playing: boolean) => {
    setIsVideoPlaying(playing);
  };

  // Get language
  const getTitle = () => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return course?.title_en || course?.title_vi || 'Course';
    if (lang === 'zh') return course?.title_zh || course?.title_vi || 'Course';
    return course?.title_vi || 'Course';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <Title level={4}>Course not found</Title>
        <Button type="primary" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 -mx-4 xl:mx-0">
      {/* Main Content - Video + Info */}
      <div className="flex-1 min-w-0 xl:max-w-[calc(100%-21rem)]">
        {/* Video Player - Full width for all screens */}
        <div className="w-full aspect-video">
          {currentCourseVideo?.video ? (
            <VideoPlayer
              videoId={currentCourseVideo.videoId}
              videoName={currentCourseVideo.video?.name}
              courseRule={course.rule}
              lessonId={currentLesson?.id}
              trackProgress={trackProgress}
              onTimeUpdate={handleTimeUpdate}
              onComplete={handleVideoComplete}
              onPlayingChange={handlePlayingChange}
            />
          ) : (
            <div className="w-full h-full bg-slate-900 rounded-lg flex items-center justify-center">
              <div className="text-white text-center">
                <PlayCircleOutlined className="text-4xl mb-2" />
                <p>Select a video to start learning</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Video + Course Info - Combined Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 mt-4">
{/* Title Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <Title level={4} className="!mb-0">
                {/* Priority: video.name -> lesson.title -> video order number */}
                {(() => {
                  const videoIdx = videoList.findIndex(v => v.videoId === currentVideoId);
                  const videoNm = currentCourseVideo?.video?.name;
                  const lessonTtl = currentLesson?.title;
                  if (videoNm) return videoNm;
                  if (lessonTtl) return lessonTtl;
                  return `Video ${videoIdx >= 0 ? videoIdx + 1 : 1}`;
                })()}
              </Title>
              <Text type="secondary" className="text-sm">
                {getTitle()}{course.isPublic && <Tag color="green" className="ml-2">Công khai</Tag>}
              </Text>
            </div>
            {trackProgress && courseProgress && (
              <div className="hidden sm:block">
                <CourseProgressBar 
                  completedVideos={courseProgress.completedVideos}
                  totalVideos={courseProgress.totalVideos}
                />
              </div>
            )}
          </div>
          
{/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-3">
            {/* Mobile: Content Button - More prominent */}
            <Button 
              type="primary"
              size="small"
              className="xl:hidden flex items-center gap-1 bg-blue-500 border-blue-500"
              onClick={() => {
                setActiveContentTab('video');
                setContentDrawerOpen(true);
              }}
            >
              <PlayCircleOutlined /> 
              Danh sách ({currentLesson ? videoList.findIndex(v => v.videoId === currentVideoId) + 1 : 0}/{videoList.length})
            </Button>
            {/* Desktop: Always show */}
            <span className="hidden xl:flex items-center gap-1">
              <PlayCircleOutlined /> 
              {currentLesson ? videoList.findIndex(v => v.videoId === currentVideoId) + 1 : 0} / {videoList.length} videos
            </span>
            {currentCourseVideo?.video?.duration && (
              <span className="flex items-center gap-1">
                <ClockCircleOutlined /> 
                {Math.floor(currentCourseVideo.video.duration / 60)}:{String(currentCourseVideo.video.duration % 60).padStart(2, '0')}
              </span>
            )}
            {course.rating > 0 && (
              <span className="flex items-center gap-1">
                <StarOutlined /> {course.rating}
              </span>
            )}
{/* Like button */}
            {isAuthenticated && currentVideoId && (
              <div className="flex items-center gap-1 rounded-full border border-slate-200 overflow-hidden h-7 text-sm">
                <span className="px-2.5 text-slate-600 font-medium select-none">{likeCount}</span>
                <button
                  disabled={likeLoading}
                  onClick={handleLike}
                  className={`h-full px-2.5 flex items-center transition-colors cursor-pointer border-l border-slate-200 ${liked ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-red-400'}`}
                >
                  {liked ? <HeartFilled /> : <HeartOutlined />}
                </button>
              </div>
            )}
          </div>

          {/* Course Info */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
            {course.academy && (
              <Tag color="blue" icon={<BookOutlined />}>
                {course.academy.name_vi}
              </Tag>
            )}
            {course.language && (
              <Tag icon={<GlobalOutlined />}>{course.language}</Tag>
            )}
            {course.instructor && (
              <span className="flex items-center gap-1 text-sm text-slate-500">
                <UserOutlined /> {course.instructor.fullName || 'Instructor'}
              </span>
            )}
          </div>

          {/* Progress Bar - Mobile */}
          {trackProgress && courseProgress && (
            <div className="sm:hidden mt-3 bg-slate-50 rounded-lg p-3">
              <CourseProgressBar 
                completedVideos={courseProgress.completedVideos}
                totalVideos={courseProgress.totalVideos}
              />
            </div>
          )}
        </div>
      </div>

      {/* Video List Sidebar - Right Side (YouTube style) - Desktop only */}
      <div className="hidden xl:block w-full xl:w-80 flex-shrink-0">
        <div className="bg-white rounded-lg border border-slate-200 p-4 sticky top-4 max-h-[calc(100vh-100px)] overflow-y-auto">
          <Title level={5} className="!mb-4 flex items-center gap-2">
            <PlayCircleOutlined /> Danh sách video
          </Title>
          
{videoList.length === 0 ? (
                  <Text type="secondary">No videos available</Text>
                ) : (
                  <div className="flex flex-col gap-1">
{videoList.map((item, index) => {
                      const isActive = item.videoId === currentVideoId;
                      // Get lesson for this video - try to find by videoId match first, then fallback to index
                      const videoLesson = course?.lessons?.find(l => l.videoId === item.videoId) || course?.lessons?.[index];
                      // Check if lesson is completed - use completedLessons array (more accurate than index-based check)
                      const completedLessons = courseProgress?.completedLessons || [];
                      const isCompleted = trackProgress && courseProgress && videoLesson && completedLessons.includes(videoLesson.id);
                      const isPlaying = isActive && isVideoPlaying;
                      
                      // Debug log for each video
                      console.log('[CourseLearn] Video check:', {
                        videoId: item.videoId,
                        videoLessonId: videoLesson?.id,
                        trackProgress,
                        hasCourseProgress: !!courseProgress,
                        completedLessons,
                        isCompleted
                      });

                      return (
                  <div
                    key={item.videoId}
                    className={`cursor-pointer hover:bg-slate-50 rounded-lg p-2 transition-colors ${
                      isActive ? 'bg-blue-50 border border-blue-200' : ''
                    }`}
                    onClick={() => handleSelectVideo(item.videoId)}
                  >
                    <div className="flex items-center gap-3 w-full">
<div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                        {isCompleted ? (
                          <CheckCircleOutlined style={{ color: '#22c55e', fontSize: 20 }} />
                        ) : isPlaying ? (
                          <PlayCircleOutlined style={{ color: '#ef4444', fontSize: 20 }} />
                        ) : isActive ? (
                          <PlayCircleOutlined style={{ color: '#1890ff', fontSize: 20 }} />
                        ) : (
                          <span className="text-slate-400 text-sm">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Text 
                          ellipsis 
                          className={`block text-sm ${isActive ? 'font-medium text-blue-600' : ''}`}
                        >
                          {item.video?.name || `Video ${index + 1}`}
                        </Text>
                        {item.video?.duration && (
                          <Text type="secondary" className="text-xs flex items-center gap-1">
                            <ClockCircleOutlined /> 
                            {Math.floor(item.video.duration / 60)}:{String(item.video.duration % 60).padStart(2, '0')}
                          </Text>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

{/* Content Drawer - Mobile Only with Tabs */}
      <Drawer
        title={
          <Title level={5} className="!mb-0">
            Nội dung
          </Title>
        }
        placement="bottom"
        onClose={() => setContentDrawerOpen(false)}
        open={contentDrawerOpen}
        size="large"
        className="xl:hidden"
      >
        <Tabs 
          activeKey={activeContentTab} 
          onChange={setActiveContentTab}
          items={[
            {
              key: 'video',
              label: (
                <span className="flex items-center gap-2">
                  <PlayCircleOutlined /> Video ({videoList.length})
                </span>
              ),
              children: (
                <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto">
                  {videoList.length === 0 ? (
                    <Text type="secondary">No videos available</Text>
                  ) : (
videoList.map((item, index) => {
                      const isActive = item.videoId === currentVideoId;
                      // Mobile drawer: Get lesson for this video - try to find by videoId match first, then fallback to index
                      const videoLesson = course?.lessons?.find(l => l.videoId === item.videoId) || course?.lessons?.[index];
                      // Check if lesson is completed - use completedLessons array (more accurate than index-based check)
                      const completedLessons = courseProgress?.completedLessons || [];
                      const isCompleted = trackProgress && courseProgress && videoLesson && completedLessons.includes(videoLesson.id);
                      const isPlaying = isActive && isVideoPlaying;
                      
                      return (
                        <div
                          key={item.videoId}
                          className={`cursor-pointer hover:bg-slate-50 rounded-lg p-3 transition-colors ${
                            isActive ? 'bg-blue-50 border border-blue-200' : ''
                          }`}
                          onClick={() => {
                            handleSelectVideo(item.videoId);
                            setContentDrawerOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-3 w-full">
<div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100">
                              {isCompleted ? (
                                <CheckCircleOutlined style={{ color: '#22c55e', fontSize: 24 }} />
                              ) : isPlaying ? (
                                <PlayCircleOutlined style={{ color: '#ef4444', fontSize: 24 }} />
                              ) : isActive ? (
                                <PlayCircleOutlined style={{ color: '#1890ff', fontSize: 24 }} />
                              ) : (
                                <span className="text-slate-500 font-medium">{index + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <Text 
                                ellipsis 
                                className={`block text-base ${isActive ? 'font-medium text-blue-600' : ''}`}
                              >
                                {item.video?.name || `Video ${index + 1}`}
                              </Text>
                              {item.video?.duration && (
                                <Text type="secondary" className="text-sm flex items-center gap-1">
                                  <ClockCircleOutlined /> 
                                  {Math.floor(item.video.duration / 60)}:{String(item.video.duration % 60).padStart(2, '0')}
                                </Text>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )
            },
            {
              key: 'info',
              label: (
                <span className="flex items-center gap-2">
                  <BookOutlined /> Thông tin
                </span>
              ),
              children: (
                <div className="max-h-[50vh] overflow-y-auto">
                  <div className="mb-4">
                    <Title level={5}>Mô tả khóa học</Title>
                    <Text>{course.description_vi || 'Chưa có mô tả'}</Text>
                  </div>
                  {course.academy && (
                    <div className="mb-4">
                      <Title level={5}>Học viện</Title>
                      <Tag color="blue" icon={<BookOutlined />}>
                        {course.academy.name_vi}
                      </Tag>
                    </div>
                  )}
                  {course.language && (
                    <div className="mb-4">
                      <Title level={5}>Ngôn ngữ</Title>
                      <Tag icon={<GlobalOutlined />}>{course.language}</Tag>
                    </div>
                  )}
                  {course.instructor && (
                    <div className="mb-4">
                      <Title level={5}>Giảng viên</Title>
                      <div className="flex items-center gap-2">
                        <Avatar icon={<UserOutlined />} />
                        <Text>{course.instructor.fullName}</Text>
                      </div>
                    </div>
                  )}
                </div>
              )
            }
          ]}
        />
      </Drawer>
    </div>
  );
}
