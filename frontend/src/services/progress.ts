import api from "./api";

// Types for Learning Progress
export interface LearningProgress {
  id: number;
  userId: number;
  lessonId: number;
  watchedSeconds: number;
  completed: boolean;
  updatedAt: string;
  lesson?: {
    id: number;
    title: string;
    order: number;
    courseId: number;
    video?: {
      id: number;
      name: string;
      duration: number;
      thumbnailUrl: string;
      hlsPath: string;
    };
  };
}

export interface CourseProgress {
  courseId: number;
  totalVideos: number;
  completedVideos: number;
  completedLessons: number[]; // Array of completed lesson IDs
  progressPercent: number;
  lastWatchedVideoId: number | null;
  lastWatchedSeconds: number;
  updatedAt: string;
}

// API Responses
interface ProgressResponse {
  success: boolean;
  data: LearningProgress;
}

interface CourseProgressResponse {
  success: boolean;
  data: CourseProgress;
}

interface ProgressListResponse {
  success: boolean;
  data: LearningProgress[];
}

interface ApiResponse {
  success: boolean;
  message: string;
}

// Get progress for a specific lesson
export async function getLessonProgress(lessonId: number): Promise<LearningProgress | null> {
  try {
    const response = await api.get<ProgressResponse>(`/progress/lesson/${lessonId}`);
    return response.data.data;
  } catch (error) {
    return null;
  }
}

// Get all progress for a course
export async function getCourseProgress(courseId: number): Promise<CourseProgress | null> {
  try {
    const response = await api.get<CourseProgressResponse>(`/progress/course/${courseId}`);
    return response.data.data;
  } catch (error) {
    return null;
  }
}

// Get all progress for current user
export async function getMyProgress(): Promise<LearningProgress[]> {
  const response = await api.get<ProgressListResponse>("/progress/my");
  return response.data.data;
}

// Update progress for a lesson (called periodically while watching)
export async function updateProgress(
  lessonId: number,
  watchedSeconds: number,
  completed: boolean = false
): Promise<LearningProgress> {
  const response = await api.post<ProgressResponse>("/progress", {
    lessonId,
    watchedSeconds,
    completed,
  });
  return response.data.data;
}

// Mark lesson as completed
export async function markLessonCompleted(lessonId: number): Promise<LearningProgress> {
  const response = await api.post<ProgressResponse>("/progress/complete", {
    lessonId,
  });
  return response.data.data;
}

// Get courses with progress for profile (academy courses only)
export async function getMyAcademyCourses(): Promise<any[]> {
  const response = await api.get<{ success: boolean; data: any[] }>("/progress/my-academy-courses");
  return response.data.data;
}

// Watch History Types
export interface WatchHistoryItem {
  id: number;
  lessonId: number;
  lessonTitle: string | null;
  videoId: number | null;
  watchedSeconds: number;
  completed: boolean;
  updatedAt: string;
  progressPercent: number;
  video: {
    id: number;
    name: string;
    duration: number | null;
    thumbnailUrl: string | null;
  } | null;
  course: {
    id: number;
    title_vi: string | null;
    title_en: string | null;
    title_zh: string | null;
    coverImage: string | null;
  } | null;
}

// Get watch history for current user
export async function getWatchHistory(): Promise<WatchHistoryItem[]> {
  const response = await api.get<{ success: boolean; data: WatchHistoryItem[] }>("/progress/history");
  return response.data.data;
}

// Learning Statistics Types
export interface MonthlyDuration {
  month: string;  // format: "2025-01"
  duration: number;  // seconds
}

export interface LearningStats {
  monthlyDuration: number;  // seconds this month
  totalDuration: number;    // total seconds
  coursesCompleted: number;
  coursesInProgress: number;
  totalCourses: number;
  monthlyDurationByMonth: MonthlyDuration[];  // last 6 months
}

// Get learning statistics for current user
export async function getMyStats(): Promise<LearningStats> {
  const response = await api.get<{ success: boolean; data: LearningStats }>("/progress/my/stats");
  return response.data.data;
}

// Video Like Types
export interface LikedVideoItem {
  likeId: number;
  likedAt: string;
  videoId: number;
  videoName: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  lessonId: number | null;
  courseId: number | null;
  course: {
    id: number;
    title_vi: string | null;
    title_en: string | null;
    title_zh: string | null;
    coverImage: string | null;
  } | null;
}

// Toggle like on a video
export async function toggleVideoLike(videoId: number): Promise<{ liked: boolean; likeCount: number }> {
  const response = await api.post<{ success: boolean; liked: boolean; likeCount: number }>("/progress/like", { videoId });
  return { liked: response.data.liked, likeCount: response.data.likeCount };
}

// Get like status for a video
export async function getVideoLikeStatus(videoId: number): Promise<{ liked: boolean; likeCount: number }> {
  const response = await api.get<{ success: boolean; liked: boolean; likeCount: number }>(`/progress/like/${videoId}`);
  return { liked: response.data.liked, likeCount: response.data.likeCount };
}

// Get all liked videos for current user
export async function getMyLikedVideos(): Promise<LikedVideoItem[]> {
  const response = await api.get<{ success: boolean; data: LikedVideoItem[] }>("/progress/my/likes");
  return response.data.data;
}
