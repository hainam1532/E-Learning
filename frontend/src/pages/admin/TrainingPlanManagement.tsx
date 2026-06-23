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
  Switch,
  Select,
  Tabs,
  Upload,
  Typography,
  DatePicker,
  Modal,
  Card,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined,
  BookOutlined,
  FileTextOutlined,
  ProjectOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  getTrainingPlans,
  createTrainingPlan,
  updateTrainingPlan,
  deleteTrainingPlan,
  uploadTrainingPlanCover,
  getTrainingClasses,
  addTrainingResource,
  removeTrainingResource,
  type TrainingPlan,
  type TrainingClass,
  type TrainingResource,
  type TrainingResourceType,
} from '../../services/training';
import { getAcademies, getCourses, type Course, type Academy } from '../../services/course';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

export default function TrainingPlanManagement() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [classes, setClasses] = useState<TrainingClass[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TrainingPlan | null>(null);
  const [activeTab, setActiveTab] = useState('basic');

// Filters
  const [filterAcademyId, setFilterAcademyId] = useState<number | undefined>(undefined);
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Resources inside Drawer
  const [selectedClassId, setSelectedClassId] = useState<number | undefined>(undefined);
  const [coverFileList, setCoverFileList] = useState<any[]>([]);
  
  // Local resource list for creating/editing - ensuring it's always an array to prevent .map() errors
  const [draftResources, setDraftResources] = useState<Partial<TrainingResource>[]>([]);
  const [deletedResourceIds, setDeletedResourceIds] = useState<number[]>([]);

  // Modals for adding resources
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);

  // Forms
  const [form] = Form.useForm();
  const [resourceForm] = Form.useForm();

  // Fetch initial data with defensive initialization to prevent .map() undefined errors
  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansData, academiesData, classesData, coursesData] = await Promise.all([
        getTrainingPlans(filterAcademyId, filterSearch || undefined),
        getAcademies(),
        getTrainingClasses(),
        getCourses(),
      ]);
      // Ensure all arrays are initialized properly to prevent .map() errors
      setPlans(plansData || []);
      setAcademies(academiesData || []);
      setClasses(classesData || []);
      setCourses(coursesData || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải dữ liệu kế hoạch đào tạo');
      // Initialize with empty arrays on error
      setPlans([]);
      setAcademies([]);
      setClasses([]);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterAcademyId]);

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
    setEditingPlan(null);
    setCoverFileList([]);
    setSelectedClassId(undefined);
    setDraftResources([]);
    setDeletedResourceIds([]);
    setActiveTab('basic');
    form.resetFields();
    form.setFieldsValue({
      status: 'DRAFT',
    });
    setDrawerVisible(true);
  };

  const handleEdit = (record: TrainingPlan) => {
    setEditingPlan(record);
    setCoverFileList(
      record.coverImage
        ? [
            {
              uid: '-1',
name: 'Current Cover',
              status: 'done',
              url: record.coverImage,
            },
          ]
        : []
    );

    setSelectedClassId(record.trainingClassId || undefined);
    // Ensure resources is always an array to prevent .map() undefined errors
    setDraftResources(Array.isArray(record.resources) ? record.resources : []);
    setDeletedResourceIds([]);
    setActiveTab('basic');

    form.resetFields();
    form.setFieldsValue({
      title_vi: record.title_vi,
      title_en: record.title_en,
      title_zh: record.title_zh,
      description_vi: record.description_vi,
      description_en: record.description_en,
      description_zh: record.description_zh,
      academyId: record.academyId || undefined,
      trainingClassId: record.trainingClassId || undefined,
      status: record.status,
      dates: record.startDate && record.endDate ? [dayjs(record.startDate), dayjs(record.endDate)] : null,
    });

    setDrawerVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTrainingPlan(id);
      message.success('Xóa kế hoạch đào tạo thành công');
      fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Xóa kế hoạch đào tạo thất bại');
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    try {
      const formValues = await form.validateFields();
      setLoading(true);

      const payload: Partial<TrainingPlan> = {
        title_vi: formValues.title_vi,
        title_en: formValues.title_en,
        title_zh: formValues.title_zh,
        description_vi: formValues.description_vi,
        description_en: formValues.description_en,
        description_zh: formValues.description_zh,
        academyId: formValues.academyId || null,
        trainingClassId: selectedClassId || null,
        status: formValues.status,
        startDate: formValues.dates ? formValues.dates[0].toISOString() : null,
        endDate: formValues.dates ? formValues.dates[1].toISOString() : null,
};

      let savedPlan: TrainingPlan;

      // Defensive check: ensure editingPlan has valid id before updating
      if (editingPlan && editingPlan.id) {
        // Update Plan
        savedPlan = await updateTrainingPlan(editingPlan.id, payload);

        // Delete removed resources
        for (const resId of deletedResourceIds) {
          await removeTrainingResource(editingPlan.id, resId).catch(() => {});
        }

        // Add new resources (resources with no id)
        for (let i = 0; i < draftResources.length; i++) {
          const res = draftResources[i];
          if (!res.id) {
            await addTrainingResource(editingPlan.id, {
              type: res.type!,
              refId: res.refId!,
              title_vi: res.title_vi,
              title_en: res.title_en,
              title_zh: res.title_zh,
              order: i + 1,
            });
          }
        }

        // Handle image upload
        const newFile = coverFileList.find((f) => f.originFileObj);
        if (newFile) {
          await uploadTrainingPlanCover(editingPlan.id, newFile.originFileObj);
        }

        message.success('Cập nhật kế hoạch đào tạo thành công');
      } else {
        // Create Plan
        savedPlan = await createTrainingPlan(payload);

        // Add resources
        for (let i = 0; i < draftResources.length; i++) {
          const res = draftResources[i];
          await addTrainingResource(savedPlan.id, {
            type: res.type!,
            refId: res.refId!,
            title_vi: res.title_vi,
            title_en: res.title_en,
            title_zh: res.title_zh,
            order: i + 1,
          });
        }

        // Upload cover
        const newFile = coverFileList.find((f) => f.originFileObj);
        if (newFile) {
          await uploadTrainingPlanCover(savedPlan.id, newFile.originFileObj);
        }

        message.success('Tạo kế hoạch đào tạo thành công');
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

  // Resource Management in UI
  const handleAddCourseResource = (courseId: number) => {
    const courseObj = courses.find((c) => c.id === courseId);
    if (!courseObj) return;

    if (draftResources.some((r) => r.type === 'COURSE' && r.refId === courseId)) {
      message.warning('Khóa học này đã có trong danh sách');
      return;
    }

    const newResource: Partial<TrainingResource> = {
      type: 'COURSE',
      refId: courseId,
      title_vi: courseObj.title_vi || '',
      title_en: courseObj.title_en || '',
      title_zh: courseObj.title_zh || '',
    };

    setDraftResources([...draftResources, newResource]);
    setCourseModalOpen(false);
  };

  const handleAddManualResource = (type: TrainingResourceType, values: any) => {
    const refId = Math.floor(Math.random() * 1000000); // Random mock reference ID since tables don't exist
    const newResource: Partial<TrainingResource> = {
      type,
      refId,
      title_vi: values.title_vi,
      title_en: values.title_en,
      title_zh: values.title_zh,
    };

    setDraftResources([...draftResources, newResource]);
    if (type === 'EXAM') setExamModalOpen(false);
    if (type === 'DOCUMENT') setDocModalOpen(false);
    resourceForm.resetFields();
  };

  const handleRemoveResource = (index: number) => {
    const resource = draftResources[index];
    if (resource.id) {
      setDeletedResourceIds([...deletedResourceIds, resource.id]);
    }
    setDraftResources(draftResources.filter((_, i) => i !== index));
  };

  const moveResource = (index: number, direction: 'up' | 'down') => {
    const newList = [...draftResources];
    if (direction === 'up' && index > 0) {
      const temp = newList[index];
      newList[index] = newList[index - 1];
      newList[index - 1] = temp;
    } else if (direction === 'down' && index < newList.length - 1) {
      const temp = newList[index];
      newList[index] = newList[index + 1];
      newList[index + 1] = temp;
    }
    setDraftResources(newList);
  };

  const columns = [
    {
      title: 'Ảnh bìa',
      dataIndex: 'coverImage',
      key: 'coverImage',
      width: 100,
      render: (cover: string | null) => (
        <div className="w-16 h-10 bg-slate-100 rounded-md border border-slate-200 overflow-hidden flex items-center justify-center shadow-sm">
          {cover ? (
            <img src={cover} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <Text type="secondary" className="text-xs">No img</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Kế hoạch đào tạo',
      key: 'title',
      render: (_: any, record: TrainingPlan) => (
        <div>
          <span className="font-semibold text-slate-800 text-sm block">
            {getLocalizedName(record, 'title')}
          </span>
          <Text type="secondary" className="text-xs max-w-xs truncate block">
            {getLocalizedName(record, 'description') || 'Chưa có mô tả'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Học viện',
      key: 'academy',
      render: (_: any, record: TrainingPlan) =>
        record.academy ? (
          <Tag color="blue">{getLocalizedName(record.academy, 'name')}</Tag>
        ) : (
          '-'
        ),
    },
    {
      title: 'Lớp học',
      key: 'trainingClass',
      render: (_: any, record: TrainingPlan) =>
        record.trainingClass ? (
          <Tag color="cyan">{getLocalizedName(record.trainingClass, 'name')}</Tag>
        ) : (
          '-'
        ),
    },
    {
      title: 'Thời gian',
      key: 'dates',
      render: (_: any, record: TrainingPlan) => {
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
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        let color = 'gold';
        let text = 'Nháp';
        if (status === 'ACTIVE') {
          color = 'green';
          text = 'Hoạt động';
        } else if (status === 'COMPLETED') {
          color = 'blue';
          text = 'Hoàn thành';
        } else if (status === 'CANCELLED') {
          color = 'red';
          text = 'Đã hủy';
        }
        return <Tag color={color} className="font-medium">{text}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 110,
      render: (_: any, record: TrainingPlan) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="text-blue-600 hover:text-blue-700"
          />
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa kế hoạch đào tạo này?"
            description="Tất cả các tài nguyên liên quan sẽ bị xóa khỏi kế hoạch."
            onConfirm={() => handleDelete(record.id)}
            okText="Có"
            cancelText="Không"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              className="text-red-600 hover:text-red-700"
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
            Kế hoạch đào tạo
          </Title>
          <Text type="secondary" className="text-slate-500">
            Quản lý lộ trình đào tạo, lớp học, kỳ thi và tài liệu học tập theo từng học viện.
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
            Tạo kế hoạch đào tạo
          </Button>
        </div>
      </div>

      {/* Filter Section */}
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
          <label className="text-xs font-semibold text-slate-500 block mb-1">Tên kế hoạch</label>
          <Input
            placeholder="Tìm kiếm theo tiêu đề..."
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

      {/* Table grid */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm overflow-x-auto">
        <Table
          columns={columns}
          dataSource={plans}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 800 }}
          size="small"
        />
      </div>

      {/* Create / Edit Drawer */}
      <Drawer
        title={editingPlan ? 'Chỉnh sửa kế hoạch' : 'Tạo kế hoạch đào tạo mới'}
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
              Lưu kế hoạch
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'basic',
                label: 'Thông tin cơ bản',
                children: (
                  <div className="space-y-4 pt-2">
                    {/* Cover image upload */}
                    <Form.Item label="Ảnh bìa kế hoạch">
                      <Upload
                        listType="picture-card"
                        fileList={coverFileList}
                        beforeUpload={(file) => {
                          const isImage = file.type.startsWith('image/');
                          if (!isImage) {
                            message.error('Chỉ chấp nhận định dạng ảnh!');
                            return Upload.LIST_IGNORE;
                          }
                          const isLt10M = file.size / 1024 / 1024 < 10;
                          if (!isLt10M) {
                            message.error('Kích thước ảnh phải nhỏ hơn 10MB!');
                            return Upload.LIST_IGNORE;
                          }
                          setCoverFileList([
                            {
                              uid: '-1',
                              name: file.name,
                              status: 'done',
                              originFileObj: file,
                              url: URL.createObjectURL(file),
                            },
                          ]);
                          return false;
                        }}
                        onRemove={() => setCoverFileList([])}
                      >
                        {coverFileList.length === 0 && (
                          <div className="flex flex-col items-center">
                            <UploadOutlined style={{ fontSize: 20 }} />
                            <div className="mt-2 text-xs">Tải ảnh lên</div>
                          </div>
                        )}
                      </Upload>
                    </Form.Item>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Academy selection */}
                      <Form.Item
                        name="academyId"
                        label="Học viện quản lý"
                        rules={[{ required: true, message: 'Vui lòng chọn học viện!' }]}
                      >
                        <Select
                          placeholder="Chọn học viện trực thuộc"
                          options={academies.map((a) => ({
                            value: a.id,
                            label: getLocalizedName(a, 'name'),
                          }))}
                        />
                      </Form.Item>

                      {/* Status */}
                      <Form.Item
                        name="status"
                        label="Trạng thái kế hoạch"
                        rules={[{ required: true }]}
                      >
                        <Select
                          options={[
                            { value: 'DRAFT', label: 'Nháp (DRAFT)' },
                            { value: 'ACTIVE', label: 'Hoạt động (ACTIVE)' },
                            { value: 'COMPLETED', label: 'Hoàn thành (COMPLETED)' },
                            { value: 'CANCELLED', label: 'Đã hủy (CANCELLED)' },
                          ]}
                        />
                      </Form.Item>
                    </div>

                    {/* Date Pickers */}
                    <Form.Item
                      name="dates"
                      label="Thời gian thực hiện (Bắt đầu & Kết thúc)"
                      rules={[{ required: true, message: 'Vui lòng chọn thời gian bắt đầu và kết thúc!' }]}
                    >
                      <RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                    </Form.Item>

                    <div className="border-t border-slate-100 my-4" />

                    {/* Multi-language Title Inputs */}
                    <div className="space-y-4">
                      <Form.Item
                        name="title_vi"
                        label="Tiêu đề kế hoạch (Tiếng Việt)"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề tiếng Việt!' }]}
                      >
                        <Input placeholder="Ví dụ: Kế hoạch đào tạo hội nhập nhân viên mới" />
                      </Form.Item>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Form.Item name="title_en" label="Tiêu đề kế hoạch (English)">
                          <Input placeholder="Example: Onboarding Training Plan" />
                        </Form.Item>

                        <Form.Item name="title_zh" label="Tiêu đề kế hoạch (中文)">
                          <Input placeholder="例如: 新员工培训计划" />
                        </Form.Item>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 my-4" />

                    {/* Descriptions */}
                    <div className="space-y-4">
                      <Form.Item name="description_vi" label="Mô tả kế hoạch (Tiếng Việt)">
                        <TextArea placeholder="Mô tả chi tiết kế hoạch đào tạo..." rows={3} />
                      </Form.Item>
                      <Form.Item name="description_en" label="Mô tả kế hoạch (English)">
                        <TextArea placeholder="Detailed description of the plan..." rows={2} />
                      </Form.Item>
                      <Form.Item name="description_zh" label="Mô tả kế hoạch (中文)">
                        <TextArea placeholder="详细培训计划描述..." rows={2} />
                      </Form.Item>
                    </div>
                  </div>
                ),
              },
              {
                key: 'resources',
                label: 'Tài nguyên đào tạo',
                children: (
                  <div className="space-y-4 pt-2">
                    {/* Class Selector */}
                    <div>
                      <label className="text-slate-800 text-sm font-semibold block mb-2">
                        Chọn lớp học thực hiện kế hoạch
                      </label>
                      <Select
                        placeholder="Vui lòng chọn lớp học trước để thêm tài nguyên"
                        value={selectedClassId}
                        onChange={setSelectedClassId}
                        style={{ width: '100%' }}
                        allowClear
                        options={classes.map((c) => ({
                          value: c.id,
                          label: `${c.code} - ${getLocalizedName(c, 'name')}`,
                        }))}
                      />
                    </div>

                    {/* Action buttons - disabled unless a class is selected */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 flex flex-wrap gap-2 justify-center sm:justify-start">
                      <Button
                        type="primary"
                        icon={<BookOutlined />}
                        disabled={!selectedClassId}
                        onClick={() => setCourseModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Thêm khóa học
                      </Button>
                      <Button
                        type="primary"
                        icon={<ProjectOutlined />}
                        disabled={!selectedClassId}
                        onClick={() => setExamModalOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700 border-none"
                      >
                        Thêm kỳ thi
                      </Button>
                      <Button
                        type="primary"
                        icon={<FileTextOutlined />}
                        disabled={!selectedClassId}
                        onClick={() => setDocModalOpen(true)}
                        className="bg-orange-600 hover:bg-orange-700 border-none"
                      >
                        Thêm tài liệu
                      </Button>
                    </div>

                    {/* Attached Resources List */}
                    <div className="space-y-2">
                      <Text className="font-semibold text-slate-700 block">
                        Danh sách tài nguyên đính kèm ({draftResources.length})
                      </Text>
                      {draftResources.length > 0 ? (
                        <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-100">
                          {draftResources.map((res, idx) => {
                            let typeTag = <Tag color="blue">Khóa học</Tag>;
                            if (res.type === 'EXAM') typeTag = <Tag color="purple">Kỳ thi</Tag>;
                            if (res.type === 'DOCUMENT') typeTag = <Tag color="orange">Tài liệu</Tag>;

                            return (
                              <div
                                key={`${res.type}-${res.refId}-${idx}`}
                                className="flex items-center justify-between p-3 bg-white hover:bg-slate-50/50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-xs">
                                    {idx + 1}
                                  </span>
                                  {typeTag}
                                  <div>
                                    <span className="font-medium text-slate-800 block">
                                      {getLocalizedName(res, 'title')}
                                    </span>
                                    <Text type="secondary" className="text-xs">
                                      Mã tham chiếu: #{res.refId}
                                    </Text>
                                  </div>
                                </div>
                                <Space>
                                  <Button
                                    icon={<ArrowUpOutlined />}
                                    size="small"
                                    disabled={idx === 0}
                                    onClick={() => moveResource(idx, 'up')}
                                  />
                                  <Button
                                    icon={<ArrowDownOutlined />}
                                    size="small"
                                    disabled={idx === draftResources.length - 1}
                                    onClick={() => moveResource(idx, 'down')}
                                  />
                                  <Popconfirm
                                    title="Xóa tài nguyên này khỏi kế hoạch?"
                                    onConfirm={() => handleRemoveResource(idx)}
                                    okText="Xóa"
                                    cancelText="Hủy"
                                  >
                                    <Button
                                      danger
                                      type="text"
                                      icon={<DeleteOutlined />}
                                    />
                                  </Popconfirm>
                                </Space>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 bg-slate-50/50">
                          Chưa có tài nguyên nào được thêm. Hãy chọn một lớp học và bấm nút thêm tài nguyên phía trên.
                        </div>
                      )}
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Drawer>

      {/* Select Course Modal */}
      <Modal
        title="Chọn khóa học để đính kèm"
        open={courseModalOpen}
        onCancel={() => setCourseModalOpen(false)}
        footer={null}
        width={600}
      >
        <div className="max-h-96 overflow-y-auto space-y-2 mt-4">
          {courses.map((course) => (
            <Card
              key={course.id}
              size="small"
              className="hover:border-blue-500 cursor-pointer transition-colors"
              onClick={() => handleAddCourseResource(course.id)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-semibold block text-slate-800">
                    {getLocalizedName(course, 'title')}
                  </span>
                  <Text type="secondary" className="text-xs">
                    Học viện: {course.academy ? getLocalizedName(course.academy, 'name') : 'Công khai'}
                  </Text>
                </div>
                <Button type="primary" size="small" className="bg-blue-600 hover:bg-blue-700">
                  Chọn
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Modal>

      {/* Add Exam Modal */}
      <Modal
        title="Thêm kỳ thi mới vào kế hoạch"
        open={examModalOpen}
        onCancel={() => setExamModalOpen(false)}
        footer={null}
      >
        <Form
          form={resourceForm}
          layout="vertical"
          onFinish={(values) => handleAddManualResource('EXAM', values)}
          className="mt-4"
        >
          <Form.Item
            name="title_vi"
            label="Tên kỳ thi (Tiếng Việt)"
            rules={[{ required: true, message: 'Nhập tên kỳ thi tiếng Việt' }]}
          >
            <Input placeholder="Ví dụ: Thi trắc nghiệm cuối kỳ hội nhập" />
          </Form.Item>
          <Form.Item name="title_en" label="Tên kỳ thi (English)">
            <Input placeholder="Example: Integration Final Exam" />
          </Form.Item>
          <Form.Item name="title_zh" label="Tên kỳ thi (中文)">
            <Input placeholder="例如: 入职培训期末考试" />
          </Form.Item>
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setExamModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" className="bg-purple-600 hover:bg-purple-700 border-none">
              Thêm kỳ thi
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Add Document Modal */}
      <Modal
        title="Thêm tài liệu học tập mới"
        open={docModalOpen}
        onCancel={() => setDocModalOpen(false)}
        footer={null}
      >
        <Form
          form={resourceForm}
          layout="vertical"
          onFinish={(values) => handleAddManualResource('DOCUMENT', values)}
          className="mt-4"
        >
          <Form.Item
            name="title_vi"
            label="Tên tài liệu (Tiếng Việt)"
            rules={[{ required: true, message: 'Nhập tên tài liệu tiếng Việt' }]}
          >
            <Input placeholder="Ví dụ: Sách hướng dẫn quy định nhân sự" />
          </Form.Item>
          <Form.Item name="title_en" label="Tên tài liệu (English)">
            <Input placeholder="Example: Employee Handbook & Regulations" />
          </Form.Item>
          <Form.Item name="title_zh" label="Tên tài liệu (中文)">
            <Input placeholder="例如: 员工手册及规章制度" />
          </Form.Item>
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setDocModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" className="bg-orange-600 hover:bg-orange-700 border-none">
              Thêm tài liệu
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
