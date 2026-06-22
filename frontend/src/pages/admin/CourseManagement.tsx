import { useState, useEffect } from "react";
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
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  VideoCameraOutlined,
  SettingOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  uploadCourseCover,
  getCourseCategories,
  getAcademies,
  getInstructors,
  getVideos,
  addVideoToCourse,
  removeVideoFromCourse,
  type Course,
  type CourseCategory,
  type Academy,
  type User,
  type Video,
} from "../../services/course";

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function CourseManagement() {
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [instructors, setInstructors] = useState<User[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  
const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  
  // Custom states for files & videos in Drawer
  const [coverFileList, setCoverFileList] = useState<any[]>([]);
  const [attachedVideos, setAttachedVideos] = useState<Video[]>([]);
  const [selectedVideoToAdd, setSelectedVideoToAdd] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState("basic");
  const [formReady, setFormReady] = useState(false);

  const [form] = Form.useForm();

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [coursesData, academiesData, categoriesData, instructorsData, videosData] = await Promise.all([
        getCourses(),
        getAcademies(),
        getCourseCategories(),
        getInstructors(),
        getVideos(),
      ]);
      setCourses(coursesData);
      setAcademies(academiesData);
      setCategories(categoriesData);
      setInstructors(instructorsData);
      setVideos(videosData);
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Failed to load management data");
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
    fetchData();
  }, []);

const getLocalizedName = (item: any, prefix: string) => {
    const lang = localStorage.getItem("i18nextLng") || "vi";
    if (lang === "en") return item[`${prefix}_en`] || item[`${prefix}_vi`] || "";
    if (lang === "zh") return item[`${prefix}_zh`] || item[`${prefix}_vi`] || "";
    return item[`${prefix}_vi`] || "";
  };

const handleAdd = () => {
    setEditingCourse(null);
    setCoverFileList([]);
    setAttachedVideos([]);
    setSelectedVideoToAdd(undefined);
    setActiveTab("basic");
    setDrawerVisible(true);
  };

const handleEdit = (record: Course) => {
    setEditingCourse(record);
    setCoverFileList(
      record.coverImage
        ? [
            {
              uid: "-1",
              name: "Ảnh bìa hiện tại",
              status: "done",
              url: record.coverImage,
            },
          ]
        : []
    );

    // Map course videos to our local Video model list
    const sortedVideos = record.courseVideos
      ? [...record.courseVideos]
          .sort((a, b) => a.order - b.order)
          .map((cv) => cv.video)
          .filter((v): v is Video => !!v)
      : [];
    setAttachedVideos(sortedVideos);
    setSelectedVideoToAdd(undefined);
    setActiveTab("basic");

    setDrawerVisible(true);
  };

