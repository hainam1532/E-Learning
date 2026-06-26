import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Divider,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReadOutlined,
  TeamOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { UploadFile } from 'antd/es/upload/interface';
import { getAcademies, getCourses, type Academy, type Course } from '../../services/course';
import {
  addStudentToClass,
  addTrainingResource,
  createTrainingClass,
  getTrainingPlan,
  getTrainingPlans,
  importStudentsToClass,
  updateTrainingPlan,
  type Lecturer,
  type TrainingPlan,
  type TrainingResourceType,
} from '../../services/training';
import { authGet } from '../../services/auth/auth.get';
import { getDocuments, type Document } from '../../services/document';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type StepKey = 0 | 1 | 2;

type DraftResource = {
  type: TrainingResourceType;
  refId: number | null;
  title_vi: string;
};

type DraftClass = {
  tempId: string;
  code: string;
  academyId?: number;
  planId?: number;
  name_vi: string;
  lecturerId?: number;
  startDate?: string;
  endDate?: string;
  manualStudentIds: number[];
  importFiles: UploadFile[];
  resources: DraftResource[];
};

type UserOption = {
  id: number;
  usercode?: string;
  fullName?: string | null;
};

type CreationSummary = {
  className: string;
  classCode: string;
  classId: number;
  studentSuccess: number;
  studentFailed: number;
  importSuccess: number;
  importFailed: number;
  resourcesAdded: number;
};

function createDraftClass(index: number): DraftClass {
  return {
    tempId: `tmp-${Date.now()}-${index}`,
    code: `LH${Math.floor(1000 + Math.random() * 9000)}`,
    name_vi: '',
    manualStudentIds: [],
    importFiles: [],
    resources: [],
  };
}

