import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Space, Tag, Switch, Select, Avatar } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, UserAddOutlined, UserDeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authGet } from '../../services/auth/auth.get';
import { authPost } from '../../services/auth/auth.post';

interface Academy {
  id: number;
  name_vi: string | null;
  name_en: string | null;
  name_zh: string | null;
  code: string;
  description: string | null;
  isPublic: boolean;
  users: AcademyUser[];
  createdAt: string;
  updatedAt: string;
}

interface AcademyUser {
  id: number;
  usercode: string;
  fullName: string | null;
}

interface User {
  id: number;
  usercode: string;
  fullName: string | null;
}

export default function AcademyManagement() {
  const { t } = useTranslation();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [editingAcademy, setEditingAcademy] = useState<Academy | null>(null);
  const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);
  const [form] = Form.useForm();

  const fetchAcademies = async () => {
    setLoading(true);
    try {
      const response = await authGet.getAcademies();
      setAcademies(response.data.academies);
    } catch (error: any) {
      message.error(error?.response?.data?.message || t('academy.loadFailed') || 'Failed to load academies');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await authGet.getUsers();
      setUsers(response.data.users);
    } catch (error: any) {
      console.error('Failed to load users:', error);
    }
  };

  useEffect(() => {
    fetchAcademies();
    fetchUsers();
  }, []);

  const handleAdd = () => {
    setEditingAcademy(null);
    form.resetFields();
    form.setFieldsValue({ isPublic: true });
    setModalVisible(true);
  };

  const handleEdit = (record: Academy) => {
    setEditingAcademy(record);
    form.setFieldsValue({
      name_vi: record.name_vi,
      name_en: record.name_en,
      name_zh: record.name_zh,
      code: record.code,
      description: record.description,
      isPublic: record.isPublic,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await authPost.deleteAcademy(id);
      message.success(t('academy.deleteSuccess') || 'Academy deleted successfully');
      fetchAcademies();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to delete academy');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingAcademy) {
        await authPost.updateAcademy(editingAcademy.id, values);
        message.success(t('academy.updateSuccess') || 'Academy updated successfully');
      } else {
        await authPost.createAcademy(values);
        message.success(t('academy.createSuccess') || 'Academy created successfully');
      }
      setModalVisible(false);
      fetchAcademies();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Operation failed');
    }
  };

const handleManageUsers = (record: Academy) => {
    // If academy is public, show warning
    if (record.isPublic) {
      message.warning(t('academy.publicAcademyWarning') || 'This academy is public. All users can access. No need to add users.');
      return;
    }
    // Get the latest academy data from state to ensure we have updated user list
    const latestAcademy = academies.find(a => a.id === record.id) || record;
    setSelectedAcademy(latestAcademy);
    setUserModalVisible(true);
  };

const handleAddUsers = async (userIds: number[]) => {
    if (!selectedAcademy || userIds.length === 0) return;
    try {
      // Add users one by one
      for (const userId of userIds) {
        await authPost.addUserToAcademy(selectedAcademy.id, userId);
      }
      message.success(t('academy.usersAdded') || `${userIds.length} users added successfully`);
      // Refresh to show new users immediately
      const response = await authGet.getAcademies();
      const updatedAcademies = response.data.academies;
      setAcademies(updatedAcademies);
      // Update selectedAcademy with new data
      const updated = updatedAcademies.find((a: Academy) => a.id === selectedAcademy.id);
      if (updated) setSelectedAcademy(updated);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to add users');
    }
  };

