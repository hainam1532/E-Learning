import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import {
  Alert,
  Avatar,
  Tag,
  Button,
  Typography,
  Modal,
  Progress,
  message,
} from "antd";
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
  ReadOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getCourses } from "../../services/course";
import { getMyTrainingPlans } from "../../services/training";
import {
  getWatchHistory,
  getMyStats,
  getMyLikedVideos,
} from "../../services/progress";
import {
  getExamAttempt,
  getMyExamAttempts,
  type MyExamAttempt,
} from "../../services/exam";
import type {
  WatchHistoryItem,
  LearningStats,
  LikedVideoItem,
} from "../../services/progress";
import type { Course } from "../../services/course";
import type { UserTrainingPlan } from "../../services/training";

const { Title, Text } = Typography;

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds} giây`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}p` : `${h} giờ`;
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const formatRelativeTime = (dateString: string): string => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Vừa xem";
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} tháng trước`;
  return `${Math.floor(diffDays / 365)} năm trước`;
};

const isPlanExpired = (
  endDate: string | null | undefined,
  status: string,
): boolean => {
  if (!endDate || status !== "ACTIVE") return false;
  const end = new Date(endDate);
  const now = new Date();
  const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return endMid < nowMid;
};

const getPlanDisplayStatus = (
  endDate: string | null | undefined,
  status: string,
): { text: string; color: string } => {
  if (status === "COMPLETED") return { text: "Hoàn thành", color: "green" };
  if (status === "CANCELLED") return { text: "Đã hủy", color: "red" };
  if (status === "DRAFT") return { text: "Nháp", color: "gold" };
  if (endDate && new Date(endDate) < new Date())
    return { text: "Hết hạn", color: "red" };
  return { text: "Hoạt động", color: "green" };
};

export default function Profile() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("training");
  const [, setCourses] = useState<Course[]>([]);
  const [trainingPlans, setTrainingPlans] = useState<UserTrainingPlan[]>([]);
  const [loadingTrainingPlans, setLoadingTrainingPlans] = useState(false);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stats, setStats] = useState<LearningStats>({
    monthlyDuration: 0,
    totalDuration: 0,
    coursesCompleted: 0,
    coursesInProgress: 0,
    totalCourses: 0,
    monthlyDurationByMonth: [],
  });
  const [likedVideos, setLikedVideos] = useState<LikedVideoItem[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [examAttempts, setExamAttempts] = useState<MyExamAttempt[]>([]);
  const [loadingExamAttempts, setLoadingExamAttempts] = useState(false);
  const [examDetailOpen, setExamDetailOpen] = useState(false);
  const [examDetailLoading, setExamDetailLoading] = useState(false);
  const [selectedExamDetail, setSelectedExamDetail] = useState<any>(null);

  useEffect(() => {
    getCourses()
      .then((d) => setCourses(d.slice(0, 6)))
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoadingTrainingPlans(true);
    getMyTrainingPlans()
      .then(setTrainingPlans)
      .catch(() => setTrainingPlans([]))
      .finally(() => setLoadingTrainingPlans(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "history") return;
    setLoadingHistory(true);
    getWatchHistory()
      .then(setWatchHistory)
      .catch(() => setWatchHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [activeTab]);

  useEffect(() => {
    getMyStats().then(setStats).catch(console.error);
  }, []);

  useEffect(() => {
    setLoadingLikes(true);
    getMyLikedVideos()
      .then(setLikedVideos)
      .catch(() => setLikedVideos([]))
      .finally(() => setLoadingLikes(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "exam-results") return;
    setLoadingExamAttempts(true);
    getMyExamAttempts()
      .then((d) => setExamAttempts(d || []))
      .catch(() => setExamAttempts([]))
      .finally(() => setLoadingExamAttempts(false));
  }, [activeTab]);

  const openExamDetail = async (attemptId: number) => {
    setExamDetailOpen(true);
    setExamDetailLoading(true);
    try {
      setSelectedExamDetail(await getExamAttempt(attemptId));
    } catch {
      message.error("Không thể tải chi tiết kết quả thi");
      setExamDetailOpen(false);
    } finally {
      setExamDetailLoading(false);
    }
  };

  const menuItems = [
    {
      key: "training",
      icon: <BookOutlined />,
      label: "Đào tạo của tôi",
      count: trainingPlans.length,
    },
    {
      key: "exam-results",
      icon: <FileSearchOutlined />,
      label: "Kết quả thi",
      count: examAttempts.length,
    },
    {
      key: "favorites",
      icon: <HeartOutlined />,
      label: "Yêu thích",
      count: likedVideos.length,
    },
    {
      key: "history",
      icon: <HistoryOutlined />,
      label: "Lịch sử xem",
      count: watchHistory.length,
    },
    {
      key: "statistics",
      icon: <BarChartOutlined />,
      label: "Thống kê",
      count: 0,
    },
  ];

  // 3 chỉ số gọn dùng cho sidebar mobile
  const quickStats = [
    {
      icon: <BookOutlined className="text-blue-500" />,
      label: "Khóa học",
      value: stats.totalCourses,
    },
    {
      icon: <CheckCircleOutlined className="text-green-500" />,
      label: "Hoàn thành",
      value: stats.coursesCompleted,
    },
    {
      icon: <ClockCircleOutlined className="text-orange-500" />,
      label: "Đang học",
      value: stats.coursesInProgress,
    },
  ];

  // Shared empty state component
  const EmptyState = ({
    icon,
    text,
    sub,
  }: {
    icon: React.ReactNode;
    text: string;
    sub?: string;
  }) => (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <div className="text-5xl mb-3">{icon}</div>
      <p className="text-base">{text}</p>
      {sub && <p className="text-sm text-slate-400 mt-1">{sub}</p>}
    </div>
  );

  return (
    // Chiều cao do SIDEBAR quyết định; Tab content khớp đúng chiều cao đó.
    <div className="bg-slate-50">
      {/* lg:items-stretch -> cột phải cao bằng cột sidebar */}
      <div className="flex flex-col lg:flex-row gap-4 p-3 lg:p-4 lg:items-stretch">
        {/* ── Left Sidebar (chiều cao tự nhiên theo nội dung) ── */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            {/* Header: NGANG trên mobile, DỌC trên desktop */}
            <div className="flex lg:flex-col items-center lg:text-center gap-3 lg:gap-0 lg:mb-4">
              <Avatar
                size={56}
                src={user?.avatar}
                icon={<UserOutlined />}
                className="border-2 border-blue-100 lg:size-16 shrink-0 lg:mb-2"
              />
              <div className="flex-1 min-w-0 lg:mt-1">
                <Title level={4} className="!mb-0 !mt-0 truncate">
                  {user?.name}
                </Title>
                <Text type="secondary" className="text-sm block mb-1.5">
                  {user?.role === "admin" ? "Quản trị viên" : "Học viên"}
                </Text>
                <Tag icon={<UserOutlined />} color="blue" className="text-sm">
                  {user?.usercode}
                </Tag>
              </div>
            </div>

            {/* ── Mobile: 3 chip gọn, không stack dọc ── */}
            <div className="grid grid-cols-3 gap-2 mt-3 lg:hidden">
              {quickStats.map(({ icon, label, value }) => (
                <div
                  key={label}
                  className="bg-slate-50 rounded-lg py-2 px-1 text-center"
                >
                  <div className="text-lg leading-none mb-1">{icon}</div>
                  <div className="text-lg font-bold leading-tight">{value}</div>
                  <div className="text-xs text-slate-500 leading-tight">
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop only: full stats ── */}
            <div className="hidden lg:block">
              {/* Course stats */}
              <div className="border-t border-slate-100 pt-3 mt-3 space-y-2.5">
                {quickStats.map(({ icon, label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 text-base text-slate-600">
                      {icon}
                      {label}
                    </div>
                    <span className="text-base font-semibold">{value}</span>
                  </div>
                ))}
              </div>

              {/* Time stats */}
              <div className="border-t border-slate-100 pt-3 mt-3 space-y-2">
                <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-2">
                  <ClockCircleOutlined className="text-blue-500 text-lg shrink-0" />
                  <div>
                    <p className="text-base font-semibold text-blue-700 leading-tight">
                      {formatDuration(stats.monthlyDuration)}
                    </p>
                    <p className="text-sm text-blue-400 leading-tight">
                      tháng này
                    </p>
                  </div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 flex items-center gap-2">
                  <TrophyOutlined className="text-yellow-500 text-lg shrink-0" />
                  <div>
                    <p className="text-base font-semibold text-yellow-700 leading-tight">
                      {formatDuration(stats.totalDuration)}
                    </p>
                    <p className="text-sm text-yellow-500 leading-tight">
                      tích lũy
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Dept + position (hiện ở cả mobile; mobile xếp 2 cột cho gọn) ── */}
            <div className="border-t border-slate-100 pt-3 mt-3 grid grid-cols-2 lg:grid-cols-1 gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-0.5">
                  <TeamOutlined className="text-cyan-500" />
                  Bộ phận
                </div>
                <p className="text-base font-medium text-slate-700 pl-5 truncate lg:whitespace-normal">
                  {user?.department?.name_vi ||
                    user?.department?.name_en ||
                    user?.department?.code ||
                    "---"}
                </p>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-0.5">
                  <CrownOutlined className="text-purple-500" />
                  Chức vụ
                </div>
                <p className="text-base font-medium text-slate-700 pl-5 truncate lg:whitespace-normal">
                  {user?.position?.name_vi ||
                    user?.position?.name_en ||
                    user?.position?.code ||
                    "---"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Content ── */}
        {/* lg:relative + inner absolute inset-0: cột phải lấp đúng chiều cao đã stretch theo
            sidebar, list dài chỉ cuộn bên trong, KHÔNG kéo layout cao hơn sidebar. */}
        <div className="flex-1 min-w-0 lg:relative lg:overflow-hidden">
          <div className="flex flex-col lg:absolute lg:inset-0">
          {/* Tab bar */}
          <div className="bg-white rounded-xl border border-slate-200 mb-3 flex-shrink-0">
            <div className="flex overflow-x-auto scrollbar-none">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 whitespace-nowrap border-b-2 text-base transition-colors ${
                    activeTab === item.key
                      ? "border-blue-500 text-blue-600 bg-blue-50/60 font-semibold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.count > 0 && (
                    <span className="bg-slate-100 text-slate-500 px-1.5 py-0 rounded-full text-xs leading-5">
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content — desktop cuộn nội bộ, mobile giãn tự nhiên */}
          <div className="bg-white rounded-xl border border-slate-200 flex-1 min-h-0 lg:overflow-y-auto p-4">
            {/* ── TRAINING TAB ── */}
            {activeTab === "training" && (
              <div>
                <p className="text-lg font-semibold text-slate-700 mb-3">
                  Kế hoạch đào tạo của tôi
                </p>
                {loadingTrainingPlans ? (
                  <div className="text-center py-10">
                    <Progress type="circle" percent={0} size={40} />
                  </div>
                ) : trainingPlans.length > 0 ? (
                  <div className="space-y-2">
                    {trainingPlans.map((plan) => {
                      const isExpired = isPlanExpired(
                        plan.endDate,
                        plan.status,
                      );
                      const isCompleted = plan.status === "COMPLETED";
                      const canAccess = !isExpired && !isCompleted;
                      const displayStatus = getPlanDisplayStatus(
                        plan.endDate,
                        plan.status,
                      );

                      const firstCourseResource = plan.resources?.find(
                        (r) => r.type === "COURSE" && r.refId,
                      );
                      const firstExamResource = plan.resources?.find(
                        (r) => r.type === "EXAM" && r.refId,
                      );
                      const firstCourseImg = plan.resources?.find(
                        (r) => r.type === "COURSE" && r.course?.coverImage,
                      );
                      const imgSrc =
                        plan.coverImage || firstCourseImg?.course?.coverImage;

                      return (
                        <div
                          key={plan.id}
                          onClick={() => {
                            if (!canAccess) {
                              if (isExpired)
                                message.warning("Kế hoạch đã hết hạn.");
                              else if (isCompleted)
                                message.info("Kế hoạch đã hoàn thành.");
                              return;
                            }
                            if (firstCourseResource?.refId)
                              navigate(
                                `/learn/${firstCourseResource.refId}?planId=${plan.id}`,
                              );
                            else if (firstExamResource?.refId)
                              navigate(
                                `/exam/${firstExamResource.refId}?planId=${plan.id}`,
                              );
                          }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 hover:shadow-sm cursor-pointer transition-all hover:border-blue-200"
                        >
                          {/* Thumbnail */}
                          <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                            <img
                              src={
                                imgSrc ||
                                `https://via.placeholder.com/56x56?text=${encodeURIComponent(plan.trainingClass?.name_vi?.[0] || "T")}`
                              }
                              alt={plan.title_vi}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src =
                                  "https://via.placeholder.com/56x56?text=T";
                              }}
                            />
                          </div>

                          {/* Info — 2 rows only */}
                          <div className="flex-1 min-w-0">
                            {/* Row 1: title + status + percent */}
                            <div className="flex items-center gap-2">
                              <p className="text-base font-semibold text-slate-800 truncate flex-1">
                                {plan.title_vi || "Kế hoạch đào tạo"}
                              </p>
                              <Tag
                                color={displayStatus.color as any}
                                className="!text-xs !px-1.5 !py-0 !m-0 shrink-0"
                              >
                                {displayStatus.text}
                              </Tag>
                              <span className="text-base font-bold text-blue-600 shrink-0 w-11 text-right">
                                {plan.progressPercent}%
                              </span>
                            </div>

                            {/* Row 2: meta tags + date + progress bar
                                mobile: stack dọc (progress xuống dưới, full width) để tag không đè */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mt-1.5">
                              {/* Left: tags + date */}
                              <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                                {plan.trainingClass && (
                                  <Tag
                                    icon={<BookOutlined />}
                                    color="blue"
                                    className="!text-sm !px-1.5 !py-0 !m-0 !leading-6 max-w-[45vw] sm:max-w-none truncate"
                                  >
                                    {plan.trainingClass.name_vi ||
                                      plan.trainingClass.code}
                                  </Tag>
                                )}
                                {plan.academy && (
                                  <Tag
                                    icon={<CalendarOutlined />}
                                    color="purple"
                                    className="!text-sm !px-1.5 !py-0 !m-0 !leading-6 max-w-[45vw] sm:max-w-none truncate"
                                  >
                                    {plan.academy.name_vi || plan.academy.code}
                                  </Tag>
                                )}
                                {plan.endDate && (
                                  <span
                                    className={`text-sm shrink-0 ${isExpired ? "text-red-500" : "text-slate-400"}`}
                                  >
                                    {isExpired
                                      ? "⚠ Hết hạn"
                                      : `Đến ${new Date(plan.endDate).toLocaleDateString("vi-VN")}`}
                                  </span>
                                )}
                                {/* Resource tags inline — chỉ hiện từ sm trở lên cho gọn mobile */}
                                {plan.resources?.slice(0, 2).map((r, idx) => {
                                  const label =
                                    r.course?.title_vi ||
                                    r.document?.name ||
                                    r.exam?.name_vi ||
                                    r.title_vi ||
                                    `Mục ${idx + 1}`;
                                  const icon =
                                    r.type === "EXAM" ? (
                                      <FileProtectOutlined />
                                    ) : r.type === "DOCUMENT" ? (
                                      <FileDoneOutlined />
                                    ) : (
                                      <ReadOutlined />
                                    );
                                  return (
                                    <Tag
                                      key={r.id}
                                      icon={icon}
                                      color={
                                        r.progressPercent === 100
                                          ? "success"
                                          : r.progressPercent > 0
                                            ? "processing"
                                            : "default"
                                      }
                                      className="!text-sm !px-1.5 !py-0 !m-0 !leading-6 cursor-pointer max-w-[160px] truncate"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (r.type === "COURSE" && r.refId)
                                          navigate(
                                            `/learn/${r.refId}?planId=${plan.id}`,
                                          );
                                        if (r.type === "EXAM" && r.refId)
                                          navigate(
                                            `/exam/${r.refId}?planId=${plan.id}`,
                                          );
                                      }}
                                    >
                                      {label}
                                    </Tag>
                                  );
                                })}
                                {(plan.resources?.length ?? 0) > 2 && (
                                  <Tag className="!text-sm !px-1.5 !py-0 !m-0 !leading-6">
                                    +{plan.resources!.length - 2}
                                  </Tag>
                                )}
                              </div>

                              {/* Right: progress bar + count — full width trên mobile */}
                              <div className="flex items-center gap-2 shrink-0 w-full sm:w-32">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${plan.progressPercent}%`,
                                      background:
                                        plan.progressPercent === 100
                                          ? "#22c55e"
                                          : "#3b82f6",
                                    }}
                                  />
                                </div>
                                <span className="text-sm text-slate-400 shrink-0">
                                  {plan.completedVideos}/{plan.totalVideos}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<BookOutlined />}
                    text="Chưa có kế hoạch đào tạo nào"
                    sub="Liên hệ quản trị viên để được thêm vào lớp học"
                  />
                )}
              </div>
            )}

            {/* ── EXAM RESULTS TAB ── */}
            {activeTab === "exam-results" && (
              <div>
                <p className="text-lg font-semibold text-slate-700 mb-3">
                  Lịch sử kết quả thi
                </p>
                {loadingExamAttempts ? (
                  <div className="text-center py-12">
                    <Progress type="circle" percent={0} size={40} />
                  </div>
                ) : examAttempts.length > 0 ? (
                  <div className="space-y-2">
                    {examAttempts.map((attempt) => {
                      const examName =
                        attempt.examName?.vi ||
                        attempt.examName?.en ||
                        attempt.examName?.zh ||
                        `Kỳ thi #${attempt.examSessionId}`;
                      const passed = Boolean(attempt.passed);
                      const finished = attempt.status !== "ONGOING";
                      return (
                        <div
                          key={attempt.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:shadow-sm transition-shadow"
                        >
                          {/* Score badge */}
                          <div
                            className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                              !finished
                                ? "bg-blue-50"
                                : passed
                                  ? "bg-green-50"
                                  : "bg-red-50"
                            }`}
                          >
                            <span
                              className={`text-2xl font-bold ${!finished ? "text-blue-600" : passed ? "text-green-600" : "text-red-500"}`}
                            >
                              {attempt.score ?? 0}
                            </span>
                            <span className="text-xs text-slate-400">điểm</span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-medium text-slate-800 truncate">
                              {examName}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Tag
                                color={
                                  finished ? (passed ? "green" : "red") : "blue"
                                }
                                className="!text-sm !px-1.5 !py-0 !m-0"
                              >
                                {finished
                                  ? passed
                                    ? "Đạt"
                                    : "Không đạt"
                                  : "Đang làm"}
                              </Tag>
                              {attempt.isFraud && (
                                <Tag
                                  color="error"
                                  className="!text-sm !px-1.5 !py-0 !m-0"
                                >
                                  Gian lận
                                </Tag>
                              )}
                              {attempt.cheatWarnings > 0 && (
                                <Tag
                                  color="warning"
                                  className="!text-sm !px-1.5 !py-0 !m-0"
                                >
                                  ⚠ {attempt.cheatWarnings}/3
                                </Tag>
                              )}
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                              {new Date(attempt.startedAt).toLocaleString(
                                "vi-VN",
                              )}
                            </p>
                            <p className="text-sm text-slate-400">
                              Đúng {attempt.correctCount} · Sai{" "}
                              {attempt.wrongCount} · Trống{" "}
                              {attempt.unansweredCount}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <Button
                              size="middle"
                              onClick={() =>
                                navigate(`/exam/${attempt.examSessionId}`)
                              }
                            >
                              Thi lại
                            </Button>
                            <Button
                              size="middle"
                              type="primary"
                              onClick={() => openExamDetail(attempt.id)}
                            >
                              Chi tiết
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<FileSearchOutlined />}
                    text="Chưa có dữ liệu kết quả thi"
                  />
                )}
              </div>
            )}

            {/* ── FAVORITES TAB ── */}
            {activeTab === "favorites" && (
              <div>
                <p className="text-lg font-semibold text-slate-700 mb-3">
                  Video yêu thích
                </p>
                {loadingLikes ? (
                  <div className="text-center py-12">
                    <Progress type="circle" percent={0} size={40} />
                  </div>
                ) : likedVideos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {likedVideos.map((item) => (
                      <div
                        key={item.likeId}
                        className="rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          if (item.courseId && item.lessonId) {
                            navigate(
                              `/learn/${item.courseId}?lessonId=${item.lessonId}&videoId=${item.videoId}`,
                            );
                          } else if (item.courseId) {
                            navigate(`/learn/${item.courseId}/${item.videoId}`);
                          }
                        }}
                      >
                        <div className="relative h-28 bg-slate-900">
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt={item.videoName || ""}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <PlayCircleOutlined className="text-slate-400 text-2xl" />
                            </div>
                          )}
                          <HeartFilled className="absolute top-2 right-2 text-red-500 text-base" />
                          {item.duration && (
                            <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
                              {Math.floor(item.duration / 60)}:
                              {String(item.duration % 60).padStart(2, "0")}
                            </span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug">
                            {item.videoName || "Video"}
                          </p>
                          {item.course && (
                            <p className="text-sm text-slate-400 truncate mt-0.5">
                              {item.course.title_vi || item.course.title_en}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<HeartOutlined />}
                    text="Chưa có video yêu thích"
                    sub="Like video trong trang học để lưu vào đây"
                  />
                )}
              </div>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab === "history" && (
              <div>
                <p className="text-lg font-semibold text-slate-700 mb-3">
                  Lịch sử xem gần đây
                </p>
                {loadingHistory ? (
                  <div className="text-center py-12">
                    <Progress type="circle" percent={0} size={40} />
                  </div>
                ) : watchHistory.length > 0 ? (
                  <div className="space-y-2">
                    {watchHistory.map((item) => {
                      const thumbnailSrc =
                        item.video?.thumbnailUrl || item.course?.coverImage;
                      const videoName =
                        item.video?.name || item.lessonTitle || "Video";
                      const courseTitle =
                        item.course?.title_vi ||
                        item.course?.title_en ||
                        item.course?.title_zh ||
                        "Khóa học";
                      const courseId = item.course?.id;

                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:shadow-sm cursor-pointer transition-all"
                          onClick={() => {
                            if (courseId) {
                              const p = new URLSearchParams();
                              if (item.lessonId)
                                p.set("lessonId", String(item.lessonId));
                              if (item.videoId)
                                p.set("videoId", String(item.videoId));
                              navigate(
                                `/learn/${courseId}${p.toString() ? `?${p}` : ""}`,
                              );
                            }
                          }}
                        >
                          {/* Thumbnail */}
                          <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-slate-900">
                            {thumbnailSrc ? (
                              <img
                                src={thumbnailSrc}
                                alt={courseTitle}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src =
                                    "https://via.placeholder.com/64x48";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <PlayCircleOutlined className="text-slate-400 text-base" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-medium text-blue-600 truncate leading-snug">
                              {videoName}
                            </p>
                            <p className="text-sm text-slate-400 truncate">
                              {courseTitle}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-24">
                                <div
                                  className="h-full bg-blue-400 rounded-full"
                                  style={{ width: `${item.progressPercent}%` }}
                                />
                              </div>
                              <span className="text-sm text-slate-400">
                                {item.completed
                                  ? "Xong"
                                  : formatTime(item.watchedSeconds)}
                              </span>
                            </div>
                          </div>

                          {/* Right */}
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="text-sm text-slate-400">
                              {formatRelativeTime(item.updatedAt)}
                            </span>
                            <Button
                              type="primary"
                              size="middle"
                              icon={<PlayCircleOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (courseId) {
                                  const p = new URLSearchParams();
                                  if (item.lessonId)
                                    p.set("lessonId", String(item.lessonId));
                                  if (item.videoId)
                                    p.set("videoId", String(item.videoId));
                                  navigate(
                                    `/learn/${courseId}${p.toString() ? `?${p}` : ""}`,
                                  );
                                }
                              }}
                            >
                              {item.completed ? "Xem lại" : "Tiếp tục"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<HistoryOutlined />}
                    text="Chưa có lịch sử xem"
                    sub="Bắt đầu xem video để theo dõi tiến trình"
                  />
                )}
              </div>
            )}

            {/* ── STATISTICS TAB ── */}
            {activeTab === "statistics" && (
              <div>
                <p className="text-lg font-semibold text-slate-700 mb-3">
                  Thống kê học tập
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    {
                      icon: <ClockCircleOutlined />,
                      value: formatDuration(stats.monthlyDuration),
                      label: "tháng này",
                      from: "from-blue-500",
                      to: "to-blue-600",
                    },
                    {
                      icon: <TrophyOutlined />,
                      value: formatDuration(stats.totalDuration),
                      label: "tích lũy",
                      from: "from-yellow-400",
                      to: "to-yellow-500",
                    },
                    {
                      icon: <CheckCircleOutlined />,
                      value: stats.coursesCompleted,
                      label: "hoàn thành",
                      from: "from-green-500",
                      to: "to-green-600",
                    },
                    {
                      icon: <TeamOutlined />,
                      value: stats.coursesInProgress,
                      label: "đang học",
                      from: "from-orange-400",
                      to: "to-orange-500",
                    },
                  ].map(({ icon, value, label, from, to }) => (
                    <div
                      key={label}
                      className={`bg-gradient-to-br ${from} ${to} rounded-xl p-4 text-white`}
                    >
                      <div className="text-xl mb-1">{icon}</div>
                      <div className="text-2xl font-bold leading-tight">
                        {value}
                      </div>
                      <div className="text-sm opacity-80">{label}</div>
                    </div>
                  ))}
                </div>

                <p className="text-lg font-semibold text-slate-700 mb-3">
                  Hoạt động 6 tháng gần nhất
                </p>
                {stats.monthlyDurationByMonth?.length > 0 ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={stats.monthlyDurationByMonth.map((item) => ({
                          minutes: Math.round((item.duration / 60) * 10) / 10,
                          label:
                            item.month.split("-")[1] +
                            "/" +
                            item.month.split("-")[0].slice(2),
                        }))}
                        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12 }}
                          stroke="#94a3b8"
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          stroke="#94a3b8"
                          tickFormatter={(v) => (v ? `${v}p` : "0")}
                        />
                        <Tooltip
                          formatter={(v) => [
                            formatDuration(Math.round((v as number) * 60)),
                            "Học",
                          ]}
                          labelFormatter={(l) => `Tháng ${l}`}
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            fontSize: 13,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="minutes"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ fill: "#3b82f6", strokeWidth: 2, r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    icon={<BarChartOutlined />}
                    text="Chưa có dữ liệu học tập"
                  />
                )}
              </div>
            )}
          </div>
          {/* end tab content */}
          </div>
          {/* end absolute wrapper */}
        </div>
        {/* end main */}
      </div>
      {/* end flex row */}

      {/* ── Exam Detail Modal ── */}
      <Modal
        title="Chi tiết bài thi"
        open={examDetailOpen}
        onCancel={() => setExamDetailOpen(false)}
        footer={null}
        width={700}
      >
        {examDetailLoading ? (
          <div className="text-center py-8">
            <Progress type="circle" percent={0} size={40} />
          </div>
        ) : selectedExamDetail ? (
          <div className="space-y-3">
            <Alert
              type={
                selectedExamDetail.passed && !selectedExamDetail.isFraud
                  ? "success"
                  : "error"
              }
              message={
                selectedExamDetail.isFraud
                  ? "Gian lận"
                  : selectedExamDetail.passed
                    ? "Đạt"
                    : "Không đạt"
              }
              description={`Điểm: ${selectedExamDetail.score} · Đúng: ${selectedExamDetail.correctCount} · Sai: ${selectedExamDetail.wrongCount} · Trống: ${selectedExamDetail.unansweredCount} · Cảnh báo: ${selectedExamDetail.cheatWarnings}/3`}
              showIcon
            />
            <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg p-3 space-y-2">
              {(selectedExamDetail.details || []).map(
                (detail: any, idx: number) => (
                  <div
                    key={detail.questionId}
                    className="rounded-lg border border-slate-100 p-3"
                  >
                    <Text strong className="text-base">
                      Câu {idx + 1}: {detail.question}
                    </Text>
                    <div className="text-sm mt-1 text-slate-600">
                      Trả lời:{" "}
                      {Array.isArray(detail.userAnswer)
                        ? detail.userAnswer.join(", ")
                        : String(detail.userAnswer ?? "Bỏ trống")}
                    </div>
                    <div className="text-sm text-slate-600">
                      Đáp án đúng:{" "}
                      {Array.isArray(detail.correctAnswer)
                        ? detail.correctAnswer.join(", ")
                        : String(detail.correctAnswer ?? "")}
                    </div>
                    <Tag
                      color={
                        detail.correct
                          ? "success"
                          : detail.answered
                            ? "error"
                            : "warning"
                      }
                      className="mt-1.5 !text-sm"
                    >
                      {detail.correct
                        ? "Đúng"
                        : detail.answered
                          ? "Sai"
                          : "Bỏ trống"}
                    </Tag>
                  </div>
                ),
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