export default function TrainingPathManagement() {
  const [currentStep, setCurrentStep] = useState<StepKey>(0);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [academies, setAcademies] = useState<Academy[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [draftClasses, setDraftClasses] = useState<DraftClass[]>([createDraftClass(0)]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [courseToAddId, setCourseToAddId] = useState<number | undefined>();

const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resourceType, setResourceType] = useState<TrainingResourceType>('EXAM');
  const [resourceTitle, setResourceTitle] = useState('');

  // Document modal states
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const [createdSummaries, setCreatedSummaries] = useState<CreationSummary[]>([]);
  const [failedClasses, setFailedClasses] = useState<string[]>([]);

  useEffect(() => {
    const fetchLookup = async () => {
      setLoadingLookup(true);
      try {
        const [academyData, planData, courseData, lecturerRes, userRes] = await Promise.all([
          getAcademies(),
          getTrainingPlans(),
          getCourses(),
          authGet.getLecturers(),
          authGet.getUsers(),
        ]);

        setAcademies(academyData || []);
        setPlans(planData || []);
        setCourses(courseData || []);
        setLecturers(lecturerRes.data.lecturers || []);
        setUsers(userRes.data.users || []);
      } catch (error: any) {
        message.error(error?.response?.data?.message || 'Không thể tải dữ liệu lộ trình học tập');
      } finally {
        setLoadingLookup(false);
      }
    };

    fetchLookup();
  }, []);

  useEffect(() => {
    if (!selectedClassId && draftClasses.length > 0) {
      setSelectedClassId(draftClasses[0].tempId);
      return;
    }

    const exists = draftClasses.some((item) => item.tempId === selectedClassId);
    if (!exists && draftClasses.length > 0) {
      setSelectedClassId(draftClasses[0].tempId);
    }
  }, [draftClasses, selectedClassId]);

  const selectedDraftClass = useMemo(
    () => draftClasses.find((item) => item.tempId === selectedClassId),
    [draftClasses, selectedClassId]
  );

  const getLocalizedName = (item: any, prefix: string) => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return item?.[`${prefix}_en`] || item?.[`${prefix}_vi`] || '';
    if (lang === 'zh') return item?.[`${prefix}_zh`] || item?.[`${prefix}_vi`] || '';
    return item?.[`${prefix}_vi`] || '';
  };

  const updateDraftClass = (tempId: string, updater: (prev: DraftClass) => DraftClass) => {
    setDraftClasses((prev) => prev.map((item) => (item.tempId === tempId ? updater(item) : item)));
  };

  const addNewDraftClass = () => {
    const next = createDraftClass(draftClasses.length + 1);
    setDraftClasses((prev) => [...prev, next]);
    setSelectedClassId(next.tempId);
  };

  const removeDraftClass = (tempId: string) => {
    if (draftClasses.length === 1) {
      message.warning('Cần ít nhất 1 lớp trong lộ trình.');
      return;
    }
    setDraftClasses((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const validateStep1 = () => {
    if (draftClasses.length === 0) {
      message.error('Vui lòng tạo ít nhất 1 lớp học.');
      return false;
    }

    for (const item of draftClasses) {
      if (!item.planId || !item.name_vi.trim() || !item.lecturerId || !item.startDate || !item.endDate) {
        message.error(`Vui lòng nhập đầy đủ thông tin cho lớp ${item.code}.`);
        return false;
      }

      const hasStudentInput = item.manualStudentIds.length > 0 || item.importFiles.length > 0;
      if (!hasStudentInput) {
        message.error(`Lớp ${item.code} cần thêm học viên thủ công hoặc import Excel.`);
        return false;
      }

      if (dayjs(item.endDate).isBefore(dayjs(item.startDate), 'day')) {
        message.error(`Ngày kết thúc của lớp ${item.code} phải lớn hơn hoặc bằng ngày bắt đầu.`);
        return false;
      }
    }

    return true;
  };

  const validateStep2 = () => {
    const noResourceClass = draftClasses.find((item) => item.resources.length === 0);
    if (noResourceClass) {
      message.error(`Lớp ${noResourceClass.code} chưa có nội dung đào tạo.`);
      return false;
    }
    return true;
  };

  const goToStep2 = () => {
    if (!validateStep1()) return;
    setCurrentStep(1);
  };

  const goToStep3 = () => {
    if (!validateStep2()) return;
    setCurrentStep(2);
  };

  const handleAddCourseResource = () => {
    if (!selectedDraftClass || !courseToAddId) return;

    const foundCourse = courses.find((course) => course.id === courseToAddId);
    if (!foundCourse) return;

    const duplicated = selectedDraftClass.resources.some(
      (resource) => resource.type === 'COURSE' && resource.refId === courseToAddId
    );
    if (duplicated) {
      message.warning('Khóa học này đã có trong lớp.');
      return;
    }

    updateDraftClass(selectedDraftClass.tempId, (prev) => ({
      ...prev,
      resources: [
        ...prev.resources,
        {
          type: 'COURSE',
          refId: foundCourse.id,
          title_vi: foundCourse.title_vi || foundCourse.title_en || foundCourse.title_zh || `Course ${foundCourse.id}`,
        },
      ],
    }));

    setCourseToAddId(undefined);
  };

  const openManualResourceModal = (type: TrainingResourceType) => {
    setResourceType(type);
    setResourceTitle('');
    setResourceModalOpen(true);
  };

  const confirmAddManualResource = () => {
    if (!selectedDraftClass) return;
    if (!resourceTitle.trim()) {
      message.error('Vui lòng nhập tiêu đề nội dung.');
      return;
    }

    updateDraftClass(selectedDraftClass.tempId, (prev) => ({
      ...prev,
      resources: [
        ...prev.resources,
        {
          type: resourceType,
          refId: Math.floor(Math.random() * 10000000),
          title_vi: resourceTitle.trim(),
        },
      ],
    }));

setResourceModalOpen(false);
  };

  // Open document modal and load documents
  const openDocumentModal = async () => {
    setDocumentModalOpen(true);
    setDocumentsLoading(true);
    try {
      const docs = await getDocuments();
      setDocuments(docs || []);
    } catch (error: any) {
      message.error('Không thể tải danh sách tài liệu');
    } finally {
      setDocumentsLoading(false);
    }
  };

  // Add document to class resources
  const handleAddDocumentResource = (doc: Document) => {
    if (!selectedDraftClass) return;

    if (selectedDraftClass.resources.some(
      (resource) => resource.type === 'DOCUMENT' && resource.refId === doc.id
    )) {
      message.warning('Tài liệu này đã có trong lớp.');
      return;
    }

    updateDraftClass(selectedDraftClass.tempId, (prev) => ({
      ...prev,
      resources: [
        ...prev.resources,
        {
          type: 'DOCUMENT',
          refId: doc.id,
          title_vi: doc.name || '',
        },
      ],
    }));

    setDocumentModalOpen(false);
    message.success('Đã thêm tài liệu vào lớp');
  };

const removeResource = (index: number) => {
    if (!selectedDraftClass) return;
    updateDraftClass(selectedDraftClass.tempId, (prev) => ({
      ...prev,
      resources: prev.resources.filter((_, i) => i !== index),
    }));
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await authGet.getUserTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_hoc_vien.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success('Đã tải template');
    } catch (error: any) {
      message.error('Không thể tải template');
    }
  };

  const submitWizard = async () => {
    setSubmitting(true);
    setCreatedSummaries([]);
    setFailedClasses([]);

    const successRows: CreationSummary[] = [];
    const failedRows: string[] = [];

    for (const item of draftClasses) {
      try {
const createdClass = await createTrainingClass({
          code: item.code,
          name_vi: item.name_vi,
          startDate: item.startDate || undefined,
          endDate: item.endDate || undefined,
          ...(item.academyId !== undefined ? { academyId: item.academyId } : {}),
          ...(item.lecturerId !== undefined ? { lecturerId: item.lecturerId } : {}),
        });

        let studentSuccess = 0;
        let studentFailed = 0;

        for (const studentId of item.manualStudentIds) {
          try {
            await addStudentToClass(createdClass.id, studentId);
            studentSuccess += 1;
          } catch {
            studentFailed += 1;
          }
        }

        let importSuccess = 0;
        let importFailed = 0;
        if (item.importFiles[0]?.originFileObj) {
          try {
            const importResult = await importStudentsToClass(createdClass.id, item.importFiles[0].originFileObj as File);
            importSuccess = importResult.success;
            importFailed = importResult.failed;
          } catch {
            importFailed = 1;
          }
        }

        let resourcesAdded = 0;
        if (item.planId) {
          const currentPlan = await getTrainingPlan(item.planId);
          await updateTrainingPlan(item.planId, { trainingClassId: createdClass.id });

          const existingResources = currentPlan.resources || [];
          const keySet = new Set(
            existingResources.map((resource) => `${resource.type}-${resource.refId || 0}-${resource.title_vi || ''}`)
          );
          let nextOrder = existingResources.length > 0 ? Math.max(...existingResources.map((resource) => resource.order)) + 1 : 1;

          for (const resource of item.resources) {
            const key = `${resource.type}-${resource.refId || 0}-${resource.title_vi || ''}`;
            if (keySet.has(key)) {
              continue;
            }

            await addTrainingResource(item.planId, {
              type: resource.type,
              refId: resource.refId || 0,
              title_vi: resource.title_vi,
              order: nextOrder,
            });
            keySet.add(key);
            nextOrder += 1;
            resourcesAdded += 1;
          }
        }

        successRows.push({
          className: item.name_vi,
          classCode: item.code,
          classId: createdClass.id,
          studentSuccess,
          studentFailed,
          importSuccess,
          importFailed,
          resourcesAdded,
        });
      } catch (error: any) {
        const errorText = error?.response?.data?.message || 'Không xác định';
        failedRows.push(`${item.code}: ${errorText}`);
      }
    }

    setCreatedSummaries(successRows);
    setFailedClasses(failedRows);

    if (successRows.length > 0 && failedRows.length === 0) {
      message.success(`Đã tạo thành công ${successRows.length} lớp.`);
    } else if (successRows.length > 0 && failedRows.length > 0) {
      message.warning(`Tạo thành công ${successRows.length} lớp, thất bại ${failedRows.length} lớp.`);
    } else {
      message.error('Không tạo được lớp nào.');
    }

    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Title level={4} className="mb-1!">Lộ trình học tập nhanh</Title>
            <Text type="secondary">Tạo lớp, xây dựng nội dung và xác nhận trong 1 luồng thao tác duy nhất.</Text>
          </div>
          <Tag color="processing" className="px-2 py-1">Wizard 3 bước</Tag>
        </div>
      </div>

<Card className="rounded-2xl border-slate-200/70 shadow-sm" loading={loadingLookup}>
          <Steps
            current={currentStep}
            items={[
              { title: 'Bước 1', description: 'Tạo lớp học', icon: <TeamOutlined /> },
              { title: 'Bước 2', description: 'Xây dựng nội dung', icon: <ReadOutlined /> },
              { title: 'Bước 3', description: 'Review & xác nhận', icon: <CheckCircleOutlined /> },
            ]}
          />

          <Divider />

          {currentStep === 0 && (
            <Space direction="vertical" size={16} className="w-full">
              <div className="flex items-center justify-between">
                <Text strong>Danh sách lớp cần tạo</Text>
                <Button icon={<PlusOutlined />} type="primary" onClick={addNewDraftClass}>
                  Thêm lớp học
                </Button>
              </div>

              {draftClasses.map((item, index) => {
                const planOptions = plans.filter((plan) => !item.academyId || plan.academyId === item.academyId);

                return (
                  <Card
                    key={item.tempId}
                    className="rounded-xl border border-slate-200"
                    title={
                      <div className="flex items-center gap-2">
                        <Tag color="blue">Lớp {index + 1}</Tag>
                        <Text strong>{item.name_vi || item.code}</Text>
                      </div>
                    }
                    extra={
                      <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeDraftClass(item.tempId)}>
                        Xóa
                      </Button>
                    }
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      <Input
                        value={item.code}
                        placeholder="Mã lớp"
                        onChange={(event) =>
                          updateDraftClass(item.tempId, (prev) => ({
                            ...prev,
                            code: event.target.value,
                          }))
                        }
                      />

                      <Input
                        value={item.name_vi}
                        placeholder="Tên lớp học"
                        onChange={(event) =>
                          updateDraftClass(item.tempId, (prev) => ({
                            ...prev,
                            name_vi: event.target.value,
                          }))
                        }
                      />

                      <Select
                        value={item.academyId}
                        placeholder="Chọn học viện"
                        allowClear
                        options={academies.map((academy) => ({
                          value: academy.id,
                          label: getLocalizedName(academy, 'name') || academy.code,
                        }))}
                        onChange={(value) =>
                          updateDraftClass(item.tempId, (prev) => ({
                            ...prev,
                            academyId: value,
                            planId: undefined,
                          }))
                        }
                      />

                      <Select
                        value={item.planId}
                        placeholder="Chọn kế hoạch đào tạo"
                        options={planOptions.map((plan) => ({
                          value: plan.id,
                          label: getLocalizedName(plan, 'title') || `Plan #${plan.id}`,
                        }))}
                        onChange={(value) =>
                          updateDraftClass(item.tempId, (prev) => ({
                            ...prev,
                            planId: value,
                          }))
                        }
                      />

                      <Select
                        value={item.lecturerId}
                        placeholder="Chọn giảng viên"
                        options={lecturers.map((lecturer) => ({
                          value: lecturer.id,
                          label: `${lecturer.code} - ${lecturer.name || 'No name'}`,
                        }))}
                        onChange={(value) =>
                          updateDraftClass(item.tempId, (prev) => ({
                            ...prev,
                            lecturerId: value,
                          }))
                        }
                      />

                      <RangePicker
                        value={
                          item.startDate && item.endDate
                            ? [dayjs(item.startDate), dayjs(item.endDate)]
                            : null
                        }
                        format="DD/MM/YYYY"
                        onChange={(dates) =>
                          updateDraftClass(item.tempId, (prev) => ({
                            ...prev,
                            startDate: dates?.[0]?.toISOString(),
                            endDate: dates?.[1]?.toISOString(),
                          }))
                        }
                      />
                    </div>

                    <Divider className="my-4!" />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <Text strong>Thêm học viên thủ công</Text>
                        <Select
                          mode="multiple"
                          className="w-full mt-2"
                          placeholder="Chọn học viên"
                          value={item.manualStudentIds}
                          optionFilterProp="label"
                          options={users.map((user) => ({
                            value: user.id,
                            label: `${user.usercode || ''} - ${user.fullName || 'No name'}`,
                          }))}
                          onChange={(value) =>
                            updateDraftClass(item.tempId, (prev) => ({
                              ...prev,
                              manualStudentIds: value,
                            }))
                          }
                        />
                      </div>

<div>
                        <Text strong>Import Excel học viên</Text>
                        <Upload
                          accept=".xlsx,.xls"
                          maxCount={1}
                          beforeUpload={() => false}
                          fileList={item.importFiles}
                          onChange={({ fileList }) =>
                            updateDraftClass(item.tempId, (prev) => ({
                              ...prev,
                              importFiles: fileList,
                            }))
                          }
                        >
                          <Button icon={<FileExcelOutlined />} className="mt-2">
                            Chọn file Excel
                          </Button>
                        </Upload>
                        <Button
                          type="link"
                          icon={<DownloadOutlined />}
                          onClick={handleDownloadTemplate}
                          className="mt-2 ml-2 text-blue-600"
                          size="small"
                        >
                          Tải mẫu
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              <div className="flex justify-end">
                <Button type="primary" size="large" onClick={goToStep2}>
                  Tiếp tục xây dựng nội dung
                </Button>
              </div>
            </Space>
          )}

        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
<Card
              title={<span className="font-semibold text-slate-700">Lớp đã tạo</span>}
              className="lg:col-span-1 rounded-xl border-slate-200/80 shadow-sm lg:sticky lg:top-4"
            >
              {draftClasses.length === 0 ? (
                <div className="text-center py-4 text-slate-400">Chưa có lớp nào</div>
              ) : (
                <div className="space-y-2">
                  {draftClasses.map((item) => (
                    <Button
                      key={item.tempId}
                      type={item.tempId === selectedClassId ? 'primary' : 'default'}
                      className="w-full text-left h-10 font-medium"
                      onClick={() => setSelectedClassId(item.tempId)}
                    >
                      {item.name_vi || item.code}
                    </Button>
                  ))}
                </div>
              )}
            </Card>

            <Card
              title={<span className="font-semibold text-slate-700">Xây dựng nội dung</span>}
              className="lg:col-span-3 rounded-xl border-slate-200/80 shadow-sm"
            >
              {!selectedDraftClass ? (
                <Empty description="Chọn lớp để thêm nội dung" />
              ) : (
<Space direction="vertical" size={16} className="w-full">
                  <Alert
                    type="info"
                    showIcon
                    message={`Đang cấu hình: ${selectedDraftClass.name_vi || selectedDraftClass.code}`}
                  />

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <Space.Compact className="w-full">
                      <Select
                        className="w-full"
                        value={courseToAddId}
                        placeholder="Chọn khóa học để thêm"
                        options={courses.map((course) => ({
                          value: course.id,
                          label: getLocalizedName(course, 'title') || `Course #${course.id}`,
                        }))}
                        onChange={(value) => setCourseToAddId(value)}
                      />
                      <Button type="primary" onClick={handleAddCourseResource}>
                        Thêm khóa học
                      </Button>
                    </Space.Compact>

<Space>
                      <Button icon={<FileTextOutlined />} onClick={() => openManualResourceModal('EXAM')}>
                        Thêm kỳ thi
                      </Button>
                      <Button icon={<FileTextOutlined />} onClick={() => openDocumentModal()}>
                        Thêm tài liệu
                      </Button>
                    </Space>
                  </div>

                  <Table
                    size="small"
                    rowKey={(_, index) => `${selectedDraftClass.tempId}-${index}`}
                    pagination={false}
                    dataSource={selectedDraftClass.resources}
                    className="rounded-lg overflow-hidden"
                    locale={{ emptyText: 'Chưa có nội dung cho lớp này' }}
                    columns={[
                      {
                        title: '#',
                        width: 60,
                        render: (_value, _row, index) => index + 1,
                      },
                      {
                        title: 'Loại',
                        dataIndex: 'type',
                        render: (value: TrainingResourceType) => {
                          if (value === 'COURSE') return <Tag color="blue">Khóa học</Tag>;
                          if (value === 'EXAM') return <Tag color="gold">Kỳ thi</Tag>;
                          return <Tag color="purple">Tài liệu</Tag>;
                        },
                      },
                      {
                        title: 'Tiêu đề',
                        dataIndex: 'title_vi',
                      },
                      {
                        title: 'Thao tác',
                        width: 120,
                        render: (_value, _row, index) => (
                          <Button danger size="small" onClick={() => removeResource(index)}>
                            Xóa
                          </Button>
                        ),
                      },
                    ]}
                  />

                  <div className="flex justify-between">
                    <Button onClick={() => setCurrentStep(0)}>Quay lại bước 1</Button>
                    <Button type="primary" onClick={goToStep3}>
                      Review & xác nhận
                    </Button>
                  </div>
                </Space>
              )}
            </Card>
          </div>
        )}

{currentStep === 2 && (
          <Space direction="vertical" size={16} className="w-full">
            <Alert
              showIcon
              type="warning"
              message="Vui lòng kiểm tra lại trước khi tạo"
              description="Sau khi xác nhận, hệ thống sẽ tạo lớp, thêm học viên và cập nhật nội dung vào kế hoạch đã chọn."
            />

            {draftClasses.map((item) => {
              const linkedPlan = plans.find((plan) => plan.id === item.planId);
              const linkedLecturer = lecturers.find((lecturer) => lecturer.id === item.lecturerId);

              return (
                <Card key={item.tempId} className="rounded-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Text strong>{item.name_vi || item.code}</Text>
                      <div>
                        <Tag color="blue">{item.code}</Tag>
                        <Tag color="cyan">{linkedPlan ? getLocalizedName(linkedPlan, 'title') : 'Chưa có kế hoạch'}</Tag>
                        <Tag color="geekblue">{linkedLecturer?.name || 'Chưa có giảng viên'}</Tag>
                      </div>
                    </div>
                    <Text type="secondary">
                      {item.startDate && item.endDate
                        ? `${dayjs(item.startDate).format('DD/MM/YYYY')} - ${dayjs(item.endDate).format('DD/MM/YYYY')}`
                        : 'Chưa chọn thời gian'}
                    </Text>
                  </div>

                  <Divider className="my-3!" />

                  <Space size={16}>
                    <Text>HV thủ công: {item.manualStudentIds.length}</Text>
                    <Text>File Excel: {item.importFiles.length > 0 ? item.importFiles[0].name : 'Không có'}</Text>
                    <Text>Nội dung: {item.resources.length}</Text>
                  </Space>
                </Card>
              );
            })}

{failedClasses.length > 0 && (
              <Alert
                type="error"
                showIcon
                message="Một số lớp tạo thất bại"
                description={
                  <ul className="list-disc pl-5 my-0">
                    {failedClasses.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                }
              />
            )}

            {createdSummaries.length > 0 && (
              <Card title="Kết quả tạo lớp" className="rounded-xl">
                <Table
                  size="small"
                  pagination={false}
                  rowKey="classId"
                  dataSource={createdSummaries}
                  columns={[
                    { title: 'Lớp', dataIndex: 'className' },
                    { title: 'Mã', dataIndex: 'classCode' },
                    { title: 'ID', dataIndex: 'classId' },
                    { title: 'HV thành công', dataIndex: 'studentSuccess' },
                    { title: 'HV lỗi', dataIndex: 'studentFailed' },
                    { title: 'Import thành công', dataIndex: 'importSuccess' },
                    { title: 'Import lỗi', dataIndex: 'importFailed' },
                    { title: 'Nội dung thêm mới', dataIndex: 'resourcesAdded' },
                  ]}
                />
              </Card>
            )}

            <div className="flex justify-between">
              <Button onClick={() => setCurrentStep(1)}>Quay lại bước 2</Button>
              <Space>
                <Button
                  onClick={() => {
                    setCurrentStep(0);
                    setCreatedSummaries([]);
                    setFailedClasses([]);
                  }}
                >
                  Sửa lại toàn bộ
                </Button>
                <Button type="primary" loading={submitting} onClick={submitWizard}>
                  Xác nhận tạo
                </Button>
              </Space>
            </div>
          </Space>
        )}
      </Card>

<Modal
        title={resourceType === 'EXAM' ? 'Thêm kỳ thi' : 'Thêm tài liệu'}
        open={resourceModalOpen}
        onCancel={() => setResourceModalOpen(false)}
        onOk={confirmAddManualResource}
      >
        <Input
          placeholder={resourceType === 'EXAM' ? 'Nhập tên kỳ thi' : 'Nhập tên tài liệu'}
          value={resourceTitle}
          onChange={(event) => setResourceTitle(event.target.value)}
        />
      </Modal>

      {/* Select Document from Library Modal */}
      <Modal
        title="Chọn tài liệu từ thư viện"
        open={documentModalOpen}
        onCancel={() => setDocumentModalOpen(false)}
        footer={null}
        width={600}
      >
        <div className="max-h-96 overflow-y-auto space-y-2 mt-4">
          {documentsLoading ? (
            <div className="text-center py-8 text-slate-400">Đang tải...</div>
          ) : documents.length > 0 ? (
            documents.map((doc) => (
              <Card
                key={doc.id}
                size="small"
                className="hover:border-orange-500 cursor-pointer transition-colors"
                onClick={() => handleAddDocumentResource(doc)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <FileTextOutlined className="text-orange-500" />
                    <div>
                      <span className="font-semibold block text-slate-800">
                        {doc.name}
                      </span>
                      <Text type="secondary" className="text-xs">
                        {doc.type?.toUpperCase()} - {(doc.size / 1024).toFixed(1)} KB
                      </Text>
                    </div>
                  </div>
                  <Button type="primary" size="small" className="bg-orange-600 hover:bg-orange-700 border-none">
                    Chọn
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-slate-400">
              Chưa có tài liệu nào. Hãy upload tài liệu mới trước.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
