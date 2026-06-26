import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  EyeOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SearchOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { authGet } from "../../services/auth/auth.get";

const { Title, Text } = Typography;
const { Search } = Input;

interface Academy {
  id: number;
  name_vi?: string | null;
  code: string;
}

interface QuestionOption {
  id: number;
  option_vi?: string | null;
  option_en?: string | null;
  option_zh?: string | null;
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

interface QuestionCategory {
  id: number;
  name_vi?: string | null;
  name_en?: string | null;
  name_zh?: string | null;
  academyId: number;
  academy?: Academy;
  _count?: { questions: number };
}

interface ExamPaper {
  id: string;
  categoryId: number;
  paperName: string;
  academyName: string;
  questionCount: number;
}

const QUESTION_TYPE_MAP: Record<string, { label: string; color: string }> = {
  FILL_BLANK: { label: "Điền câu từ", color: "blue" },
  SINGLE_CHOICE: { label: "Trắc nghiệm 1 lựa chọn", color: "green" },
  MULTIPLE_CHOICE: { label: "Trắc nghiệm nhiều lựa chọn", color: "purple" },
  TRUE_FALSE: { label: "Đúng / Sai", color: "orange" },
};

const DIFFICULTY_MAP: Record<string, { label: string; color: string }> = {
  EASY: { label: "Dễ", color: "success" },
  MEDIUM: { label: "Trung bình", color: "warning" },
  HARD: { label: "Khó", color: "error" },
};

const normalizeCorrectAnswer = (value: Question["correctAnswer"]) => {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
};

export default function ExamPaperManagement() {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const [academyFilter, setAcademyFilter] = useState<number | undefined>(undefined);
  const [nameFilter, setNameFilter] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<ExamPaper | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);

  const fetchAcademies = useCallback(async () => {
    try {
      const res = await authGet.getAcademies();
      setAcademies(res.data?.academies ?? res.data ?? []);
    } catch {
      message.error("Không thể tải danh sách học viện");
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authGet.getQuestionCategories(academyFilter, nameFilter || undefined);
      setCategories(res.data?.categories ?? []);
    } catch {
      message.error("Không thể tải danh mục câu hỏi để tạo đề thi");
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [academyFilter, nameFilter]);

  useEffect(() => {
    fetchAcademies();
  }, [fetchAcademies]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const papers = useMemo<ExamPaper[]>(() => {
    return categories.map((category) => ({
      id: `PAPER-${category.id}`,
      categoryId: category.id,
      paperName:
        category.name_vi ||
        category.name_en ||
        category.name_zh ||
        `Đề thi danh mục #${category.id}`,
      academyName: category.academy?.name_vi || category.academy?.code || "-",
      questionCount: category._count?.questions || 0,
    }));
  }, [categories]);

  const openPaperDrawer = async (paper: ExamPaper) => {
    setSelectedPaper(paper);
    setDrawerOpen(true);
    setDrawerLoading(true);

    try {
      const res = await authGet.getQuestions(paper.categoryId);
      setSelectedQuestions(res.data?.questions ?? []);
    } catch {
      message.error("Không thể tải chi tiết đề thi");
      setSelectedQuestions([]);
    } finally {
      setDrawerLoading(false);
    }
  };

  const paperColumns: ColumnsType<ExamPaper> = [
    {
      title: "Mã đề",
      dataIndex: "id",
      key: "id",
      width: 140,
      render: (value) => <Text code>{value}</Text>,
    },
    {
      title: "Tên đề thi (tự tạo từ danh mục)",
      dataIndex: "paperName",
      key: "paperName",
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: "Học viện",
      dataIndex: "academyName",
      key: "academyName",
      width: 220,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: "Số câu hỏi",
      dataIndex: "questionCount",
      key: "questionCount",
      width: 130,
      align: "center",
      render: (count: number) => (
        <Badge
          count={count}
          showZero
          style={{ backgroundColor: count > 0 ? "#1677ff" : "#bfbfbf" }}
        />
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 130,
      align: "center",
      render: (_, record) => (
        <Tooltip title="Xem chi tiết đề thi">
          <Button
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => openPaperDrawer(record)}
            disabled={record.questionCount === 0}
          >
            Xem
          </Button>
        </Tooltip>
      ),
    },
  ];

  const questionColumns: ColumnsType<Question> = [
    {
      title: "#",
      width: 60,
      align: "center",
      render: (_, __, index) => index + 1,
    },
    {
      title: "Câu hỏi",
      dataIndex: "question_vi",
      key: "question_vi",
      render: (_, record) => (
        <div>
          <div>{record.question_vi || "-"}</div>
          {record.question_en ? <Text type="secondary">EN: {record.question_en}</Text> : null}
          {record.question_zh ? <div><Text type="secondary">ZH: {record.question_zh}</Text></div> : null}
        </div>
      ),
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      width: 220,
      render: (type: Question["type"]) => {
        const mapped = QUESTION_TYPE_MAP[type];
        return <Tag color={mapped?.color}>{mapped?.label || type}</Tag>;
      },
    },
    {
      title: "Độ khó",
      dataIndex: "difficulty",
      key: "difficulty",
      width: 120,
      render: (difficulty: Question["difficulty"]) => {
        const mapped = DIFFICULTY_MAP[difficulty];
        return <Tag color={mapped?.color}>{mapped?.label || difficulty}</Tag>;
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
            <FileTextOutlined style={{ fontSize: 28, color: "#1677ff" }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                Quản lý đề thi
              </Title>
              <Text type="secondary">
                Đề thi được tạo tự động từ danh mục câu hỏi đã có
              </Text>
            </div>
          </div>
          <Button icon={<ReloadOutlined />} onClick={fetchCategories} loading={loading}>
            Làm mới
          </Button>
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
            <Search
              allowClear
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              onSearch={fetchCategories}
              placeholder="Tìm theo tên danh mục / đề thi..."
              prefix={<SearchOutlined />}
            />
          </Col>
        </Row>
      </Card>

      <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={papers}
          columns={paperColumns}
          pagination={{ pageSize: 12, showSizeChanger: true }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có danh mục câu hỏi. Vui lòng tạo và upload câu hỏi ở trang Ngân hàng câu hỏi."
              />
            ),
          }}
          scroll={{ x: 980 }}
        />
      </div>

      <Drawer
        title={
          <Space>
            <FileSearchOutlined />
            <span>
              {selectedPaper?.paperName || "Chi tiết đề thi"}
            </span>
          </Space>
        }
        width={1100}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedQuestions([]);
        }}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Card size="small">
            <Space size={20} wrap>
              <div>
                <Text type="secondary">Mã đề</Text>
                <div><Text code>{selectedPaper?.id || "-"}</Text></div>
              </div>
              <div>
                <Text type="secondary">Tổng số câu</Text>
                <div>
                  <Badge
                    count={selectedQuestions.length}
                    showZero
                    style={{ backgroundColor: selectedQuestions.length > 0 ? "#1677ff" : "#bfbfbf" }}
                  />
                </div>
              </div>
              <div>
                <Text type="secondary">Học viện</Text>
                <div><Tag color="blue">{selectedPaper?.academyName || "-"}</Tag></div>
              </div>
            </Space>
          </Card>

          <Table
            rowKey="id"
            loading={drawerLoading}
            dataSource={selectedQuestions}
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
              emptyText: "Đề thi này chưa có câu hỏi. Hãy upload câu hỏi vào danh mục tương ứng.",
            }}
          />
        </Space>
      </Drawer>
    </div>
  );
}