// Initialize form values when drawer opens
  useEffect(() => {
    if (drawerVisible) {
      // Use setTimeout to ensure Form component is mounted before setting values
      // This prevents the warning "Instance created by useForm is not connected to any Form element"
      setFormReady(false);
      const timer = setTimeout(() => {
        try {
          if (editingCourse) {
            // Parse benefits and tags safely
            let parsedBenefits = editingCourse.benefits;
            if (typeof parsedBenefits === "string") {
              try {
                parsedBenefits = JSON.parse(parsedBenefits);
              } catch {
                parsedBenefits = [];
              }
            }
            
            let parsedTags = editingCourse.tags;
            if (typeof parsedTags === "string") {
              try {
                parsedTags = JSON.parse(parsedTags);
              } catch {
                parsedTags = [];
              }
            }

            form.setFieldsValue({
              title_vi: editingCourse.title_vi,
              title_en: editingCourse.title_en,
              title_zh: editingCourse.title_zh,
              description_vi: editingCourse.description_vi,
              description_en: editingCourse.description_en,
              description_zh: editingCourse.description_zh,
              isPublic: editingCourse.isPublic,
              rating: editingCourse.rating,
              language: editingCourse.language || "vi",
              targetAudience: editingCourse.targetAudience,
              benefits: parsedBenefits || [],
              tags: parsedTags || [],
              academyId: editingCourse.academyId,
              categoryId: editingCourse.categoryId,
              instructorId: editingCourse.instructorId,
              antiFastForward: editingCourse.rule?.antiFastForward || false,
              lockSpeed1x: editingCourse.rule?.lockSpeed1x || false,
              showWatermark: editingCourse.rule?.showWatermark || false,
              blockDownload: editingCourse.rule?.blockDownload || false,
              requireFullCompletion: editingCourse.rule?.requireFullCompletion || false,
            });
          } else {
            // Reset to default values for new course
            form.resetFields();
            form.setFieldsValue({
              isPublic: true,
              rating: 5,
              language: "vi",
              antiFastForward: false,
              lockSpeed1x: false,
              showWatermark: false,
              blockDownload: false,
              requireFullCompletion: false,
            });
          }
          setFormReady(true);
        } catch (error) {
          // Silently handle - form may not be mounted yet
          console.debug("Form not ready, skipping field initialization");
        }
      }, 100);

      return () => clearTimeout(timer);
    } else {
      setFormReady(false);
    }
  }, [drawerVisible, editingCourse]);

  const handleDelete = async (id: number) => {
    try {
      await deleteCourse(id);
      message.success("Xóa khóa học thành công");
      fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Xóa khóa học thất bại");
    }
  };

  // Video arrangement handlers
  const handleAttachVideo = () => {
    if (!selectedVideoToAdd) return;
    const video = videos.find((v) => v.id === selectedVideoToAdd);
    if (!video) return;

    if (attachedVideos.some((v) => v.id === video.id)) {
      message.warning("Video này đã được đính kèm rồi");
      return;
    }

    setAttachedVideos([...attachedVideos, video]);
    setSelectedVideoToAdd(undefined);
  };

  const handleDetachVideo = (videoId: number) => {
    setAttachedVideos(attachedVideos.filter((v) => v.id !== videoId));
  };

  const moveVideo = (index: number, direction: "up" | "down") => {
    const newVideos = [...attachedVideos];
    if (direction === "up" && index > 0) {
      const temp = newVideos[index];
      newVideos[index] = newVideos[index - 1];
      newVideos[index - 1] = temp;
    } else if (direction === "down" && index < newVideos.length - 1) {
      const temp = newVideos[index];
      newVideos[index] = newVideos[index + 1];
      newVideos[index + 1] = temp;
    }
    setAttachedVideos(newVideos);
  };

  // Form submit handler
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      let savedCourse: Course;

      if (editingCourse) {
        // Update Course
        savedCourse = await updateCourse(editingCourse.id, values);
        
        // Sync videos: Delete all original videos and re-add in order
        if (editingCourse.courseVideos) {
          for (const cv of editingCourse.courseVideos) {
            await removeVideoFromCourse(editingCourse.id, cv.videoId).catch(() => {});
          }
        }
        for (let i = 0; i < attachedVideos.length; i++) {
          await addVideoToCourse(editingCourse.id, attachedVideos[i].id, i + 1);
        }

        // Upload Cover Image if a new file is uploaded
        const newFile = coverFileList.find((f) => f.originFileObj);
        if (newFile) {
          await uploadCourseCover(editingCourse.id, newFile.originFileObj);
        }

        message.success("Cập nhật khóa học thành công");
      } else {
        // Create Course
        savedCourse = await createCourse(values);
        
        // Associate videos
        for (let i = 0; i < attachedVideos.length; i++) {
          await addVideoToCourse(savedCourse.id, attachedVideos[i].id, i + 1);
        }

        // Upload Cover Image
        const newFile = coverFileList.find((f) => f.originFileObj);
        if (newFile) {
          await uploadCourseCover(savedCourse.id, newFile.originFileObj);
        }

        message.success("Tạo khóa học thành công");
      }

      setDrawerVisible(false);
      fetchData();
    } catch (error: any) {
      console.error(error);
      message.error(error?.response?.data?.message || "Lưu thông tin thất bại");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Ảnh bìa",
      dataIndex: "coverImage",
      key: "coverImage",
      width: 100,
      render: (cover: string | null) => (
        <div className="w-16 h-10 bg-slate-100 rounded-md border border-slate-200 overflow-hidden flex items-center justify-center">
          {cover ? (
            <img src={cover} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <Text type="secondary" className="text-xs">No img</Text>
          )}
        </div>
      ),
    },
    {
      title: "Tiêu đề",
      key: "title",
      render: (_: any, record: Course) => (
        <div>
          <span className="font-semibold text-slate-800 text-sm block">
            {getLocalizedName(record, "title")}
          </span>
          <Text type="secondary" className="text-xs max-w-xs truncate block">
            {getLocalizedName(record, "description")}
          </Text>
        </div>
      ),
    },
    {
      title: "Danh mục",
      key: "category",
      render: (_: any, record: Course) =>
        record.category ? (
          <Tag color="cyan">{getLocalizedName(record.category, "name")}</Tag>
        ) : (
          "-"
        ),
    },
    {
      title: "Học viện",
      key: "academy",
      render: (_: any, record: Course) =>
        record.academy ? (
          <Tag color="blue">{getLocalizedName(record.academy, "name")}</Tag>
        ) : (
          "-"
        ),
    },
    {
      title: "Giảng viên",
      key: "instructor",
      render: (_: any, record: Course) =>
        record.instructor?.fullName ? (
          <span className="text-sm font-medium text-slate-600">
            {record.instructor.fullName}
          </span>
        ) : (
          "-"
        ),
    },
    {
      title: "Điểm số",
      dataIndex: "rating",
      key: "rating",
      width: 80,
      render: (rating: number) => (
        <Tag color="gold" className="font-bold">★ {rating.toFixed(1)}</Tag>
      ),
    },
    {
      title: "Loại khóa học",
      dataIndex: "isPublic",
      key: "isPublic",
      width: 130,
      render: (isPublic: boolean) => (
        <Tag color={isPublic ? "green" : "orange"} className="font-medium">
          {isPublic ? "Công khai" : "Không công khai"}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 110,
      render: (_: any, record: Course) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="text-blue-600 hover:text-blue-700"
          />
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa khóa học này?"
            description="Tất cả các video và cài đặt quy tắc liên quan sẽ bị xóa khỏi khóa học."
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
          <Title level={3} className="!mb-0">
            Quản lý khóa học
          </Title>
          <Text type="secondary" className="text-slate-500">
            Xem, thêm mới, sửa đổi cấu hình quy tắc và đính kèm video tài nguyên cho khóa học.
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
            className="bg-blue-600 hover:bg-blue-700"
          >
            Thêm khóa học mới
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm overflow-x-auto">
        <Table
          columns={columns}
          dataSource={courses}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 800 }}
          size="small"
        />
      </div>

