import { useEffect, useMemo, useState } from 'react';
import { Input, Select, Table, message } from 'antd';
import {
  BookOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
  TrophyOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { authGet } from '../../services/auth/auth.get';

interface DepartmentOption {
  id: number;
  name_vi?: string | null;
  code: string;
}

interface ReportSummary {
  totalLearners: number;
  totalStudyHours: number;
  totalCompletedCourses: number;
  totalPassedExams: number;
}

interface ReportRow {
  userId: number;
  usercode: string;
  fullName: string;
  department: string;
  position: string;
  studyHours: number;
  completedCourses: number;
  passedExams: number;
}

const initialSummary: ReportSummary = {
  totalLearners: 0,
  totalStudyHours: 0,
  totalCompletedCourses: 0,
  totalPassedExams: 0,
};

// ── Stat card component ──────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent: { from: string; to: string; text: string; bg: string };
}) {
  return (
    <div
      className="relative bg-white rounded-2xl p-5 overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}
    >
      {/* Gradient accent strip top */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}
      />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
          <p className="text-3xl font-bold text-slate-800 leading-none tabular-nums">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-xl"
          style={{ background: accent.bg, color: accent.from }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── Mini bar (inline study hours visualisation) ──────────────────────────────
function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #0EA5E9, #1E40AF)',
          }}
        />
      </div>
      <span className="text-sm tabular-nums text-slate-700">{value.toFixed(2)}</span>
    </div>
  );
}

