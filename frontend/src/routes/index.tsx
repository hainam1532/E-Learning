import { createBrowserRouter, Navigate } from "react-router-dom";
import UserLayout from "../layouts/UserLayout";
import AdminLayout from "../layouts/AdminLayout";
import ProtectedRoute from "../components/ProtectedRoute";
import Home from "../pages/views/Home";
import Courses from "../pages/views/Courses";
import Topics from "../pages/views/Topics";
import Profile from "../pages/views/Profile";
import Login from "../pages/views/Login";
import Unauthorized from "../pages/views/Unauthorized";
import CourseLearn from "../pages/views/CourseLearn";
import ExamTaking from "../pages/views/ExamTaking";
import Dashboard from "../pages/admin/Dashboard";
import UserManagement from "../pages/admin/UserManagement";
import RoleManagement from "../pages/admin/RoleManagement";
import DepartmentManagement from "../pages/admin/DepartmentManagement";
import PositionManagement from "../pages/admin/PositionManagement";
import SystemConfig from "../pages/admin/SystemConfig";
import VideoLibrary from "../pages/admin/VideoLibrary";
import AcademyManagement from "../pages/admin/AcademyManagement";
import CourseManagement from "../pages/admin/CourseManagement";
import CourseTagManagement from "../pages/admin/CourseTagManagement";
import CourseCategoryManagement from "../pages/admin/CourseCategoryManagement";
import SpecialTopicManagement from "../pages/admin/SpecialTopicManagement";
import TrainingPlanManagement from "../pages/admin/TrainingPlanManagement";
import TrainingClassManagement from "../pages/admin/TrainingClassManagement";
import LecturerManagement from "../pages/admin/LecturerManagement";
import TrainingPathManagement from "../pages/admin/TrainingPathManagement";
import DocumentLibrary from "../pages/admin/DocumentLibrary";
import QuestionBankManagement from "../pages/admin/QuestionBankManagement";
import ExamPaperManagement from "../pages/admin/ExamPaperManagement";
import ExamSessionManagement from "../pages/admin/ExamSessionManagement";
import ReportsOverview from "../pages/admin/ReportsOverview";
import ReportsTime from "../pages/admin/ReportsTime";

const routerBasenameRaw = (import.meta.env.VITE_ROUTER_BASENAME || '/').trim();
const routerBasename = routerBasenameRaw === '/'
  ? '/'
  : routerBasenameRaw.replace(/\/+$/, '');


// Placeholder components for new menu items
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm">
    <h2 className="text-xl font-bold text-slate-800 mb-4">{title}</h2>
    <p className="text-slate-500">Chức năng đang được phát triển.</p>
  </div>
);

export const router = createBrowserRouter([
// Giao diện người dùng / học viên (Views)
  {
    path: "/",
    element: <UserLayout />,
    children: [
      {
        path: "",
        element: <Home />,
      },
      {
        path: "courses",
        element: <Courses />,
      },
      {
        path: "topics",
        element: <Topics />,
      },
      // Profile - Yêu cầu đăng nhập
      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        ),
      },
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "unauthorized",
        element: <Unauthorized />,
      },
    ],
  },

// Course Learning - Standalone (no UserLayout)
  {
    path: "/learn/:courseId",
    element: (
      <ProtectedRoute>
        <CourseLearn />
      </ProtectedRoute>
    ),
  },
  {
    path: "/learn/:courseId/:videoId",
    element: (
      <ProtectedRoute>
        <CourseLearn />
      </ProtectedRoute>
    ),
  },

  // Exam Taking - Standalone (no UserLayout)
  {
    path: "/exam/:sessionId",
    element: (
      <ProtectedRoute>
        <ExamTaking />
      </ProtectedRoute>
    ),
  },

  // Giao diện quản trị (Admin) - Yêu cầu vai trò 'admin'
  {
    path: "/admin",
    element: <ProtectedRoute allowedRoles={["admin"]} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          // Dashboard
          {
            path: "",
            element: <Dashboard />,
          },
          // Quản lý hệ thống
          {
            path: "users",
            element: <UserManagement />,
          },
          {
            path: "departments",
            element: <DepartmentManagement />,
          },
          {
            path: "positions",
            element: <PositionManagement />,
          },
          {
            path: "roles",
            element: <RoleManagement />,
          },
{
            path: "config",
            element: <SystemConfig />,
          },
          {
            path: "academies",
            element: <AcademyManagement />,
          },
          // Quản lý khóa học
          {
            path: "courses",
            element: <CourseManagement />,
          },
{
            path: "courses/videos",
            element: <VideoLibrary />,
          },
{
            path: "courses/cards",
            element: <CourseTagManagement />,
          },
          {
            path: "courses/categories",
            element: <CourseCategoryManagement />,
          },
          {
            path: "courses/special-topics",
            element: <SpecialTopicManagement />,
          },
          // Quản lý đào tạo
          {
            path: "training/paths",
            element: <TrainingPathManagement />,
          },
{
            path: "training/documents",
            element: <DocumentLibrary />,
          },
          {
            path: "document-library",
            element: <DocumentLibrary />,
          },
          {
            path: "training/locations",
            element: <PlaceholderPage title="Địa điểm đào tạo" />,
          },
          {
            path: "training/plans",
            element: <TrainingPlanManagement />,
          },
          {
            path: "training/classes",
            element: <TrainingClassManagement />,
          },
{
            path: "training/instructors",
            element: <LecturerManagement />,
          },
// Quản lý kỳ thi
          {
            path: "exam/questions",
            element: <QuestionBankManagement />,
          },
          {
            path: "exam/papers",
            element: <ExamPaperManagement />,
          },
          {
            path: "exam/sessions",
            element: <ExamSessionManagement />,
          },
          // Báo cáo dữ liệu
          {
            path: "reports/overview",
            element: <ReportsOverview />,
          },
          {
            path: "reports/time",
            element: <ReportsTime />,
          },
        ],
      },
    ],
  },

  // Đường dẫn không hợp lệ -> quay về trang chủ
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
], {
  basename: routerBasename,
});
