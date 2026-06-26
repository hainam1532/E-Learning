import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Row, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ClockCircleOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { authGet } from '../../services/auth/auth.get';

const { Title, Text } = Typography;

type DashboardSummary = {
  totalLearners: number;
  activeLearners: number;
  completionRate: number;
  totalStudyHours: number;
};

type TopLearner = {
  userId: number;
  usercode: string;
  fullName: string;
  department: string;
  hours: number;
};

type LowestCourse = {
  courseId: number;
  courseName: string;
  completionRate: number;
  assignedLearners: number;
};

type MonthlyHour = {
  month: string;
  hours: number;
};

type ExpiringPlan = {
  userId: number;
  usercode: string;
  fullName: string;
  department: string;
  planId: number;
  planName: string;
  deadline: string;
  daysRemaining: number;
  progressPercent: number;
};

type OpenExam = {
  id: number;
  name: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: 'OPEN' | 'UPCOMING' | 'CLOSED';
};

type NotStartedLearner = {
  userId: number;
  usercode: string;
  fullName: string;
  department: string;
  position: string;
  activePlanCount: number;
  nearestDeadline: string | null;
};

type DashboardPayload = {
  summary: DashboardSummary;
  topLearnersThisMonth: TopLearner[];
  lowestCompletionCourses: LowestCourse[];
  monthlyStudyHours: MonthlyHour[];
  expiringPlans: ExpiringPlan[];
  openExams: OpenExam[];
  notStartedLearners: NotStartedLearner[];
};

const emptyPayload: DashboardPayload = {
  summary: {
    totalLearners: 0,
    activeLearners: 0,
    completionRate: 0,
    totalStudyHours: 0,
  },
  topLearnersThisMonth: [],
  lowestCompletionCourses: [],
  monthlyStudyHours: [],
  expiringPlans: [],
  openExams: [],
  notStartedLearners: [],
};