export default function ReportsOverview() {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [summary, setSummary] = useState<ReportSummary>(initialSummary);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [usercodeFilter, setUsercodeFilter] = useState('');
  const [departmentIdFilter, setDepartmentIdFilter] = useState<number | undefined>(undefined);

  const numberFormat = useMemo(() => new Intl.NumberFormat('vi-VN'), []);
  const maxStudyHours = useMemo(() => Math.max(...rows.map((r) => r.studyHours), 0.001), [rows]);

  const fetchDepartments = async () => {
    try {
      const response = await authGet.getDepartments();
      setDepartments(response.data.departments || []);
    } catch {
      message.error('Không thể tải danh sách bộ phận');
    }
  };

  const fetchReport = async (override?: { usercode?: string; departmentId?: number }) => {
    const payload = {
      usercode: (override?.usercode ?? usercodeFilter).trim() || undefined,
      departmentId: override?.departmentId ?? departmentIdFilter,
    };
    setLoading(true);
    try {
      const response = await authGet.getLearningOverviewReport(payload);
      setSummary(response.data.summary || initialSummary);
      setRows(response.data.rows || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải báo cáo tổng quan');
      setSummary(initialSummary);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const response = await authGet.exportLearningOverviewReport({
        usercode: usercodeFilter.trim() || undefined,
        departmentId: departmentIdFilter,
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'learning-overview-report.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      message.success('Đã xuất file Excel');
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchReport();
  }, []);

  const columns: ColumnsType<ReportRow> = [
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mã số</span>,
      dataIndex: 'usercode',
      key: 'usercode',
      width: 130,
      render: (v: string) => (
        <span className="font-mono text-sm font-semibold text-slate-700">{v}</span>
      ),
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Họ tên</span>,
      dataIndex: 'fullName',
      key: 'fullName',
      width: 200,
      render: (v: string) => (
        <span className="text-sm font-medium text-slate-800">{v || '—'}</span>
      ),
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phòng ban</span>,
      dataIndex: 'department',
      key: 'department',
      width: 170,
      render: (v: string) => (
        <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-md px-2 py-0.5">
          {v || '—'}
        </span>
      ),
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chức vụ</span>,
      dataIndex: 'position',
      key: 'position',
      width: 160,
      render: (v: string) => <span className="text-sm text-slate-600">{v || '—'}</span>,
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Giờ học</span>,
      dataIndex: 'studyHours',
      key: 'studyHours',
      width: 180,
      align: 'left',
      sorter: (a, b) => a.studyHours - b.studyHours,
      render: (v: number) => <MiniBar value={v} max={maxStudyHours} />,
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Khóa học</span>,
      dataIndex: 'completedCourses',
      key: 'completedCourses',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.completedCourses - b.completedCourses,
      render: (v: number) => (
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
            v > 0 ? 'bg-sky-50 text-sky-700' : 'bg-slate-50 text-slate-400'
          }`}
        >
          {v}
        </span>
      ),
    },
    {
      title: <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Thi đạt</span>,
      dataIndex: 'passedExams',
      key: 'passedExams',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.passedExams - b.passedExams,
      render: (v: number) => (
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
            v > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'
          }`}
        >
          {v}
        </span>
      ),
    },
  ];

  const statCards = [
    {
      label: 'Học viên',
      value: numberFormat.format(summary.totalLearners),
      sub: 'tổng số nhân sự',
      icon: <TeamOutlined />,
      accent: { from: '#1E40AF', to: '#3B82F6', text: '#1E40AF', bg: '#EFF6FF' },
    },
    {
      label: 'Giờ học',
      value: summary.totalStudyHours.toFixed(1),
      sub: 'tổng giờ tích lũy',
      icon: <ClockCircleOutlined />,
      accent: { from: '#0EA5E9', to: '#38BDF8', text: '#0EA5E9', bg: '#F0F9FF' },
    },
    {
      label: 'Khóa học',
      value: numberFormat.format(summary.totalCompletedCourses),
      sub: 'khóa đã hoàn thành',
      icon: <BookOutlined />,
      accent: { from: '#F59E0B', to: '#FCD34D', text: '#B45309', bg: '#FFFBEB' },
    },
    {
      label: 'Thi đạt',
      value: numberFormat.format(summary.totalPassedExams),
      sub: 'lần thi vượt ngưỡng',
      icon: <TrophyOutlined />,
      accent: { from: '#10B981', to: '#34D399', text: '#065F46', bg: '#ECFDF5' },
    },
  ];

  return (
    <div className="bg-slate-50 p-6 space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1">
            Báo cáo
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Tổng quan học tập</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tổng hợp tiến độ học theo nhân sự và kết quả thi
          </p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-700 text-slate-600 text-sm font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-60 shadow-sm"
        >
          <DownloadOutlined />
          {exporting ? 'Đang xuất...' : 'Xuất Excel'}
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div
        className="bg-white rounded-2xl p-4 flex flex-col lg:flex-row lg:items-end gap-3"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}
      >
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            Mã số nhân viên
          </label>
          <Input
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Nhập mã số..."
            value={usercodeFilter}
            onChange={(e) => setUsercodeFilter(e.target.value)}
            onPressEnter={() => fetchReport()}
            allowClear
            className="rounded-xl"
          />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            Bộ phận
          </label>
          <Select
            placeholder="Tất cả bộ phận"
            value={departmentIdFilter}
            allowClear
            className="w-full"
            options={departments.map((d) => ({ label: d.name_vi || d.code, value: d.id }))}
            onChange={(v) => setDepartmentIdFilter(v)}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchReport()}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all disabled:opacity-60 h-9"
          >
            <SearchOutlined />
            Lọc
          </button>
          <button
            onClick={() => {
              setUsercodeFilter('');
              setDepartmentIdFilter(undefined);
              fetchReport({ usercode: '', departmentId: undefined });
            }}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold px-4 py-2 rounded-xl transition-all h-9"
          >
            <ReloadOutlined />
            Đặt lại
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* ── Data table ── */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' }}
      >
        {/* Table header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Chi tiết theo nhân sự</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {rows.length} nhân viên • click tiêu đề để sắp xếp
            </p>
          </div>
          {loading && (
            <span className="text-xs text-blue-500 font-medium animate-pulse">Đang tải...</span>
          )}
        </div>

        <Table<ReportRow>
          rowKey="userId"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 980 }}
          rowClassName={(_, index) =>
            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
          }
          onRow={() => ({
            className: 'hover:bg-blue-50/40 transition-colors cursor-default',
          })}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => (
              <span className="text-xs text-slate-500">
                {range[0]}–{range[1]} / {total} nhân viên
              </span>
            ),
          }}
          className="[&_.ant-table-thead_th]:!bg-white [&_.ant-table-thead_th]:!border-b [&_.ant-table-thead_th]:!border-slate-100 [&_.ant-table-thead_th]:!py-3 [&_.ant-table-cell]:!py-3"
        />
      </div>
    </div>
  );
}