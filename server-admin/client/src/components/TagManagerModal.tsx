import { useState } from 'react';
import { Modal, Table, Input, Button, Form, Popconfirm, Divider, Space, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';

interface TagManagerModalProps {
  visible: boolean;
  marketTags: any[];
  onCancel: () => void;
  onSave: (nextTags: any[]) => void;
}

export default function TagManagerModal({
  visible,
  marketTags,
  onCancel,
  onSave
}: TagManagerModalProps) {
  const [form] = Form.useForm();
  
  // 行内编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingZh, setEditingZh] = useState('');
  const [editingEn, setEditingEn] = useState('');

  const handleAdd = (values: any) => {
    const { id, zh, en } = values;
    if (marketTags.some((t) => t.id === id.trim())) {
      message.error('该标签 ID 已存在');
      return;
    }

    const newTag = {
      id: id.trim(),
      zh: zh.trim(),
      en: en ? en.trim() : zh.trim()
    };

    onSave([...marketTags, newTag]);
    form.resetFields();
  };

  const handleDelete = (id: string) => {
    onSave(marketTags.filter((t) => t.id !== id));
    message.success('标签已删除');
  };

  const handleStartEdit = (record: any) => {
    setEditingId(record.id);
    setEditingZh(record.zh || '');
    setEditingEn(record.en || '');
  };

  const handleSaveEdit = (id: string) => {
    if (!editingZh.trim()) {
      message.error('中文名不能为空');
      return;
    }

    const nextTags = marketTags.map((t) => {
      if (t.id === id) {
        return {
          ...t,
          zh: editingZh.trim(),
          en: editingEn ? editingEn.trim() : editingZh.trim()
        };
      }
      return t;
    });

    onSave(nextTags);
    setEditingId(null);
  };

  const columns = [
    {
      title: '标签 ID',
      dataIndex: 'id',
      key: 'id',
      width: '25%',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: '中文名称',
      dataIndex: 'zh',
      key: 'zh',
      width: '30%',
      render: (zh: string, record: any) => {
        if (editingId === record.id) {
          return <Input value={editingZh} onChange={(e) => setEditingZh(e.target.value)} size="small" />;
        }
        return zh || '';
      }
    },
    {
      title: '英文名称',
      dataIndex: 'en',
      key: 'en',
      width: '30%',
      render: (en: string, record: any) => {
        if (editingId === record.id) {
          return <Input value={editingEn} onChange={(e) => setEditingEn(e.target.value)} size="small" />;
        }
        return en || '';
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
              title="确定删除此标签吗？"
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
      title="管理技能市场标签"
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
        <h4 style={{ margin: '0 0 12px 0' }}>新增标签</h4>
        <Form form={form} onFinish={handleAdd} layout="inline" size="middle">
          <Form.Item name="id" rules={[{ required: true, message: 'ID 必填' }]}>
            <Input placeholder="标签 ID (如: academic)" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="zh" rules={[{ required: true, message: '中文名必填' }]}>
            <Input placeholder="中文名 (如: 学术)" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="en">
            <Input placeholder="英文名 (如: Academic)" style={{ width: 140 }} />
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
        dataSource={marketTags}
        columns={columns}
        rowKey="id"
        pagination={false}
        scroll={{ y: 240 }}
        size="small"
      />
    </Modal>
  );
}
