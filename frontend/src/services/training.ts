import api from "./api";

// Types for Training Plan
export interface Academy {
  id: number;
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  code: string;
  description?: string;
  isPublic: boolean;
}

export interface Lecturer {
  id: number;
  code: string;
  name: string | null;
  type: 'INTERNAL' | 'EXTERNAL';
}

export interface TrainingClass {
  id: number;
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  code: string;
  description_vi?: string;
  description_en?: string;
  description_zh?: string;
  content_vi?: string;
  content_en?: string;
  content_zh?: string;
  objectives_vi?: string;
  objectives_en?: string;
  objectives_zh?: string;
  targetAudience?: string;
  startDate?: string | null;
  endDate?: string | null;
  academyId?: number;
  academy?: Academy;
  lecturerId?: number;
  lecturer?: Lecturer;
  createdAt?: string;
  updatedAt?: string;
}

// Student in class
export interface ClassStudent {
  id: number;
  usercode: string;
  fullName: string | null;
  email: string | null;
  departmentId: number | null;
  department?: {
    id: number;
    name_vi: string | null;
    name_en: string | null;
    name_zh: string | null;
    code: string;
  } | null;
  positionId: number | null;
  position?: {
    id: number;
    name_vi: string | null;
    name_en: string | null;
    name_zh: string | null;
    code: string;
  } | null;
}

export interface ClassReportStudent extends ClassStudent {
  department?: (ClassStudent['department'] & { name?: string | null }) | null;
  position?: (ClassStudent['position'] & { name?: string | null }) | null;
  totalCourses: number;
  completedCourses: number;
  incompleteCourses: number;
  totalVideos: number;
  completedVideos: number;
  incompleteVideos: number;
  totalExams: number;
  completedExams: number;
  incompleteExams: number;
  passedExams: number;
  attemptedExams: number;
  averageExamScore: number | null;
  completionRate: number;
  status: string;
  statusLabel: string;
  courseProgress: Array<{
    courseId: number;
    courseName: string;
    totalVideos: number;
    completedVideos: number;
    incompleteVideos: number;
    progressPercent: number;
    startedVideos: number;
    watchedSeconds: number;
    isCompleted: boolean;
  }>;
}

export interface ClassReportStatusBucket {
  key: string;
  label: string;
  count: number;
  percent: number;
}

export interface ClassReportTopExamScorer {
  rank: number;
  userId: number;
  usercode: string;
  fullName: string | null;
  department: string;
  position: string;
  averageExamScore: number | null;
  passedExams: number;
}

export interface ClassReportDepartmentProgress {
  departmentId: number | null;
  departmentName: string;
  totalStudents: number;
  completedUsers: number;
  incompleteUsers: number;
  completedVideos: number;
  passedExams: number;
}

export interface ClassReportCourseProgressStudent {
  userId: number;
  usercode: string;
  fullName: string | null;
  department: string;
  departmentId: number | null;
  position: string;
  positionId: number | null;
  progressPercent: number;
  completedVideos: number;
  totalVideos: number;
  videoStatus: string;
  examStatus: string;
  statusLabel: string;
}

export interface ClassReportCourseProgress {
  courseId: number;
  courseName: string;
  totalVideos: number;
  completedStudents: number;
  students: ClassReportCourseProgressStudent[];
}

// Class report
export interface ClassReport {
  id: number;
  code: string;
  name: string;
  description: string;
  academy: { id: number; name: string } | null;
  lecturer: { id: number; code: string; name: string | null } | null;
  startDate: string | null;
  endDate: string | null;
  studentCount: number;
  totalCourses: number;
  totalVideos: number;
  totalExams: number;
  trainingPlans: Array<{ id: number; title: string }>;
  summary: {
    totalStudents: number;
    averageCompletionRate: number;
    completedUsers: number;
    passedExamUsers: number;
    totalCourses: number;
    totalVideos: number;
    totalExams: number;
  };
  statusDistribution: ClassReportStatusBucket[];
  topExamScorers: ClassReportTopExamScorer[];
  departmentProgress: ClassReportDepartmentProgress[];
  courseProgress: ClassReportCourseProgress[];
  students: ClassReportStudent[];
}

export type TrainingPlanStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type TrainingResourceType = 'COURSE' | 'EXAM' | 'DOCUMENT';

export interface TrainingResource {
  id: number;
  trainingPlanId: number;
  type: TrainingResourceType;
  refId: number | null;
  title_vi?: string;
  title_en?: string;
  title_zh?: string;
  order: number;
}

