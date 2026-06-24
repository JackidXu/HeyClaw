import { useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Space, Card, Divider, Collapse } from 'antd';
import { PlusOutlined, MinusCircleOutlined, SaveOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import UploadDropzone from './UploadDropzone';

const { Option } = Select;

interface KitEditModalProps {
  visible: boolean;
  kit: any;
  isNew: boolean;
  allSkills: any[];
  categories: any[];
  token: string;
  onCancel: () => void;
  onSave: (payload: any) => void;
}

export default function KitEditModal({
  visible,
  kit,
  isNew,
  categories,
  token,
  onCancel,
  onSave
}: KitEditModalProps) {
  const [form] = Form.useForm();
  const isLocalKit = kit?._type === 'localKit';

  // 辅助解析多语言文本
  const getLocText = (field: any, lang: 'zh' | 'en' = 'zh'): string => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field['en'] || '';
  };

  // 监听 kit 改变回填表单
  useEffect(() => {
    if (visible && kit) {
      const skillsList = (kit.skills?.list || []).map((s: any) => ({
        id: s.id || '',
        name: s.name || '',
        descriptionZh: getLocText(s.description, 'zh'),
        descriptionEn: getLocText(s.description, 'en')
      }));
      const tryAskingList = (kit.tryAsking || []).map((item: any) => ({
        zh: item.zh || '',
        en: item.en || ''
      }));

      const rawMcpList = Array.isArray(kit.mcpServers) ? kit.mcpServers : [];
      const mcpList = rawMcpList.map((item: any) => ({
        id: item.id || '',
        name: item.name || '',
        transportType: item.transportType || 'stdio',
        commandOrUrl: item.command || item.url || '',
        argsCsv: Array.isArray(item.args) ? item.args.join(', ') : ''
      }));

      const rawConnectorList = Array.isArray(kit.connectors) ? kit.connectors : [];
      const connectorList = rawConnectorList.map((item: any) => ({
        id: item.id || '',
        name: item.name || '',
        type: item.type || '',
        url: item.url || ''
      }));

      const tagsList = (kit.tags || []).map((t: any) => ({
        textZh: getLocText(t.text, 'zh'),
        textEn: getLocText(t.text, 'en'),
        color: t.color || 'sky'
      }));

      form.setFieldsValue({
        id: kit.id || '',
        category: kit.category || 'market',
        nameZh: getLocText(kit.name, 'zh'),
        nameEn: getLocText(kit.name, 'en'),
        descriptionZh: getLocText(kit.description, 'zh'),
        descriptionEn: getLocText(kit.description, 'en'),
        author: kit.author || 'HeyClaw',
        version: kit.version || '1.0.0',
        downloadCount: kit.downloadCount || '0',
        icon: kit.icon || '',
        bundleUrl: kit.skills?.bundle || '',
        skillsList,
        tryAskingList,
        mcpList,
        connectorList,
        taglineZh: getLocText(kit.tagline, 'zh'),
        taglineEn: getLocText(kit.tagline, 'en'),
        mottoZh: getLocText(kit.motto, 'zh'),
        mottoEn: getLocText(kit.motto, 'en'),
        avatarBg: kit.avatarBg || 'sky',
        tagsList
      });
    } else {
      form.resetFields();
    }
  }, [visible, kit, form]);

  const onFinish = (values: any) => {
    const {
      id,
      category,
      nameZh,
      nameEn,
      descriptionZh,
      descriptionEn,
      author,
      version,
      downloadCount,
      icon,
      bundleUrl,
      skillsList,
      tryAskingList,
      mcpList,
      connectorList,
      taglineZh,
      taglineEn,
      mottoZh,
      mottoEn,
      avatarBg,
      tagsList
    } = values;

    // 1. 组装关联技能并保留历史关联
    const finalSkills = (skillsList || []).map((s: any) => ({
      id: (s.id || '').trim(),
      name: (s.name || '').trim() || `/${(s.id || '').trim()}`, // 缺省时自动补充前缀 /
      description: {
        zh: (s.descriptionZh || '').trim(),
        en: (s.descriptionEn || '').trim()
      }
    }));

    // 2. 组装提问示例
    const tryAsking = (tryAskingList || []).map((item: any) => ({
      zh: item.zh,
      en: item.en || item.zh
    }));

    // 3. 组装 MCP
    const mcpServers = (mcpList || []).map((item: any) => {
      const isStdio = item.transportType === 'stdio';
      const args = item.argsCsv
        ? item.argsCsv.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
      return {
        id: item.id || Math.random().toString(36).substr(2, 9),
        name: item.name,
        transportType: item.transportType,
        enabled: true,
        isBuiltIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...(isStdio
          ? { command: item.commandOrUrl, args }
          : { url: item.commandOrUrl })
      };
    });

    // 4. 组装 Connectors
    const connectors = (connectorList || []).map((item: any) => ({
      id: item.id || Math.random().toString(36).substr(2, 9),
      name: item.name,
      type: item.type,
      url: item.url
    }));

    // 5. 最终组装的 JSON 格式 payload (根据大类分治，支持干净的去冗余少字段方案)
    let payloadKit: any;
    if (isLocalKit) {
      payloadKit = {
        id: id.trim(),
        _type: 'localKit', // 保留大类标记用于 App.tsx 保存路由分发
        category: category || 'market',
        name: { zh: nameZh.trim(), en: nameEn.trim() },
        description: { zh: descriptionZh.trim(), en: descriptionEn.trim() },
        author: author ? author.trim() : 'HeyClaw',
        version: version ? version.trim() : '1.0.0',
        icon: icon ? icon.trim() : '',
        skills: {
          list: finalSkills
          // 本地内置专家在物理上不包含 bundle 键，精简字段
        },
        tryAsking,
        tagline: { zh: (taglineZh || '').trim(), en: (taglineEn || '').trim() },
        motto: { zh: (mottoZh || '').trim(), en: (mottoEn || '').trim() },
        avatarBg: avatarBg || 'sky',
        tags: (tagsList || []).slice(0, 3).map((t: any) => ({
          text: { zh: (t.textZh || '').trim(), en: (t.textEn || '').trim() },
          color: t.color || 'sky'
        }))
      };
    } else {
      payloadKit = {
        id: id.trim(),
        _type: 'marketplace', // 保留大类标记用于 App.tsx 保存路由分发
        category: category || 'market',
        name: { zh: nameZh.trim(), en: nameEn.trim() },
        description: { zh: descriptionZh.trim(), en: descriptionEn.trim() },
        author: author ? author.trim() : 'HeyClaw',
        version: version ? version.trim() : '1.0.0',
        downloadCount: downloadCount ? downloadCount.trim() : '0',
        icon: icon ? icon.trim() : '',
        skills: {
          list: finalSkills,
          bundle: bundleUrl || ''
        },
        tryAsking,
        tagline: { zh: (taglineZh || '').trim(), en: (taglineEn || '').trim() },
        motto: { zh: (mottoZh || '').trim(), en: (mottoEn || '').trim() },
        avatarBg: avatarBg || 'sky',
        tags: (tagsList || []).slice(0, 3).map((t: any) => ({
          text: { zh: (t.textZh || '').trim(), en: (t.textEn || '').trim() },
          color: t.color || 'sky'
        }))
      };
    }

    // 仅在有依赖值时才输出字段，免去 json 写入多余 null 键
    if (mcpServers.length > 0) {
      payloadKit.mcpServers = mcpServers;
    }
    if (connectors.length > 0) {
      payloadKit.connectors = connectors;
    }

    onSave(payloadKit);
  };

  return (
    <Modal
      title={isNew ? (isLocalKit ? '新增本地内置专家' : '新增专家套件') : (isLocalKit ? '编辑本地内置专家' : '编辑专家套件')}
      open={visible}
      onCancel={onCancel}
      width={720}
      footer={[
        <Button key="cancel" icon={<CloseOutlined />} onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>
          保存更改
        </Button>
      ]}
      style={{ top: 20 }}
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
        {/* Card 1：基础信息 */}
        <Card title="基础信息" size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item
              label="套件 ID (唯一/必填)"
              name="id"
              rules={[{ required: true, message: '请输入套件唯一 ID' }]}
            >
              <Input disabled={!isNew} placeholder="如: code-copilot" />
            </Form.Item>
            <Form.Item
              label="套件分类 (category)"
              name="category"
              rules={[{ required: true, message: '请选择分类' }]}
            >
              <Select placeholder="请选择套件分类">
                {categories.map((cat: any) => (
                  <Option key={cat.id} value={cat.id}>
                    {getLocText(cat.name, 'zh')} ({cat.id})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item
              label="中文名称"
              name="nameZh"
              rules={[{ required: true, message: '请输入套件中文名称' }]}
            >
              <Input placeholder="如: 编程助手" />
            </Form.Item>
            <Form.Item
              label="英文名称"
              name="nameEn"
              rules={[{ required: true, message: '请输入套件英文名称' }]}
            >
              <Input placeholder="如: Code Copilot" />
            </Form.Item>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isLocalKit ? '1.2fr 0.8fr' : '1fr 0.8fr 1fr',
            gap: '12px'
          }}>
            <Form.Item label="作者 (author)" name="author">
              <Input placeholder="默认: HeyClaw" />
            </Form.Item>
            <Form.Item
              label="版本号"
              name="version"
              rules={[{ required: true, message: '必填' }]}
            >
              <Input placeholder="1.0.0" />
            </Form.Item>
            {!isLocalKit && (
              <Form.Item label="已下载次数" name="downloadCount">
                <Input placeholder="0" />
              </Form.Item>
            )}
          </div>
        </Card>

        {/* Card 2：云端资源与图标上传 */}
        <Card title="云端资源与图标" size="small" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(0, 0, 0, 0.88)', marginBottom: 8 }}>
            套件图标 (icon)
          </div>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.icon !== curr.icon}>
            {({ getFieldValue }) => {
              const currentIcon = getFieldValue('icon');
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  {currentIcon ? (
                    <div style={{ position: 'relative', width: 64, height: 64, border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                      <img src={currentIcon} alt="icon" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      <Button 
                        type="primary" 
                        danger 
                        shape="circle" 
                        icon={<DeleteOutlined />} 
                        size="small" 
                        style={{ position: 'absolute', right: 2, top: 2, fontSize: 10, width: 20, height: 20, minWidth: 20 }}
                        onClick={() => form.setFieldsValue({ icon: '' })}
                      />
                    </div>
                  ) : (
                    <div style={{ width: 64, height: 64, border: '1px dashed #d9d9d9', borderRadius: 8, background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bfbfbf', fontSize: '11px' }}>
                      暂无图标
                    </div>
                  )}
                  <div style={{ flexGrow: 1 }}>
                    <UploadDropzone
                      token={token}
                      accept="image/*"
                      placeholderText="点击或拖拽上传并替换新图标"
                      onUploadSuccess={(url) => form.setFieldsValue({ icon: url })}
                    />
                  </div>
                </div>
              );
            }}
          </Form.Item>
          <Form.Item name="icon" style={{ margin: 0, height: 0, overflow: 'hidden' }}>
            <Input />
          </Form.Item>

          {!isLocalKit && (
            <>
              <Divider style={{ margin: '16px 0 16px 0' }} />
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.bundleUrl !== curr.bundleUrl}>
                {({ getFieldValue }) => {
                  const currentBundleUrl = getFieldValue('bundleUrl');
                  return (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: 'rgba(0, 0, 0, 0.88)', marginBottom: 8 }}>
                        套件 Zip 资源包 (bundleUrl) <span style={{ color: '#ff4d4f' }}>*</span>
                      </div>
                      {currentBundleUrl ? (
                        <div style={{ padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: '13px', color: '#389e0d', wordBreak: 'break-all' }}>
                            ✓ 已绑定云端资源包：{currentBundleUrl}
                          </span>
                          <Button 
                            type="link" 
                            danger 
                            size="small" 
                            icon={<DeleteOutlined />}
                            onClick={() => form.setFieldsValue({ bundleUrl: '' })}
                          >
                            清除
                          </Button>
                        </div>
                      ) : (
                        <div style={{ padding: '8px 12px', background: '#fff2e8', border: '1px solid #ffbb96', borderRadius: 6, fontSize: '13px', color: '#d4380d', marginBottom: 8 }}>
                          ⚠ 尚未上传云端资源包，请在下方拖拽或点击上传。
                        </div>
                      )}
                      <UploadDropzone
                        token={token}
                        accept=".zip"
                        placeholderText="点击或拖拽上传套件 Zip 包"
                        onUploadSuccess={(url) => form.setFieldsValue({ bundleUrl: url })}
                      />
                    </div>
                  );
                }}
              </Form.Item>
              <Form.Item
                name="bundleUrl"
                rules={[{ required: true, message: '请上传套件 Zip 资源包' }]}
                style={{ margin: 0, height: 0, overflow: 'hidden' }}
              >
                <Input />
              </Form.Item>
            </>
          )}
        </Card>

        {/* Card 3：关联技能配置 */}
        <Card title="关联技能配置" size="small" style={{ marginBottom: 16 }}>
          <Form.List name="skillsList">
            {(fields, { add, remove }) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {fields.map(({ key, name, ...restField }) => (
                  <div
                    key={key}
                    style={{
                      padding: '12px 12px 12px 12px',
                      background: '#fafafa',
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                      position: 'relative'
                    }}
                  >
                    <MinusCircleOutlined
                      style={{ position: 'absolute', right: 10, top: 10, color: '#ff4d4f', zIndex: 2 }}
                      onClick={() => remove(name)}
                    />
                    <Form.Item
                      {...restField}
                      label="技能唯一标识 ID (id)"
                      name={[name, 'id']}
                      rules={[{ required: true, message: '请输入技能唯一 ID' }]}
                      style={{ marginBottom: 8 }}
                    >
                      <Input 
                        placeholder="如: architecture" 
                        onChange={(e) => {
                          // 自动补全 name 为 /id 的小交互
                          const val = e.target.value;
                          const nameVal = form.getFieldValue(['skillsList', name, 'name']);
                          if (!nameVal || nameVal === `/${val.slice(0, -1)}`) {
                            form.setFieldValue(['skillsList', name, 'name'], val ? `/${val}` : '');
                          }
                        }}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      label="技能指令名称 (name)"
                      name={[name, 'name']}
                      rules={[{ required: true, message: '请输入技能指令名称' }]}
                      style={{ marginBottom: 8 }}
                    >
                      <Input placeholder="如: /architecture" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      label="中文描述"
                      name={[name, 'descriptionZh']}
                      rules={[{ required: true, message: '请输入中文描述' }]}
                      style={{ marginBottom: 8 }}
                    >
                      <Input.TextArea autoSize={{ minRows: 2, maxRows: 3 }} placeholder="中文描述该技能作用" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      label="英文描述"
                      name={[name, 'descriptionEn']}
                      rules={[{ required: true, message: '请输入英文描述' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input.TextArea autoSize={{ minRows: 2, maxRows: 3 }} placeholder="英文描述该技能作用" />
                    </Form.Item>
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加关联技能
                </Button>
              </div>
            )}
          </Form.List>
        </Card>

        {/* Card 4：中英文描述 */}
        <Card title="中英文描述" size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            label="中文描述"
            name="descriptionZh"
            rules={[{ required: true, message: '中文描述必填' }]}
          >
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 3 }} placeholder="请简要描述套件功能" />
          </Form.Item>
          <Form.Item
            label="英文描述"
            name="descriptionEn"
            rules={[{ required: true, message: '英文描述必填' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 3 }} placeholder="Description in English" />
          </Form.Item>
        </Card>

        {/* 外观呈现与个性化配置 */}
        <Card title="外观呈现与个性化配置" size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item
              label="中文一句话定位 (tagline)"
              name="taglineZh"
              rules={[{ required: true, message: '请输入中文一句话定位' }]}
            >
              <Input placeholder="如: 代码编写 · 系统架构" />
            </Form.Item>
            <Form.Item
              label="英文一句话定位 (tagline)"
              name="taglineEn"
              rules={[{ required: true, message: '请输入英文一句话定位' }]}
            >
              <Input placeholder="如: Code Writing · System Architecture" />
            </Form.Item>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item
              label="中文专家格言/座右铭 (motto)"
              name="mottoZh"
              rules={[{ required: true, message: '请输入中文专家座右铭' }]}
            >
              <Input.TextArea autoSize={{ minRows: 1, maxRows: 2 }} placeholder="如: 别家还在找 bug，我已重构完成" />
            </Form.Item>
            <Form.Item
              label="英文专家格言/座右铭 (motto)"
              name="mottoEn"
              rules={[{ required: true, message: '请输入英文专家座右铭' }]}
            >
              <Input.TextArea autoSize={{ minRows: 1, maxRows: 2 }} placeholder="如: Others are debugging, I've refactored." />
            </Form.Item>
          </div>

          <Form.Item
            label="专家头像背景色 (avatarBg)"
            name="avatarBg"
            rules={[{ required: true, message: '请选择头像背景色' }]}
            style={{ marginBottom: 0 }}
          >
            <Select placeholder="选择头像背景色">
              <Option value="sky">sky (天蓝)</Option>
              <Option value="purple">purple (紫色)</Option>
              <Option value="slate">slate (石板灰)</Option>
              <Option value="emerald">emerald (翡翠绿)</Option>
              <Option value="amber">amber (琥珀黄)</Option>
              <Option value="rose">rose (玫瑰红)</Option>
              <Option value="indigo">indigo (靛蓝)</Option>
              <Option value="orange">orange (橙色)</Option>
            </Select>
          </Form.Item>
        </Card>

        {/* 特色高光标签 (最多 3 个) */}
        <Card title="特色高光标签 (最多 3 个)" size="small" style={{ marginBottom: 16 }}>
          <Form.List name="tagsList">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 4 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'textZh']}
                      rules={[{ required: true, message: '中文必填' }]}
                      style={{ margin: 0 }}
                    >
                      <Input placeholder="中文标签文本 (如: 架构决策)" style={{ width: 220 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'textEn']}
                      rules={[{ required: true, message: '英文必填' }]}
                      style={{ margin: 0 }}
                    >
                      <Input placeholder="英文标签文本 (如: ADR)" style={{ width: 220 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'color']}
                      rules={[{ required: true, message: '必选' }]}
                      style={{ margin: 0 }}
                    >
                      <Select placeholder="颜色" style={{ width: 140 }}>
                        <Option value="sky">sky (天蓝)</Option>
                        <Option value="purple">purple (紫色)</Option>
                        <Option value="slate">slate (石板灰)</Option>
                        <Option value="emerald">emerald (翡翠绿)</Option>
                        <Option value="amber">amber (琥珀黄)</Option>
                        <Option value="rose">rose (玫瑰红)</Option>
                        <Option value="indigo">indigo (靛蓝)</Option>
                        <Option value="orange">orange (橙色)</Option>
                      </Select>
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                  </Space>
                ))}
                {fields.length < 3 ? (
                  <Button type="dashed" onClick={() => add({ color: 'sky' })} block icon={<PlusOutlined />}>
                    添加特色标签 (当前 {fields.length}/3)
                  </Button>
                ) : (
                  <div style={{ textAlign: 'center', color: '#8c8c8c', fontSize: '13px', padding: '4px 0' }}>
                    已达到标签上限 3 个，若要添加新标签，请先删除已有标签。
                  </div>
                )}
              </Space>
            )}
          </Form.List>
        </Card>

        {/* Card 5：推荐提问示例 */}
        <Card title="推荐提问示例 (tryAsking)" size="small" style={{ marginBottom: 16 }}>
          <Form.List name="tryAskingList">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 4 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'zh']}
                      rules={[{ required: true, message: '中文必填' }]}
                      style={{ margin: 0 }}
                    >
                      <Input placeholder="中文提问词" style={{ width: 280 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'en']}
                      style={{ margin: 0 }}
                    >
                      <Input placeholder="英文提问词(选填)" style={{ width: 280 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加提问词示例
                </Button>
              </Space>
            )}
          </Form.List>
        </Card>

        {/* 极客高级配置项，折叠收起 */}
        <Collapse ghost style={{ background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
          <Collapse.Panel header={<span style={{ fontWeight: 600, color: '#8c8c8c' }}>高级选项 (依赖的 MCP Servers 和 Connectors)</span>} key="advanced">
            <Card title="依赖的 MCP Servers" size="small" style={{ marginBottom: 12 }}>
              <Form.List name="mcpList">
                {(fields, { add, remove }) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {fields.map(({ key, name, ...restField }) => (
                      <div
                        key={key}
                        style={{
                          padding: 12,
                          background: '#fff',
                          border: '1px solid #f0f0f0',
                          borderRadius: 8,
                          position: 'relative'
                        }}
                      >
                        <MinusCircleOutlined
                          style={{ position: 'absolute', right: 10, top: 10, color: '#ff4d4f' }}
                          onClick={() => remove(name)}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: 8 }}>
                          <Form.Item
                            {...restField}
                            label="显示名称"
                            name={[name, 'name']}
                            rules={[{ required: true, message: '必填' }]}
                            style={{ margin: 0 }}
                          >
                            <Input placeholder="如: Web Search" size="small" />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            label="唯一标识 ID"
                            name={[name, 'id']}
                            rules={[{ required: true, message: '必填' }]}
                            style={{ margin: 0 }}
                          >
                            <Input placeholder="如: google-search" size="small" />
                          </Form.Item>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '12px', marginBottom: 8 }}>
                          <Form.Item
                            {...restField}
                            label="传输类型"
                            name={[name, 'transportType']}
                            rules={[{ required: true }]}
                            style={{ margin: 0 }}
                          >
                            <Select size="small">
                              <Option value="stdio">stdio (本地命令)</Option>
                              <Option value="sse">sse (流事件)</Option>
                              <Option value="http">http (远程HTTP)</Option>
                            </Select>
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            label="命令或连接 URL"
                            name={[name, 'commandOrUrl']}
                            rules={[{ required: true, message: '必填' }]}
                            style={{ margin: 0 }}
                          >
                            <Input placeholder="如: npx 或 URL" size="small" />
                          </Form.Item>
                        </div>
                        <Form.Item
                          noStyle
                          shouldUpdate={(prevValues, currentValues) =>
                            prevValues.mcpList?.[name]?.transportType !== currentValues.mcpList?.[name]?.transportType
                          }
                        >
                          {({ getFieldValue }) => {
                            const type = getFieldValue(['mcpList', name, 'transportType']);
                            if (type === 'stdio') {
                              return (
                                <Form.Item
                                  {...restField}
                                  label="运行参数 (用英文逗号分隔)"
                                  name={[name, 'argsCsv']}
                                  style={{ margin: 0 }}
                                >
                                  <Input placeholder="如: -y, @modelcontextprotocol/server-postgres" size="small" />
                                </Form.Item>
                              );
                            }
                            return null;
                          }}
                        </Form.Item>
                      </div>
                    ))}
                    <Button type="dashed" onClick={() => add({ transportType: 'stdio' })} block icon={<PlusOutlined />}>
                      添加 MCP Server 依赖
                    </Button>
                  </div>
                )}
              </Form.List>
            </Card>

            <Card title="依赖的 Connectors" size="small">
              <Form.List name="connectorList">
                {(fields, { add, remove }) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {fields.map(({ key, name, ...restField }) => (
                      <div
                        key={key}
                        style={{
                          padding: 12,
                          background: '#fff',
                          border: '1px solid #f0f0f0',
                          borderRadius: 8,
                          position: 'relative'
                        }}
                      >
                        <MinusCircleOutlined
                          style={{ position: 'absolute', right: 10, top: 10, color: '#ff4d4f' }}
                          onClick={() => remove(name)}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: 8 }}>
                          <Form.Item
                            {...restField}
                            label="显示名称"
                            name={[name, 'name']}
                            rules={[{ required: true, message: '必填' }]}
                            style={{ margin: 0 }}
                          >
                            <Input placeholder="如: DB Connector" size="small" />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            label="标识 ID"
                            name={[name, 'id']}
                            rules={[{ required: true, message: '必填' }]}
                            style={{ margin: 0 }}
                          >
                            <Input placeholder="如: mysql-db" size="small" />
                          </Form.Item>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                          <Form.Item
                            {...restField}
                            label="连接类型"
                            name={[name, 'type']}
                            rules={[{ required: true, message: '必填' }]}
                            style={{ margin: 0 }}
                          >
                            <Input placeholder="如: mysql" size="small" />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            label="连接地址 URL"
                            name={[name, 'url']}
                            rules={[{ required: true, message: '必填' }]}
                            style={{ margin: 0 }}
                          >
                            <Input placeholder="如: mysql://localhost:3306" size="small" />
                          </Form.Item>
                        </div>
                      </div>
                    ))}
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      添加 Connector 依赖
                    </Button>
                  </div>
                )}
              </Form.List>
            </Card>
          </Collapse.Panel>
        </Collapse>
      </Form>
    </Modal>
  );
}
