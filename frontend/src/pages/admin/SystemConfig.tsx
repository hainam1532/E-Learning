import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, KeyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authGet } from '../../services/auth/auth.get';
import { authPost } from '../../services/auth/auth.post';

interface SystemConfig {
  id: number;
  configKey: string;
  configValue: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function SystemConfig() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null);
  const [form] = Form.useForm();

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await authGet.getConfigs();
      setConfigs(response.data.configs);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to load configs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleAdd = () => {
    setEditingConfig(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: SystemConfig) => {
    setEditingConfig(record);
    form.setFieldsValue({
      configKey: record.configKey,
      configValue: record.configValue,
      description: record.description,
    });
    // Don't allow editing key of built-in configs
    setModalVisible(true);
  };

  const handleDelete = async (key: string) => {
    try {
      await authPost.deleteConfig(key);
      message.success(t('config.deleteSuccess') || 'Config deleted successfully');
      fetchConfigs();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to delete config');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      await authPost.setConfig(values);
      message.success(editingConfig ? t('config.updateSuccess') : t('config.createSuccess'));
      setModalVisible(false);
      fetchConfigs();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Operation failed');
    }
  };

  const columns = [
    {
      title: t('config.key') || 'Key',
      dataIndex: 'configKey',
      key: 'configKey',
      render: (text: string) => (
        <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono text-slate-700">
          {text}
        </code>
      ),
    },
    {
      title: t('config.value') || 'Value',
      dataIndex: 'configValue',
      key: 'configValue',
      render: (text: string) => (
        <span className="font-mono text-slate-600">{text}</span>
      ),
    },
    {
      title: t('config.description') || 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
    },
    {
      title: t('common.actions') || 'Actions',
      key: 'actions',
      render: (_: any, record: SystemConfig) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="text-blue-600 hover:text-blue-700"
          />
          <Popconfirm
            title={t('config.confirmDelete') || 'Are you sure you want to delete this config?'}
            onConfirm={() => handleDelete(record.configKey)}
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
          {t('config.management') || 'System Configuration'}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchConfigs}
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
            {t('config.addConfig') || 'Add'}
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/50 shadow-sm overflow-x-auto">
        <Table
          columns={columns}
          dataSource={configs}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
          }}
          scroll={{ x: 400 }}
          size="small"
        />
      </div>

      <Modal
        title={editingConfig ? t('config.editConfig') : t('config.addConfig')}
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
            name="configKey"
            label={t('config.key') || 'Key'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Input
              placeholder="DEFAULT_USER_PASSWORD"
              disabled={!!editingConfig}
              prefix={<KeyOutlined />}
            />
          </Form.Item>

          <Form.Item
            name="configValue"
            label={t('config.value') || 'Value'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Input placeholder="123456" />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('config.description') || 'Description'}
          >
            <Input.TextArea placeholder={t('config.descriptionPlaceholder') || 'Optional description'} rows={2} />
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
