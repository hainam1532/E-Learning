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
