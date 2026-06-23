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
  message 
} from 'antd';
import { 
  PlayCircleOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  BookOutlined,
  UserOutlined,
  StarOutlined,
  LockOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { getCourse, getCourseWithProgress } from '../../services/course';
import { getCourseProgress, markLessonCompleted } from '../../services/progress';
import { useAuthStore } from '../../store/authStore';
import VideoPlayer from '../../components/VideoPlayer';
import CourseProgressBar from '../../components/CourseProgressBar';
import type { Course, CourseVideo, Video } from '../../services/course';

const { Title, Text, Paragraph } = Typography;

export default function CourseLearn() {
  const { courseId, videoId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();
  
const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [courseProgress, setCourseProgress] = useState<any>(null);
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  const [expandedLesson, setExpandedLesson] = useState<number | null>(null);
  
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
    if (videoId) return parseInt(videoId);
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
        
        // Set current video
        if (videoIdNum) {
          setCurrentVideoId(videoIdNum);
        } else if (courseData.courseVideos && courseData.courseVideos.length > 0) {
          setCurrentVideoId(courseData.courseVideos[0].videoId);
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
              <Title level={4} className="!mb-0">{currentCourseVideo?.video?.name || 'Video Title'}</Title>
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
            <span className="flex items-center gap-1">
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

      {/* Video List Sidebar - Right Side (YouTube style) */}
      <div className="w-full xl:w-80 flex-shrink-0">
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
                const isCompleted = trackProgress && courseProgress?.completedVideos > index;
                const isPlaying = isActive && isVideoPlaying;
                
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
                          <CheckCircleOutlined className="text-green-500 text-lg" />
                        ) : isPlaying ? (
                          <PlayCircleOutlined className="text-lg video-playing-indicator" style={{ color: '#ef4444' }} />
                        ) : isActive ? (
                          <PlayCircleOutlined className="text-blue-500 text-lg" />
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
    </div>
  );
}
