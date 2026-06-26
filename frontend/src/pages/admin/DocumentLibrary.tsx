import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Table,
  Button,
  Modal,
  Form,
  Upload,
  Input,
  message,
  Space,
  Tag,
  Popconfirm,
  Typography,
} from "antd";
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  getDocuments,
  deleteDocument,
  type Document,
} from "../../services/document";

const { Title } = Typography;

// Get icon based on document type
const getDocumentIcon = (type: string) => {
  switch (type) {
    case "xlsx":
      return <FileExcelOutlined style={{ color: "#217346", fontSize: 24 }} />;
    case "docx":
      return <FileWordOutlined style={{ color: "#2b579a", fontSize: 24 }} />;
    case "pdf":
      return <FilePdfOutlined style={{ color: "#d32f27", fontSize: 24 }} />;
    case "pptx":
      return <FilePptOutlined style={{ color: "#d24726", fontSize: 24 }} />;
    default:
      return <FileOutlined style={{ color: "#666", fontSize: 24 }} />;
  }
};

// Get display name for document type
const getDocumentTypeName = (type: string): string => {
  switch (type) {
    case "xlsx":
      return "Excel";
    case "docx":
      return "Word";
    case "pdf":
      return "PDF";
    case "pptx":
      return "PowerPoint";
    default:
      return type.toUpperCase();
  }
};

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

export default function DocumentLibrary() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [form] = Form.useForm();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const data = await getDocuments();
      setDocuments(data);
    } catch (error) {
      message.error(t("document.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    const file = form.getFieldValue("document")?.[0]?.originFileObj;
    const name = form.getFieldValue("name");

    if (!file) {
      message.error(t("document.pleaseSelectDocument"));
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const { uploadDocument } = await import("../../services/document");

      await uploadDocument({ document: file, name }, (progress) => {
        setUploadProgress(progress);
      });

      message.success(t("document.uploadSuccess"));
      setUploadModalVisible(false);
      form.resetFields();
      fetchDocuments();
    } catch (error) {
      message.error(t("document.uploadFailed"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDocument(id);
      message.success(t("document.deletedSuccess"));
      fetchDocuments();
    } catch (error) {
      message.error(t("document.deleteFailed"));
    }
  };

  const handleDownload = (doc: Document) => {
    window.open(doc.url, "_blank");
  };

  const columns: ColumnsType<Document> = [
    {
      title: t("document.type"),
      key: "type",
      width: 80,
      render: (_, record) => getDocumentIcon(record.type),
    },
    {
      title: t("document.name"),
      key: "name",
      dataIndex: "name",
      render: (name: string | null, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name || record.name}</div>
          <div style={{ fontSize: 12, color: "#888" }}>
            {getDocumentTypeName(record.type)} - {formatFileSize(record.size)}
          </div>
        </div>
      ),
    },
    {
      title: t("document.size"),
      dataIndex: "size",
      key: "size",
      width: 120,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: t("document.uploadedAt"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (date: string) =>
        new Date(date).toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      title: t("document.actions"),
      key: "actions",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
          >
            {t("document.download")}
          </Button>
          <Popconfirm
            title={t("document.confirmDelete")}
            description={t("document.confirmDeleteDesc")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("common.yes")}
            cancelText={t("common.no")}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <Title level={3} className="!mb-0">
          {t("document.library")}
        </Title>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => setUploadModalVisible(true)}
        >
          {t("document.uploadDocument")}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={documents}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: t("document.noDocuments") }}
      />

      {/* Upload Modal */}
      <Modal
        title={t("document.uploadDocument")}
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item
            name="document"
            label={t("document.documentFile")}
            rules={[
              { required: true, message: t("document.pleaseSelectDocument") },
            ]}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload
              maxCount={1}
              beforeUpload={(file) => {
                const allowedExtensions = [
                  ".xlsx",
                  ".xls",
                  ".docx",
                  ".doc",
                  ".pdf",
                  ".pptx",
                  ".ppt",
                ];
                const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
                const isAllowed = allowedExtensions.includes(ext);
                if (!isAllowed) {
                  message.error(
                    "Only Excel, Word, PDF, and PowerPoint files are allowed"
                  );
                  return Upload.LIST_IGNORE;
                }
                const isLt100M = file.size / 1024 / 1024 < 100;
                if (!isLt100M) {
                  message.error("Document must be smaller than 100MB");
                  return Upload.LIST_IGNORE;
                }
                return false;
              }}
              listType="text"
            >
              <Button icon={<UploadOutlined />}>
                {t("document.selectDocument")}
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item
            name="name"
            label={t("document.documentName")}
            rules={[{ required: false }]}
          >
            <Input placeholder={t("document.documentNamePlaceholder")} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={uploading}>
                {uploading ? t("common.loading") : t("document.uploadDocument")}
              </Button>
              <Button onClick={() => setUploadModalVisible(false)}>
                {t("common.cancel")}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
