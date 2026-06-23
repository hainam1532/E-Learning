import { useState, useEffect, useRef } from "react";
import Hls from "hls.js";
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
  Progress,
} from "antd";
import {
  UploadOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  EditOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  getVideos,
  deleteVideo,
  reprocessVideo,
  updateVideo,
  uploadThumbnail,
  type Video,
} from "../../services/video";

const { Title } = Typography;

export default function VideoLibrary() {
  const { t } = useTranslation();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editingThumbnail, setEditingThumbnail] = useState<File | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [form] = Form.useForm();

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    const hasProcessing = videos.some((v) => v.status === "PROCESSING");

    if (!hasProcessing) return; // ← không poll nếu không cần

    const interval = setInterval(() => {
      fetchVideos();
    }, 3000);

    return () => clearInterval(interval);
  }, [videos]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const data = await getVideos();
      setVideos(data);
    } catch (error) {
      message.error(t("video.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const initHls = (videoElement: HTMLVideoElement | null) => {
    videoRef.current = videoElement;

    if (!videoElement || !selectedVideo?.streamingUrl) return;

    // Cleanup cũ
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(selectedVideo.streamingUrl);
      hls.attachMedia(videoElement);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoElement.play().catch(() => {});
      });
      hlsRef.current = hls;
    } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
      videoElement.src = selectedVideo.streamingUrl;
    }
  };

  const handleUpload = async () => {
    const file = form.getFieldValue("video")?.[0]?.originFileObj;
    const name = form.getFieldValue("name");

    if (!file) {
      message.error(t("video.pleaseSelectVideo"));
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Import the upload function dynamically to avoid circular deps
      const { uploadVideo } = await import("../../services/video");

      await uploadVideo({ video: file, name }, (progress) => {
        setUploadProgress(progress);
      });

      message.success(t("video.uploadSuccess"));
      setUploadModalVisible(false);
      form.resetFields();
      fetchVideos();
    } catch (error) {
      message.error(t("video.uploadFailed"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteVideo(id);
      message.success(t("video.deletedSuccess"));
      fetchVideos();
    } catch (error) {
      message.error(t("video.deleteFailed"));
    }
  };

  const handleReprocess = async (id: number) => {
    try {
      await reprocessVideo(id);
      message.success(t("video.processingQueued"));
      // Refresh to show PROCESSING status
      fetchVideos();
    } catch (error) {
      message.error(t("video.queueFailed"));
    }
  };

  const handlePreview = (video: Video) => {
    setSelectedVideo(video);
    setPreviewVisible(true);
  };

  const handleEdit = (video: Video) => {
    setEditingVideo(video);
    setEditName(video.name || "");
    setEditingThumbnail(null);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingVideo) return;
    try {
      // Update name if changed
      if (editName !== editingVideo.name) {
        await updateVideo(editingVideo.id, { name: editName });
      }
      // Upload thumbnail if selected
      if (editingThumbnail) {
        await uploadThumbnail(editingVideo.id, editingThumbnail);
        message.success(t("video.thumbnailUploaded"));
      }
      message.success(t("video.updatedSuccess"));
      setEditModalVisible(false);
      setEditingThumbnail(null);
      fetchVideos();
    } catch (error) {
      message.error(t("video.updateFailed"));
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Format video name - use name field or extract from path
  const formatVideoName = (video: Video): string => {
    if (video.name) return video.name;
    // Extract filename from path
    const parts = video.path.split("/");
    const filename = parts[parts.length - 1] || "";
    // Remove uuid prefix if exists
    return filename.replace(/^[0-9a-f-]{36}\./, "").replace(/\./g, " ");
  };

const columns: ColumnsType<Video> = [
    {
      title: t("video.thumbnail"),
      key: "thumbnail",
      width: 150,
      render: (_, record) => (
        <div
          style={{
            width: 120,
            height: 70,
            backgroundColor: "#f0f0f0",
            borderRadius: 6,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {record.thumbnailUrl ? (
            <img
              src={record.thumbnailUrl}
              alt="thumbnail"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <PlayCircleOutlined style={{ fontSize: 32, color: "#999" }} />
          )}
        </div>
      ),
    },
    {
      title: t("video.videoName"),
      key: "name",
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{formatVideoName(record)}</div>
          {record.lesson && (
            <div style={{ fontSize: 12, color: "#888" }}>
              {record.lesson.title}
            </div>
          )}
        </div>
      ),
    },
{
      title: t("video.duration"),
      dataIndex: "duration",
      key: "duration",
      width: 120,
      render: (duration: number | null) => formatDuration(duration),
    },
    {
      title: t("video.status"),
      key: "status",
      width: 140,
      render: (_, record) => {
        const status = record.status || "PROCESSING";
        const progress = record.progress || 0;

        // Show progress bar when PROCESSING
        if (status === "PROCESSING") {
          return (
            <div>
              <Progress
                percent={progress}
                size="small"
                status="active"
                strokeColor="#1890ff"
              />
              <span style={{ fontSize: 11, color: "#888" }}>{progress}%</span>
            </div>
          );
        }

        // Show ready status when COMPLETED
        if (status === "COMPLETED") {
          return <Tag color="green">{t("video.ready")}</Tag>;
        }

        // Show failed status
        return <Tag color="red">{t("video.failed")}</Tag>;
      },
    },
    {
      title: t("video.actions"),
      key: "actions",
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<PlayCircleOutlined />}
            onClick={() => handlePreview(record)}
            disabled={record.status !== "COMPLETED"}
          >
            {t("video.play")}
          </Button>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t("video.edit")}
          </Button>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => handleReprocess(record.id)}
            disabled={record.status === "PROCESSING"}
          >
            {t("video.reprocess")}
          </Button>
          <Popconfirm
            title={t("video.confirmDelete")}
            description={t("video.confirmDeleteDesc")}
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
          {t("video.library")}
        </Title>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => setUploadModalVisible(true)}
        >
          {t("video.uploadVideo")}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={videos}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* Upload Modal */}
      <Modal
        title={t("video.uploadVideo")}
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item
            name="video"
            label={t("video.videoFile")}
            rules={[{ required: true, message: t("video.pleaseSelectVideo") }]}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          >
            <Upload
              maxCount={1}
              beforeUpload={(file) => {
                const isVideo = file.type.startsWith("video/");
                if (!isVideo) {
                  message.error("Only video files are allowed");
                  return Upload.LIST_IGNORE;
                }
                const isLt500M = file.size / 1024 / 1024 < 500;
                if (!isLt500M) {
                  message.error("Video must be smaller than 500MB");
                  return Upload.LIST_IGNORE;
                }
                return false;
              }}
              listType="text"
            >
              <Button icon={<UploadOutlined />}>
                {t("video.selectVideo")}
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item
            name="name"
            label={t("video.videoName")}
            rules={[{ required: false }]}
          >
            <Input placeholder={t("video.videoNamePlaceholder")} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={uploading}>
                {uploading ? t("common.loading") : t("video.uploadVideo")}
              </Button>
              <Button onClick={() => setUploadModalVisible(false)}>
                {t("common.cancel")}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Video Preview Modal with HLS support */}
      <Modal
        title={selectedVideo?.lesson?.title || t("video.play")}
        open={previewVisible}
        onCancel={() => {
          hlsRef.current?.destroy();
          hlsRef.current = null;
          setPreviewVisible(false);
          setSelectedVideo(null);
        }}
        footer={null}
        width={800}
      >
        {selectedVideo?.streamingUrl && (
          <video
            ref={initHls} // ← ref callback, gọi khi DOM sẵn sàng
            controls
            style={{ width: "100%" }}
          />
        )}
      </Modal>

