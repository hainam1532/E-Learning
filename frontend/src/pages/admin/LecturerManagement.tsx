import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Radio, message, Popconfirm, Space, Tag, Drawer } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { authGet } from '../../services/auth/auth.get';
import { authPost } from '../../services/auth/auth.post';

interface Lecturer {
  id: number;
  code: string;
  name: string | null;
  type: 'INTERNAL' | 'EXTERNAL';
  gender: 'MALE' | 'FEMALE';
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function LecturerManagement() {
  const { t } = useTranslation();
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingLecturer, setEditingLecturer] = useState<Lecturer | null>(null);
  const [form] = Form.useForm();
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>(undefined);

  const fetchLecturers = async (search?: string, type?: string) => {
    setLoading(true);
    try {
      const response = await authGet.getLecturers(search, type);
      setLecturers(response.data.lecturers);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to load lecturers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLecturers();
  }, []);

  const handleSearch = () => {
    fetchLecturers(searchText, filterType);
  };

  const handleAdd = () => {
    setEditingLecturer(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'INTERNAL',
      gender: 'MALE',
    });
    setDrawerVisible(true);
  };

  const handleEdit = (record: Lecturer) => {
    setEditingLecturer(record);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      type: record.type,
      gender: record.gender,
      phone: record.phone,
      email: record.email,
      address: record.address,
    });
    setDrawerVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await authPost.deleteLecturer(id);
      message.success(t('lecturer.deleteSuccess') || 'Lecturer deleted successfully');
      handleSearch();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to delete lecturer');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingLecturer) {
        await authPost.updateLecturer(editingLecturer.id, values);
        message.success(t('lecturer.updateSuccess') || 'Lecturer updated successfully');
      } else {
        await authPost.createLecturer(values);
        message.success(t('lecturer.createSuccess') || 'Lecturer created successfully');
      }
      setDrawerVisible(false);
      handleSearch();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Operation failed');
    }
  };

  const handleTypeChange = (value: string) => {
    // Reset email and address when switching to INTERNAL
    if (value === 'INTERNAL') {
      form.setFieldsValue({ email: undefined, address: undefined });
    }
  };

  const columns = [
    {
      title: t('lecturer.id') || 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: t('lecturer.code') || 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => (
        <Tag color="blue">{text}</Tag>
      ),
    },
    {
      title: t('lecturer.name') || 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string | null) => text || '-',
    },
    {
      title: t('lecturer.type') || 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'INTERNAL' ? 'green' : 'orange'}>
          {type === 'INTERNAL' ? t('lecturer.internal') : t('lecturer.external')}
        </Tag>
      ),
    },
    {
      title: t('lecturer.gender') || 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender: string) => (
        <span>
          {gender === 'MALE' ? t('lecturer.male') : t('lecturer.female')}
        </span>
      ),
    },
    {
      title: t('lecturer.phone') || 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (text: string | null) => text || '-',
    },
    {
      title: t('common.actions') || 'Actions',
      key: 'actions',
      render: (_: any, record: Lecturer) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            className="text-blue-600 hover:text-blue-700"
          />
          <Popconfirm
            title={t('lecturer.confirmDelete') || 'Are you sure you want to delete this lecturer?'}
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
          {t('lecturer.management') || 'Lecturer Management'}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={handleSearch}
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
            {t('lecturer.add') || 'Add'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm text-slate-600 mb-1 block">
              {t('lecturer.searchByCode') || 'Search by code'}
            </label>
            <Input
              placeholder={t('lecturer.codePlaceholder') || 'Enter code...'}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              allowClear
            />
          </div>
          <div className="w-[180px]">
            <label className="text-sm text-slate-600 mb-1 block">
              {t('lecturer.filterByType') || 'Filter by type'}
            </label>
            <Select
              placeholder={t('lecturer.allTypes') || 'All types'}
              value={filterType}
              onChange={(value) => setFilterType(value)}
              allowClear
              style={{ width: '100%' }}
              options={[
                { label: t('lecturer.internal'), value: 'INTERNAL' },
                { label: t('lecturer.external'), value: 'EXTERNAL' },
              ]}
            />
          </div>
          <Button type="primary" onClick={handleSearch} loading={loading}>
            {t('common.search') || 'Search'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/50 shadow-sm overflow-x-auto">
        <Table
          columns={columns}
          dataSource={lecturers}
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

{/* Drawer Form */}
      <Drawer
        title={editingLecturer ? t('lecturer.edit') : t('lecturer.add')}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        size="default"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="mt-4"
        >
          <Form.Item
            name="code"
            label={t('lecturer.code') || 'Code'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Input placeholder="GV001" disabled={!!editingLecturer} />
          </Form.Item>

          <Form.Item
            name="name"
            label={t('lecturer.name') || 'Name'}
          >
            <Input placeholder={t('lecturer.namePlaceholder') || 'Enter lecturer name'} />
          </Form.Item>

          <Form.Item
            name="type"
            label={t('lecturer.type') || 'Type'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Select
              onChange={handleTypeChange}
              options={[
                { label: t('lecturer.internal'), value: 'INTERNAL' },
                { label: t('lecturer.external'), value: 'EXTERNAL' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="gender"
            label={t('lecturer.gender') || 'Gender'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Radio.Group>
              <Radio value="MALE">{t('lecturer.male') || 'Male'}</Radio>
              <Radio value="FEMALE">{t('lecturer.female') || 'Female'}</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="phone"
            label={t('lecturer.phone') || 'Phone'}
            rules={[{ required: true, message: t('common.requiredField') || 'This field is required' }]}
          >
            <Input placeholder="0123456789" />
          </Form.Item>

          {/* Conditional fields for EXTERNAL */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.type !== curr.type}
          >
            {() => {
              const lecturerType = form.getFieldValue('type');
              if (lecturerType === 'EXTERNAL' || editingLecturer?.type === 'EXTERNAL') {
                return (
                  <>
                    <Form.Item
                      name="email"
                      label={t('lecturer.email') || 'Email'}
                      rules={[
                        { required: true, message: t('common.requiredField') || 'This field is required' },
                        { type: 'email', message: 'Invalid email format' }
                      ]}
                    >
                      <Input placeholder="email@example.com" />
                    </Form.Item>

                    <Form.Item
                      name="address"
                      label={t('lecturer.address') || 'Address'}
                    >
                      <Input.TextArea placeholder={t('lecturer.addressPlaceholder') || 'Enter address'} rows={2} />
                    </Form.Item>
                  </>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item className="mb-0 flex justify-end gap-2 mt-4">
            <Button onClick={() => setDrawerVisible(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button type="primary" htmlType="submit" className="bg-blue-600 hover:bg-blue-700">
              {t('common.save') || 'Save'}
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
