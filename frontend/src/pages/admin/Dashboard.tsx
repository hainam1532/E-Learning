import { Card, Row, Col, Statistic, Table, Tag, Space, Button } from 'antd';
import {
  ArrowUpOutlined,
  BookOutlined,
  TeamOutlined,
  DollarCircleOutlined,
  PlusOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { t } = useTranslation();
  
  // Mock data for recent course registration activities
  const recentActivities = [
    {
      key: '1',
      studentName: 'Nguyễn Văn A',
      email: 'anguyen@gmail.com',
      courseName: 'Lập trình ReactJS & TypeScript',
      date: '2026-06-21 14:32',
      status: 'Đã thanh toán',
      amount: '1,200,000 đ',
    },
    {
      key: '2',
      studentName: 'Trần Thị B',
      email: 'btran@gmail.com',
      courseName: 'Xây dựng RESTful API với Node.js',
      date: '2026-06-21 10:15',
      status: 'Đã thanh toán',
      amount: '950,000 đ',
    },
    {
      key: '3',
      studentName: 'Phạm Minh C',
      email: 'cpham@gmail.com',
      courseName: 'Làm chủ thiết kế CSS với Tailwind CSS v4',
      date: '2026-06-20 18:40',
      status: 'Chờ xử lý',
      amount: '600,000 đ',
    },
    {
      key: '4',
      studentName: 'Lê Hoàng D',
      email: 'dle@gmail.com',
      courseName: 'Lập trình ReactJS & TypeScript',
      date: '2026-06-20 09:05',
      status: 'Đã thanh toán',
      amount: '1,200,000 đ',
    },
  ];

  const columns = [
    {
      title: t('dashboard.student'),
      dataIndex: 'studentName',
      key: 'studentName',
      render: (text: string, record: any) => (
        <div>
          <div className="font-semibold text-slate-800">{text}</div>
          <div className="text-xs text-slate-400">{record.email}</div>
        </div>
      ),
    },
    {
      title: t('dashboard.courseRegistered'),
      dataIndex: 'courseName',
      key: 'courseName',
      render: (text: string) => <span className="font-medium text-slate-700">{text}</span>,
    },
    {
      title: t('dashboard.fee'),
      dataIndex: 'amount',
      key: 'amount',
      render: (text: string) => <span className="font-semibold text-emerald-600">{text}</span>,
    },
    {
      title: t('dashboard.time'),
      dataIndex: 'date',
      key: 'date',
      render: (text: string) => <span className="text-slate-500 text-xs">{text}</span>,
    },
    {
      title: t('dashboard.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'Đã thanh toán' ? 'success' : 'warning'}>
          {status}
        </Tag>
      ),
    },
    {
      title: t('common.action'),
      key: 'action',
      render: () => (
        <Space size="middle">
          <Button type="text" icon={<EyeOutlined />} className="text-blue-600 hover:text-blue-800" />
        </Space>
      ),
    },
  ];

return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header Dashboard */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t('dashboard.title')}</h1>
          <p className="text-slate-500 text-sm hidden sm:block">{t('dashboard.sub')}</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          className="bg-amber-500 hover:bg-amber-600 border-none font-semibold shadow-md shadow-amber-500/20"
          size="small"
        >
          {t('dashboard.addCourse')}
        </Button>
      </div>

      {/* Grid Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
<Card variant="borderless" className="shadow-sm border border-slate-200/50 rounded-2xl hover:shadow-md transition-shadow duration-200">
            <Statistic
              title={<span className="text-slate-500 font-semibold text-xs sm:text-sm">{t('dashboard.totalStudents')}</span>}
              value={12450}
              precision={0}
              styles={{ content: { color: '#1e293b', fontWeight: 'bold', fontSize: '1.5rem' } }}
              prefix={<TeamOutlined className="text-blue-500 mr-1 sm:mr-2" />}
              suffix={<span className="text-xs text-emerald-500 font-medium ml-1 sm:ml-2"><ArrowUpOutlined /> 12%</span>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
<Card variant="borderless" className="shadow-sm border border-slate-200/50 rounded-2xl hover:shadow-md transition-shadow duration-200">
            <Statistic
              title={<span className="text-slate-500 font-semibold text-xs sm:text-sm">{t('dashboard.activeCourses')}</span>}
              value={48}
              styles={{ content: { color: '#1e293b', fontWeight: 'bold', fontSize: '1.5rem' } }}
              prefix={<BookOutlined className="text-amber-500 mr-1 sm:mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless" className="shadow-sm border border-slate-200/50 rounded-2xl hover:shadow-md transition-shadow duration-200">
            <Statistic
              title={<span className="text-slate-500 font-semibold text-xs sm:text-sm">{t('dashboard.monthlyRevenue')}</span>}
              value={158400000}
              precision={0}
              styles={{ content: { color: '#10b981', fontWeight: 'bold', fontSize: '1.5rem' } }}
              prefix={<DollarCircleOutlined className="mr-1 sm:mr-2" />}
              suffix={<span className="text-xs text-slate-500 font-semibold ml-1">VNĐ</span>}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Registrations Table */}
<Card
        title={<span className="text-base sm:text-lg font-bold text-slate-800">{t('dashboard.recentRegistrations')}</span>}
        variant="borderless"
        className="shadow-sm border border-slate-200/50 rounded-2xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <Table
            dataSource={recentActivities}
            columns={columns}
            pagination={false}
            size="small"
            className="admin-dashboard-table"
          />
        </div>
      </Card>
    </div>
  );
}
