import api from "./api";

// Types
export interface Course {
  id: number;
  title_vi?: string;
  title_en?: string;
  title_zh?: string;
  description_vi?: string;
  description_en?: string;
  description_zh?: string;
  coverImage?: string;
  isPublic: boolean;
  rating: number;
  language?: string;
  targetAudience?: string;
  benefits?: string[];
  tags?: string[];
  academyId?: number;
  categoryId?: number;
  instructorId?: number;
  academy?: Academy;
  category?: CourseCategory;
  instructor?: User;
  courseVideos?: CourseVideo[];
  rule?: CourseRule;
  createdAt: string;
  updatedAt: string;
}

export interface Academy {
  id: number;
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  code: string;
  description?: string;
  isPublic: boolean;
}

export interface CourseCategory {
  id: number;
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  code: string;
  description?: string;
}

export interface User {
  id: number;
  usercode: string;
  fullName?: string;
}

export interface Video {
  id: number;
  name?: string;
  thumbnailUrl?: string;
  duration?: number;
  status: string;
  hlsPath?: string;
}

export interface CourseVideo {
  id: number;
  courseId: number;
  videoId: number;
  order: number;
  video?: Video;
}

export interface CourseRule {
  id: number;
  antiFastForward: boolean;
  lockSpeed1x: boolean;
  showWatermark: boolean;
  blockDownload: boolean;
  requireFullCompletion: boolean;
}

export interface Lesson {
  id: number;
  title: string;
  order: number;
  courseId: number;
  course?: {
    id: number;
    title: string;
  };
}

// API Response types
interface CoursesResponse {
  success: boolean;
  data: Course[];
}

interface CourseResponse {
  success: boolean;
  data: Course;
}

interface CourseCategoriesResponse {
  success: boolean;
  data: CourseCategory[];
}

// Course API
export async function getCourses(): Promise<Course[]> {
  const response = await api.get<CoursesResponse>("/courses");
  return response.data.data;
}

export async function getCourse(id: number): Promise<Course> {
  const response = await api.get<CourseResponse>(`/courses/${id}`);
  return response.data.data;
}

export async function createCourse(data: Partial<Course>): Promise<Course> {
  const response = await api.post<CourseResponse>("/courses", data);
  return response.data.data;
}

export async function updateCourse(id: number, data: Partial<Course>): Promise<Course> {
  const response = await api.put<CourseResponse>(`/courses/${id}`, data);
  return response.data.data;
}

export async function deleteCourse(id: number): Promise<void> {
  await api.delete(`/courses/${id}`);
}

// Course Category API
export async function getCourseCategories(): Promise<CourseCategory[]> {
  const response = await api.get<CourseCategoriesResponse>("/courses/categories");
  return response.data.data;
}

export async function createCourseCategory(data: Partial<CourseCategory>): Promise<CourseCategory> {
  const response = await api.post<CourseCategoriesResponse>("/courses/categories", data);
  return response.data.data[0];
}

export async function updateCourseCategory(
  id: number,
  data: Partial<CourseCategory>
): Promise<CourseCategory> {
  const response = await api.put<CourseCategoriesResponse>(`/courses/categories/${id}`, data);
  return response.data.data[0];
}

export async function deleteCourseCategory(id: number): Promise<void> {
  await api.delete(`/courses/categories/${id}`);
}

// Course Video API
interface CourseVideoResponse {
  success: boolean;
  data: CourseVideo;
}

export async function addVideoToCourse(
  courseId: number,
  videoId: number,
  order?: number
): Promise<CourseVideo> {
  const response = await api.post<CourseVideoResponse>(`/courses/${courseId}/videos`, {
    videoId,
    order,
  });
  return response.data.data;
}

export async function removeVideoFromCourse(
  courseId: number,
  videoId: number
): Promise<void> {
  await api.delete(`/courses/${courseId}/videos`, { data: { videoId } });
}

// Lesson API (backward compatibility)
interface LessonsResponse {
  success: boolean;
  data: Lesson[];
}

export async function getLessons(): Promise<Lesson[]> {
  const response = await api.get<LessonsResponse>("/courses/lessons");
  return response.data.data;
}

export async function getLessonsByCourse(courseId: number): Promise<Lesson[]> {
  const response = await api.get<LessonsResponse>(`/courses/${courseId}/lessons`);
  return response.data.data;
}
