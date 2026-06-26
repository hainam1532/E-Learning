import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { authGet } from "../../services/auth/auth.get";
import { authPost } from "../../services/auth/auth.post";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface Academy {
  id: number;
  name_vi?: string | null;
  name_en?: string | null;
  name_zh?: string | null;
  code: string;
}

interface QuestionCategory {
  id: number;
  name_vi?: string | null;
  name_en?: string | null;
  name_zh?: string | null;
  academyId: number;
  academy?: Academy;
  _count?: { questions: number };
}

interface QuestionOption {
  id: number;
  option_vi?: string | null;
  order: number;
}

interface Question {
  id: number;
  question_vi?: string | null;
  question_en?: string | null;
  question_zh?: string | null;
  type: "FILL_BLANK" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  correctAnswer: string | string[] | boolean | null;
  options?: QuestionOption[];
}

interface ExamSettings {
  antiCheat: boolean;
  requireFullscreen: boolean;
  detectTabSwitch: boolean;
  shuffleQuestions: boolean;
}

interface ExamSession {
  id: number;
  name_vi: string;
  name_en?: string;
  name_zh?: string;
  academyId: number;
  paperCategoryId: number;
  startAt: string;
  endAt: string;
  attemptLimit: number;
  passingScore: number;
  durationMinutes: number;
  settings: ExamSettings;
  createdAt: string;
  updatedAt?: string;
}

interface ExamPaperOption {
  value: number;
  label: string;
  academyId: number;
  questionCount: number;
}

const QUESTION_TYPE_MAP: Record<string, { label: string; color: string }> = {
  FILL_BLANK: { label: "Điền câu từ", color: "blue" },
  SINGLE_CHOICE: { label: "Trắc nghiệm 1 lựa chọn", color: "green" },
  MULTIPLE_CHOICE: { label: "Trắc nghiệm nhiều lựa chọn", color: "purple" },
  TRUE_FALSE: { label: "Đúng / Sai", color: "orange" },
};