{/* Add / Edit Drawer */}
      <Drawer
        title={editingCourse ? "Chỉnh sửa khóa học" : "Thêm khóa học mới"}
        size="large"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>Hủy</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Lưu lại
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
                key: "basic",
                label: "Thông tin cơ bản",
                children: (
                  <div className="space-y-4 pt-2">
                    {/* Cover image upload */}
                    <Form.Item label="Ảnh bìa khóa học">
                      <Upload
                        listType="picture-card"
                        fileList={coverFileList}
                        beforeUpload={(file) => {
                          const isImage = file.type.startsWith("image/");
                          if (!isImage) {
                            message.error("Chỉ chấp nhận định dạng ảnh!");
                            return Upload.LIST_IGNORE;
                          }
                          const isLt10M = file.size / 1024 / 1024 < 10;
                          if (!isLt10M) {
                            message.error("Kích thước ảnh phải nhỏ hơn 10MB!");
                            return Upload.LIST_IGNORE;
                          }
                          // Keep only the latest file selected
                          setCoverFileList([
                            {
                              uid: "-1",
                              name: file.name,
                              status: "done",
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
                      {/* Select Academy */}
                      <Form.Item
                        name="academyId"
                        label="Học viện trực thuộc"
                        rules={[{ required: true, message: "Vui lòng chọn học viện!" }]}
                      >
                        <Select
                          placeholder="Chọn học viện"
                          options={academies.map((a) => ({
                            value: a.id,
                            label: getLocalizedName(a, "name"),
                          }))}
                        />
                      </Form.Item>

{/* Course visibility */}
                      <Form.Item
                        name="isPublic"
                        label="Trạng thái hiển thị"
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                      <div className="text-sm text-slate-500 -mt-3 mb-4">
                        {formReady ? form.getFieldValue("isPublic") ?? true
                          ? "Công khai (Hiển thị trang chủ học viện)"
                          : "Không công khai"
                          : "Công khai (Hiển thị trang chủ học viện)"}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 my-4" />

                    {/* Multi-language title inputs */}
                    <div className="space-y-4">
                      <Form.Item
                        name="title_vi"
                        label="Tên khóa học (Tiếng Việt)"
                        rules={[{ required: true, message: "Vui lòng nhập tên tiếng Việt!" }]}
                      >
                        <Input placeholder="Ví dụ: Lập trình ReactJS cơ bản" />
                      </Form.Item>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Form.Item name="title_en" label="Tên khóa học (English)">
                          <Input placeholder="Example: Basic ReactJS Programming" />
                        </Form.Item>

                        <Form.Item name="title_zh" label="Tên khóa học (中文)">
                          <Input placeholder="例如: ReactJS 基础编程" />
                        </Form.Item>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 my-4" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Select category */}
                      <Form.Item
                        name="categoryId"
                        label="Danh mục khóa học"
                        rules={[{ required: true, message: "Vui lòng chọn danh mục!" }]}
                      >
                        <Select
                          placeholder="Chọn danh mục"
                          options={categories.map((c) => ({
                            value: c.id,
                            label: getLocalizedName(c, "name"),
                          }))}
                        />
                      </Form.Item>

                      {/* Select instructor */}
                      <Form.Item
                        name="instructorId"
                        label="Giảng viên"
                        rules={[{ required: true, message: "Vui lòng chọn giảng viên!" }]}
                      >
                        <Select
                          placeholder="Chọn giảng viên"
                          options={instructors.map((i) => ({
                            value: i.id,
                            label: i.fullName || i.usercode,
                          }))}
                        />
                      </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Training language */}
                      <Form.Item name="language" label="Ngôn ngữ giảng dạy">
                        <Select
                          options={[
                            { value: "vi", label: "Tiếng Việt" },
                            { value: "en", label: "Tiếng Anh" },
                            { value: "zh", label: "Tiếng Trung" },
                          ]}
                        />
                      </Form.Item>

                      {/* Rating (score) */}
                      <Form.Item name="rating" label="Điểm số đánh giá ban đầu">
                        <Select
                          options={[
                            { value: 5, label: "5.0 Sao" },
                            { value: 4.5, label: "4.5 Sao" },
                            { value: 4, label: "4.0 Sao" },
                            { value: 3.5, label: "3.5 Sao" },
                            { value: 3, label: "3.0 Sao" },
                          ]}
                        />
                      </Form.Item>
                    </div>

                    {/* Target audience */}
                    <Form.Item name="targetAudience" label="Nhóm đối tượng đào tạo">
                      <Input placeholder="Ví dụ: Lập trình viên mới bắt đầu, Sinh viên công nghệ..." />
                    </Form.Item>

                    {/* Benefits List */}
                    <Form.List name="benefits">
                      {(fields, { add, remove }) => (
                        <div className="space-y-2">
                          <label className="text-slate-800 text-sm font-medium block">
                            Lợi ích khóa học
                          </label>
                          {fields.map((field, index) => (
                            <Form.Item required={false} key={field.key} className="!mb-2">
                              <div className="flex gap-2">
                                <Form.Item
                                  {...field}
                                  validateTrigger={["onChange", "onBlur"]}
                                  rules={[
                                    {
                                      required: true,
                                      whitespace: true,
                                      message: "Vui lòng nhập lợi ích hoặc xóa dòng này.",
                                    },
                                  ]}
                                  noStyle
                                >
                                  <Input placeholder="Ví dụ: Làm chủ các hook cơ bản của React" />
                                </Form.Item>
                                <Button danger onClick={() => remove(field.name)}>
                                  Xóa
                                </Button>
                              </div>
                            </Form.Item>
                          ))}
                          <Button
                            type="dashed"
                            onClick={() => add()}
                            icon={<PlusOutlined />}
                            className="w-full"
                          >
                            Thêm lợi ích
                          </Button>
                        </div>
                      )}
                    </Form.List>

                    {/* Tags */}
                    <Form.Item name="tags" label="Thẻ khóa học">
                      <Select
                        mode="tags"
                        style={{ width: "100%" }}
                        placeholder="Nhập thẻ và nhấn Enter để thêm (Ví dụ: ReactJS, Frontend)"
                      />
                    </Form.Item>

                    {/* Multi-language description inputs */}
                    <div className="space-y-4">
                      <Form.Item name="description_vi" label="Mô tả khóa học (Tiếng Việt)">
                        <TextArea placeholder="Mô tả tóm tắt nội dung khóa học..." rows={3} />
                      </Form.Item>
                      <Form.Item name="description_en" label="Mô tả khóa học (English)">
                        <TextArea placeholder="Summary of the course content..." rows={2} />
                      </Form.Item>
                      <Form.Item name="description_zh" label="Mô tả khóa học (中文)">
                        <TextArea placeholder="课程内容摘要..." rows={2} />
                      </Form.Item>
                    </div>
                  </div>
                ),
              },
              {
                key: "videos",
                label: "Tab Video tài nguyên",
                children: (
                  <div className="space-y-4 pt-2">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-end gap-3">
                      <div className="flex-1">
                        <label className="text-slate-800 text-xs font-semibold block mb-2">
                          Chọn video từ thư viện video
                        </label>
                        <Select
                          showSearch
                          placeholder="Tìm kiếm video..."
                          value={selectedVideoToAdd}
                          onChange={setSelectedVideoToAdd}
                          style={{ width: "100%" }}
                          filterOption={(input, option) =>
                            (option?.label ?? "").toString().toLowerCase().includes(input.toLowerCase())
                          }
                          options={videos
                            .filter((v) => v.status === "COMPLETED")
                            .map((v) => ({
                              value: v.id,
                              label: v.name || `Video #${v.id}`,
                            }))}
                        />
                      </div>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAttachVideo}
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={!selectedVideoToAdd}
                      >
                        Đính kèm
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Text className="font-semibold text-slate-700 block">
                        Danh sách video đính kèm ({attachedVideos.length})
                      </Text>
                      {attachedVideos.length > 0 ? (
                        <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-100">
                          {attachedVideos.map((video, idx) => (
                            <div
                              key={video.id}
                              className="flex items-center justify-between p-3 bg-white hover:bg-slate-50/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-xs">
                                  {idx + 1}
                                </span>
                                {video.thumbnailUrl && (
                                  <img
                                    src={video.thumbnailUrl}
                                    alt="thumb"
                                    className="w-12 h-8 rounded object-cover"
                                  />
                                )}
                                <div>
                                  <span className="font-medium text-slate-800 block">
                                    {video.name || `Video #${video.id}`}
                                  </span>
                                  {video.duration && (
                                    <Text type="secondary" className="text-xs">
                                      Thời lượng: {Math.floor(video.duration / 60)} phút{" "}
                                      {video.duration % 60} giây
                                    </Text>
                                  )}
                                </div>
                              </div>
                              <Space>
                                <Button
                                  icon={<ArrowUpOutlined />}
                                  size="small"
                                  disabled={idx === 0}
                                  onClick={() => moveVideo(idx, "up")}
                                />
                                <Button
                                  icon={<ArrowDownOutlined />}
                                  size="small"
                                  disabled={idx === attachedVideos.length - 1}
                                  onClick={() => moveVideo(idx, "down")}
                                />
                                <Button
                                  danger
                                  type="text"
                                  icon={<DeleteOutlined />}
                                  onClick={() => handleDetachVideo(video.id)}
                                />
                              </Space>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <VideoCameraOutlined style={{ fontSize: 32, color: "#ccc" }} />
                          <p className="text-slate-400 mt-2 text-sm">
                            Chưa có video nào được đính kèm vào khóa học này.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: "rules",
                label: "Quy tắc khóa học",
                children: (
                  <div className="space-y-5 pt-2">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <Title level={5} className="!mb-1">
                        Cấu hình quy tắc phát video
                      </Title>
                      <Text type="secondary" className="text-xs">
                        Các cấu hình chống gian lận và kiểm soát trải nghiệm xem video của học viên.
                      </Text>
                    </div>

{/* Video Rule Settings */}
                    <Form.Item name="antiFastForward" valuePropName="checked" className="mb-3">
                      <div className="flex items-start justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                        <div className="pr-4">
                          <span className="font-semibold text-slate-800 block">
                            Chống tua nhanh (Anti-Fast-Forward)
                          </span>
                          <Text type="secondary" className="text-xs">
                            Khi bật, học viên không thể tua vượt quá mốc thời gian đã xem trong video.
                          </Text>
                        </div>
                        <Switch 
                          checked={form.getFieldValue('antiFastForward')}
                          onChange={(checked) => form.setFieldsValue({ antiFastForward: checked })} 
                        />
                      </div>
                    </Form.Item>

                    <Form.Item name="lockSpeed1x" valuePropName="checked" className="mb-3">
                      <div className="flex items-start justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                        <div className="pr-4">
                          <span className="font-semibold text-slate-800 block">
                            Khóa tốc độ phát 1x
                          </span>
                          <Text type="secondary" className="text-xs">
                            Khóa tốc độ xem video ở mức 1x, không cho phép học viên tăng tốc độ phát (ví dụ 1.5x, 2x).
                          </Text>
                        </div>
                        <Switch 
                          checked={form.getFieldValue('lockSpeed1x')}
                          onChange={(checked) => form.setFieldsValue({ lockSpeed1x: checked })} 
                        />
                      </div>
                    </Form.Item>

                    <Form.Item name="showWatermark" valuePropName="checked" className="mb-3">
                      <div className="flex items-start justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                        <div className="pr-4">
                          <span className="font-semibold text-slate-800 block">
                            Hiển thị Watermark chống quay màn hình
                          </span>
                          <Text type="secondary" className="text-xs">
                            Hiển thị mã học viên (Usercode) mờ chạy ngẫu nhiên trên màn hình phát video.
                          </Text>
                        </div>
                        <Switch 
                          checked={form.getFieldValue('showWatermark')}
                          onChange={(checked) => form.setFieldsValue({ showWatermark: checked })} 
                        />
                      </div>
                    </Form.Item>

                    <Form.Item name="blockDownload" valuePropName="checked" className="mb-3">
                      <div className="flex items-start justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                        <div className="pr-4">
                          <span className="font-semibold text-slate-800 block">
                            Chặn tải xuống video
                          </span>
                          <Text type="secondary" className="text-xs">
                            Chặn các thao tác click chuột phải, ẩn nút tải xuống mặc định của trình duyệt để bảo vệ bản quyền.
                          </Text>
                        </div>
                        <Switch 
                          checked={form.getFieldValue('blockDownload')}
                          onChange={(checked) => form.setFieldsValue({ blockDownload: checked })} 
                        />
                      </div>
                    </Form.Item>

                    <div className="border-t border-slate-100 my-4" />

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <Title level={5} className="!mb-1">
                        Điều kiện hoàn thành khóa học
                      </Title>
                      <Text type="secondary" className="text-xs">
                        Thiết lập điều kiện cần để hệ thống đánh giá học viên đã kết thúc khóa học này.
                      </Text>
                    </div>

{/* requireFullCompletion */}
                    <Form.Item name="requireFullCompletion" valuePropName="checked">
                      <div className="flex items-start justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                        <div className="pr-4">
                          <span className="font-semibold text-slate-800 block">
                            Yêu cầu hoàn thành 100% video
                          </span>
                          <Text type="secondary" className="text-xs">
                            Khi bật, học viên phải xem toàn bộ tất cả video (không bỏ sót giây nào) mới được ghi nhận hoàn thành khóa học.
                          </Text>
                        </div>
                        <Switch 
                          checked={form.getFieldValue('requireFullCompletion')}
                          onChange={(checked) => form.setFieldsValue({ requireFullCompletion: checked })} 
                        />
                      </div>
                    </Form.Item>
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Drawer>
    </div>
  );
}
