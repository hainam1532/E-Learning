import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Space, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authGet } from '../../services/auth/auth.get';
import { authPost } from '../../services/auth/auth.post';

interface Position {
  id: number;
  name_vi: string | null;
  name_en: string | null;
  name_zh: string | null;
  code: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function PositionManagement() {
  const { t } = useTranslation();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [form] = Form.useForm();

  const fetchPositions = async () => {
    setLoading(true);
    try {
      const response = await authGet.getPositions();
      setPositions(response.data.positions);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to load positions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  const handleAdd = () => {
    setEditingPos(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Position) => {
    setEditingPos(record);
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
      await authPost.deletePosition(id);
      message.success(t('position.deleteSuccess') || 'Position deleted successfully');
      fetchPositions();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to delete position');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingPos) {
        await authPost.updatePosition(editingPos.id, values);
        message.success(t('position.updateSuccess') || 'Position updated successfully');
      } else {
        await authPost.createPosition(values);
        message.success(t('position.createSuccess') || 'Position created successfully');
      }
      setModalVisible(false);
      fetchPositions();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Operation failed');
    }
  };

  const columns = [
    {
      title: t('position.id') || 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: t('position.code') || 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => (
        <Tag color="green">{text}</Tag>
      ),
    },
    {
      title: t('position.nameVi') || 'Name (VN)',
      dataIndex: 'name_vi',
      key: 'name_vi',
    },
    {
      title: t('position.nameEn') || 'Name (EN)',
      dataIndex: 'name_en',
      key: 'name_en',
    },
    {
      title: t('position.nameZh') || 'Name (CN)',
      dataIndex: 'name_zh',
      key: 'name_zh',
    },
    {
      title: t('position.description') || 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
    },
    {
      title: t('common.actions') || 'Actions',
      key: 'actions',
      render: (_: any, record: Position) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="text-blue-600 hover:text-blue-700"
          />
          <Popconfirm
            title={t('position.confirmDelete') || 'Are you sure you want to delete this position?'}
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
          {t('position.management') || 'Position Management'}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchPositions}
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
            {t('position.add') || 'Add'}
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/50 shadow-sm overflow-x-auto">
        <Table
          columns={columns}
          dataSource={positions}
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
        title={editingPos ? t('position.edit') : t('position.add')}
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
            label={t('position.nameVi') || 'Name (VN)'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Input placeholder="Trưởng phòng" />
          </Form.Item>

          <Form.Item
            name="name_en"
            label={t('position.nameEn') || 'Name (EN)'}
          >
            <Input placeholder="Manager" />
          </Form.Item>

          <Form.Item
            name="name_zh"
            label={t('position.nameZh') || 'Name (CN)'}
          >
            <Input placeholder="经理" />
          </Form.Item>

<Form.Item
            name="code"
            label={t('position.code') || 'Code'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Input placeholder="TP" disabled={!!editingPos} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('position.description') || 'Description'}
          >
            <Input.TextArea placeholder={t('position.descriptionPlaceholder') || 'Optional description'} rows={2} />
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
