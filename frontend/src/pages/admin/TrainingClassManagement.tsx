import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Drawer,
  Form,
  Input,
  message,
  Popconfirm,
  Space,
  Tag,
  Select,
  Tabs,
  Upload,
  Typography,
  DatePicker,
  Modal,
  Card,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined,
  UserAddOutlined,
  FileExcelOutlined,
  BookOutlined,
  TeamOutlined,
  SolutionOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  getTrainingClasses,
  createTrainingClass,
  updateTrainingClass,
  deleteTrainingClass,
  getClassStudents,
  addStudentToClass,
  removeStudentFromClass,
  importStudentsToClass,
  generateClassReport,
  getTrainingPlans,
  type TrainingClass,
  type TrainingPlan,
  type ClassStudent,
  type ClassReport,
} from '../../services/training';
import { getAcademies, getCourses, type Academy, type Course } from '../../services/course';
import { authGet } from '../../services/auth/auth.get';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface Lecturer {
  id: number;
  code: string;
  name: string | null;
}

interface User {
  id: number;
  usercode: string;
  fullName: string | null;
  department?: { name_vi: string | null } | null;
  position?: { name_vi: string | null } | null;
}

interface Department {
  id: number;
  name_vi: string | null;
  name_en: string | null;
  name_zh: string | null;
  code: string;
}