function StatCard({
  label,
  value,
  icon,
  sub,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
  tone: { from: string; to: string; bg: string; text: string };
}) {
  return (
    <Card className="rounded-2xl border-slate-200 overflow-hidden" bodyStyle={{ padding: 18 }}>
      <div
        className="h-1 rounded-full mb-4"
        style={{ background: `linear-gradient(90deg, ${tone.from}, ${tone.to})` }}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">{label}</p>
          <p className="text-3xl leading-none font-bold text-slate-800 tabular-nums">{value}</p>
          {sub ? <p className="text-xs text-slate-500 mt-2">{sub}</p> : null}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{ background: tone.bg, color: tone.text }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<DashboardPayload>(emptyPayload);

  const numberFormat = useMemo(() => new Intl.NumberFormat('vi-VN'), []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await authGet.getAdminDashboardReport();
      const apiPayload = (response.data as any)?.data || response.data;
      setPayload({
        ...emptyPayload,
        ...(apiPayload || {}),
      });
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải dashboard tổng quan');
      setPayload(emptyPayload);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const topLearnerColumns: ColumnsType<TopLearner> = [
    {
      title: 'Mã số',
      dataIndex: 'usercode',
      key: 'usercode',
      width: 110,
      render: (value: string) => <span className="font-mono font-semibold">{value}</span>,
    },
    {
      title: 'Họ tên',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (value: string) => <span className="font-medium text-slate-800">{value || '—'}</span>,
    },
    {
      title: 'Bộ phận',
      dataIndex: 'department',
      key: 'department',
      width: 160,
    },
    {
      title: 'Giờ học tháng này',
      dataIndex: 'hours',
      key: 'hours',
      width: 130,
      align: 'right',
      render: (value: number) => <span className="tabular-nums font-semibold text-emerald-600">{value.toFixed(2)}</span>,
    },
  ];

  const lowCourseColumns: ColumnsType<LowestCourse> = [
    {
      title: 'Khóa học',
      dataIndex: 'courseName',
      key: 'courseName',
      render: (value: string) => <span className="font-medium text-slate-800">{value}</span>,
    },
    {
      title: 'Tỷ lệ hoàn thành',
      dataIndex: 'completionRate',
      key: 'completionRate',
      width: 140,
      align: 'right',
      render: (value: number) => <span className="tabular-nums text-amber-600 font-semibold">{value.toFixed(2)}%</span>,
    },
    {
      title: 'Số HV',
      dataIndex: 'assignedLearners',
      key: 'assignedLearners',
      width: 90,
      align: 'center',
    },
  ];

  const expiringPlanColumns: ColumnsType<ExpiringPlan> = [
    {
      title: 'Mã số',
      dataIndex: 'usercode',
      key: 'usercode',
      width: 110,
      render: (value: string) => <span className="font-mono font-semibold">{value}</span>,
    },
    {
      title: 'Họ tên',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 180,
      render: (value: string) => <span className="font-medium text-slate-800">{value || '—'}</span>,
    },
    {
      title: 'Kế hoạch',
      dataIndex: 'planName',
      key: 'planName',
      ellipsis: true,
    },
    {
      title: 'Deadline',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 120,
      render: (value: string) => dayjs(value).format('DD/MM/YYYY'),
    },
    {
      title: 'Còn lại',
      dataIndex: 'daysRemaining',
      key: 'daysRemaining',
      width: 90,
      align: 'center',
      render: (value: number) => (
        <Tag color={value <= 3 ? 'red' : value <= 7 ? 'orange' : 'default'}>{value}</Tag>
      ),
    },
    {
      title: 'Tiến trình',
      dataIndex: 'progressPercent',
      key: 'progressPercent',
      width: 120,
      align: 'right',
      render: (value: number) => <span className="tabular-nums font-semibold">{value.toFixed(2)}%</span>,
    },
  ];

  const openExamColumns: ColumnsType<OpenExam> = [
    {
      title: 'Kỳ thi',
      dataIndex: 'name',
      key: 'name',
      render: (value: string) => <span className="font-medium text-slate-800">{value}</span>,
    },
    {
      title: 'Bắt đầu',
      dataIndex: 'startAt',
      key: 'startAt',
      width: 150,
      render: (value: string) => dayjs(value).format('DD/MM HH:mm'),
    },
    {
      title: 'Kết thúc',
      dataIndex: 'endAt',
      key: 'endAt',
      width: 150,
      render: (value: string) => dayjs(value).format('DD/MM HH:mm'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      align: 'center',
      render: (value: OpenExam['status']) => {
        if (value === 'OPEN') return <Tag color="green">Đang mở</Tag>;
        if (value === 'UPCOMING') return <Tag color="blue">Sắp mở</Tag>;
        return <Tag color="default">Đã đóng</Tag>;
      },
    },
  ];

  const notStartedColumns: ColumnsType<NotStartedLearner> = [
    {
      title: 'Mã số',
      dataIndex: 'usercode',
      key: 'usercode',
      width: 110,
      render: (value: string) => <span className="font-mono font-semibold">{value}</span>,
    },
    {
      title: 'Họ tên',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 180,
      render: (value: string) => <span className="font-medium text-slate-800">{value || '—'}</span>,
    },
    {
      title: 'Bộ phận',
      dataIndex: 'department',
      key: 'department',
      width: 160,
    },
    {
      title: 'Chức vụ',
      dataIndex: 'position',
      key: 'position',
      width: 140,
    },
    {
      title: 'Số kế hoạch active',
      dataIndex: 'activePlanCount',
      key: 'activePlanCount',
      width: 140,
      align: 'center',
    },
    {
      title: 'Deadline gần nhất',
      dataIndex: 'nearestDeadline',
      key: 'nearestDeadline',
      width: 150,
      render: (value: string | null) => (value ? dayjs(value).format('DD/MM/YYYY') : '—'),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Title level={3} className="mb-1!">Dashboard tổng quan đào tạo</Title>
        <Text className="text-slate-500">Theo dõi nhanh tình trạng học tập và kỳ thi trong hệ thống</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <StatCard
            label="Tổng học viên"
            value={numberFormat.format(payload.summary.totalLearners)}
            sub="Số học viên trong hệ thống"
            icon={<TeamOutlined />}
            tone={{ from: '#1D4ED8', to: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8' }}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <StatCard
            label="Đang học"
            value={numberFormat.format(payload.summary.activeLearners)}
            sub="Học viên có kế hoạch active"
            icon={<UserOutlined />}
            tone={{ from: '#0EA5E9', to: '#38BDF8', bg: '#F0F9FF', text: '#0369A1' }}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <StatCard
            label="Tỉ lệ hoàn thành"
            value={`${payload.summary.completionRate.toFixed(2)}%`}
            sub="% học viên hoàn thành kế hoạch"
            icon={<TrophyOutlined />}
            tone={{ from: '#10B981', to: '#34D399', bg: '#ECFDF5', text: '#047857' }}
          />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <StatCard
            label="Tổng giờ học"
            value={payload.summary.totalStudyHours.toFixed(2)}
            sub="Tổng giờ tích lũy"
            icon={<ClockCircleOutlined />}
            tone={{ from: '#F59E0B', to: '#FCD34D', bg: '#FFFBEB', text: '#B45309' }}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="Top nhân sự học nhiều nhất tháng này" className="rounded-2xl border-slate-200">
            <Table<TopLearner>
              rowKey="userId"
              loading={loading}
              columns={topLearnerColumns}
              dataSource={payload.topLearnersThisMonth}
              pagination={false}
              size="small"
              scroll={{ x: 760 }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Khóa học có tỷ lệ hoàn thành thấp nhất" className="rounded-2xl border-slate-200">
            <Table<LowestCourse>
              rowKey="courseId"
              loading={loading}
              columns={lowCourseColumns}
              dataSource={payload.lowestCompletionCourses}
              pagination={false}
              size="small"
              scroll={{ x: 640 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="Biểu đồ giờ học theo tháng (6 tháng)" className="rounded-2xl border-slate-200">
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={payload.monthlyStudyHours} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                  <Tooltip formatter={(value: any) => [`${Number(value).toFixed(2)} giờ`, 'Giờ học']} />
                  <Line type="monotone" dataKey="hours" stroke="#2563EB" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Kỳ thi đang mở / sắp mở / đã đóng" className="rounded-2xl border-slate-200">
            <Table<OpenExam>
              rowKey="id"
              loading={loading}
              columns={openExamColumns}
              dataSource={payload.openExams}
              pagination={{ pageSize: 5, size: 'small' }}
              size="small"
              scroll={{ x: 640 }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Kế hoạch đào tạo sắp hết hạn (7 ngày tới)" className="rounded-2xl border-slate-200">
        <Table<ExpiringPlan>
          rowKey={(row) => `${row.userId}-${row.planId}`}
          loading={loading}
          columns={expiringPlanColumns}
          dataSource={payload.expiringPlans}
          pagination={{ pageSize: 8, showSizeChanger: true, pageSizeOptions: ['8', '12', '20'] }}
          size="small"
          scroll={{ x: 1100 }}
        />
      </Card>

      <Card title="Học viên chưa bắt đầu (được phân công nhưng chưa học buổi nào)" className="rounded-2xl border-slate-200">
        <Table<NotStartedLearner>
          rowKey="userId"
          loading={loading}
          columns={notStartedColumns}
          dataSource={payload.notStartedLearners}
          pagination={{ pageSize: 8, showSizeChanger: true, pageSizeOptions: ['8', '12', '20'] }}
          size="small"
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  );
}
