import { useEffect, useMemo, useState } from 'react';
import { DatePicker, Input, Modal, Select, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BookOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { authGet } from '../../services/auth/auth.get';
import { getCourses } from '../../services/course';

const { RangePicker } = DatePicker;

type StatusType = 'CHUA_BAT_DAU' | 'DANG_HOC' | 'HOAN_THANH' | 'QUA_HAN';

interface DepartmentOption { id: number; name_vi?: string | null; code: string; }
interface CourseOption { id: number; title_vi?: string | null; title_en?: string | null; title_zh?: string | null; }
interface TimeReportSummary { totalLearners: number; totalCourses: number; completionRate: number; totalStudyHours: number; }
interface TimeReportRow {
  key: string; userId: number; usercode: string; fullName: string; department: string;
  position: string;
  courseId: number; courseName: string; deadline: string | null; daysRemaining: number | null;
  studyHours: number; progressPercent: number; status: StatusType; planId: number | null;
}
interface DetailCards {
  contentCompleted: { percent: number; completed: number; total: number };
  examCompleted: { completed: number; total: number };
  completionPercent: number; learningProgressPercent: number; status: StatusType;
}
interface DetailItem {
  key: string; type: 'VIDEO' | 'DOCUMENT' | 'EXAM'; content: string;
  progressPercent: number; completed: boolean; completedAt: string | null;
}
interface DetailResponse {
  user: { id: number; usercode: string; fullName: string; department: string };
  course: { id: number; name: string };
  cards: DetailCards; items: DetailItem[];
}

const emptySummary: TimeReportSummary = { totalLearners: 0, totalCourses: 0, completionRate: 0, totalStudyHours: 0 };

const STATUS_MAP: Record<StatusType, { label: string; color: string; bg: string; dot: string }> = {
  HOAN_THANH: { label: 'Hoàn thành', color: '#059669', bg: '#ECFDF5', dot: '#10B981' },
  QUA_HAN:    { label: 'Quá hạn',    color: '#DC2626', bg: '#FEF2F2', dot: '#EF4444' },
  DANG_HOC:   { label: 'Đang học',   color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
  CHUA_BAT_DAU: { label: 'Chưa bắt đầu', color: '#64748B', bg: '#F1F5F9', dot: '#94A3B8' },
};

function StatusBadge({ status }: { status: StatusType }) {
  const s = STATUS_MAP[status] || STATUS_MAP.CHUA_BAT_DAU;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function MiniProgress({ value }: { value: number }) {
  const color = value >= 100 ? '#10B981' : value > 0 ? '#3B82F6' : '#CBD5E1';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="text-sm tabular-nums font-medium" style={{ color }}>{value.toFixed(0)}%</span>
    </div>
  );
}

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return <span className="text-slate-400">—</span>;
  const urgent = days <= 3;
  const warn = days <= 7;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums ${
      urgent ? 'bg-red-50 text-red-600' : warn ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
    }`}>
      <ClockCircleOutlined className="text-[10px]" />
      {days}
    </span>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ReactNode;
  accent: { from: string; to: string; bg: string; text: string };
}) {
  return (
    <div className="relative bg-white rounded-2xl p-5 overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.04)' }}>
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg,${accent.from},${accent.to})` }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
          <p className="text-3xl font-bold text-slate-800 leading-none tabular-nums">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-xl"
          style={{ background: accent.bg, color: accent.from }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── Detail mini card ─────────────────────────────────────────────────────────
function DetailCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function courseLabel(c: CourseOption) {
  return c.title_vi || c.title_en || c.title_zh || `Khóa học #${c.id}`;
}

export default function ReportsTime() {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [summary, setSummary] = useState<TimeReportSummary>(emptySummary);
  const [rows, setRows] = useState<TimeReportRow[]>([]);
  const [usercodeFilter, setUsercodeFilter] = useState('');
  const [departmentIdFilter, setDepartmentIdFilter] = useState<number | undefined>(undefined);
  const [courseIdFilter, setCourseIdFilter] = useState<number | undefined>(undefined);
  const [dateRangeFilter, setDateRangeFilter] = useState<[Dayjs, Dayjs] | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<DetailResponse | null>(null);

  const numberFormat = useMemo(() => new Intl.NumberFormat('vi-VN'), []);

  const buildFilters = () => ({
    usercode: usercodeFilter.trim() || undefined,
    departmentId: departmentIdFilter,
    courseId: courseIdFilter,
    startDate: dateRangeFilter?.[0]?.format('YYYY-MM-DD'),
    endDate: dateRangeFilter?.[1]?.format('YYYY-MM-DD'),
  });

  const fetchFilterOptions = async () => {
    try {
      const [deptRes, courseRes] = await Promise.all([authGet.getDepartments(), getCourses()]);
      setDepartments(deptRes.data.departments || []);
      setCourses((courseRes || []).map((c: any) => ({ id: c.id, title_vi: c.title_vi, title_en: c.title_en, title_zh: c.title_zh })));
    } catch { message.error('Không thể tải bộ lọc'); }
  };

  const fetchReport = async (overrideFilters?: object) => {
    setLoading(true);
    try {
      const response = await authGet.getLearningTimeReport(overrideFilters ?? buildFilters());
      setSummary(response.data.summary || emptySummary);
      setRows(response.data.rows || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải báo cáo');
      setSummary(emptySummary); setRows([]);
    } finally { setLoading(false); }
  };

  const fetchDetail = async (row: TimeReportRow) => {
    setDetailOpen(true); setDetailLoading(true); setDetailData(null);
    try {
      const response = await authGet.getLearningTimeReportDetail({ userId: row.userId, courseId: row.courseId, planId: row.planId || undefined });
      setDetailData(response.data as DetailResponse);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải chi tiết');
    } finally { setDetailLoading(false); }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const response = await authGet.exportLearningTimeReportExcel(buildFilters());
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'learning-time-report.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      message.success('Đã xuất file Excel');
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Xuất Excel thất bại');
    } finally { setExporting(false); }
  };

  useEffect(() => { fetchFilterOptions(); fetchReport(); }, []);

  const columns: ColumnsType<TimeReportRow> = [
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mã số</span>,
      dataIndex: 'usercode', key: 'usercode', width: 110,
      render: (v: string) => <span className="font-mono text-sm font-bold text-slate-700">{v}</span>,
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Họ tên</span>,
      dataIndex: 'fullName', key: 'fullName', width: 180,
      render: (v: string) => <span className="text-sm font-medium text-slate-800">{v || '—'}</span>,
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chức vụ</span>,
      dataIndex: 'position', key: 'position', width: 140, ellipsis: true,
      render: (v: string) => <span className="text-sm text-slate-600">{v || '—'}</span>,
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bộ phận</span>,
      dataIndex: 'department', key: 'department', width: 150, ellipsis: true,
      render: (v: string) => (
        <span className="inline-flex items-center text-xs font-medium bg-slate-100 text-slate-600 rounded-md px-2 py-0.5">{v || '—'}</span>
      ),
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Khóa học</span>,
      dataIndex: 'courseName', key: 'courseName', width: 220, ellipsis: true,
      render: (v: string) => <span className="text-sm font-medium text-blue-700">{v}</span>,
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Deadline</span>,
      dataIndex: 'deadline', key: 'deadline', width: 120,
      render: (v: string | null) => v
        ? <span className="flex items-center gap-1 text-sm text-slate-600"><CalendarOutlined className="text-slate-400 text-xs" />{dayjs(v).format('DD/MM/YYYY')}</span>
        : <span className="text-slate-400">—</span>,
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Còn lại</span>,
      dataIndex: 'daysRemaining', key: 'daysRemaining', width: 90, align: 'center',
      render: (v: number | null) => <DaysChip days={v} />,
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Giờ học</span>,
      dataIndex: 'studyHours', key: 'studyHours', width: 100, align: 'right',
      sorter: (a, b) => a.studyHours - b.studyHours,
      render: (v: number) => <span className="tabular-nums text-sm text-slate-700 font-medium">{v.toFixed(2)}</span>,
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tiến trình</span>,
      dataIndex: 'progressPercent', key: 'progressPercent', width: 160,
      sorter: (a, b) => a.progressPercent - b.progressPercent,
      render: (v: number) => <MiniProgress value={v} />,
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Trạng thái</span>,
      dataIndex: 'status', key: 'status', width: 140,
      render: (s: StatusType) => <StatusBadge status={s} />,
    },
    {
      title: '',
      key: 'action', width: 90, fixed: 'right',
      render: (_, row) => (
        <button onClick={() => fetchDetail(row)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors">
          Chi tiết →
        </button>
      ),
    },
  ];

  const detailColumns: ColumnsType<DetailItem> = [
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nội dung</span>,
      dataIndex: 'content', key: 'content', ellipsis: true, width: 260,
      render: (v: string) => <span className="text-sm text-slate-700">{v}</span>,
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Loại</span>,
      dataIndex: 'type', key: 'type', width: 110,
      render: (type: DetailItem['type']) => {
        const map = { VIDEO: { label: 'Video', icon: <PlayCircleOutlined />, color: 'text-blue-600 bg-blue-50' }, DOCUMENT: { label: 'Tài liệu', icon: <FileTextOutlined />, color: 'text-amber-700 bg-amber-50' }, EXAM: { label: 'Kỳ thi', icon: <TrophyOutlined />, color: 'text-emerald-700 bg-emerald-50' } };
        const m = map[type];
        return <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-md px-2 py-0.5 ${m.color}`}>{m.icon}{m.label}</span>;
      },
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tiến trình</span>,
      dataIndex: 'progressPercent', key: 'progressPercent', width: 150,
      render: (v: number) => <MiniProgress value={v} />,
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hoàn thành lúc</span>,
      dataIndex: 'completedAt', key: 'completedAt', width: 160,
      render: (v: string | null) => v
        ? <span className="text-xs text-slate-500">{dayjs(v).format('DD/MM/YYYY HH:mm')}</span>
        : <span className="text-slate-300">—</span>,
    },
  ];

  const statCards = [
    { label: 'Học viên', value: numberFormat.format(summary.totalLearners), sub: 'tổng số nhân sự', icon: <TeamOutlined />, accent: { from: '#1E40AF', to: '#3B82F6', bg: '#EFF6FF', text: '#1E40AF' } },
    { label: 'Khóa học', value: numberFormat.format(summary.totalCourses), sub: 'khóa được phân công', icon: <BookOutlined />, accent: { from: '#0EA5E9', to: '#38BDF8', bg: '#F0F9FF', text: '#0EA5E9' } },
    { label: 'Tỉ lệ hoàn thành', value: `${summary.completionRate.toFixed(1)}%`, sub: 'trên tổng số phân công', icon: <CheckCircleOutlined />, accent: { from: '#10B981', to: '#34D399', bg: '#ECFDF5', text: '#065F46' } },
    { label: 'Giờ học', value: summary.totalStudyHours.toFixed(2), sub: 'tổng giờ tích lũy', icon: <ClockCircleOutlined />, accent: { from: '#F59E0B', to: '#FCD34D', bg: '#FFFBEB', text: '#B45309' } },
  ];

  return (
    <div className="bg-slate-50 p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1">Báo cáo</p>
          <h1 className="text-2xl font-bold text-slate-900">Báo cáo thời gian học tập</h1>
          <p className="text-sm text-slate-500 mt-1">Theo dõi tiến độ học tập theo nhân sự và khóa học</p>
        </div>
        <button onClick={exportExcel} disabled={exporting}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-700 text-slate-600 text-sm font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-60 shadow-sm shrink-0">
          <DownloadOutlined />
          {exporting ? 'Đang xuất...' : 'Xuất Excel'}
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl p-4"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.04)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Mã số</label>
            <Input prefix={<SearchOutlined className="text-slate-400" />} placeholder="Nhập mã số..."
              value={usercodeFilter} onChange={e => setUsercodeFilter(e.target.value)}
              onPressEnter={() => fetchReport()} allowClear />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Bộ phận</label>
            <Select placeholder="Tất cả bộ phận" value={departmentIdFilter} allowClear className="w-full"
              options={departments.map(d => ({ label: d.name_vi || d.code, value: d.id }))}
              onChange={v => setDepartmentIdFilter(v)} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Khóa học</label>
            <Select placeholder="Tất cả khóa học" value={courseIdFilter} allowClear showSearch optionFilterProp="label"
              className="w-full"
              options={courses.map(c => ({ label: courseLabel(c), value: c.id }))}
              onChange={v => setCourseIdFilter(v)} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Khoảng thời gian</label>
            <RangePicker value={dateRangeFilter} onChange={v => setDateRangeFilter(v as [Dayjs, Dayjs] | null)}
              format="DD/MM/YYYY" placeholder={['Từ ngày', 'Đến ngày']} className="w-full" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={() => fetchReport()} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-60 h-9">
              <SearchOutlined />Lọc
            </button>
            <button onClick={() => {
                setUsercodeFilter(''); setDepartmentIdFilter(undefined);
                setCourseIdFilter(undefined); setDateRangeFilter(null);
                fetchReport({});
              }}
              className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold px-3 py-2 rounded-xl transition-all h-9">
              <ReloadOutlined />
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Dữ liệu chi tiết</h2>
            <p className="text-xs text-slate-400 mt-0.5">{rows.length} dòng dữ liệu • click tiêu đề để sắp xếp</p>
          </div>
          {loading && <span className="text-xs text-blue-500 font-medium animate-pulse">Đang tải...</span>}
        </div>

        <Table<TimeReportRow>
          rowKey="key"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1200 }}
          rowClassName={(_, i) => i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
          onRow={() => ({ className: 'hover:bg-blue-50/40 transition-colors' })}
          pagination={{
            pageSize: 20, showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => (
              <span className="text-xs text-slate-500">{range[0]}–{range[1]} / {total} dòng</span>
            ),
          }}
          className="[&_.ant-table-thead_th]:!bg-white [&_.ant-table-thead_th]:!border-b [&_.ant-table-thead_th]:!border-slate-100 [&_.ant-table-thead_th]:!py-3 [&_.ant-table-cell]:!py-3"
        />
      </div>

      {/* ── Detail Modal ── */}
      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={960}
        title={null}
        styles={{ body: { padding: 0 } }}
      >
        {/* Modal header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1">Chi tiết học tập</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <UserOutlined className="text-blue-600 text-lg" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">
                {detailData?.user.fullName || detailData?.user.usercode || '—'}
              </p>
              <p className="text-xs text-slate-500">
                {detailData?.user.usercode} · {detailData?.user.department} · {detailData?.course.name}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {detailLoading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
              <ClockCircleOutlined className="text-3xl animate-spin" />
              <p className="text-sm">Đang tải chi tiết...</p>
            </div>
          ) : (
            <>
              {/* Detail stat cards */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
                <DetailCard
                  label="Nội dung hoàn thành"
                  value={`${detailData?.cards.contentCompleted.percent.toFixed(0) || '0'}%`}
                  sub={`${detailData?.cards.contentCompleted.completed || 0}/${detailData?.cards.contentCompleted.total || 0} mục`}
                  color="#1D4ED8"
                />
                <DetailCard
                  label="Bài thi"
                  value={`${detailData?.cards.examCompleted.completed || 0}/${detailData?.cards.examCompleted.total || 0}`}
                  sub="lần thi đạt"
                  color="#059669"
                />
                <DetailCard
                  label="% Hoàn thành"
                  value={`${detailData?.cards.completionPercent.toFixed(1) || '0.0'}%`}
                  color="#0EA5E9"
                />
                <DetailCard
                  label="Tiến trình & trạng thái"
                  value={`${detailData?.cards.learningProgressPercent.toFixed(1) || '0.0'}%`}
                  sub={detailData?.cards.status ? STATUS_MAP[detailData.cards.status]?.label : '—'}
                  color="#F59E0B"
                />
              </div>

              <Table<DetailItem>
                rowKey="key"
                columns={detailColumns}
                dataSource={detailData?.items || []}
                pagination={{ pageSize: 10, showTotal: (t, r) => <span className="text-xs text-slate-500">{r[0]}–{r[1]} / {t}</span> }}
                scroll={{ x: 720 }}
                rowClassName={(_, i) => i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                className="[&_.ant-table-thead_th]:!bg-white [&_.ant-table-thead_th]:!border-b [&_.ant-table-thead_th]:!border-slate-100 [&_.ant-table-thead_th]:!py-2.5 [&_.ant-table-cell]:!py-2.5"
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}