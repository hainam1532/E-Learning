import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, message, Tag, Space, Badge } from 'antd';
import { SwapOutlined, UserOutlined, SafetyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authGet } from '../../services/auth/auth.get';
import { authPost } from '../../services/auth/auth.post';

interface User {
  id: number;
  usercode: string;
  fullName: string | null;
  email: string | null;
  role: string;
  createdAt: string;
}

export default function RoleManagement() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [form] = Form.useForm();

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = (record: User) => {
    setSelectedUser(record);
    form.setFieldsValue({
      role: record.role === 'ADMIN' ? 'ADMIN' : 'USER',
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    if (!selectedUser) return;

    try {
      await authPost.updateUser(selectedUser.id, {
        role: values.role,
      });
      message.success(t('role.updateSuccess') || 'Role updated successfully');
      setModalVisible(false);
      fetchUsers();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to update role');
    }
  };

  const columns = [
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
      title: t('user.role') || 'Current Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Badge
          status={role === 'ADMIN' ? 'success' : 'processing'}
          text={
            <Tag color={role === 'ADMIN' ? 'gold' : 'blue'}>
              {role === 'ADMIN' ? (
                <><SafetyOutlined /> {t('user.roleAdmin')}</>
              ) : (
                <><UserOutlined /> {t('user.roleUser')}</>
              )}
            </Tag>
          }
        />
      ),
    },
    {
      title: t('role.changeRole') || 'Change Role',
      key: 'actions',
      render: (_: any, record: User) => (
        <Button
          type="link"
          icon={<SwapOutlined />}
          onClick={() => handleRoleChange(record)}
          className="text-blue-600 hover:text-blue-700"
        >
          {t('role.change') || 'Change'}
        </Button>
      ),
    },
  ];

  // Statistics
  const adminCount = users.filter(u => u.role === 'ADMIN').length;
  const userCount = users.filter(u => u.role === 'USER').length;

return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800">
          {t('role.management') || 'Role Management'}
        </h2>
        <Button onClick={fetchUsers} loading={loading} size="small">
          {t('common.refresh') || 'Refresh'}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/50 shadow-sm">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <UserOutlined className="text-lg sm:text-xl text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('role.totalUsers') || 'Total'}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/50 shadow-sm">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <UserOutlined className="text-lg sm:text-xl text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('user.roleUser') || 'Students'}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800">{userCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/50 shadow-sm">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <SafetyOutlined className="text-lg sm:text-xl text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('user.roleAdmin') || 'Admins'}</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800">{adminCount}</p>
            </div>
          </div>
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
          scroll={{ x: 400 }}
          size="small"
        />
      </div>

      <Modal
        title={t('role.changeRole') || 'Change Role'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={Math.min(400, window.innerWidth - 32)}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ role: 'USER' }}
          className="mt-4"
        >
          <div className="mb-4">
            <p className="text-sm text-slate-500">
              {t('role.currentUser') || 'User'}:
              <span className="font-semibold text-slate-800 ml-2">
                {selectedUser?.usercode}
              </span>
            </p>
          </div>

          <Form.Item
            name="role"
            label={t('user.role') || 'Role'}
            rules={[{ required: true, message: t('common.requiredField') || 'Required' }]}
          >
            <Select>
              <Select.Option value="USER">
                <Space>
                  <UserOutlined className="text-blue-500" />
                  {t('user.roleUser') || 'User (Student)'}
                </Space>
              </Select.Option>
              <Select.Option value="ADMIN">
                <Space>
                  <SafetyOutlined className="text-amber-500" />
                  {t('user.roleAdmin') || 'Admin'}
                </Space>
              </Select.Option>
            </Select>
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
