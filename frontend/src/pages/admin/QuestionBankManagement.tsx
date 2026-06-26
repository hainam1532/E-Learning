import { useState, useEffect, useCallback } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Card,
  Upload,
  Tooltip,
  Divider,
  Badge,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FolderOutlined,
  SearchOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { authGet } from "../../services/auth/auth.get";
import { authPost } from "../../services/auth/auth.post";

const { Title, Text } = Typography;
const { Search } = Input;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Academy {
  id: number;
  name_vi: string | null;
  name_en: string | null;
  name_zh: string | null;
  code: string;
}

interface Question {
  id: number;
  question_vi: string | null;
  question_en: string | null;
  question_zh: string | null;
  type: "FILL_BLANK" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  categoryId: number;
}

interface QuestionCategory {
  id: number;
  name_vi: string | null;
  name_en: string | null;
  name_zh: string | null;
  description: string | null;
  academyId: number;
  academy?: Academy;
  questions?: Question[];
  _count?: { questions: number };
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const QUESTION_TYPE_LABELS: Record<Question["type"], { label: string; color: string }> = {
  FILL_BLANK: { label: "Điền câu từ", color: "blue" },
  SINGLE_CHOICE: { label: "Trắc nghiệm 1 lựa chọn", color: "green" },
  MULTIPLE_CHOICE: { label: "Trắc nghiệm nhiều lựa chọn", color: "purple" },
  TRUE_FALSE: { label: "Chọn đúng/sai", color: "orange" },
};

const DIFFICULTY_LABELS: Record<Question["difficulty"], { label: string; color: string }> = {
  EASY: { label: "Dễ", color: "success" },
  MEDIUM: { label: "Trung bình", color: "warning" },
  HARD: { label: "Khó", color: "error" },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuestionBankManagement() {
  // List state
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [filterAcademy, setFilterAcademy] = useState<number | undefined>(undefined);
  const [filterSearch, setFilterSearch] = useState<string>("");

  // Category modal state
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<QuestionCategory | null>(null);
const [categoryForm] = Form.useForm();
  const [savingCategory, setSavingCategory] = useState(false);

  // Questions drawer state
  const [questionsModalVisible, setQuestionsModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // Upload state
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadCategoryId, setUploadCategoryId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchAcademies = useCallback(async () => {
    try {
      const res = await authGet.getAcademies();
      setAcademies(res.data.academies ?? res.data ?? []);
    } catch {
      message.error("Không thể tải danh sách học viện");
    }
  }, []);

const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authGet.getQuestionCategories(filterAcademy, filterSearch || undefined);
      // Backend returns { categories: [...] } - extract from res.data.categories
      // Also handle case where res.data is wrapped in { success, data }
      let rawData = res.data;
      if (rawData && typeof rawData === 'object' && 'categories' in rawData) {
        rawData = (rawData as any).categories;
      }
      // Ensure data is always an array
      const data = Array.isArray(rawData) ? rawData : [];
      setCategories(data);
    } catch {
      message.error("Không thể tải danh sách danh mục câu hỏi");
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [filterAcademy, filterSearch]);

  useEffect(() => {
    fetchAcademies();
  }, [fetchAcademies]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

const fetchQuestions = async (categoryId: number) => {
    setQuestionsLoading(true);
    try {
      const res = await authGet.getQuestions(categoryId);
      // Backend returns { questions: [...] } - extract from res.data.questions
      // Also handle case where res.data is wrapped in { success, data }
      let rawData = res.data;
      if (rawData && typeof rawData === 'object' && 'questions' in rawData) {
        rawData = (rawData as any).questions;
      }
      // Ensure data is always an array
      const data = Array.isArray(rawData) ? rawData : [];
      setQuestions(data);
    } catch {
      message.error("Không thể tải danh sách câu hỏi");
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  };

  // ─── Category CRUD ──────────────────────────────────────────────────────────

  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCategoryModalVisible(true);  // Open modal first
    // resetFields after the Form mounts
    setTimeout(() => {
      categoryForm.resetFields();
    }, 0);
  };

  const handleOpenEditCategory = (record: QuestionCategory) => {
    setEditingCategory(record);
    categoryForm.setFieldsValue({
      name_vi: record.name_vi,
      name_en: record.name_en,
      name_zh: record.name_zh,
      description: record.description,
      academyId: record.academyId,
    });
    setCategoryModalVisible(true);
  };

  const handleSaveCategory = async (values: any) => {
    setSavingCategory(true);
    try {
      if (editingCategory) {
        await authPost.updateQuestionCategory(editingCategory.id, values);
        message.success("Cập nhật danh mục thành công");
      } else {
        await authPost.createQuestionCategory(values);
        message.success("Tạo danh mục thành công");
      }
      setCategoryModalVisible(false);
      fetchCategories();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Thao tác thất bại");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await authPost.deleteQuestionCategory(id);
      message.success("Xoá danh mục thành công");
      fetchCategories();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Xoá thất bại");
    }
  };

  // ─── View Questions ─────────────────────────────────────────────────────────

  const handleViewQuestions = (category: QuestionCategory) => {
    setSelectedCategory(category);
    setQuestionsModalVisible(true);
    fetchQuestions(category.id);
  };

  // ─── Upload ─────────────────────────────────────────────────────────────────

  const handleOpenUpload = (category: QuestionCategory) => {
    setUploadCategoryId(category.id);
    setUploadFile(null);
    setSelectedCategory(category);
    setUploadModalVisible(true);
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadCategoryId) {
      message.warning("Vui lòng chọn file Excel để upload");
      return;
    }
    setUploading(true);
    try {
      const res = await authPost.importQuestions(uploadCategoryId, uploadFile);
      const imported = Number(res.data?.imported ?? res.data?.results?.success ?? 0);
      const failed = Number(res.data?.failed ?? res.data?.results?.failed ?? 0);

      if (imported > 0) {
        message.success(
          failed > 0
            ? `Import xong: ${imported} thành công, ${failed} thất bại`
            : `Import thành công ${imported} câu hỏi`
        );
      } else {
        message.warning(`Không có câu hỏi nào được lưu. Thất bại: ${failed}`);
      }

      if (Array.isArray(res.data?.errors) && res.data.errors.length > 0) {
        message.warning(`Chi tiết lỗi: ${res.data.errors.slice(0, 3).join(" | ")}`);
      }

      setUploadModalVisible(false);
      fetchCategories();
      if (selectedCategory) {
        fetchQuestions(selectedCategory.id);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Import thất bại");
    } finally {
      setUploading(false);
    }
  };

  // ─── Download Template ──────────────────────────────────────────────────────

  const handleDownloadTemplate = async () => {
    try {
      const res = await authGet.getQuestionTemplate();
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "question_template.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success("Đã tải template Excel câu hỏi");
    } catch {
      message.error("Không thể tải template câu hỏi");
    }
  };

  // ─── Table Columns ──────────────────────────────────────────────────────────

  const categoryColumns: ColumnsType<QuestionCategory> = [
    {
      title: "STT",
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: "Tên danh mục (VI)",
      dataIndex: "name_vi",
      key: "name_vi",
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: "Tên danh mục (EN)",
      dataIndex: "name_en",
      key: "name_en",
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: "Tên danh mục (ZH)",
      dataIndex: "name_zh",
      key: "name_zh",
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: "Học viện",
      dataIndex: ["academy", "name_vi"],
      key: "academy",
      render: (_: any, record: QuestionCategory) =>
        record.academy ? (
          <Tag color="blue">{record.academy.name_vi || record.academy.code}</Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Số câu hỏi",
      key: "questionCount",
      align: "center",
      render: (_: any, record: QuestionCategory) => {
        const count = record._count?.questions ?? record.questions?.length ?? 0;
        return (
          <Button type="link" onClick={() => handleViewQuestions(record)}>
            <Badge count={count} showZero style={{ backgroundColor: count > 0 ? "#1677ff" : "#aaa" }} />
          </Button>
        );
      },
    },
    {
      title: "Thao tác",
      key: "action",
      align: "center",
      width: 220,
      render: (_: any, record: QuestionCategory) => (
        <Space>
          <Tooltip title="Upload câu hỏi từ Excel">
            <Button
              type="primary"
              size="small"
              icon={<UploadOutlined />}
              onClick={() => handleOpenUpload(record)}
            >
              Upload
            </Button>
          </Tooltip>
          <Tooltip title="Sửa danh mục">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEditCategory(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Xoá danh mục?"
            description="Tất cả câu hỏi trong danh mục sẽ bị xoá. Bạn có chắc chắn không?"
            onConfirm={() => handleDeleteCategory(record.id)}
            okText="Xoá"
            cancelText="Huỷ"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Xoá danh mục">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const questionColumns: ColumnsType<Question> = [
    {
      title: "STT",
      width: 55,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: "Câu hỏi (VI)",
      dataIndex: "question_vi",
      key: "question_vi",
      ellipsis: true,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: "Câu hỏi (EN)",
      dataIndex: "question_en",
      key: "question_en",
      ellipsis: true,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: "Câu hỏi (ZH)",
      dataIndex: "question_zh",
      key: "question_zh",
      ellipsis: true,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: "Loại câu hỏi",
      dataIndex: "type",
      key: "type",
      width: 200,
      render: (type: Question["type"]) => {
        const info = QUESTION_TYPE_LABELS[type];
        return <Tag color={info?.color}>{info?.label ?? type}</Tag>;
      },
    },
    {
      title: "Độ khó",
      dataIndex: "difficulty",
      key: "difficulty",
      width: 120,
      render: (diff: Question["difficulty"]) => {
        const info = DIFFICULTY_LABELS[diff];
        return <Tag color={info?.color}>{info?.label ?? diff}</Tag>;
      },
    },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <QuestionCircleOutlined style={{ fontSize: 28, color: "#1677ff" }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                Ngân hàng câu hỏi
              </Title>
              <Text type="secondary">Quản lý danh mục và câu hỏi theo học viện</Text>
            </div>
          </div>
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
              Tải template Excel
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreateCategory}
            >
              Tạo danh mục
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchCategories} loading={loading} />
          </Space>
        </div>
      </div>

      {/* Filter Bar */}
      <Card size="small" className="rounded-2xl border border-slate-200/50 shadow-sm">
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={10} md={8}>
            <Select
              allowClear
              showSearch
              placeholder="Lọc theo học viện"
              style={{ width: "100%" }}
              value={filterAcademy}
              onChange={(val) => setFilterAcademy(val)}
              optionFilterProp="label"
              options={academies.map((a) => ({
                value: a.id,
                label: a.name_vi || a.code,
              }))}
            />
          </Col>
          <Col xs={24} sm={14} md={10}>
            <Search
              placeholder="Tìm theo tên danh mục..."
              allowClear
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              onSearch={fetchCategories}
              prefix={<SearchOutlined />}
            />
          </Col>
        </Row>
      </Card>

      {/* Category Table */}
      <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
        <Table
          rowKey="id"
          dataSource={categories}
          columns={categoryColumns}
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          locale={{ emptyText: "Chưa có danh mục câu hỏi nào" }}
          scroll={{ x: 900 }}
        />
      </div>

{/* ─── Category Create/Edit Modal ─────────────────────────────────────── */}
      <Modal
        open={categoryModalVisible}
        afterOpenChange={(open) => {
          if (open) {
            categoryForm.resetFields();
          }
        }}
        title={
          <Space>
            <FolderOutlined />
            {editingCategory ? "Chỉnh sửa danh mục câu hỏi" : "Tạo danh mục câu hỏi mới"}
          </Space>
        }
        onCancel={() => setCategoryModalVisible(false)}
        onOk={() => categoryForm.submit()}
        confirmLoading={savingCategory}
        okText={editingCategory ? "Lưu" : "Tạo"}
        cancelText="Huỷ"
        width={580}
        destroyOnHidden
      >
        <Form
          form={categoryForm}
          name="categoryForm"
          layout="vertical"
          onFinish={handleSaveCategory}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="academyId"
            label="Học viện"
            rules={[{ required: true, message: "Vui lòng chọn học viện" }]}
          >
            <Select
              placeholder="Chọn học viện"
              showSearch
              optionFilterProp="label"
              options={academies.map((a) => ({
                value: a.id,
                label: a.name_vi || a.code,
              }))}
              disabled={!!editingCategory}
            />
          </Form.Item>

          <Form.Item
            name="name_vi"
            label="Tên danh mục (Tiếng Việt)"
            rules={[{ required: true, message: "Vui lòng nhập tên danh mục tiếng Việt" }]}
          >
            <Input placeholder="Ví dụ: An toàn lao động" />
          </Form.Item>

          <Form.Item name="name_en" label="Tên danh mục (Tiếng Anh)">
            <Input placeholder="e.g. Labor Safety" />
          </Form.Item>

          <Form.Item name="name_zh" label="Tên danh mục (Tiếng Trung)">
            <Input placeholder="例：劳动安全" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả ngắn về danh mục..." />
          </Form.Item>
        </Form>
      </Modal>

{/* ─── Questions View Modal ───────────────────────────────────────────── */}
      <Modal
        open={questionsModalVisible}
        title={
          <Space>
            <QuestionCircleOutlined />
            {selectedCategory
              ? `Câu hỏi trong: ${selectedCategory.name_vi || "—"}`
              : "Câu hỏi"}
          </Space>
        }
        onCancel={() => setQuestionsModalVisible(false)}
        footer={
          <Space>
            {selectedCategory && (
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => {
                  setQuestionsModalVisible(false);
                  handleOpenUpload(selectedCategory);
                }}
              >
                Upload câu hỏi
              </Button>
            )}
            <Button onClick={() => setQuestionsModalVisible(false)}>Đóng</Button>
          </Space>
        }
        width={1000}
        destroyOnHidden
      >
        <Table
          rowKey="id"
          dataSource={questions}
          columns={questionColumns}
          loading={questionsLoading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: "Danh mục này chưa có câu hỏi nào. Hãy upload file Excel." }}
          scroll={{ x: 800 }}
          size="small"
        />
      </Modal>

{/* ─── Upload Questions Modal ─────────────────────────────────────────── */}
      <Modal
        open={uploadModalVisible}
        title={
          <Space>
            <FileExcelOutlined style={{ color: "#217346" }} />
            Upload câu hỏi từ Excel
          </Space>
        }
        onCancel={() => setUploadModalVisible(false)}
        onOk={handleUpload}
        confirmLoading={uploading}
        okText="Upload"
        cancelText="Huỷ"
        width={520}
        destroyOnHidden
      >
        <div style={{ marginTop: 16 }}>
          {selectedCategory && (
            <div
              style={{
                background: "#f0f5ff",
                border: "1px solid #adc6ff",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 16,
              }}
            >
              <Text strong>Danh mục: </Text>
              <Text>{selectedCategory.name_vi || "—"}</Text>
              {selectedCategory.academy && (
                <>
                  <br />
                  <Text strong>Học viện: </Text>
                  <Text>{selectedCategory.academy.name_vi || selectedCategory.academy.code}</Text>
                </>
              )}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">
              Vui lòng tải{" "}
              <Button type="link" size="small" style={{ padding: 0 }} onClick={handleDownloadTemplate}>
                template Excel
              </Button>{" "}
              trước, điền câu hỏi rồi upload lên.
            </Text>
          </div>

          <Divider style={{ margin: "12px 0" }} />

          <div
            style={{
              background: "#fffbe6",
              border: "1px solid #ffe58f",
              borderRadius: 8,
              padding: "8px 12px",
              marginBottom: 16,
              fontSize: 12,
            }}
          >
            <Text strong>Loại câu hỏi hỗ trợ:</Text>
            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
              <li>FILL_BLANK – Điền câu từ</li>
              <li>SINGLE_CHOICE – Trắc nghiệm 1 lựa chọn</li>
              <li>MULTIPLE_CHOICE – Trắc nghiệm nhiều lựa chọn</li>
              <li>TRUE_FALSE – Chọn đúng/sai</li>
            </ul>
            <Text strong>Độ khó:</Text> EASY | MEDIUM | HARD
          </div>

          <Upload
            accept=".xlsx,.xls"
            maxCount={1}
            beforeUpload={(file) => {
              setUploadFile(file);
              return false; // prevent auto-upload
            }}
            onRemove={() => setUploadFile(null)}
          >
            <Button icon={<UploadOutlined />} block>
              Chọn file Excel
            </Button>
          </Upload>

          {uploadFile && (
            <div style={{ marginTop: 8 }}>
              <Tag color="green" icon={<FileExcelOutlined />}>
                {uploadFile.name}
              </Tag>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
