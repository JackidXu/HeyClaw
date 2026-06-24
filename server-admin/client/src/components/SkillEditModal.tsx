import { useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Row, Col, Card, Upload, message } from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';

// 自适应 API 端口基址
const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8082'
    : '';

// 二进制文件流式上传 (对接服务端 /api/upload-file)
const performUpload = (file: File, token: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/upload-file?filename=${encodeURIComponent(file.name)}`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.url) {
            resolve(res.url);
          } else {
            reject(new Error(res.error || '上传响应失败'));
          }
        } catch (e) {
          reject(new Error('解析上传响应出错'));
        }
      } else {
        reject(new Error(`HTTP 状态异常: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('网络连接异常'));
    xhr.send(file);
  });
};

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
        sourceAuthor: skill.source?.author || (isNew ? 'HeyClaw' : ''),
        sourceFrom: skill.source?.from || (isNew ? 'HeyClaw' : 'Github'),
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
              label="技能别名名称 (name)"
              name="name"
              rules={[{ required: true, message: '请输入技能名称' }]}
            >
              <Input placeholder="如: 网页搜索 或 code-formatter" />
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
              <Form.Item
                label="技能 Zip 资源包 (url)"
                name="url"
                rules={[{ required: true, message: '请上传技能 Zip 资源包' }]}
                style={{ marginBottom: 16 }}
              >
                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.url !== curr.url}>
                  {({ getFieldValue }) => {
                    const zipUrl = getFieldValue('url') || '';
                    const zipFileList = zipUrl ? [{
                      uid: '-1',
                      name: zipUrl.substring(zipUrl.lastIndexOf('/') + 1) || 'skill.zip',
                      status: 'done' as const,
                      url: zipUrl
                    }] : [];

                    return (
                      <Upload
                        fileList={zipFileList}
                        customRequest={async (options) => {
                          const { file, onSuccess, onError } = options;
                          try {
                            const url = await performUpload(file as File, token);
                            form.setFieldsValue({ url });
                            onSuccess?.(url);
                            message.success('资源包上传成功');
                          } catch (err: any) {
                            onError?.(err);
                            message.error(`资源包上传失败: ${err.message}`);
                          }
                        }}
                        onRemove={() => {
                          form.setFieldsValue({ url: '' });
                        }}
                        beforeUpload={(file) => {
                          const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
                          if (ext !== '.zip') {
                            message.error('仅支持上传 .zip 文件');
                            return Upload.LIST_IGNORE;
                          }
                          return true;
                        }}
                      >
                        {zipFileList.length >= 1 ? null : (
                          <Button icon={<PlusOutlined />}>上传 Zip 资源包</Button>
                        )}
                      </Upload>
                    );
                  }}
                </Form.Item>
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
