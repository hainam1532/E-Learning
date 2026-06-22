import { createBrowserRouter, Navigate } from "react-router-dom";
import UserLayout from "../layouts/UserLayout";
import AdminLayout from "../layouts/AdminLayout";
import ProtectedRoute from "../components/ProtectedRoute";
import Home from "../pages/views/Home";
import Profile from "../pages/views/Profile";
import Login from "../pages/views/Login";
import Unauthorized from "../pages/views/Unauthorized";
import Dashboard from "../pages/admin/Dashboard";
import UserManagement from "../pages/admin/UserManagement";
import RoleManagement from "../pages/admin/RoleManagement";
import DepartmentManagement from "../pages/admin/DepartmentManagement";
import PositionManagement from "../pages/admin/PositionManagement";
import SystemConfig from "../pages/admin/SystemConfig";
import VideoLibrary from "../pages/admin/VideoLibrary";
import AcademyManagement from "../pages/admin/AcademyManagement";
import CourseManagement from "../pages/admin/CourseManagement";

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
        path: "profile",
        element: <Profile />,
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
            element: <PlaceholderPage title="Thẻ khóa học" />,
          },
          {
            path: "courses/categories",
            element: <PlaceholderPage title="Danh mục khóa học" />,
          },
          {
            path: "courses/special-topics",
            element: <PlaceholderPage title="Chủ đề đặc biệt" />,
          },
          // Quản lý đào tạo
          {
            path: "training/paths",
            element: <PlaceholderPage title="Lộ trình học tập" />,
          },
          {
            path: "training/documents",
            element: <PlaceholderPage title="Thư viện tài liệu" />,
          },
          {
            path: "training/locations",
            element: <PlaceholderPage title="Địa điểm đào tạo" />,
          },
          {
            path: "training/plans",
            element: <PlaceholderPage title="Kế hoạch đào tạo" />,
          },
          {
            path: "training/classes",
            element: <PlaceholderPage title="Quản lý lớp học" />,
          },
          {
            path: "training/instructors",
            element: <PlaceholderPage title="Quản lý giảng viên" />,
          },
          // Quản lý kỳ thi
          {
            path: "exam/questions",
            element: <PlaceholderPage title="Ngân hàng câu hỏi" />,
          },
          {
            path: "exam/papers",
            element: <PlaceholderPage title="Quản lý đề thi" />,
          },
          {
            path: "exam/sessions",
            element: <PlaceholderPage title="Quản lý kỳ thi" />,
          },
          // Báo cáo dữ liệu
          {
            path: "reports/overview",
            element: <PlaceholderPage title="Báo cáo tổng quan học tập" />,
          },
          {
            path: "reports/time",
            element: <PlaceholderPage title="Báo cáo thời gian học tập" />,
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
]);
