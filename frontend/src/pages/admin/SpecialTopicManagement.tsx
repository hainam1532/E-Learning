import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { DeleteOutlined, EditOutlined, HolderOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { authGet } from "../../services/auth";
import {
  createSpecialTopic,
  deleteSpecialTopic,
  getCoursesByAcademy,
  getCoursesBySpecialTopic,
  getSpecialTopics,
  reorderSpecialTopicCourses,
  reorderSpecialTopics,
  type Academy,
  type Course,
  type SpecialTopic,
  type SpecialTopicPayload,
  updateSpecialTopic,
} from "../../services/course";

const { Title, Text } = Typography;

interface TopicFormValues {
  academyId: number;
  page: string;
  name_vi: string;
  name_en?: string;
  name_zh?: string;
  courseIds?: number[];
}

export default function SpecialTopicManagement() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [topics, setTopics] = useState<SpecialTopic[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [academyFilter, setAcademyFilter] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [editingTopic, setEditingTopic] = useState<SpecialTopic | null>(null);
  const [courseOptions, setCourseOptions] = useState<Course[]>([]);
  const [sortCoursesModalOpen, setSortCoursesModalOpen] = useState(false);
  const [sortingTopic, setSortingTopic] = useState<SpecialTopic | null>(null);
  const [sortingCourses, setSortingCourses] = useState<Course[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draggingTopicId, setDraggingTopicId] = useState<number | null>(null);
  const [draggingCourseId, setDraggingCourseId] = useState<number | null>(null);
  const [form] = Form.useForm<TopicFormValues>();

  const language = i18n.language;

  const getLocalizedText = useCallback(
    (item: { name_vi?: string; name_en?: string; name_zh?: string }) => {
      if (language === "zh") return item.name_zh || item.name_vi || item.name_en || "-";
      if (language === "en") return item.name_en || item.name_vi || item.name_zh || "-";
      return item.name_vi || item.name_en || item.name_zh || "-";
    },
    [language]
  );

  const getCourseTitle = useCallback(
    (course: Course) => {
      if (language === "zh") return course.title_zh || course.title_vi || course.title_en || "-";
      if (language === "en") return course.title_en || course.title_vi || course.title_zh || "-";
      return course.title_vi || course.title_en || course.title_zh || "-";
    },
    [language]
  );

  const fetchAcademies = useCallback(async () => {
    try {
      const response = await authGet.getAcademies();
      const data = (response.data.academies || []) as Academy[];
      setAcademies(data);
      if (!academyFilter && data.length > 0) {
        setAcademyFilter(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load academies:", error);
      message.error(t("common.error"));
    }
  }, [academyFilter, t]);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSpecialTopics({
        academyId: academyFilter,
        page: "home",
        search: search || undefined,
      });
      setTopics(data);
    } catch (error) {
      console.error("Failed to load special topics:", error);
      message.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [academyFilter, search, t]);

  const loadCoursesByAcademy = useCallback(async (academyId: number) => {
    try {
      const data = await getCoursesByAcademy(academyId);
      setCourseOptions(data);
      return data;
    } catch (error) {
      console.error("Failed to load courses:", error);
      message.error(t("common.error"));
      setCourseOptions([]);
      return [];
    }
  }, [t]);

  useEffect(() => {
    fetchAcademies();
  }, [fetchAcademies]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingTopic(null);
    setCourseOptions([]);
    form.resetFields();
  };

  const moveItem = <T extends { id: number }>(list: T[], fromId: number, toId: number): T[] => {
    const fromIndex = list.findIndex((item) => item.id === fromId);
    const toIndex = list.findIndex((item) => item.id === toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return list;
    }

    const updated = [...list];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    return updated;
  };

  const handleDropTopic = async (targetTopicId: number) => {
    if (!draggingTopicId || draggingTopicId === targetTopicId) return;

    const updatedTopics = moveItem(topics, draggingTopicId, targetTopicId);
    setTopics(updatedTopics);
    setDraggingTopicId(null);

    try {
      await reorderSpecialTopics(updatedTopics.map((topic) => topic.id));
      message.success(t("common.success"));
      fetchTopics();
    } catch (error: any) {
      console.error("Failed to reorder topics:", error);
      message.error(error?.response?.data?.message || t("common.error"));
      fetchTopics();
    }
  };

  const openSortCoursesModal = async (topic: SpecialTopic) => {
    setSortingTopic(topic);
    setSortCoursesModalOpen(true);
    try {
      const courses = await getCoursesBySpecialTopic(topic.id);
      setSortingCourses(courses);
    } catch (error) {
      console.error("Failed to load topic courses:", error);
      message.error(t("common.error"));
      setSortingCourses([]);
    }
  };

  const closeSortCoursesModal = () => {
    setSortCoursesModalOpen(false);
    setSortingTopic(null);
    setSortingCourses([]);
    setDraggingCourseId(null);
  };

  const handleDropCourse = (targetCourseId: number) => {
    if (!draggingCourseId || draggingCourseId === targetCourseId) return;
    setSortingCourses((prev) => moveItem(prev, draggingCourseId, targetCourseId));
    setDraggingCourseId(null);
  };

  const handleSaveCourseOrder = async () => {
    if (!sortingTopic) return;
    setSavingOrder(true);
    try {
      await reorderSpecialTopicCourses(
        sortingTopic.id,
        sortingCourses.map((course) => course.id)
      );
      message.success(t("common.success"));
      closeSortCoursesModal();
      fetchTopics();
    } catch (error: any) {
      console.error("Failed to reorder courses:", error);
      message.error(error?.response?.data?.message || t("common.error"));
    } finally {
      setSavingOrder(false);
    }
  };

  const handleCreate = async () => {
    setEditingTopic(null);
    const selectedAcademyId = academyFilter || academies[0]?.id;
    if (!selectedAcademyId) {
      message.warning(t("common.selectAcademyFirst"));
      return;
    }

    await loadCoursesByAcademy(selectedAcademyId);
    form.setFieldsValue({
      academyId: selectedAcademyId,
      page: "home",
      courseIds: [],
    });
    setModalOpen(true);
  };

  const handleEdit = async (topic: SpecialTopic) => {
    setEditingTopic(topic);
    await loadCoursesByAcademy(topic.academyId);

    let selectedCourseIds: number[] = [];
    try {
      const courses = await getCoursesBySpecialTopic(topic.id);
      selectedCourseIds = courses.map((course) => course.id);
    } catch (error) {
      console.error("Failed to load topic courses:", error);
      message.error(t("common.error"));
    }

    form.setFieldsValue({
      academyId: topic.academyId,
      page: topic.page || "home",
      name_vi: topic.name_vi,
      name_en: topic.name_en,
      name_zh: topic.name_zh,
      courseIds: selectedCourseIds,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSpecialTopic(id);
      message.success(t("common.success"));
      fetchTopics();
    } catch (error) {
      console.error("Failed to delete topic:", error);
      message.error(t("common.error"));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload: SpecialTopicPayload = {
        academyId: values.academyId,
        page: values.page || "home",
        name_vi: values.name_vi,
        name_en: values.name_en,
        name_zh: values.name_zh,
        courseIds: values.courseIds || [],
      };

      if (editingTopic) {
        await updateSpecialTopic(editingTopic.id, payload);
      } else {
        await createSpecialTopic(payload);
      }

      message.success(t("common.success"));
      closeModal();
      fetchTopics();
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error("Failed to save topic:", error);
      message.error(error?.response?.data?.message || t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const academyOptions = useMemo(
    () =>
      academies.map((academy) => ({
        label: getLocalizedText(academy),
        value: academy.id,
      })),
    [academies, getLocalizedText]
  );

  const courseSelectOptions = useMemo(
    () =>
      courseOptions.map((course) => ({
        label: getCourseTitle(course),
        value: course.id,
      })),
    [courseOptions, getCourseTitle]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <Title level={3} className="mb-0!">{t("menu.coursesSpecial")}</Title>
          <Text type="secondary">{t("common.search")} / {t("common.addCategory")}</Text>
        </div>

        <Space wrap>
          <Select
            value={academyFilter}
            onChange={setAcademyFilter}
            options={academyOptions}
            placeholder={t("menu.academies")}
            style={{ width: 220 }}
            allowClear
          />
          <Input.Search
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={fetchTopics}
            placeholder={t("common.search")}
            style={{ width: 240 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchTopics} loading={loading}>
            {t("common.refresh")}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t("common.addCategory")}
          </Button>
        </Space>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Text strong>{t("menu.coursesSpecial")} - Home Order</Text>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {topics.map((topic) => (
              <div
                key={`topic-order-${topic.id}`}
                draggable
                onDragStart={() => setDraggingTopicId(topic.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropTopic(topic.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 10px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: draggingTopicId === topic.id ? "#eff6ff" : "#fff",
                  cursor: "grab",
                }}
              >
                <Space>
                  <HolderOutlined style={{ color: "#64748b" }} />
                  <span>{getLocalizedText(topic)}</span>
                </Space>
                <Tag color="blue">#{topic.orderIndex || "-"}</Tag>
              </div>
            ))}
            {topics.length === 0 && <Text type="secondary">{t("common.noData")}</Text>}
          </div>
        </div>

        <Table
          loading={loading}
          rowKey="id"
          dataSource={topics}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "ID", dataIndex: "id", width: 70 },
            {
              title: "VN",
              dataIndex: "name_vi",
            },
            {
              title: "EN",
              dataIndex: "name_en",
              render: (value: string) => value || "-",
            },
            {
              title: "ZH",
              dataIndex: "name_zh",
              render: (value: string) => value || "-",
            },
            {
              title: t("menu.academies"),
              key: "academy",
              render: (_, record: SpecialTopic) => getLocalizedText(record.academy || {}),
            },
            {
              title: "Page",
              dataIndex: "page",
              width: 100,
              render: (value: string) => <Tag color="blue">{value}</Tag>,
            },
            {
              title: t("menu.courses"),
              key: "coursesCount",
              width: 120,
              render: (_, record: SpecialTopic) => record._count?.courses || 0,
            },
            {
              title: t("common.actions"),
              key: "actions",
              width: 180,
              render: (_, record: SpecialTopic) => (
                <Space>
                  <Button type="text" icon={<HolderOutlined />} onClick={() => openSortCoursesModal(record)} />
                  <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                  <Popconfirm title={t("common.confirmDelete")} onConfirm={() => handleDelete(record.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingTopic ? t("common.edit") : t("common.addCategory")}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={closeModal}
        okButtonProps={{ loading: submitting }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="academyId"
            label={t("menu.academies")}
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Select
              options={academyOptions}
              disabled={!!editingTopic}
              onChange={(value) => {
                if (value) {
                  loadCoursesByAcademy(value);
                  form.setFieldValue("courseIds", []);
                }
              }}
            />
          </Form.Item>

          <Form.Item name="page" label="Page" initialValue="home">
            <Select options={[{ label: t("common.home"), value: "home" }]} />
          </Form.Item>

          <Form.Item
            name="name_vi"
            label="Tên chủ đề (VN)"
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="name_en" label="Topic Name (EN)">
            <Input />
          </Form.Item>

          <Form.Item name="name_zh" label="主题名称 (ZH)">
            <Input />
          </Form.Item>

          <Form.Item name="courseIds" label={t("common.addCourse")}>
            <Select
              mode="multiple"
              options={courseSelectOptions}
              placeholder={t("common.selectCourse")}
              optionFilterProp="label"
              showSearch
              maxTagCount="responsive"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={sortingTopic ? `${t("menu.courses")} - ${getLocalizedText(sortingTopic)}` : t("menu.courses")}
        open={sortCoursesModalOpen}
        onCancel={closeSortCoursesModal}
        onOk={handleSaveCourseOrder}
        okButtonProps={{ loading: savingOrder }}
        width={720}
      >
        <Text type="secondary">Kéo thả để sắp xếp thứ tự hiển thị khóa học trong chủ đề.</Text>
        <div style={{ marginTop: 12, display: "grid", gap: 8, maxHeight: 420, overflowY: "auto" }}>
          {sortingCourses.map((course, index) => (
            <div
              key={`course-sort-${course.id}`}
              draggable
              onDragStart={() => setDraggingCourseId(course.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropCourse(course.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: draggingCourseId === course.id ? "#eff6ff" : "#fff",
                cursor: "grab",
              }}
            >
              <HolderOutlined style={{ color: "#64748b" }} />
              <Tag color="default" style={{ margin: 0 }}>#{index + 1}</Tag>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {getCourseTitle(course)}
              </span>
            </div>
          ))}
          {sortingCourses.length === 0 && <Text type="secondary">{t("common.noData")}</Text>}
        </div>
      </Modal>
    </div>
  );
}