export interface TrainingPlan {
  id: number;
  title_vi?: string;
  title_en?: string;
  title_zh?: string;
  description_vi?: string;
  description_en?: string;
  description_zh?: string;
  coverImage?: string;
  startDate?: string | null;
  endDate?: string | null;
  status: TrainingPlanStatus;
  academyId?: number | null;
  trainingClassId?: number | null;
  academy?: Academy;
  trainingClass?: TrainingClass;
  resources?: TrainingResource[];
  createdAt: string;
  updatedAt: string;
}

// API Response types
interface TrainingPlansResponse {
  success: boolean;
  data: TrainingPlan[];
}

interface TrainingPlanResponse {
  success: boolean;
  data: TrainingPlan;
}

interface ClassStudentsResponse {
  success: boolean;
  data: ClassStudent[];
}

interface ClassReportResponse {
  success: boolean;
  data: ClassReport;
}

// Training Class API
export async function getTrainingClasses(academyId?: number): Promise<TrainingClass[]> {
  const params = academyId ? { academyId } : {};
  const response = await api.get<{ success: boolean; data: TrainingClass[] }>("/training/classes", { params });
  return response.data.data;
}

export async function createTrainingClass(data: Partial<TrainingClass>): Promise<TrainingClass> {
  const response = await api.post<{ trainingClass: TrainingClass }>("/training/classes", data);
  return response.data.trainingClass;
}

export async function updateTrainingClass(id: number, data: Partial<TrainingClass>): Promise<TrainingClass> {
  const response = await api.put<{ trainingClass: TrainingClass }>(`/training/classes/${id}`, data);
  return response.data.trainingClass;
}

export async function deleteTrainingClass(id: number): Promise<void> {
  await api.delete(`/training/classes/${id}`);
}

// Class Student Management API
export async function getClassStudents(classId: number, search?: string, departmentId?: number): Promise<ClassStudent[]> {
  const params: Record<string, unknown> = { classId };
  if (search) params.search = search;
  if (departmentId) params.departmentId = departmentId;
  
  const response = await api.get<ClassStudentsResponse>(`/training/classes/${classId}/students`, { params });
  return response.data.data;
}

export async function addStudentToClass(classId: number, userId: number): Promise<{ id: number; usercode: string; fullName: string | null }> {
  const response = await api.post(`/training/classes/${classId}/students`, { userId });
  return response.data.student;
}

export async function removeStudentFromClass(classId: number, userId: number): Promise<void> {
  await api.delete(`/training/classes/${classId}/students/${userId}`);
}

export async function importStudentsToClass(classId: number, file: File): Promise<{ success: number; failed: number; errors: string[] }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<{ message: string; results: { success: number; failed: number; errors: string[] } }>(
    `/training/classes/${classId}/students/import`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data.results;
}

export async function generateClassReport(classId: number): Promise<ClassReport> {
  const response = await api.get<ClassReportResponse>(`/training/classes/${classId}/report`);
  return response.data.data;
}

// Training Plan API
export async function getTrainingPlans(academyId?: number, search?: string): Promise<TrainingPlan[]> {
  const params: Record<string, unknown> = {};
  if (academyId) params.academyId = academyId;
  if (search) params.search = search;
  
  const response = await api.get<TrainingPlansResponse>("/training/plans", { params });
  return response.data.data;
}

export async function getTrainingPlan(id: number): Promise<TrainingPlan> {
  const response = await api.get<TrainingPlanResponse>(`/training/plans/${id}`);
  return response.data.data;
}

export async function createTrainingPlan(data: Partial<TrainingPlan>): Promise<TrainingPlan> {
  const response = await api.post<TrainingPlanResponse>("/training/plans", data);
  return response.data.data;
}

export async function updateTrainingPlan(id: number, data: Partial<TrainingPlan>): Promise<TrainingPlan> {
  const response = await api.put<TrainingPlanResponse>(`/training/plans/${id}`, data);
  return response.data.data;
}

export async function deleteTrainingPlan(id: number): Promise<void> {
  await api.delete(`/training/plans/${id}`);
}