const normalizeCorrectAnswer = (value: Question["correctAnswer"]) => {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const mapExamSessionFromApi = (item: any): ExamSession => ({
  id: item.id,
  name_vi: item.name_vi,
  name_en: item.name_en || undefined,
  name_zh: item.name_zh || undefined,
  academyId: item.academyId,
  paperCategoryId: item.paperCategoryId,
  startAt: item.startAt,
  endAt: item.endAt,
  attemptLimit: item.attemptLimit,
  passingScore: item.passingScore,
  durationMinutes: item.durationMinutes,
  settings: {
    antiCheat: Boolean(item.antiCheat),
    requireFullscreen: Boolean(item.requireFullscreen),
    detectTabSwitch: Boolean(item.detectTabSwitch),
    shuffleQuestions: Boolean(item.shuffleQuestions),
  },
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export default function ExamSessionManagement() {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ExamSession | null>(null);
  const [activeTab, setActiveTab] = useState("basic");
  const [saving, setSaving] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [linkedQuestions, setLinkedQuestions] = useState<Question[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [academyFilter, setAcademyFilter] = useState<number | undefined>(undefined);
  const [searchName, setSearchName] = useState("");

  const [form] = Form.useForm();
  const selectedAcademyId = Form.useWatch("academyId", form);

  const fetchMasterData = useCallback(async () => {
    setLoading(true);
    try {
      const [academyRes, categoryRes] = await Promise.all([
        authGet.getAcademies(),
        authGet.getQuestionCategories(),
      ]);
      setAcademies(academyRes.data?.academies ?? academyRes.data ?? []);
      setCategories(categoryRes.data?.categories ?? []);
    } catch {
      message.error("Không thể tải dữ liệu học viện/đề thi");
      setAcademies([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExamSessions = useCallback(async () => {
    setLoading(true);
    try {
      const sessionRes = await authGet.getExamSessions(academyFilter, searchName || undefined);
      const rawSessions = sessionRes.data?.sessions ?? [];
      setSessions(Array.isArray(rawSessions) ? rawSessions.map(mapExamSessionFromApi) : []);
    } catch {
      message.error("Không thể tải danh sách kỳ thi");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [academyFilter, searchName]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  useEffect(() => {
    fetchExamSessions();
  }, [fetchExamSessions]);

  const paperOptions = useMemo<ExamPaperOption[]>(() => {
    return categories
      .map((category) => ({
        value: category.id,
        academyId: category.academyId,
        questionCount: category._count?.questions || 0,
        label: `${category.name_vi || category.name_en || category.name_zh || `Danh mục #${category.id}`} (${category._count?.questions || 0} câu)`,
      }))
      .filter((paper) => paper.questionCount > 0);
  }, [categories]);

  const paperOptionsByAcademy = useMemo(() => {
    if (!selectedAcademyId) return [];
    return paperOptions.filter((paper) => paper.academyId === selectedAcademyId);
  }, [paperOptions, selectedAcademyId]);

  const getAcademyName = (academyId: number) => {
    const academy = academies.find((item) => item.id === academyId);
    return academy?.name_vi || academy?.code || "-";
  };

  const getPaperLabel = (categoryId: number) => {
    const paper = paperOptions.find((item) => item.value === categoryId);
    return paper?.label || `Danh mục #${categoryId}`;
  };

  const openCreateModal = () => {
    setEditingSession(null);
    setActiveTab("basic");
    form.resetFields();
    form.setFieldsValue({
      attemptLimit: 1,
      passingScore: 70,
      durationMinutes: 60,
      antiCheat: true,
      requireFullscreen: true,
      detectTabSwitch: true,
      shuffleQuestions: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (session: ExamSession) => {
    setEditingSession(session);
    setActiveTab("basic");
    form.setFieldsValue({
      name_vi: session.name_vi,
      name_en: session.name_en,
      name_zh: session.name_zh,
      academyId: session.academyId,
      paperCategoryId: session.paperCategoryId,
      timeRange: [dayjs(session.startAt), dayjs(session.endAt)],
      attemptLimit: session.attemptLimit,
      passingScore: session.passingScore,
      durationMinutes: session.durationMinutes,
      antiCheat: session.settings.antiCheat,
      requireFullscreen: session.settings.requireFullscreen,
      detectTabSwitch: session.settings.detectTabSwitch,
      shuffleQuestions: session.settings.shuffleQuestions,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        name_vi: values.name_vi,
        name_en: values.name_en,
        name_zh: values.name_zh,
        academyId: values.academyId,
        paperCategoryId: values.paperCategoryId,
        startAt: values.timeRange[0].toISOString(),
        endAt: values.timeRange[1].toISOString(),
        attemptLimit: values.attemptLimit,
        passingScore: values.passingScore,
        durationMinutes: values.durationMinutes,
        antiCheat: Boolean(values.antiCheat),
        requireFullscreen: Boolean(values.requireFullscreen),
        detectTabSwitch: Boolean(values.detectTabSwitch),
        shuffleQuestions: Boolean(values.shuffleQuestions),
      };

      if (dayjs(payload.endAt).isBefore(dayjs(payload.startAt))) {
        message.error("Thời gian kết thúc phải sau thời gian bắt đầu");
        setSaving(false);
        return;
      }

      if (editingSession) {
        await authPost.updateExamSession(editingSession.id, payload);
      } else {
        await authPost.createExamSession(payload);
      }

      await fetchExamSessions();

      setModalOpen(false);
      message.success(editingSession ? "Cập nhật kỳ thi thành công" : "Tạo kỳ thi thành công");
    } catch {
      // form validation handled by antd
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await authPost.deleteExamSession(id);
      await fetchExamSessions();
      message.success("Đã xóa kỳ thi");
    } catch {
      message.error("Không thể xóa kỳ thi");
    }
  };

  const openSessionDrawer = async (session: ExamSession) => {
    setSelectedSession(session);
    setDrawerOpen(true);
    setDrawerLoading(true);

    try {
      const res = await authGet.getQuestions(session.paperCategoryId);
      setLinkedQuestions(res.data?.questions ?? []);
    } catch {
      message.error("Không thể tải chi tiết bộ đề liên kết");
      setLinkedQuestions([]);
    } finally {
      setDrawerLoading(false);
    }
  };

  const sessionColumns: ColumnsType<ExamSession> = [
    {
      title: "Tên kỳ thi",
      key: "name_vi",
      render: (_, record) => (
        <div>
          <div><Text strong>{record.name_vi}</Text></div>
          {record.name_en ? <Text type="secondary">EN: {record.name_en}</Text> : null}
          {record.name_zh ? <div><Text type="secondary">ZH: {record.name_zh}</Text></div> : null}
        </div>
      ),
    },
    {
      title: "Học viện",
      dataIndex: "academyId",
      key: "academyId",
      width: 180,
      render: (academyId: number) => <Tag color="blue">{getAcademyName(academyId)}</Tag>,
    },
    {
      title: "Đề thi liên kết",
      dataIndex: "paperCategoryId",
      key: "paperCategoryId",
      width: 280,
      render: (categoryId: number) => <Text>{getPaperLabel(categoryId)}</Text>,
    },
    {
      title: "Thời gian",
      key: "time",
      width: 280,
      render: (_, record) => (
        <div>
          <div><Text>BD: {dayjs(record.startAt).format("DD/MM/YYYY HH:mm")}</Text></div>
          <div><Text>KT: {dayjs(record.endAt).format("DD/MM/YYYY HH:mm")}</Text></div>
        </div>
      ),
    },
    {
      title: "Thi / Điểm / Phút",
      key: "rules",
      width: 170,
      render: (_, record) => (
        <div>
          <div><Text>{record.attemptLimit} lần</Text></div>
          <div><Text>{record.passingScore} điểm đạt</Text></div>
          <div><Text>{record.durationMinutes} phút</Text></div>
        </div>
      ),
    },
    {
      title: "Cài đặt",
      key: "settings",
      width: 230,
      render: (_, record) => (
        <Space wrap>
          <Tag color={record.settings.antiCheat ? "green" : "default"}>Chống gian lận</Tag>
          <Tag color={record.settings.requireFullscreen ? "green" : "default"}>Toàn màn hình</Tag>
          <Tag color={record.settings.detectTabSwitch ? "green" : "default"}>Phát hiện đổi tab</Tag>
          <Tag color={record.settings.shuffleQuestions ? "green" : "default"}>Xáo trộn câu hỏi</Tag>
        </Space>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 160,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button icon={<EyeOutlined />} onClick={() => openSessionDrawer(record)} />
          </Tooltip>
          <Tooltip title="Sửa kỳ thi">
            <Button icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          </Tooltip>
          <Popconfirm
            title="Xóa kỳ thi này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Tooltip title="Xóa kỳ thi">
              <Button danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const questionColumns: ColumnsType<Question> = [
    {
      title: "#",
      width: 50,
      align: "center",
      render: (_, __, idx) => idx + 1,
    },
    {
      title: "Câu hỏi",
      dataIndex: "question_vi",
      key: "question_vi",
      render: (_, record) => (
        <div>
          <div>{record.question_vi || "-"}</div>
          {record.question_en ? <Text type="secondary">EN: {record.question_en}</Text> : null}
        </div>
      ),
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      width: 200,
      render: (type: Question["type"]) => {
        const mapped = QUESTION_TYPE_MAP[type];
        return <Tag color={mapped?.color}>{mapped?.label || type}</Tag>;
      },
    },
    {
      title: "Đáp án đúng",
      dataIndex: "correctAnswer",
      key: "correctAnswer",
      width: 180,
      render: (value: Question["correctAnswer"]) => (
        <Text strong style={{ color: "#1677ff" }}>
          {normalizeCorrectAnswer(value)}
        </Text>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CalendarOutlined style={{ fontSize: 28, color: "#1677ff" }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>Quản lý kỳ thi</Title>
              <Text type="secondary">
                Tạo kỳ thi, liên kết đề thi, thiết lập thời gian và chống gian lận
              </Text>
            </div>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchMasterData();
                fetchExamSessions();
              }}
              loading={loading}
            >
              Làm mới
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>Tạo kỳ thi</Button>
          </Space>
        </div>
      </div>

      <Card size="small" className="rounded-2xl border border-slate-200/50 shadow-sm">
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={10} md={8}>
            <Select
              allowClear
              showSearch
              placeholder="Lọc theo học viện"
              value={academyFilter}
              onChange={setAcademyFilter}
              style={{ width: "100%" }}
              optionFilterProp="label"
              options={academies.map((academy) => ({
                value: academy.id,
                label: academy.name_vi || academy.code,
              }))}
            />
          </Col>
          <Col xs={24} sm={14} md={10}>
            <Input
              allowClear
              prefix={<FileTextOutlined />}
              placeholder="Tìm theo tên kỳ thi..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </Col>
        </Row>
      </Card>

      <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={sessions}
          columns={sessionColumns}
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có kỳ thi nào. Bấm Tạo kỳ thi để bắt đầu."
              />
            ),
          }}
        />
      </div>

      <Modal
        open={modalOpen}
        title={
          <Space>
            <SafetyCertificateOutlined />
            {editingSession ? "Cập nhật kỳ thi" : "Tạo kỳ thi mới"}
          </Space>
        }
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editingSession ? "Lưu" : "Tạo"}
        cancelText="Hủy"
        width={900}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: "basic",
                label: "Thông tin kỳ thi",
                children: (
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="name_vi"
                        label="Tên kỳ thi (Tiếng Việt)"
                        rules={[{ required: true, message: "Vui lòng nhập tên kỳ thi tiếng Việt" }]}
                      >
                        <Input placeholder="Ví dụ: Kỳ thi an toàn lao động quý 3" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="name_en" label="Tên kỳ thi (Tiếng Anh)">
                        <Input placeholder="e.g. Labor Safety Exam Q3" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="name_zh" label="Tên kỳ thi (Tiếng Trung)">
                        <Input placeholder="例如：第三季度劳动安全考试" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="academyId"
                        label="Học viện"
                        rules={[{ required: true, message: "Vui lòng chọn học viện" }]}
                      >
                        <Select
                          showSearch
                          placeholder="Chọn học viện"
                          optionFilterProp="label"
                          onChange={() => form.setFieldValue("paperCategoryId", undefined)}
                          options={academies.map((academy) => ({
                            value: academy.id,
                            label: academy.name_vi || academy.code,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="paperCategoryId"
                        label="Liên kết đề thi"
                        rules={[{ required: true, message: "Vui lòng chọn đề thi" }]}
                      >
                        <Select
                          showSearch
                          placeholder="Chọn đề thi từ Quản lý đề thi"
                          optionFilterProp="label"
                          options={paperOptionsByAcademy}
                          notFoundContent="Học viện này chưa có danh mục đã upload câu hỏi"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="timeRange"
                        label="Thời gian bắt đầu / kết thúc"
                        rules={[{ required: true, message: "Vui lòng chọn thời gian" }]}
                      >
                        <RangePicker
                          showTime
                          style={{ width: "100%" }}
                          format="DD/MM/YYYY HH:mm"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="attemptLimit"
                        label="Số lần được thi"
                        rules={[{ required: true, message: "Vui lòng nhập số lần thi" }]}
                      >
                        <InputNumber min={1} max={99} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="passingScore"
                        label="Tổng điểm đạt"
                        rules={[{ required: true, message: "Vui lòng nhập điểm đạt" }]}
                      >
                        <InputNumber min={0} max={1000} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="durationMinutes"
                        label="Thời gian thi (phút)"
                        rules={[{ required: true, message: "Vui lòng nhập thời gian thi" }]}
                      >
                        <InputNumber min={1} max={600} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
              {
                key: "settings",
                label: "Cài đặt",
                children: (
                  <Row gutter={[12, 8]}>
                    <Col span={24}>
                      <Card size="small" title="Cài đặt chống gian lận">
                        <Form.Item
                          name="antiCheat"
                          label="Chống gian lận"
                          valuePropName="checked"
                          style={{ marginBottom: 12 }}
                        >
                          <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                        </Form.Item>

                        <Form.Item
                          name="requireFullscreen"
                          label="Yêu cầu toàn màn hình"
                          valuePropName="checked"
                          style={{ marginBottom: 12 }}
                        >
                          <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                        </Form.Item>

                        <Form.Item
                          name="detectTabSwitch"
                          label="Phát hiện chuyển đổi tab"
                          valuePropName="checked"
                          style={{ marginBottom: 12 }}
                        >
                          <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                        </Form.Item>

                        <Form.Item
                          name="shuffleQuestions"
                          label="Xáo trộn câu hỏi"
                          valuePropName="checked"
                          style={{ marginBottom: 0 }}
                        >
                          <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                        </Form.Item>
                      </Card>
                    </Col>
                  </Row>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setLinkedQuestions([]);
        }}
        width={1100}
        title={selectedSession ? `Chi tiết kỳ thi: ${selectedSession.name_vi}` : "Chi tiết kỳ thi"}
      >
        {selectedSession ? (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Card size="small">
              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}>
                  <Text type="secondary">Học viện</Text>
                  <div><Tag color="blue">{getAcademyName(selectedSession.academyId)}</Tag></div>
                </Col>
                <Col xs={24} md={8}>
                  <Text type="secondary">Đề thi liên kết</Text>
                  <div>{getPaperLabel(selectedSession.paperCategoryId)}</div>
                </Col>
                <Col xs={24} md={8}>
                  <Text type="secondary">Tổng số câu liên kết</Text>
                  <div>
                    <Badge
                      count={linkedQuestions.length}
                      showZero
                      style={{ backgroundColor: linkedQuestions.length > 0 ? "#1677ff" : "#bfbfbf" }}
                    />
                  </div>
                </Col>
              </Row>
            </Card>

            <Table
              rowKey="id"
              loading={drawerLoading}
              dataSource={linkedQuestions}
              columns={questionColumns}
              pagination={{ pageSize: 8 }}
              expandable={{
                expandedRowRender: (record) => {
                  if (!record.options || record.options.length === 0) {
                    return <Text type="secondary">Câu hỏi này không có danh sách lựa chọn.</Text>;
                  }
                  return (
                    <div style={{ display: "grid", gap: 8 }}>
                      {record.options.map((option, idx) => (
                        <div key={option.id}>
                          <Text strong>{String.fromCharCode(65 + idx)}.</Text>{" "}
                          <Text>{option.option_vi || "-"}</Text>
                        </div>
                      ))}
                    </div>
                  );
                },
                rowExpandable: (record) => Boolean(record.options && record.options.length > 0),
              }}
              locale={{
                emptyText: "Đề thi liên kết chưa có câu hỏi. Hãy kiểm tra lại danh mục câu hỏi.",
              }}
            />
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
}
