import { useState } from 'react';
import { Modal, Table, Input, Button, Form, Popconfirm, Divider, Space, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';

interface CategoryManagerModalProps {
  visible: boolean;
  categories: any[];
  kitsList: any[];
  onCancel: () => void;
  onSave: (nextCategories: any[]) => void;
}

export default function CategoryManagerModal({
  visible,
  categories,
  kitsList,
  onCancel,
  onSave
}: CategoryManagerModalProps) {
  const [form] = Form.useForm();
  
  // 行内编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingZh, setEditingZh] = useState('');
  const [editingEn, setEditingEn] = useState('');

  const handleAdd = (values: any) => {
    const { id, zh, en } = values;
    if (categories.some((c) => c.id === id.trim())) {
      message.error('该分类 ID 已存在');
      return;
    }

    const newCategory = {
      id: id.trim(),
      name: {
        zh: zh.trim(),
        en: en ? en.trim() : zh.trim()
      }
    };

    onSave([...categories, newCategory]);
    form.resetFields();
  };

  const handleDelete = (id: string) => {
    const isUsed = kitsList.some((k) => k.category === id);
    const performDelete = () => {
      onSave(categories.filter((c) => c.id !== id));
      message.success('分类已删除');
    };

    if (isUsed) {
      Modal.confirm({
        title: '警告',
        content: `当前有专家套件正在使用该分类「${id}」，删除后该分类可能无法正常归类。您确认删除吗？`,
        okText: '确认删除',
        cancelText: '取消',
        onOk: performDelete
      });
    } else {
      performDelete();
    }
  };

  const handleStartEdit = (record: any) => {
    setEditingId(record.id);
    setEditingZh(record.name?.zh || '');
    setEditingEn(record.name?.en || '');
  };

  const handleSaveEdit = (id: string) => {
    if (!editingZh.trim()) {
      message.error('中文名不能为空');
      return;
    }

    const nextCategories = categories.map((c) => {
      if (c.id === id) {
        return {
          ...c,
          name: {
            zh: editingZh.trim(),
            en: editingEn ? editingEn.trim() : editingZh.trim()
          }
        };
      }
      return c;
    });

    onSave(nextCategories);
    setEditingId(null);
  };

  const columns = [
    {
      title: '分类 ID',
      dataIndex: 'id',
      key: 'id',
      width: '25%',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: '中文名称',
      dataIndex: 'name',
      key: 'name_zh',
      width: '30%',
      render: (name: any, record: any) => {
        if (editingId === record.id) {
          return <Input value={editingZh} onChange={(e) => setEditingZh(e.target.value)} size="small" />;
        }
        return name?.zh || '';
      }
    },
    {
      title: '英文名称',
      dataIndex: 'name',
      key: 'name_en',
      width: '30%',
      render: (name: any, record: any) => {
        if (editingId === record.id) {
          return <Input value={editingEn} onChange={(e) => setEditingEn(e.target.value)} size="small" />;
        }
        return name?.en || '';
      }
    },
    {
      title: '操作',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: any) => {
        if (editingId === record.id) {
          return (
            <Space>
              <Button
                type="link"
                icon={<CheckOutlined />}
                size="small"
                onClick={() => handleSaveEdit(record.id)}
              >
                保存
              </Button>
              <Button
                type="link"
                icon={<CloseOutlined />}
                size="small"
                danger
                onClick={() => setEditingId(null)}
              >
                取消
              </Button>
            </Space>
          );
        }
        return (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleStartEdit(record)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确定删除此分类吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" icon={<DeleteOutlined />} size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        );
      }
    }
  ];

  return (
    <Modal
      title="管理套件分类"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>
      ]}
      width={700}
    >
      <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <h4 style={{ margin: '0 0 12px 0' }}>新增分类</h4>
        <Form form={form} onFinish={handleAdd} layout="inline" size="middle">
          <Form.Item name="id" rules={[{ required: true, message: 'ID 必填' }]}>
            <Input placeholder="分类 ID (如: finance)" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="zh" rules={[{ required: true, message: '中文名必填' }]}>
            <Input placeholder="中文名 (如: 金融)" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="en">
            <Input placeholder="英文名 (如: Finance)" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item style={{ marginRight: 0 }}>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
              添加
            </Button>
          </Form.Item>
        </Form>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <Table
        dataSource={categories}
        columns={columns}
        rowKey="id"
        pagination={false}
        scroll={{ y: 240 }}
        size="small"
      />
    </Modal>
  );
}