export async function uploadTrainingPlanCover(id: number, file: File): Promise<{ success: boolean; coverImage: string }> {
  const formData = new FormData();
  formData.append("cover", file);
  const response = await api.post<{ success: boolean; data: { coverImage: string } }>(
    `/training/plans/${id}/cover`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return { success: response.data.success, coverImage: response.data.data.coverImage };
}

// Training Resource API
interface TrainingResourceResponse {
  success: boolean;
  data: TrainingResource;
}

// Types for User Training Plan with Progress
// Note: startDate and endDate are included from the backend response
export interface UserTrainingPlan {
  id: number;
  title_vi?: string;
  title_en?: string;
  title_zh?: string;
  description_vi?: string;
  description_en?: string;
  description_zh?: string;
  coverImage?: string;
  startDate?: string | null;  // Start date of the training plan
  endDate?: string | null;   // End date of the training plan - if passed, status becomes COMPLETED
  status: TrainingPlanStatus;
  academyId?: number | null;
  trainingClassId?: number | null;
  academy?: Academy;
  trainingClass?: TrainingClass;
  resources?: UserTrainingResource[];
  totalVideos: number;
  completedVideos: number;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}

// ============ Helper Functions for Training Plans ============
// These functions work with nullable date values (string | null | undefined)

// Helper function to check if training plan is expired based on endDate
// Returns true if endDate exists AND status is ACTIVE AND endDate is before today
export const isTrainingPlanExpired = (endDate: string | null | undefined, status: string): boolean => {
  if (!endDate || status !== 'ACTIVE') return false;
  
  const end = new Date(endDate);
  const now = new Date();
  
  // Reset time to midnight for accurate date comparison
  const endDateMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return endDateMidnight < nowDate;
};

// Format date range for display
export const formatDateRange = (startDate: string | null | undefined, endDate: string | null | undefined): string => {
  if (!startDate && !endDate) return '';
  
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('vi-VN');
  
  if (startDate && endDate) {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  } else if (startDate) {
    return `Từ ${formatDate(startDate)}`;
  } else {
    return `Đến ${formatDate(endDate!)}`;
  }
};

// Get display status text and color for training plan
export const getStatusDisplayText = (
  endDate: string | null | undefined,
  status: string
): { text: string; color: string } => {
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

// Helper function to get display status - accepts proper nullable types
export const getTrainingPlanDisplayStatus = (
  status: TrainingPlanStatus,
  endDate: string | null | undefined
): { text: string; color: string } => {
  // If endDate passed and status is ACTIVE, check if expired
  if (status === 'ACTIVE' && endDate) {
    const end = new Date(endDate);
    const now = new Date();
    if (end < now) {
      return { text: 'Hết hạn', color: 'red' };
    }
  }
  
  switch (status) {
    case 'DRAFT':
      return { text: 'Nháp', color: 'gold' };
    case 'ACTIVE':
      return { text: 'Hoạt động', color: 'green' };
    case 'COMPLETED':
      return { text: 'Hoàn thành', color: 'blue' };
    case 'CANCELLED':
      return { text: 'Đã hủy', color: 'red' };
    default:
      return { text: status, color: 'default' };
  }
};

export interface UserTrainingResource {
  id: number;
  type: TrainingResourceType;
  refId: number | null;
  title_vi?: string;
  title_en?: string;
  title_zh?: string;
  order: number;
  course?: {
    id: number;
    title_vi?: string;
    title_en?: string;
    title_zh?: string;
    coverImage?: string;
  };
  document?: {
    id: number;
    name?: string | null;
    type?: string;
    size?: number;
    url?: string | null;
  };
  exam?: {
    id: number;
    name_vi?: string | null;
    name_en?: string | null;
    name_zh?: string | null;
    passingScore: number;
    durationMinutes: number;
    antiCheat: boolean;
    requireFullscreen: boolean;
    detectTabSwitch: boolean;
    attemptLimit: number;
    startAt: string;
    endAt: string;
  };
  latestAttempt?: {
    id: number;
    status: string;
    score?: number | null;
    passed?: boolean | null;
    isFraud?: boolean;
    cheatWarnings?: number;
    submittedAt?: string | null;
  };
  completed?: boolean;
  totalVideos: number;
  completedVideos: number;
  progressPercent: number;
}

export async function addTrainingResource(
  planId: number,
  data: { type: TrainingResourceType; refId: number; title_vi?: string; title_en?: string; title_zh?: string; order?: number }
): Promise<TrainingResource> {
  const response = await api.post<TrainingResourceResponse>(`/training/plans/${planId}/resources`, data);
  return response.data.data;
}

export async function removeTrainingResource(planId: number, resourceId: number): Promise<void> {
  await api.delete(`/training/plans/${planId}/resources`, { data: { resourceId } });
}

// ============ USER TRAINING API (for current user) ============

// Types for User Training Enrollment
export interface UserTrainingEnrollment {
  id: number;
  classId: number;
  class: TrainingClass;
  createdAt: string;
}

// Get current user's training enrollments
export async function getMyTrainingEnrollments(): Promise<UserTrainingEnrollment[]> {
  const response = await api.get<{ success: boolean; data: UserTrainingEnrollment[] }>('/training/my-enrollments');
  return response.data.data;
}

// Get current user's training plans with progress
export async function getMyTrainingPlans(): Promise<UserTrainingPlan[]> {
  const response = await api.get<{ success: boolean; data: UserTrainingPlan[] }>('/training/my-plans');
  return response.data.data;
}

export async function markTrainingResourceCompleted(resourceId: number): Promise<void> {
  await api.post(`/training/resources/${resourceId}/complete`);
}
