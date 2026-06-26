import { useState, useEffect } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Space,
  Typography,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import {
  getCourseTags,
  createCourseTag,
  updateCourseTag,
  deleteCourseTag,
  type CourseTag,
} from "../../services/course";

const { Title, Text } = Typography;

export default function CourseTagManagement() {
  const { t } = useTranslation();
  const [tags, setTags] = useState<CourseTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<CourseTag | null>(null);
  const [form] = Form.useForm();

  // Fetch tags
  const fetchTags = async () => {
    setLoading(true);
    try {
      const data = await getCourseTags();
      setTags(data);
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Failed to load course tags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  // Handle add new tag
  const handleAdd = () => {
    setEditingTag(null);
    form.resetFields();
    setModalVisible(true);
  };

  // Handle edit tag
  const handleEdit = (record: CourseTag) => {
    setEditingTag(record);
    form.setFieldsValue({
      name_vi: record.name_vi,
      name_en: record.name_en,
      name_zh: record.name_zh,
    });
    setModalVisible(true);
  };

  // Handle delete tag
  const handleDelete = async (id: number) => {
    try {
      await deleteCourseTag(id);
      message.success(t("courseTag.deleteSuccess") || "Course tag deleted successfully");
      fetchTags();
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Failed to delete course tag");
    }
  };

  // Handle form submit
  const handleSubmit = async (values: any) => {
    try {
      if (editingTag) {
        await updateCourseTag(editingTag.id, values);
        message.success(t("courseTag.updateSuccess") || "Course tag updated successfully");
      } else {
        await createCourseTag(values);
        message.success(t("courseTag.createSuccess") || "Course tag created successfully");
      }
      setModalVisible(false);
      fetchTags();
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Operation failed");
    }
  };

  // Table columns
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 60,
    },
    {
      title: t("courseTag.nameVi") || "Tên (Tiếng Việt)",
      dataIndex: "name_vi",
      key: "name_vi",
      render: (text: string) => (
        <span className="font-medium text-slate-800">{text}</span>
      ),
    },
    {
      title: t("courseTag.nameEn") || "Tên (English)",
      dataIndex: "name_en",
      key: "name_en",
      render: (text: string | null) => text || <Text type="secondary">-</Text>,
    },
    {
      title: t("courseTag.nameZh") || "Tên (中文)",
      dataIndex: "name_zh",
      key: "name_zh",
      render: (text: string | null) => text || <Text type="secondary">-</Text>,
    },
    {
      title: t("courseTag.createdAt") || "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (text: string) => (
        <Text type="secondary" className="text-xs">
          {new Date(text).toLocaleDateString("vi-VN")}
        </Text>
      ),
    },
    {
      title: t("common.actions") || "Thao tác",
      key: "actions",
      width: 100,
      render: (_: any, record: CourseTag) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="text-blue-600 hover:text-blue-700"
          />
          <Popconfirm
            title={t("courseTag.confirmDelete") || "Are you sure you want to delete this tag?"}
            onConfirm={() => handleDelete(record.id)}
            okText={t("common.yes") || "Yes"}
            cancelText={t("common.no") || "No"}
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
          <Title level={3} className="!mb-0">
            {t("courseTag.management") || "Quản lý Thẻ khóa học"}
          </Title>
          <Text type="secondary" className="text-slate-500">
            {t("courseTag.subtitle") ||
              "Thêm, sửa, xóa thẻ để phân loại khóa học."}
          </Text>
        </div>
        <div className="flex gap-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchTags}
            loading={loading}
          >
            {t("common.refresh") || "Làm mới"}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {t("courseTag.add") || "Thêm thẻ mới"}
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm overflow-x-auto">
        <Table
          columns={columns}
          dataSource={tags}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 600 }}
          size="small"
        />
      </div>

      {/* Add/Edit Modal */}
      <Modal
        title={editingTag ? t("courseTag.edit") : t("courseTag.addNew")}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={Math.min(500, window.innerWidth - 32)}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="mt-4"
        >
          <Form.Item
            name="name_vi"
            label={t("courseTag.nameVi") || "Tên thẻ (Tiếng Việt)"}
            rules={[
              {
                required: true,
                message:
                  t("common.requiredField") || "Vui lòng nhập trường này!",
              },
            ]}
          >
            <Input placeholder="Ví dụ: Lập trình" />
          </Form.Item>

          <Form.Item
            name="name_en"
            label={t("courseTag.nameEn") || "Tên thẻ (English)"}
          >
            <Input placeholder="Example: Programming" />
          </Form.Item>

          <Form.Item
            name="name_zh"
            label={t("courseTag.nameZh") || "Tên thẻ (中文)"}
          >
            <Input placeholder="例如: 编程" />
          </Form.Item>

          <Form.Item className="mb-0 flex justify-end gap-2">
            <Button onClick={() => setModalVisible(false)}>
              {t("common.cancel") || "Hủy"}
            </Button>
            <Button type="primary" htmlType="submit" className="bg-blue-600 hover:bg-blue-700">
              {t("common.save") || "Lưu lại"}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