{/* Edit Video Modal */}
      <Modal
        title={t("video.editVideo")}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingThumbnail(null);
        }}
        footer={null}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              {t("video.videoName")}
            </label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={t("video.videoNamePlaceholder")}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              {t("video.thumbnail")}
              {editingVideo?.thumbnailUrl && (
                <span className="text-xs text-slate-500 ml-2">
                  ({t("video.currentThumbnail")})
                </span>
              )}
            </label>
            <Upload
              maxCount={1}
              beforeUpload={(file) => {
                const isImage = file.type.startsWith("image/");
                if (!isImage) {
                  message.error("Only image files are allowed");
                  return Upload.LIST_IGNORE;
                }
                const isLt2M = file.size / 1024 / 1024 < 2;
                if (!isLt2M) {
                  message.error("Image must be smaller than 2MB");
                  return Upload.LIST_IGNORE;
                }
                setEditingThumbnail(file);
                return false;
              }}
              listType="picture"
              fileList={
                editingThumbnail
                  ? [
                      {
                        uid: "-1",
                        name: editingThumbnail.name,
                        status: "done" as const,
                      },
                    ]
                  : []
              }
              onRemove={() => setEditingThumbnail(null)}
            >
              <Button icon={<UploadOutlined />}>
                {editingThumbnail ? t("video.change") : t("video.selectImage")}
              </Button>
            </Upload>
          </div>
          <Space>
            <Button type="primary" onClick={handleSaveEdit}>
              {t("common.save")}
            </Button>
            <Button
              onClick={() => {
                setEditModalVisible(false);
                setEditingThumbnail(null);
              }}
            >
              {t("common.cancel")}
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
}
