import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  Tree,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Popconfirm,
  message,
  Typography,
  Spin,
  Row,
  Col,
  Table,
  Empty,
  Divider,
} from "antd";
import type { Key } from "antd/lib/table/interface";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  BookOutlined,
} from "@ant-design/icons";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCoursesByCategory,
  addCourseToCategory,
  removeCourseFromCategory,
  type CourseCategory,
  type CreateCategoryPayload,
  type UpdateCategoryPayload,
} from "../../services/category";
import { authGet } from "../../services/auth";
import { getCoursesByAcademy } from "../../services/course";

const { Title, Text } = Typography;

// Type for Academy
interface Academy {
  id: number;
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  code: string;
  description?: string;
  isPublic: boolean;
}

// Tree node type
interface TreeNode {
  key: number;
  title: React.ReactNode;
  children?: TreeNode[];
  data: CourseCategory;
}

export default function CourseCategoryManagement() {
  const { t, i18n } = useTranslation();
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CourseCategory | null>(null);
  const [createParentCategory, setCreateParentCategory] = useState<CourseCategory | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CourseCategory | null>(null);
  const [selectedAcademyId, setSelectedAcademyId] = useState<number | null>(null);
  const [categoryCourses, setCategoryCourses] = useState<any[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [form] = Form.useForm();

  const lang = i18n.language;

  // Get name based on current language
  const getName = (item: any) => {
    const zh = item?.name_zh || item?.title_zh;
    const en = item?.name_en || item?.title_en;
    const vi = item?.name_vi || item?.title_vi;

    if (lang === "zh") return zh || vi || en || "-";
    if (lang === "en") return en || vi || zh || "-";
    return vi || en || zh || "-";
  };

  // Fetch academies on mount
  useEffect(() => {
    fetchAcademies();
  }, []);

  // Fetch categories when academy changes
  useEffect(() => {
    if (selectedAcademyId) {
      fetchCategories(selectedAcademyId);
      loadCourses(selectedAcademyId);
    } else {
      setCategories([]);
      setCourses([]);
      setSelectedCategory(null);
      setCategoryCourses([]);
    }
  }, [selectedAcademyId]);

  const fetchAcademies = async () => {
    try {
      const response = await authGet.getAcademies();
      const data = response.data.academies;
      setAcademies(data);
      if (data.length > 0 && !selectedAcademyId) {
        setSelectedAcademyId(data[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch academies:", error);
    }
  };

  const fetchCategories = async (academyId: number) => {
    setLoading(true);
    try {
      const data = await getCategories({ academyId });
      setCategories(data);
      setExpandedKeys(data.map((category) => category.id));

      if (selectedCategory) {
        const refreshedCategory = data.find((category) => category.id === selectedCategory.id) || null;
        setSelectedCategory(refreshedCategory);
        if (!refreshedCategory) {
          setCategoryCourses([]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      message.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async (academyId: number) => {
    try {
      const data = await getCoursesByAcademy(academyId);
      setCourses(data);
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    }
  };

  const fetchCategoryCourses = async (categoryId: number) => {
    try {
      const data = await getCoursesByCategory(categoryId);
      setCategoryCourses(data);
    } catch (error) {
      console.error("Failed to fetch category courses:", error);
    }
  };

  // Build tree data
  const treeData = useMemo(() => {
    const buildNodes = (parentId: number | null): TreeNode[] => {
      return categories
        .filter((c) => c.parentId === parentId)
        .map((cat) => ({
          key: cat.id,
          title: (
            <div className="tree-node-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <Space className="tree-node-left" title={getName(cat)}>
                {cat.children && cat.children.length > 0 ? <FolderOpenOutlined /> : <FolderOutlined />}
                <span className="tree-node-name">{getName(cat)}</span>
                <Tag color="blue">{cat.code}</Tag>
              </Space>
              <Space className="tree-node-actions" size="small" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => handleAddSubCategory(cat)}
                  title={t("common.addSubCategory")}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<BookOutlined />}
                  onClick={() => handleViewCourses(cat)}
                  title={t("menu.courses")}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(cat)}
                  title={t("common.edit")}
                />
                <Popconfirm
                  title={t("common.confirmDelete")}
                  onConfirm={() => handleDelete(cat.id)}
                >
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            </div>
          ),
          data: cat,
          children: cat._count && cat._count.children > 0 ? buildNodes(cat.id) : undefined,
        }));
    };

    return buildNodes(null);
  }, [categories, lang]);

  const handleAddSubCategory = (parent: CourseCategory) => {
    if (!selectedAcademyId) {
      message.warning(t("common.selectAcademyFirst"));
      return;
    }

    setEditingCategory(null);
    setCreateParentCategory(parent);
    form.resetFields();
    form.setFieldsValue({ parentId: parent.id });
    setModalVisible(true);
  };

  const handleViewCourses = (category: CourseCategory) => {
    setSelectedCategory(category);
    fetchCategoryCourses(category.id);
  };

  const handleEdit = (category: CourseCategory) => {
    setEditingCategory(category);
    setCreateParentCategory(null);
    form.setFieldsValue({
      name_vi: category.name_vi,
      name_en: category.name_en,
      name_zh: category.name_zh,
      code: category.code,
      description: category.description,
      parentId: category.parentId ?? null,
    });
    setModalVisible(true);
  };

  const handleCreate = () => {
    if (!selectedAcademyId) {
      message.warning(t("common.selectAcademyFirst"));
      return;
    }

    setEditingCategory(null);
    setCreateParentCategory(null);
    form.resetFields();
    form.setFieldsValue({ parentId: null });
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingCategory(null);
    setCreateParentCategory(null);
    form.resetFields();
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCategory(id);
      message.success(t("common.success"));
      if (selectedCategory?.id === id) {
        setSelectedCategory(null);
        setCategoryCourses([]);
      }
      if (selectedAcademyId) {
        fetchCategories(selectedAcademyId);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t("common.error"));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: CreateCategoryPayload | UpdateCategoryPayload = {
        name_vi: values.name_vi,
        name_en: values.name_en,
        name_zh: values.name_zh,
        code: values.code,
        description: values.description,
        parentId: values.parentId ?? null,
        academyId: selectedAcademyId!,
      };

      if (editingCategory) {
        await updateCategory(editingCategory.id, payload);
        message.success(t("common.success"));
      } else {
        await createCategory(payload as CreateCategoryPayload);
        message.success(t("common.success"));
      }

      handleCloseModal();
      if (selectedAcademyId) {
        fetchCategories(selectedAcademyId);
      }
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error.response?.data?.message || t("common.error"));
    }
  };

  const handleAddCourse = async (courseId: number) => {
    if (!selectedCategory) return;
    try {
      await addCourseToCategory(selectedCategory.id, courseId);
      message.success(t("common.success"));
      fetchCategoryCourses(selectedCategory.id);
      if (selectedAcademyId) {
        fetchCategories(selectedAcademyId);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t("common.error"));
    }
  };

  const handleRemoveCourse = async (courseId: number) => {
    if (!selectedCategory) return;
    try {
      await removeCourseFromCategory(selectedCategory.id, courseId);
      message.success(t("common.success"));
      fetchCategoryCourses(selectedCategory.id);
      if (selectedAcademyId) {
        fetchCategories(selectedAcademyId);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || t("common.error"));
    }
  };

  const excludedParentIds = useMemo(() => {
    if (!editingCategory) {
      return new Set<number>();
    }

    const excluded = new Set<number>([editingCategory.id]);
    let hasNewDescendant = true;

    while (hasNewDescendant) {
      hasNewDescendant = false;
      categories.forEach((category) => {
        if (category.parentId && excluded.has(category.parentId) && !excluded.has(category.id)) {
          excluded.add(category.id);
          hasNewDescendant = true;
        }
      });
    }

    return excluded;
  }, [categories, editingCategory]);

  // Parent category options in hierarchical order with indentation
  const parentOptions = useMemo(() => {
    const availableCategories = categories.filter((category) => !excludedParentIds.has(category.id));
    const options: Array<{ value: number; label: React.ReactNode; plainLabel: string }> = [];

    const walkTree = (parentId: number | null, depth: number) => {
      const siblings = availableCategories
        .filter((category) => category.parentId === parentId)
        .sort((a, b) => getName(a).localeCompare(getName(b)));

      siblings.forEach((category) => {
        const name = getName(category);
        const prefix = depth > 0 ? `${"\u00A0\u00A0".repeat(depth)}${"- ".repeat(depth)}` : "";
        options.push({
          value: category.id,
          plainLabel: name,
          label: (
            <span className="parent-option-label" title={name}>
              <span className="parent-option-prefix">{prefix}</span>
              <span className="parent-option-name">{name}</span>
            </span>
          ),
        });

        walkTree(category.id, depth + 1);
      });
    };

    walkTree(null, 0);

    // Safety fallback for any orphan category that was not visited
    availableCategories.forEach((category) => {
      if (!options.some((option) => option.value === category.id)) {
        options.push({ value: category.id, label: getName(category), plainLabel: getName(category) });
      }
    });

    return options;
  }, [categories, excludedParentIds, lang]);

  // Available courses (not in selected category)
  const availableCourses = useMemo(() => {
    return courses.filter(
      (course) => !categoryCourses.find((c) => c.id === course.id)
    );
  }, [courses, categoryCourses]);

  // Course table columns
  const courseColumns = [
    {
      title: t("common.name"),
      key: "title",
      render: (_: any, record: any) => getName(record),
    },
    {
      title: t("common.action"),
      key: "action",
      width: 100,
      render: (_: any, record: any) => (
        <Popconfirm
          title={t("common.confirmRemove")}
          onConfirm={() => handleRemoveCourse(record.id)}
        >
          <Button type="link" danger size="small">
            {t("common.remove")}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Card>
        {/* Header with Academy Selection */}
        <div style={{ marginBottom: 24 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={4} style={{ margin: 0 }}>
                <FolderOutlined /> {t("menu.coursesCategory")}
              </Title>
            </Col>
            <Col>
              <Space>
                <Select
                  placeholder={t("menu.academies")}
                  value={selectedAcademyId}
                  onChange={setSelectedAcademyId}
                  style={{ width: 220 }}
                  disabled={loading}
                >
                  {academies.map((academy) => (
                    <Select.Option key={academy.id} value={academy.id}>
                      {getName(academy)}
                    </Select.Option>
                  ))}
                </Select>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreate}
                  disabled={!selectedAcademyId}
                >
                  {t("common.addCategory")}
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Main Content - Split View */}
        <Row gutter={16}>
          {/* Left Panel - Category Tree */}
          <Col xs={24} lg={10}>
<Card
              type="inner"
              title={
                <Space>
                  <FolderOutlined />
                  {t("common.categories")}
                  <Tag color="default">{categories.length}</Tag>
                </Space>
              }
              styles={{ body: { padding: 0, maxHeight: "calc(100vh - 320px)", overflow: "auto" } }}
            >
              {loading ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <Spin />
                </div>
              ) : treeData.length > 0 ? (
                <Tree
                  showIcon
                  blockNode
                  expandedKeys={expandedKeys}
                  onExpand={setExpandedKeys}
                  onSelect={(_, info) => {
                    const category = (info.node as TreeNode).data;
                    if (category) {
                      handleViewCourses(category);
                    }
                  }}
                  treeData={treeData}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t("common.noData")}
                />
              )}
            </Card>
          </Col>

          {/* Right Panel - Category Details */}
          <Col xs={24} lg={14}>
            {selectedCategory ? (
              <Card
                type="inner"
                title={
                  <Space>
                    <FolderOutlined />
                    {getName(selectedCategory)}
                    <Tag color="blue">{selectedCategory.code}</Tag>
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(selectedCategory)}
                    >
                      {t("common.edit")}
                    </Button>
                  </Space>
                }
              >
                {/* Category Info */}
                <div style={{ marginBottom: 24 }}>
                  {selectedCategory.description && (
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary">{t("common.description")}: </Text>
                      <Text>{selectedCategory.description}</Text>
                    </div>
                  )}
                  <Space>
                    <Tag color="green">
                      {selectedCategory._count?.courses || 0} {t("menu.courses")}
                    </Tag>
                    <Tag color="orange">
                      {selectedCategory._count?.children || 0} {t("common.subCategories")}
                    </Tag>
                  </Space>
                </div>

                <Divider>{t("common.coursesInCategory")}</Divider>

                {/* Courses in Category */}
                {categoryCourses.length > 0 ? (
                  <Table
                    dataSource={categoryCourses}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    columns={courseColumns}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t("common.noData")}
                  />
                )}

                {/* Add Course Form */}
                <div style={{ marginTop: 16 }}>
                  <Text strong>{t("common.addCourse")}</Text>
                  <Space style={{ marginTop: 8 }}>
                    <Select
                      placeholder={t("common.selectCourse")}
                      style={{ width: 300 }}
                      onChange={(value) => {
                        if (value) {
                          handleAddCourse(value);
                        }
                      }}
                      value={undefined}
                    >
                      {availableCourses.map((course) => (
                        <Select.Option key={course.id} value={course.id}>
                          {getName(course)}
                        </Select.Option>
                      ))}
                    </Select>
                  </Space>
                </div>
              </Card>
            ) : (
              <Card type="inner">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Text type="secondary">
                      {t("common.selectCategoryToView")}
                    </Text>
                  }
                />
              </Card>
            )}
          </Col>
        </Row>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={
          editingCategory
            ? editingCategory.parentId
              ? t("common.editSubCategory")
              : t("common.editCategory")
            : createParentCategory
              ? t("common.addSubCategory")
            : t("common.addCategory")
        }
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={handleCloseModal}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name_vi"
            label={t("common.name") + " (VN)"}
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="name_en" label={t("common.name") + " (EN)"}>
            <Input />
          </Form.Item>
          <Form.Item name="name_zh" label={t("common.name") + " (CN)"}>
            <Input />
          </Form.Item>
          <Form.Item
            name="code"
            label={t("common.code")}
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t("common.description")}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="parentId" label={t("common.parentCategory")}>
            <Select
              placeholder={t("common.selectParent")}
              allowClear
              optionLabelProp="title"
            >
              {parentOptions.map((option) => (
                <Select.Option key={option.value} value={option.value} title={option.plainLabel}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .tree-node-title {
          padding: 4px 0;
          gap: 8px;
        }

        .tree-node-left {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        .tree-node-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: inline-block;
          max-width: 280px;
          vertical-align: bottom;
        }

        .tree-node-actions {
          flex-shrink: 0;
          white-space: nowrap;
        }

        .parent-option-label {
          display: flex;
          align-items: center;
          min-width: 0;
          width: 100%;
        }

        .parent-option-prefix {
          flex-shrink: 0;
          color: #94a3b8;
        }

        .parent-option-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: inline-block;
          min-width: 0;
        }

        .ant-select-item-option-content {
          overflow: hidden;
        }

        .tree-node-title .ant-space-item {
          min-width: 0;
        }

        .ant-tree-node-content-wrapper {
          padding: 4px 8px !important;
        }
      `}</style>
    </div>
  );
}