const handleRemoveUser = async (userId: number) => {
    if (!selectedAcademy) return;
    try {
      await authPost.removeUserFromAcademy(selectedAcademy.id, userId);
      message.success(t('academy.userRemoved') || 'User removed successfully');
      // Refresh and update selectedAcademy immediately
      const response = await authGet.getAcademies();
      const updatedAcademies = response.data.academies;
      setAcademies(updatedAcademies);
      // Update selectedAcademy with new data
      const updated = updatedAcademies.find((a: Academy) => a.id === selectedAcademy.id);
      if (updated) setSelectedAcademy(updated);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to remove user');
    }
  };

  const getAcademyName = (academy: Academy) => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return academy.name_en || academy.name_vi || '';
    if (lang === 'zh') return academy.name_zh || academy.name_vi || '';
    return academy.name_vi || '';
  };

  const columns = [
    {
      title: t('academy.id') || 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: t('academy.code') || 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => (
        <Tag color="blue">{text}</Tag>
      ),
    },
    {
      title: t('academy.name') || 'Name',
      key: 'name',
      render: (_: any, record: Academy) => (
        <span className="font-medium">{getAcademyName(record)}</span>
      ),
    },
    {
      title: t('academy.isPublic') || 'Public',
      dataIndex: 'isPublic',
      key: 'isPublic',
      render: (isPublic: boolean) => (
        <Tag color={isPublic ? 'green' : 'orange'}>
          {isPublic ? t('academy.isPublic') : t('academy.isPrivateDesc')}
        </Tag>
      ),
    },
    {
      title: t('academy.description') || 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
    },
    {
      title: t('common.actions') || 'Actions',
      key: 'actions',
      render: (_: any, record: Academy) => (
        <Space>
          <Button
            type="text"
            icon={<UserAddOutlined />}
            onClick={() => handleManageUsers(record)}
            className="text-blue-600 hover:text-blue-700"
            title={t('academy.assignedUsers') || 'Assigned Users'}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="text-blue-600 hover:text-blue-700"
          />
          <Popconfirm
            title={t('academy.confirmDelete') || 'Are you sure you want to delete this academy?'}
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

  // Get users not already assigned to this academy
  const getAvailableUsers = () => {
    if (!selectedAcademy) return users;
    const assignedUserIds = selectedAcademy.users?.map(u => u.id) || [];
    return users.filter(u => !assignedUserIds.includes(u.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800">
          {t('academy.management') || 'Academy Management'}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchAcademies}
            loading={loading}
            size="small"
          >
            {t('common.refresh') || 'Refresh'}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700"
            size="small"
          >
            {t('academy.add') || 'Add'}
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/50 shadow-sm overflow-x-auto">
        <Table
          columns={columns}
          dataSource={academies}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
          scroll={{ x: 600 }}
          size="small"
        />
      </div>

      {/* Add/Edit Academy Modal */}
      <Modal
        title={editingAcademy ? t('academy.edit') : t('academy.add')}
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
            label={t('academy.nameVi') || 'Name (VN)'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Input placeholder="Học viện Công nghệ Bưu chính Viễn thông" />
          </Form.Item>

          <Form.Item
            name="name_en"
            label={t('academy.nameEn') || 'Name (EN)'}
          >
            <Input placeholder="Posts and Telecommunications Institute of Technology" />
          </Form.Item>

          <Form.Item
            name="name_zh"
            label={t('academy.nameZh') || 'Name (CN)'}
          >
            <Input placeholder="邮政电信学院" />
          </Form.Item>

          <Form.Item
            name="code"
            label={t('academy.code') || 'Code'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Input placeholder="PTIT" disabled={!!editingAcademy} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('academy.description') || 'Description'}
          >
            <Input.TextArea placeholder={t('academy.descriptionPlaceholder') || 'Optional description'} rows={2} />
          </Form.Item>

<Form.Item
            name="isPublic"
            label={t('academy.isPublic') || 'Public'}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <div className="text-sm text-slate-500">
            {t('academy.isPublicDesc') || 'Public academy - all users can access'}
          </div>

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

      {/* Manage Users Modal */}
      <Modal
        title={t('academy.assignedUsers') || 'Assigned Users'}
        open={userModalVisible}
        onCancel={() => {
          setUserModalVisible(false);
          setSelectedAcademy(null);
        }}
        footer={null}
        width={Math.min(600, window.innerWidth - 32)}
      >
        <div className="space-y-4">
{/* Add user section - only show if academy is not public */}
          {selectedAcademy && !selectedAcademy.isPublic && (
            <div className="flex flex-col gap-2">
              <Select
                mode="multiple"
                showSearch
                placeholder={t('academy.selectUsers') || 'Select multiple users'}
                style={{ width: '100%' }}
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                onChange={(values) => {
                  // Only call API when users are actually selected (not clearing)
                  if (values && values.length > 0) {
                    handleAddUsers(values as number[]);
                  }
                }}
                value={[]}
                maxTagCount="responsive"
                options={getAvailableUsers().map(u => ({
                  value: u.id,
                  label: `${u.usercode} - ${u.fullName || ''}`,
                }))}
              />
              <span className="text-xs text-slate-500">
                {t('academy.selectUsersHint') || 'Select multiple users at once'}
              </span>
            </div>
          )}

          {/* Assigned users list */}
          <div className="border rounded-lg max-h-64 overflow-y-auto">
            {selectedAcademy?.users && selectedAcademy.users.length > 0 ? (
              <Table
                dataSource={selectedAcademy.users}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: t('user.usercode') || 'Usercode',
                    dataIndex: 'usercode',
                    key: 'usercode',
                  },
                  {
                    title: t('user.fullName') || 'Full Name',
                    dataIndex: 'fullName',
                    key: 'fullName',
                  },
                  {
                    title: t('common.actions') || 'Actions',
                    key: 'actions',
                    render: (_: any, record: AcademyUser) => (
                      !selectedAcademy.isPublic && (
                        <Button
                          type="text"
                          danger
                          icon={<UserDeleteOutlined />}
                          onClick={() => handleRemoveUser(record.id)}
                        />
                      )
                    ),
                  },
                ]}
              />
            ) : (
              <div className="p-4 text-center text-slate-500">
                {t('academy.noUsers') || 'No users assigned'}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
