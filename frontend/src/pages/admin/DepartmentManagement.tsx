import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Space, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authGet } from '../../services/auth/auth.get';
import { authPost } from '../../services/auth/auth.post';

interface Department {
  id: number;
  name_vi: string | null;
  name_en: string | null;
  name_zh: string | null;
  code: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DepartmentManagement() {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [form] = Form.useForm();

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const response = await authGet.getDepartments();
      setDepartments(response.data.departments);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleAdd = () => {
    setEditingDept(null);
    form.resetFields();
    setModalVisible(true);
  };

const handleEdit = (record: Department) => {
    setEditingDept(record);
    form.setFieldsValue({
      name_vi: record.name_vi,
      name_en: record.name_en,
      name_zh: record.name_zh,
      code: record.code,
      description: record.description,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await authPost.deleteDepartment(id);
      message.success(t('department.deleteSuccess') || 'Department deleted successfully');
      fetchDepartments();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to delete department');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingDept) {
        await authPost.updateDepartment(editingDept.id, values);
        message.success(t('department.updateSuccess') || 'Department updated successfully');
      } else {
        await authPost.createDepartment(values);
        message.success(t('department.createSuccess') || 'Department created successfully');
      }
      setModalVisible(false);
      fetchDepartments();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Operation failed');
    }
  };

const columns = [
    {
      title: t('department.id') || 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: t('department.code') || 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => (
        <Tag color="blue">{text}</Tag>
      ),
    },
    {
      title: t('department.nameVi') || 'Name (VN)',
      dataIndex: 'name_vi',
      key: 'name_vi',
    },
    {
      title: t('department.nameEn') || 'Name (EN)',
      dataIndex: 'name_en',
      key: 'name_en',
    },
    {
      title: t('department.nameZh') || 'Name (CN)',
      dataIndex: 'name_zh',
      key: 'name_zh',
    },
    {
      title: t('department.description') || 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
    },
    {
      title: t('common.actions') || 'Actions',
      key: 'actions',
      render: (_: any, record: Department) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="text-blue-600 hover:text-blue-700"
          />
          <Popconfirm
            title={t('department.confirmDelete') || 'Are you sure you want to delete this department?'}
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
          {t('department.management') || 'Department Management'}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchDepartments}
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
            {t('department.add') || 'Add'}
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/50 shadow-sm overflow-x-auto">
        <Table
          columns={columns}
          dataSource={departments}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
          scroll={{ x: 500 }}
          size="small"
        />
      </div>

      <Modal
        title={editingDept ? t('department.edit') : t('department.add')}
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
            label={t('department.nameVi') || 'Name (VN)'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Input placeholder="Phòng IT" />
          </Form.Item>

          <Form.Item
            name="name_en"
            label={t('department.nameEn') || 'Name (EN)'}
          >
            <Input placeholder="IT Department" />
          </Form.Item>

          <Form.Item
            name="name_zh"
            label={t('department.nameZh') || 'Name (CN)'}
          >
            <Input placeholder="IT部门" />
          </Form.Item>

<Form.Item
            name="code"
            label={t('department.code') || 'Code'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Input placeholder="IT" disabled={!!editingDept} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('department.description') || 'Description'}
          >
            <Input.TextArea placeholder={t('department.descriptionPlaceholder') || 'Optional description'} rows={2} />
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
