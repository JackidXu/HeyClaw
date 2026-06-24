import { useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Row, Col, Card } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';
import UploadDropzone from './UploadDropzone';

interface SkillEditModalProps {
  visible: boolean;
  skill: any;
  isNew: boolean;
  marketTags: any[];
  token: string;
  onCancel: () => void;
  onSave: (payload: any) => void;
}

export default function SkillEditModal({
  visible,
  skill,
  isNew,
  marketTags,
  token,
  onCancel,
  onSave
}: SkillEditModalProps) {
  const [form] = Form.useForm();

  const getLocText = (field: any, lang: 'zh' | 'en' = 'zh'): string => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field['en'] || '';
  };

  useEffect(() => {
    if (visible && skill) {
      form.setFieldsValue({
        id: skill.id || '',
        _type: skill._type || 'marketplace',
        name: skill.name || '',
        version: skill.version || '1.0.0',
        url: skill.url || '',
        tagsSelected: skill.tagsSelected || [],
        sourceAuthor: skill.source?.author || '',
        sourceFrom: skill.source?.from || 'Github',
        sourceUrl: skill.source?.url || '',
        descriptionZh: getLocText(skill.description, 'zh'),
        descriptionEn: getLocText(skill.description, 'en')
      });
    } else {
      form.resetFields();
    }
  }, [visible, skill, form]);

  const isLocal = skill?._type === 'localSkill';

  const onFinish = (values: any) => {
    const {
      id,
      name,
      version,
      url,
      tagsSelected,
      sourceAuthor,
      sourceFrom,
      sourceUrl,
      descriptionZh,
      descriptionEn
    } = values;

    let payloadSkill: any;
    if (isLocal) {
      payloadSkill = {
        id: id.trim(),
        _type: 'localSkill',
        name: name.trim(),
        version: version ? version.trim() : '1.0.0',
        description: {
          zh: descriptionZh.trim(),
          en: descriptionEn.trim()
        }
      };
    } else {
      let source = null;
      if (sourceAuthor.trim() || sourceFrom.trim() || sourceUrl.trim()) {
        source = {
          author: sourceAuthor.trim(),
          from: sourceFrom.trim() || 'Github',
          url: sourceUrl.trim()
        };
      }

      payloadSkill = {
        id: id.trim(),
        _type: 'marketplace',
        name: name.trim(),
        version: version ? version.trim() : '1.0.0',
        url: url ? url.trim() : '',
        tags: tagsSelected || [],
        source,
        description: {
          zh: descriptionZh.trim(),
          en: descriptionEn.trim()
        }
      };
    }

    onSave(payloadSkill);
  };

  return (
    <Modal
      title={isNew ? (isLocal ? '新增本地内置技能' : '新增技能市场项目') : (isLocal ? '编辑本地内置技能' : '编辑技能市场项目')}
      open={visible}
      onCancel={onCancel}
      width={680}
      footer={[
        <Button key="cancel" icon={<CloseOutlined />} onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>
          保存更改
        </Button>
      ]}
      style={{ top: 30 }}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        requiredMark
        size="middle"
        style={{ maxHeight: '78vh', overflowY: 'auto', paddingRight: 8 }}
      >
        {/* Card 1：基本配置 */}
        <Card title="基本配置" size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            label="技能唯一标识 ID (唯一且必填)"
            name="id"
            rules={[{ required: true, message: '请输入唯一技能 ID' }]}
          >
            <Input disabled={!isNew} placeholder="如: code-beautify" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
            <Form.Item
              label="技能别名名称 (name，纯小写英文)"
              name="name"
              rules={[{ required: true, message: '请输入技能名称' }]}
            >
              <Input placeholder="如: code-formatter" />
            </Form.Item>

            <Form.Item label="版本号" name="version">
              <Input placeholder="1.0.0" />
            </Form.Item>
          </div>
        </Card>

        {/* 仅当不是本地技能时，才显示市场专属属性卡片 */}
        {!isLocal && (
          <>
            {/* Card 2：技能市场标签 (tags) */}
            <Card title="关联市场标签 (tags)" size="small" style={{ marginBottom: 16 }}>
              <Form.Item name="tagsSelected" style={{ marginBottom: 0 }}>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="选择该技能所属的标签"
                  options={marketTags.map((tag) => ({
                    value: tag.id,
                    label: `${tag.zh} (${tag.id})`
                  }))}
                />
              </Form.Item>
            </Card>

            {/* Card 3：云端 Zip 资源配置 */}
            <Card title="云端 Zip 资源配置" size="small" style={{ marginBottom: 16 }}>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.url !== curr.url}>
                {({ getFieldValue }) => {
                  const currentUrl = getFieldValue('url');
                  return (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(0, 0, 0, 0.88)', marginBottom: 8 }}>
                        技能 Zip 资源包 (url)
                      </div>
                      {currentUrl ? (
                        <div style={{ padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: '13px', color: '#389e0d', wordBreak: 'break-all' }}>
                            ✓ 已绑定云端资源包：{currentUrl}
                          </span>
                          <Button 
                            type="link" 
                            danger 
                            size="small" 
                            icon={<CloseOutlined />}
                            onClick={() => form.setFieldsValue({ url: '' })}
                          >
                            清除
                          </Button>
                        </div>
                      ) : (
                        <div style={{ padding: '8px 12px', background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 6, fontSize: '13px', color: '#8c8c8c', marginBottom: 8 }}>
                          💡 提示：云端市场技能 运行必须上传配置该 Zip。
                        </div>
                      )}
                      <UploadDropzone
                        token={token}
                        accept=".zip"
                        placeholderText="点击或拖拽上传技能 Zip 包"
                        onUploadSuccess={(url) => form.setFieldsValue({ url })}
                      />
                    </div>
                  );
                }}
              </Form.Item>
              <Form.Item name="url" style={{ margin: 0, height: 0, overflow: 'hidden' }}>
                <Input />
              </Form.Item>
            </Card>

            {/* Card 4：源码与作者配置 (source) */}
            <Card title="源码与作者配置 (source)" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="作者 (author)" name="sourceAuthor">
                    <Input placeholder="如: NetEase" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="来源平台 (from)" name="sourceFrom">
                    <Input placeholder="Github" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="源码仓库地址" name="sourceUrl" style={{ marginBottom: 0 }}>
                <Input placeholder="https://github.com/..." />
              </Form.Item>
            </Card>
          </>
        )}

        {/* Card 5：中英文描述 */}
        <Card title="中英文描述" size="small">
          <Form.Item
            label="中文描述信息"
            name="descriptionZh"
            rules={[{ required: true, message: '中文描述必填' }]}
          >
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 3 }} placeholder="输入中文描述" />
          </Form.Item>
          <Form.Item
            label="英文描述信息"
            name="descriptionEn"
            rules={[{ required: true, message: '英文描述必填' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 3 }} placeholder="Description in English" />
          </Form.Item>
        </Card>
      </Form>
    </Modal>
  );
}
