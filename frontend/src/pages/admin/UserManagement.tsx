import { useState, useEffect, useRef } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Tag, Space, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authGet } from '../../services/auth/auth.get';
import { authPost } from '../../services/auth/auth.post';

interface Department {
  id: number;
  name_vi: string | null;
  name_en: string | null;
  name_zh: string | null;
  code: string;
}

interface Position {
  id: number;
  name_vi: string | null;
  name_en: string | null;
  name_zh: string | null;
  code: string;
}

interface User {
  id: number;
  usercode: string;
  fullName: string | null;
  email: string | null;
  role: string;
  departmentId: number | null;
  positionId: number | null;
  department: Department | null;
  position: Position | null;
  createdAt: string;
}

// Helper function to get localized name based on current language
const getLocalizedName = (item: Department | Position | null, lang: string): string => {
  if (!item) return '-';
  if (lang === 'zh') return item.name_zh || item.name_vi || '-';
  if (lang === 'en') return item.name_en || item.name_vi || '-';
  return item.name_vi || '-';
};

export default function UserManagement() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'vi';
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [form] = Form.useForm();
  const fileInputRef = useRef<any>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await authGet.getUsers();
      setUsers(response.data.users);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await authGet.getDepartments();
      setDepartments(response.data.departments);
    } catch (error: any) {
      console.error('Failed to load departments');
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await authGet.getPositions();
      setPositions(response.data.positions);
    } catch (error: any) {
      console.error('Failed to load positions');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchPositions();
  }, []);

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: User) => {
    setEditingUser(record);
    form.setFieldsValue({
      usercode: record.usercode,
      fullName: record.fullName,
      email: record.email,
      role: record.role === 'ADMIN' ? 'ADMIN' : 'USER',
      departmentId: record.departmentId,
      positionId: record.positionId,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await authPost.deleteUser(id);
      message.success(t('user.deleteSuccess') || 'User deleted successfully');
      fetchUsers();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingUser) {
        // Update existing user
        const updateData: any = {
          usercode: values.usercode,
          fullName: values.fullName,
          email: values.email,
          role: values.role,
          departmentId: values.departmentId,
          positionId: values.positionId,
        };
        // Only include password if provided
        if (values.password) {
          updateData.password = values.password;
        }
        await authPost.updateUser(editingUser.id, updateData);
        message.success(t('user.updateSuccess') || 'User updated successfully');
} else {
        // Create new user - remove password if empty so backend uses default
        const createData = { ...values };
        if (!createData.password) {
          delete createData.password;
        }
        await authPost.createUser(createData);
        message.success(t('user.createSuccess') || 'User created successfully');
      }
      setModalVisible(false);
      fetchUsers();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Operation failed');
    }
  };

  const handleImportExcel = async (file: File) => {
    setImportLoading(true);
    try {
      const response = await authPost.importUsers(file);
      const result = response.data.results;
      message.success(`Import completed: ${result.success} success, ${result.failed} failed`);
      if (result.errors.length > 0) {
        console.error('Import errors:', result.errors);
      }
      fetchUsers();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Import failed');
    } finally {
      setImportLoading(false);
    }
    return false; // Prevent auto-upload
  };

  const handleDownloadTemplate = async () => {
    try {
      // Call the template endpoint
      const response = await authGet.getUsers(); // We'll use a different approach for template
      
      // For now, show message - template download would need a separate endpoint
      message.info('Template feature coming soon');
    } catch (error: any) {
      message.error('Failed to download template');
    }
  };

  const columns = [
    {
      title: t('user.id') || 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: t('user.usercode') || 'Usercode',
      dataIndex: 'usercode',
      key: 'usercode',
    },
    {
      title: t('user.fullName') || 'Full Name',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (text: string | null) => text || '-',
    },
    {
      title: t('user.email') || 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (text: string | null) => text || '-',
    },
    {
      title: t('user.department') || 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (dept: Department | null) => 
        <Tag color="blue">{getLocalizedName(dept, currentLang)}</Tag>,
    },
    {
      title: t('user.position') || 'Position',
      dataIndex: 'position',
      key: 'position',
      render: (pos: Position | null) => 
        <Tag color="green">{getLocalizedName(pos, currentLang)}</Tag>,
    },
    {
      title: t('user.role') || 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'ADMIN' ? 'gold' : 'blue'}>
          {role === 'ADMIN' ? t('user.roleAdmin') : t('user.roleUser')}
        </Tag>
      ),
    },
    {
      title: t('common.actions') || 'Actions',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="text-blue-600 hover:text-blue-700"
          />
          <Popconfirm
            title={t('user.confirmDelete') || 'Are you sure you want to delete this user?'}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.yes') || 'Yes'}
            cancelText={t('common.no') || 'No'}
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800">
          {t('user.management') || 'User Management'}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchUsers}
            loading={loading}
            size="small"
          >
            {t('common.refresh') || 'Refresh'}
          </Button>
          <Upload
            showUploadList={false}
            beforeUpload={handleImportExcel}
            accept=".xlsx,.xls"
          >
            <Button icon={<UploadOutlined />} loading={importLoading} size="small">
              {t('user.importExcel') || 'Import'}
            </Button>
          </Upload>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700"
            size="small"
          >
            {t('user.addUser') || 'Add User'}
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/50 shadow-sm overflow-x-auto">
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} users`,
          }}
          scroll={{ x: 600 }}
          size="small"
        />
      </div>

      <Modal
        title={editingUser ? t('user.editUser') : t('user.addUser')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={Math.min(550, window.innerWidth - 32)}
        className="sm:modal-normal"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            role: 'USER',
          }}
          className="mt-4"
        >
          <Form.Item
            name="usercode"
            label={t('user.usercode') || 'Usercode'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Input placeholder="HV001, GV001..." />
          </Form.Item>

          <Form.Item
            name="fullName"
            label={t('user.fullName') || 'Full Name'}
          >
            <Input placeholder={t('user.fullNamePlaceholder') || 'Full Name'} />
          </Form.Item>

          <Form.Item
            name="email"
            label={t('user.email') || 'Email'}
            rules={[{ type: 'email', message: t('user.invalidEmail') || 'Invalid email format' }]}
          >
            <Input placeholder="email@example.com" />
          </Form.Item>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item
              name="departmentId"
              label={t('user.department') || 'Department'}
            >
              <Select placeholder={t('user.selectDepartment') || 'Select Department'} allowClear>
                {departments.map(dept => (
                  <Select.Option key={dept.id} value={dept.id}>
                    {getLocalizedName(dept, currentLang)}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="positionId"
              label={t('user.position') || 'Position'}
            >
              <Select placeholder={t('user.selectPosition') || 'Select Position'} allowClear>
                {positions.map(pos => (
                  <Select.Option key={pos.id} value={pos.id}>
                    {getLocalizedName(pos, currentLang)}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="role"
            label={t('user.role') || 'Role'}
          >
            <Select>
              <Select.Option value="USER">{t('user.roleUser') || 'User'}</Select.Option>
              <Select.Option value="ADMIN">{t('user.roleAdmin') || 'Admin'}</Select.Option>
            </Select>
          </Form.Item>

<Form.Item
            name="password"
            label={editingUser ? t('user.newPassword') : t('user.password')}
            tooltip={!editingUser ? t('user.passwordHint') || 'Nếu để trống, mật khẩu mặc định từ cấu hình hệ thống sẽ được sử dụng' : undefined}
          >
            <Input.Password placeholder={editingUser ? t('user.newPasswordPlaceholder') : t('user.passwordPlaceholder') || 'Để trống để dùng mật khẩu mặc định'} />
          </Form.Item>

          <Form.Item className="mb-0 flex justify-end gap-2">
            <Button onClick={() => setModalVisible(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button type="primary" htmlType="submit" className="bg-blue-600 hover:bg-blue-700">
              {t('common.save') || 'Save'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