export default function TrainingClassManagement() {
  const { t } = useTranslation();
  const [classes, setClasses] = useState<TrainingClass[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingClass, setEditingClass] = useState<TrainingClass | null>(null);
  const [activeTab, setActiveTab] = useState('info');

  // Filters (Main page)
  const [filterAcademyId, setFilterAcademyId] = useState<number | undefined>(undefined);
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Class Report Modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ClassReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Tab 3: Student List & Actions inside Drawer
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDeptId, setStudentDeptId] = useState<number | undefined>(undefined);
  const [studentLoading, setStudentLoading] = useState(false);

  // Add student modal
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined);

  // Import students modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFileList, setImportFileList] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);

  // Form
  const [form] = Form.useForm();

  // Load basic listing data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [classesData, academiesData, plansData, coursesData, lecturersRes, deptsRes, usersRes] = await Promise.all([
        getTrainingClasses(filterAcademyId),
        getAcademies(),
        getTrainingPlans(),
        getCourses(),
        authGet.getLecturers(),
        authGet.getDepartments(),
        authGet.getUsers(),
      ]);
      setClasses(classesData);
      setAcademies(academiesData);
      setPlans(plansData);
      setCourses(coursesData);
      setLecturers(lecturersRes.data.lecturers || []);
      setDepartments(deptsRes.data.departments || []);
      setAllUsers(usersRes.data.users || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải dữ liệu lớp học');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterAcademyId]);

  // Load students for editing class
  const loadClassStudents = async (classId: number) => {
    setStudentLoading(true);
    try {
      const data = await getClassStudents(classId, studentSearch || undefined, studentDeptId);
      setStudents(data);
    } catch (error) {
      console.error(error);
      message.error('Không thể tải danh sách học viên');
    } finally {
      setStudentLoading(false);
    }
  };

  useEffect(() => {
    if (editingClass) {
      loadClassStudents(editingClass.id);
    }
  }, [studentSearch, studentDeptId]);

  const handleSearch = () => {
    fetchData();
  };

  const getLocalizedName = (item: any, prefix: string) => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return item[`${prefix}_en`] || item[`${prefix}_vi`] || '';
    if (lang === 'zh') return item[`${prefix}_zh`] || item[`${prefix}_vi`] || '';
    return item[`${prefix}_vi`] || '';
  };

  const handleAdd = () => {
    setEditingClass(null);
    setActiveTab('info');
    form.resetFields();
    form.setFieldsValue({
      code: 'LH' + Math.floor(1000 + Math.random() * 9000),
    });
    setDrawerVisible(true);
  };

  const handleEdit = (record: TrainingClass) => {
    setEditingClass(record);
    setActiveTab('info');
    form.resetFields();
    form.setFieldsValue({
      code: record.code,
      academyId: record.academyId || undefined,
      lecturerId: record.lecturerId || undefined,
      name_vi: record.name_vi,
      name_en: record.name_en,
      name_zh: record.name_zh,
      description_vi: record.description_vi,
      description_en: record.description_en,
      description_zh: record.description_zh,
      content_vi: record.content_vi,
      content_en: record.content_en,
      content_zh: record.content_zh,
      objectives_vi: record.objectives_vi,
      objectives_en: record.objectives_en,
      objectives_zh: record.objectives_zh,
      targetAudience: record.targetAudience,
      dates: record.startDate && record.endDate ? [dayjs(record.startDate), dayjs(record.endDate)] : null,
    });
    setDrawerVisible(true);
    loadClassStudents(record.id);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTrainingClass(id);
      message.success('Xóa lớp học thành công');
      fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Xóa lớp học thất bại');
    }
  };

  const handleReport = async (classId: number) => {
    setReportLoading(true);
    try {
      const data = await generateClassReport(classId);
      setSelectedReport(data);
      setReportModalOpen(true);
    } catch (error) {
      console.error(error);
      message.error('Không thể tạo báo cáo lớp học');
    } finally {
      setReportLoading(false);
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload: Partial<TrainingClass> = {
        code: values.code,
        academyId: values.academyId || null,
        lecturerId: values.lecturerId || null,
        name_vi: values.name_vi,
        name_en: values.name_en,
        name_zh: values.name_zh,
        description_vi: values.description_vi,
        description_en: values.description_en,
        description_zh: values.description_zh,
        content_vi: values.content_vi,
        content_en: values.content_en,
        content_zh: values.content_zh,
        objectives_vi: values.objectives_vi,
        objectives_en: values.objectives_en,
        objectives_zh: values.objectives_zh,
        targetAudience: values.targetAudience,
        startDate: values.dates ? values.dates[0].toISOString() : null,
        endDate: values.dates ? values.dates[1].toISOString() : null,
      };

      if (editingClass) {
        await updateTrainingClass(editingClass.id, payload);
        message.success('Cập nhật lớp học thành công');
      } else {
        await createTrainingClass(payload);
        message.success('Tạo lớp học thành công');
      }

      setDrawerVisible(false);
      fetchData();
    } catch (error: any) {
      console.error(error);
      message.error(error?.response?.data?.message || 'Lưu thông tin thất bại');
    } finally {
      setLoading(false);
    }
  };

  // Student Actions
  const handleAddStudent = async () => {
    if (!editingClass || !selectedUserId) return;
    try {
      await addStudentToClass(editingClass.id, selectedUserId);
      message.success('Thêm học viên vào lớp thành công');
      setAddStudentModalOpen(false);
      setSelectedUserId(undefined);
      loadClassStudents(editingClass.id);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Thêm học viên thất bại');
    }
  };

  const handleRemoveStudent = async (userId: number) => {
    if (!editingClass) return;
    try {
      await removeStudentFromClass(editingClass.id, userId);
      message.success('Đã xóa học viên khỏi lớp');
      loadClassStudents(editingClass.id);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Xóa học viên thất bại');
    }
  };

  const handleImportExcel = async () => {
    if (!editingClass || importFileList.length === 0) return;
    setImporting(true);
    setImportResult(null);
    try {
      const results = await importStudentsToClass(editingClass.id, importFileList[0].originFileObj);
      setImportResult(results);
      message.success('Nhập file Excel hoàn tất');
      loadClassStudents(editingClass.id);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Nhập file Excel thất bại');
    } finally {
      setImporting(false);
    }
  };

  // Filter plans based on selected academy in Form
  const selectedAcademyId = Form.useWatch('academyId', form);
  const filteredPlans = plans.filter((p) => p.academyId === selectedAcademyId);

  // Find linked training plan of the class
  const classPlan = plans.find((p) => p.trainingClassId === editingClass?.id);
  const planCourses = classPlan?.resources?.filter((r) => r.type === 'COURSE') || [];

  // Filter users that are not already in the class for the modal dropdown
  const currentStudentIds = students.map((s) => s.id);
  const availableUsers = allUsers.filter((u) => !currentStudentIds.includes(u.id));

  const columns = [
    {
      title: 'Mã lớp',
      dataIndex: 'code',
      key: 'code',
      width: 90,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Lớp học',
      key: 'name',
      render: (_: any, record: TrainingClass) => (
        <div>
          <span className="font-semibold text-slate-800 text-sm block">
            {getLocalizedName(record, 'name')}
          </span>
          <Text type="secondary" className="text-xs truncate max-w-xs block">
            {getLocalizedName({ name_vi: record.description_vi, name_en: record.description_en, name_zh: record.description_zh }, 'name') || 'Chưa có mô tả'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Học viện',
      key: 'academy',
      render: (_: any, record: TrainingClass) =>
        record.academy ? (
          <Tag color="cyan">{getLocalizedName(record.academy, 'name')}</Tag>
        ) : (
          '-'
        ),
    },
    {
      title: 'Kế hoạch đào tạo',
      key: 'plan',
      render: (_: any, record: TrainingClass) => {
        const p = plans.find((pl) => pl.trainingClassId === record.id);
        return p ? <Tag color="geekblue">{getLocalizedName(p, 'title')}</Tag> : '-';
      },
    },
    {
      title: 'Nội dung đào tạo',
      key: 'content',
      render: (_: any, record: TrainingClass) =>
        getLocalizedName({ name_vi: record.content_vi, name_en: record.content_en, name_zh: record.content_zh }, 'name') || '-',
    },
    {
      title: 'Giảng viên',
      key: 'lecturer',
      render: (_: any, record: TrainingClass) =>
        record.lecturer?.name ? (
          <span className="text-sm font-medium text-slate-700">{record.lecturer.name}</span>
        ) : (
          '-'
        ),
    },
    {
      title: 'Thời gian',
      key: 'dates',
      render: (_: any, record: TrainingClass) => {
        if (!record.startDate || !record.endDate) return '-';
        return (
          <div className="text-xs text-slate-600 flex flex-col">
            <span>Bắt đầu: {dayjs(record.startDate).format('DD/MM/YYYY')}</span>
            <span>Kết thúc: {dayjs(record.endDate).format('DD/MM/YYYY')}</span>
          </div>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      render: (_: any, record: TrainingClass) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="text-blue-600 hover:text-blue-700"
            title="Chỉnh sửa lớp học"
          />
          <Button
            type="text"
            icon={<SolutionOutlined />}
            onClick={() => handleReport(record.id)}
            loading={reportLoading && selectedReport?.id === record.id}
            className="text-purple-600 hover:text-purple-700"
            title="Xem báo cáo"
          />
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa lớp học này?"
            description="Tất cả dữ liệu và học viên liên quan sẽ bị gỡ."
            onConfirm={() => handleDelete(record.id)}
            okText="Có"
            cancelText="Không"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              className="text-red-600 hover:text-red-700"
              title="Xóa lớp học"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <Title level={3} className="!mb-0 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Quản lý lớp học
          </Title>
          <Text type="secondary" className="text-slate-500">
            Xem danh sách lớp học, phân bổ kế hoạch, giảng viên, quản lý học viên và xuất báo cáo.
          </Text>
        </div>
        <div className="flex gap-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchData}
            loading={loading}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700 border-none shadow-md shadow-blue-500/20"
          >
            Tạo lớp học mới
          </Button>
        </div>
      </div>

      {/* Main page filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-sm flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="text-xs font-semibold text-slate-500 block mb-1">Học viện</label>
          <Select
            placeholder="Tất cả học viện"
            allowClear
            className="w-full"
            value={filterAcademyId}
            onChange={setFilterAcademyId}
            options={academies.map((a) => ({
              value: a.id,
              label: getLocalizedName(a, 'name'),
            }))}
          />
        </div>
        <div className="flex-1 w-full">
          <label className="text-xs font-semibold text-slate-500 block mb-1">Tìm lớp học</label>
          <Input
            placeholder="Nhập tên lớp học hoặc mã lớp..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            onPressEnter={handleSearch}
          />
        </div>
        <Button
          type="primary"
          onClick={handleSearch}
          className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
        >
          Tìm kiếm
        </Button>
      </div>

      {/* Main Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm overflow-x-auto">
        <Table
          columns={columns}
          dataSource={classes}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 900 }}
          size="small"
        />
      </div>

      {/* Create & Edit Drawer */}
      <Drawer
        title={editingClass ? 'Chỉnh sửa lớp học' : 'Tạo lớp học mới'}
        size="large"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>Hủy</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Lưu lớp học
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'info',
              label: 'Thông tin lớp',
              children: (
                <Form form={form} layout="vertical" className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Form.Item
                      name="code"
                      label="Mã lớp học"
                      rules={[{ required: true, message: 'Nhập mã lớp học!' }]}
                    >
                      <Input placeholder="Mã định danh lớp" disabled={!!editingClass} />
                    </Form.Item>

                    <Form.Item
                      name="academyId"
                      label="Học viện trực thuộc"
                      rules={[{ required: true, message: 'Chọn học viện!' }]}
                    >
                      <Select
                        placeholder="Chọn học viện"
                        options={academies.map((a) => ({
                          value: a.id,
                          label: getLocalizedName(a, 'name'),
                        }))}
                        onChange={() => form.setFieldsValue({ trainingPlanId: undefined })}
                      />
                    </Form.Item>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Form.Item
                      name="lecturerId"
                      label="Giảng viên phụ trách"
                      rules={[{ required: true, message: 'Chọn giảng viên phụ trách!' }]}
                    >
                      <Select
                        placeholder="Chọn giảng viên"
                        showSearch
                        optionFilterProp="label"
                        options={lecturers.map((l) => ({
                          value: l.id,
                          label: l.name ? `${l.code} - ${l.name}` : l.code,
                        }))}
                      />
                    </Form.Item>

                    <Form.Item
                      name="dates"
                      label="Thời gian diễn ra lớp học"
                      rules={[{ required: true, message: 'Chọn thời gian bắt đầu và kết thúc!' }]}
                    >
                      <RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                    </Form.Item>
                  </div>

                  <Divider titlePlacement="left" className="!my-2">Tiêu đề lớp học</Divider>
                  <Form.Item
                    name="name_vi"
                    label="Tên lớp học (Tiếng Việt)"
                    rules={[{ required: true, message: 'Vui lòng nhập tên lớp học!' }]}
                  >
                    <Input placeholder="Nhập tên lớp học" />
                  </Form.Item>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Form.Item name="name_en" label="Tên lớp học (English)">
                      <Input placeholder="Class Name in English" />
                    </Form.Item>
                    <Form.Item name="name_zh" label="Tên lớp học (中文)">
                      <Input placeholder="班级名称" />
                    </Form.Item>
                  </div>

                  <Divider titlePlacement="left" className="!my-2">Nội dung & Mô tả chi tiết</Divider>
                  <Form.Item name="targetAudience" label="Đối tượng tham gia">
                    <Input placeholder="Ví dụ: Nhân viên mới thử việc, Cán bộ quản lý..." />
                  </Form.Item>

                  <div className="space-y-4">
                    <Form.Item name="content_vi" label="Nội dung đào tạo (Tiếng Việt)">
                      <TextArea placeholder="Nội dung chính..." rows={2} />
                    </Form.Item>
                    <Form.Item name="content_en" label="Nội dung đào tạo (English)">
                      <TextArea placeholder="Training Content..." rows={2} />
                    </Form.Item>
                    <Form.Item name="content_zh" label="Nội dung đào tạo (中文)">
                      <TextArea placeholder="培训内容" rows={2} />
                    </Form.Item>
                  </div>

                  <div className="space-y-4">
                    <Form.Item name="objectives_vi" label="Mục tiêu đào tạo (Tiếng Việt)">
                      <TextArea placeholder="Mục tiêu đầu ra..." rows={2} />
                    </Form.Item>
                    <Form.Item name="objectives_en" label="Mục tiêu đào tạo (English)">
                      <TextArea placeholder="Training Objectives..." rows={2} />
                    </Form.Item>
                    <Form.Item name="objectives_zh" label="Mục tiêu đào tạo (中文)">
                      <TextArea placeholder="培训目标" rows={2} />
                    </Form.Item>
                  </div>

                  <div className="space-y-4">
                    <Form.Item name="description_vi" label="Mô tả lớp học (Tiếng Việt)">
                      <TextArea placeholder="Mô tả tóm tắt..." rows={2} />
                    </Form.Item>
                    <Form.Item name="description_en" label="Mô tả lớp học (English)">
                      <TextArea placeholder="Description in English..." rows={2} />
                    </Form.Item>
                    <Form.Item name="description_zh" label="Mô tả lớp học (中文)">
                      <TextArea placeholder="班级描述" rows={2} />
                    </Form.Item>
                  </div>
                </Form>
              ),
            },
            {
              key: 'training',
              label: 'Danh sách đào tạo',
              disabled: !editingClass,
              children: (
                <div className="space-y-4 pt-2">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/80">
                    <Text className="font-semibold block mb-1">
                      Kế hoạch đào tạo đang gán cho lớp:
                    </Text>
                    {classPlan ? (
                      <Tag color="geekblue" className="text-sm font-medium py-1 px-2.5">
                        {getLocalizedName(classPlan, 'title')}
                      </Tag>
                    ) : (
                      <Text type="secondary" className="italic">
                        Chưa gán kế hoạch đào tạo nào cho lớp học này.
                      </Text>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Text className="font-bold text-slate-800 block">
                      Các khóa học nằm trong kế hoạch đào tạo:
                    </Text>
                    {planCourses.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {planCourses.map((resource) => {
                          const courseObj = courses.find((c) => c.id === resource.refId);
                          return (
                            <Card key={resource.id} size="small" className="shadow-sm">
                              <div className="flex gap-3">
                                <div className="w-16 h-12 bg-slate-150 rounded overflow-hidden flex items-center justify-center border border-slate-200">
                                  {courseObj?.coverImage ? (
                                    <img src={courseObj.coverImage} alt="Cover" className="w-full h-full object-cover" />
                                  ) : (
                                    <BookOutlined className="text-slate-400" />
                                  )}
                                </div>
                                <div>
                                  <span className="font-semibold block text-slate-800 text-sm">
                                    {getLocalizedName(resource, 'title')}
                                  </span>
                                  <Text type="secondary" className="text-xs block">
                                    Mã khóa học: #{resource.refId}
                                  </Text>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-8 text-center border border-dashed rounded-xl bg-slate-50/50 text-slate-400">
                        Kế hoạch hiện không chứa khóa học đào tạo nào.
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'students',
              label: 'Học sinh lớp',
              disabled: !editingClass,
              children: (
                <div className="space-y-4 pt-2">
                  {/* Internal Search and Filters for Students */}
                  <div className="flex flex-wrap gap-2 items-end bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Tìm học viên</label>
                      <Input
                        placeholder="Mã số hoặc tên..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Phòng ban</label>
                      <Select
                        placeholder="Lọc phòng ban"
                        allowClear
                        style={{ width: '100%' }}
                        value={studentDeptId}
                        onChange={setStudentDeptId}
                        options={departments.map((d) => ({
                          value: d.id,
                          label: getLocalizedName(d, 'name'),
                        }))}
                      />
                    </div>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setAddStudentModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Thêm học sinh
                    </Button>
                    <Button
                      type="default"
                      icon={<FileExcelOutlined />}
                      onClick={() => {
                        setImportFileList([]);
                        setImportResult(null);
                        setImportModalOpen(true);
                      }}
                      className="hover:border-green-600 hover:text-green-600"
                    >
                      Import Excel
                    </Button>
                  </div>

                  {/* Student list table */}
                  <Table
                    dataSource={students}
                    loading={studentLoading}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 5 }}
                    columns={[
                      {
                        title: 'Mã số',
                        dataIndex: 'usercode',
                        key: 'usercode',
                        width: 100,
                        render: (text) => <Tag>{text}</Tag>,
                      },
                      {
                        title: 'Tên học viên',
                        dataIndex: 'fullName',
                        key: 'fullName',
                        render: (text) => <span className="font-medium text-slate-800">{text}</span>,
                      },
                      {
                        title: 'Phòng ban',
                        key: 'department',
                        render: (_, record) => record.department ? getLocalizedName(record.department, 'name') : '-',
                      },
                      {
                        title: 'Chức vụ',
                        key: 'position',
                        render: (_, record) => record.position ? getLocalizedName(record.position, 'name') : '-',
                      },
                      {
                        title: 'Thao tác',
                        key: 'action',
                        width: 80,
                        render: (_, record) => (
                          <Popconfirm
                            title="Xóa học viên khỏi lớp này?"
                            onConfirm={() => handleRemoveStudent(record.id)}
                            okText="Xóa"
                            cancelText="Hủy"
                          >
                            <Button danger type="text" icon={<DeleteOutlined />} />
                          </Popconfirm>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </Drawer>

      {/* Add Student Modal */}
      <Modal
        title="Thêm học sinh vào lớp học"
        open={addStudentModalOpen}
        onCancel={() => {
          setAddStudentModalOpen(false);
          setSelectedUserId(undefined);
        }}
        onOk={handleAddStudent}
        okButtonProps={{ className: 'bg-blue-600 hover:bg-blue-700', disabled: !selectedUserId }}
      >
        <div className="space-y-3 mt-4">
          <label className="text-sm font-semibold text-slate-700 block">
            Chọn tài khoản người dùng:
          </label>
          <Select
            placeholder="Tìm kiếm tài khoản theo mã hoặc tên..."
            showSearch
            style={{ width: '100%' }}
            value={selectedUserId}
            onChange={setSelectedUserId}
            filterOption={(input, option) =>
              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
            options={availableUsers.map((u) => ({
              value: u.id,
              label: `${u.usercode} - ${u.fullName || ''} (${u.department?.name_vi || 'Không có phòng ban'})`,
            }))}
          />
        </div>
      </Modal>

      {/* Import Students Excel Modal */}
      <Modal
        title="Nhập học viên hàng loạt từ Excel"
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={null}
        width={550}
      >
        <div className="space-y-4 mt-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-500">
            <InfoCircleOutlined className="mr-1 text-blue-500" /> File Excel của bạn phải chứa cột
            <Text strong className="mx-1">"Mã học viên"</Text> hoặc <Text strong className="mx-1">"usercode"</Text> trùng khớp với mã tài khoản người dùng đã tạo trong hệ thống.
          </div>

          <Upload
            fileList={importFileList}
            beforeUpload={(file) => {
              const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
              if (!isExcel) {
                message.error('Chỉ chấp nhận file định dạng Excel (.xlsx, .xls)!');
                return Upload.LIST_IGNORE;
              }
              setImportFileList([file]);
              return false;
            }}
            onRemove={() => setImportFileList([])}
            maxCount={1}
          >
            {importFileList.length === 0 && (
              <Button icon={<UploadOutlined />}>Chọn file Excel</Button>
            )}
          </Upload>

          <Button
            type="primary"
            onClick={handleImportExcel}
            loading={importing}
            disabled={importFileList.length === 0}
            className="w-full bg-green-600 hover:bg-green-750 border-none"
          >
            Bắt đầu Import
          </Button>

          {importResult && (
            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 text-sm space-y-2 max-h-56 overflow-y-auto">
              <span className="font-semibold text-slate-800 block">Kết quả nhập:</span>
              <div className="flex gap-4">
                <Tag color="green">Thành công: {importResult.success}</Tag>
                <Tag color="red">Thất bại: {importResult.failed}</Tag>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="text-xs font-semibold text-red-500 block">Danh sách lỗi:</span>
                  {importResult.errors.map((err, i) => (
                    <Paragraph key={i} className="!mb-0 text-xs text-red-600">
                      • {err}
                    </Paragraph>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Class Report Modal */}
      <Modal
        title={
          <Space>
            <SolutionOutlined className="text-purple-600" />
            <span>Báo cáo lớp học</span>
          </Space>
        }
        open={reportModalOpen}
        onCancel={() => setReportModalOpen(false)}
        footer={null}
        width={750}
      >
        {selectedReport ? (
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <Text type="secondary" className="text-xs block">Tên lớp học</Text>
                <span className="font-bold text-slate-800 text-sm block">{selectedReport.name}</span>
              </div>
              <div>
                <Text type="secondary" className="text-xs block">Mã lớp</Text>
                <Tag color="blue" className="mt-0.5">{selectedReport.code}</Tag>
              </div>
              <div>
                <Text type="secondary" className="text-xs block">Học viện</Text>
                <span className="font-medium text-slate-700 text-sm block">{selectedReport.academy?.name || '-'}</span>
              </div>
              <div>
                <Text type="secondary" className="text-xs block">Giảng viên phụ trách</Text>
                <span className="font-medium text-slate-700 text-sm block">{selectedReport.lecturer?.name || '-'}</span>
              </div>
              <div>
                <Text type="secondary" className="text-xs block">Thời gian diễn ra</Text>
                <span className="text-xs block font-medium">
                  {selectedReport.startDate ? dayjs(selectedReport.startDate).format('DD/MM/YYYY') : '-'} đến {selectedReport.endDate ? dayjs(selectedReport.endDate).format('DD/MM/YYYY') : '-'}
                </span>
              </div>
              <div>
                <Text type="secondary" className="text-xs block">Tổng số học viên</Text>
                <Tag color="purple" className="mt-0.5 font-semibold">{selectedReport.studentCount} Học viên</Tag>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-sm block">Danh sách học viên trong lớp:</span>
              <Table
                dataSource={selectedReport.students}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 5 }}
                columns={[
                  {
                    title: 'Mã số',
                    dataIndex: 'usercode',
                    key: 'usercode',
                    width: 90,
                  },
                  {
                    title: 'Học viên',
                    dataIndex: 'fullName',
                    key: 'fullName',
                    render: (text) => <span className="font-medium">{text}</span>,
                  },
                  {
                    title: 'Email',
                    dataIndex: 'email',
                    key: 'email',
                  },
                  {
                    title: 'Phòng ban',
                    key: 'department',
                    render: (_, record) => record.department?.name || '-',
                  },
                  {
                    title: 'Chức vụ',
                    key: 'position',
                    render: (_, record) => record.position?.name || '-',
                  },
                ]}
              />
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">Không có dữ liệu báo cáo</div>
        )}
      </Modal>
    </div>
  );
}
