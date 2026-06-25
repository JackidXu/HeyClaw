import { useEffect } from 'react';
import { Modal, Form, Input, Button, Row, Col, Card, Select, message, ColorPicker } from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { TextArea } = Input;

interface QuickActionEditModalProps {
  visible: boolean;
  action: any | null;
  isNew: boolean;
  onCancel: () => void;
  onSave: (values: any) => Promise<void>;
}

export default function QuickActionEditModal({
  visible,
  action,
  isNew,
  onCancel,
  onSave
}: QuickActionEditModalProps) {
  const [form] = Form.useForm();

  // 当 action 改变或 visible 改变时，初始化表单值
  useEffect(() => {
    if (visible && action) {
      form.setFieldsValue({
        id: action.id || '',
        icon: action.icon || '',
        color: action.color || '#1890ff',
        skillMapping: action.skillMapping || '',
        labelZh: action.labelZh || '',
        labelEn: action.labelEn || '',
        prompts: action.prompts || []
      });
    } else {
      form.resetFields();
    }
  }, [visible, action, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await onSave(values);
    } catch (err) {
      message.error('表单校验失败，请检查必填项');
    }
  };

  return (
    <Modal
      title={isNew ? '新增快速提问分类' : '编辑快速提问分类'}
      open={visible}
      onCancel={onCancel}
      width={900}
      style={{ top: 40 }}
      footer={[
        <Button key="cancel" icon={<CloseOutlined />} onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" icon={<SaveOutlined />} onClick={handleSubmit}>
          保存并上传
        </Button>
      ]}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ color: '#1890ff', prompts: [] }}
      >
        <Card title="基础信息配置" size="small" style={{ marginBottom: 20, borderRadius: 8, background: '#fafafa' }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="分类 ID (英文唯一标识)"
                name="id"
                rules={[
                  { required: true, message: '请输入分类唯一标识 ID' },
                  { pattern: /^[a-zA-Z0-9_-]+$/, message: '仅支持字母、数字、下划线和连字符' }
                ]}
              >
                <Input placeholder="例如: ai-search" disabled={!isNew} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="卡片图标 (展示 Emoji 图标)"
                name="icon"
                rules={[{ required: true, message: '请输入卡片图标' }]}
                extra="直接输入一个用于该分类卡片的展示 Emoji 图标，例如: 🔍、📱、👔、🔄"
              >
                <Input placeholder="例如: 🔍" style={{ fontSize: '16px' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="主题色彩"
                name="color"
                rules={[{ required: true, message: '请选择卡片主题色' }]}
                getValueFromEvent={(color) => {
                  return typeof color === 'string' ? color : color.toHexString();
                }}
              >
                <ColorPicker showText trigger="click" style={{ width: '100%', display: 'flex', justifyContent: 'flex-start' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="关联技能 ID (选填)"
                name="skillMapping"
              >
                <Input placeholder="例如: stock-explorer" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="中文显示名称 (Label Zh)"
                name="labelZh"
                rules={[{ required: true, message: '请输入中文显示标题' }]}
              >
                <Input placeholder="例如: AI 搜索优化" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="英文显示名称 (Label En)"
                name="labelEn"
                rules={[{ required: true, message: '请输入英文显示标题' }]}
              >
                <Input placeholder="例如: AI Search Optimization" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: '15px', color: '#262626' }}>
          子提示词管理 (Prompts)
        </div>

        <Form.List name="prompts">
          {(fields, { add, remove }) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {fields.map(({ key, name, ...restField }, index) => (
                <Card
                  key={key}
                  size="small"
                  title={`提示词项 #${index + 1}`}
                  style={{ borderRadius: 8 }}
                  extra={
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(name)}
                    >
                      移除该项
                    </Button>
                  }
                >
                  <Row gutter={16}>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        {...restField}
                        label="提示词 ID (唯一标识)"
                        name={[name, 'id']}
                        rules={[
                          { required: true, message: '请输入子项 ID' },
                          { pattern: /^[a-zA-Z0-9_-]+$/, message: '仅支持字母、数字、下划线和连字符' }
                        ]}
                      >
                        <Input placeholder="例如: outline-extraction" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        {...restField}
                        label="展示 Emoji 图标 (选填)"
                        name={[name, 'icon']}
                      >
                        <Input placeholder="例如: 📝" style={{ fontSize: '16px' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        {...restField}
                        label="关联标签 tags (输入并按回车确认)"
                        name={[name, 'tags']}
                      >
                        <Select
                          mode="tags"
                          placeholder="例如: 写作, 爆款"
                          style={{ width: '100%' }}
                          tokenSeparators={[',', '，']}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        {...restField}
                        label="中文标题 (Label Zh)"
                        name={[name, 'labelZh']}
                        rules={[{ required: true, message: '请输入中文标题' }]}
                      >
                        <Input placeholder="例如: 网页大纲提取" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        {...restField}
                        label="英文标题 (Label En)"
                        name={[name, 'labelEn']}
                        rules={[{ required: true, message: '请输入英文标题' }]}
                      >
                        <Input placeholder="例如: Extract Outline" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        {...restField}
                        label="中文描述 (Description Zh, 选填)"
                        name={[name, 'descriptionZh']}
                      >
                        <Input placeholder="一句话简单解释它的用处" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        {...restField}
                        label="英文描述 (Description En, 选填)"
                        name={[name, 'descriptionEn']}
                      >
                        <Input placeholder="A simple description in English" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        {...restField}
                        label="中文完整提示词 (Prompt Zh)"
                        name={[name, 'promptZh']}
                        rules={[{ required: true, message: '请输入中文提示词内容' }]}
                      >
                        <TextArea
                          rows={4}
                          placeholder="在这里撰写发给大模型的详细 Prompt 指令..."
                          style={{ fontFamily: 'monospace' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        {...restField}
                        label="英文完整提示词 (Prompt En)"
                        name={[name, 'promptEn']}
                        rules={[{ required: true, message: '请输入英文提示词内容' }]}
                      >
                        <TextArea
                          rows={4}
                          placeholder="Write the detailed Prompt instructions in English here..."
                          style={{ fontFamily: 'monospace' }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              ))}

              <Button
                type="dashed"
                onClick={() => add()}
                block
                icon={<PlusOutlined />}
                style={{ height: 45, borderRadius: 8 }}
              >
                添加子提示词项 (Prompt Item)
              </Button>
            </div>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}
