import api from "./api";

// Types - Academy with users for course management
export interface Academy {
  id: number;
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  code: string;
  description?: string;
  isPublic: boolean;
  users?: AcademyUser[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AcademyUser {
  id: number;
  usercode: string;
  fullName?: string;
}

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
  likeCount?: number;
  lessons?: Lesson[];
  rule?: CourseRule;
  createdAt: string;
  updatedAt: string;
}

// Course Rule - inline definition to avoid circular dependency with backend types
export interface CourseRule {
  id: number;
  antiFastForward: boolean;
  lockSpeed1x: boolean;
  showWatermark: boolean;
  blockDownload: boolean;
  requireFullCompletion: boolean;
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
  name?: string | null;
  thumbnailUrl?: string | null;
  duration?: number | null;
  status: string;
  hlsPath?: string | null;
}

export interface CourseVideo {
  id: number;
  courseId: number;
  videoId: number;
  order: number;
  video?: Video;
}

export interface Lesson {
  id: number;
  title: string;
  order: number;
  courseId: number;
  videoId?: number;
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

export async function getFeaturedCourses(academyId?: number): Promise<Course[]> {
  const response = await api.get<CoursesResponse>("/courses/featured", {
    params: { academyId },
  });
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

export async function uploadCourseCover(id: number, file: File): Promise<{ success: boolean; coverImage: string }> {
  const formData = new FormData();
  formData.append("cover", file);
  const response = await api.post<{ success: boolean; data: { coverImage: string } }>(
    `/courses/${id}/cover`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return { success: response.data.success, coverImage: response.data.data.coverImage };
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

// Get Academies for course selection
export async function getAcademies(): Promise<Academy[]> {
  const { authGet } = await import("./auth/auth.get");
  const response = await authGet.getAcademies();
  return response.data.academies;
}

// Get courses filtered by academy
export async function getCoursesByAcademy(academyId: number): Promise<Course[]> {
  const response = await api.get<CoursesResponse>("/courses", {
    params: { academyId },
  });
  return response.data.data;
}

// Get Users (Instructors) for course selection
export async function getInstructors(): Promise<User[]> {
  const { authGet } = await import("./auth/auth.get");
  const response = await authGet.getUsers();
  return response.data.users;
}

// Get Videos for course selection
export async function getVideos(): Promise<any[]> {
  const { getVideos: fetchVideos } = await import("./video/video.get");
  return fetchVideos();
}

// ===== Course Tags =====

// CourseTag type
export interface CourseTag {
  id: number;
  name_vi: string;
  name_en?: string;
  name_zh?: string;
  createdAt: string;
  updatedAt: string;
}

interface CourseTagsResponse {
  success: boolean;
  data: CourseTag[];
}

export interface SpecialTopic {
  id: number;
  name_vi: string;
  name_en?: string;
  name_zh?: string;
  page: string;
  academyId: number;
  orderIndex?: number;
  academy?: Academy;
  _count?: {
    courses: number;
  };
  courses?: Course[];
  createdAt: string;
  updatedAt: string;
}

export interface SpecialTopicPayload {
  name_vi: string;
  name_en?: string;
  name_zh?: string;
  academyId: number;
  page?: string;
  courseIds?: number[];
}

interface SpecialTopicsResponse {
  success: boolean;
  data: SpecialTopic[];
}

interface SpecialTopicResponse {
  success: boolean;
  data: SpecialTopic;
}

// Get all course tags
export async function getCourseTags(): Promise<CourseTag[]> {
  const response = await api.get<CourseTagsResponse>("/courses/tags");
  return response.data.data;
}

// Create course tag
export async function createCourseTag(data: Partial<CourseTag>): Promise<CourseTag> {
  const response = await api.post<CourseTagsResponse>("/courses/tags", data);
  return response.data.data[0];
}

// Update course tag
export async function updateCourseTag(id: number, data: Partial<CourseTag>): Promise<CourseTag> {
  const response = await api.put<CourseTagsResponse>(`/courses/tags/${id}`, data);
  return response.data.data[0];
}

// Delete course tag
export async function deleteCourseTag(id: number): Promise<void> {
  await api.delete(`/courses/tags/${id}`);
}

export async function getSpecialTopics(params?: {
  academyId?: number;
  page?: string;
  search?: string;
}): Promise<SpecialTopic[]> {
  const response = await api.get<SpecialTopicsResponse>("/courses/special-topics", { params });
  return response.data.data;
}

export async function createSpecialTopic(data: SpecialTopicPayload): Promise<SpecialTopic> {
  const response = await api.post<SpecialTopicResponse>("/courses/special-topics", data);
  return response.data.data;
}

export async function updateSpecialTopic(
  id: number,
  data: Partial<SpecialTopicPayload>
): Promise<SpecialTopic> {
  const response = await api.put<SpecialTopicResponse>(`/courses/special-topics/${id}`, data);
  return response.data.data;
}

export async function deleteSpecialTopic(id: number): Promise<void> {
  await api.delete(`/courses/special-topics/${id}`);
}

export async function getCoursesBySpecialTopic(topicId: number): Promise<Course[]> {
  const response = await api.get<CoursesResponse>(`/courses/special-topics/${topicId}/courses`);
  return response.data.data;
}

export async function getHomeSpecialTopics(params?: {
  academyId?: number;
  page?: string;
}): Promise<SpecialTopic[]> {
  const response = await api.get<SpecialTopicsResponse>("/courses/special-topics/home", { params });
  return response.data.data;
}

export async function reorderSpecialTopics(topicIds: number[]): Promise<void> {
  await api.put("/courses/special-topics/reorder", { topicIds });
}

export async function reorderSpecialTopicCourses(topicId: number, courseIds: number[]): Promise<void> {
  await api.put(`/courses/special-topics/${topicId}/courses/reorder`, { courseIds });
}

// Get course with user progress (for academy courses)
export async function getCourseWithProgress(courseId: number): Promise<Course> {
  const authStore = await import("../store/authStore");
  const userId = authStore.useAuthStore.getState().user?.id;
  
  if (!userId) {
    return getCourse(courseId);
  }
  
  try {
    const response = await api.get<CourseResponse>(`/courses/${courseId}`, {
      params: { userId }
    });
    return response.data.data;
  } catch (error) {
    // Fallback to regular course fetch
    return getCourse(courseId);
  }
}

// Get courses for profile that are from academies (with progress)
export async function getAcademyCoursesForProfile(): Promise<Course[]> {
  const { authGet } = await import("./auth/auth.get");
  try {
    const response = await authGet.getAcademies();
    const academies = response.data.academies;
    
    // Get courses from all academies the user is enrolled in
    const allCourses: Course[] = [];
    for (const academy of academies) {
      const courses = await getCoursesByAcademy(academy.id);
      allCourses.push(...courses);
    }
    return allCourses;
  } catch (error) {
    return [];
  }
}
