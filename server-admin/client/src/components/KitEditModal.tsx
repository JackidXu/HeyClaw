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
  allSkills,
  categories,
  token,
  onCancel,
  onSave
}: KitEditModalProps) {
  const [form] = Form.useForm();

  // 辅助解析多语言文本
  const getLocText = (field: any, lang: 'zh' | 'en' = 'zh'): string => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field['en'] || '';
  };

  // 监听 kit 改变回填表单
  useEffect(() => {
    if (visible && kit) {
      const skillsSelected = kit.skills?.list?.map((s: any) => s.id) || [];
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
        skillsSelected,
        tryAskingList,
        mcpList,
        connectorList
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
      skillsSelected,
      tryAskingList,
      mcpList,
      connectorList
    } = values;

    // 1. 组装关联技能并保留历史关联
    const skillsList: any[] = [];
    (skillsSelected || []).forEach((skillId: string) => {
      const found = allSkills.find((s) => s.id === skillId);
      if (found) {
        skillsList.push({
          id: found.id,
          name: `/${found.id}`,
          description: found.description || { zh: '', en: '' }
        });
      } else {
        const oldRef = kit.skills?.list?.find((item: any) => item.id === skillId);
        if (oldRef) {
          skillsList.push(oldRef);
        } else {
          skillsList.push({
            id: skillId,
            name: `/${skillId}`,
            description: { zh: skillId, en: skillId }
          });
        }
      }
    });

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

    // 5. 最终组装的 JSON 格式 payload (干净的去冗余方案)
    const payloadKit: any = {
      id: id.trim(),
      category: category || 'market',
      name: { zh: nameZh.trim(), en: nameEn.trim() },
      description: { zh: descriptionZh.trim(), en: descriptionEn.trim() },
      author: author ? author.trim() : 'HeyClaw',
      version: version ? version.trim() : '1.0.0',
      downloadCount: downloadCount ? downloadCount.trim() : '0',
      icon: icon ? icon.trim() : '',
      skills: {
        list: skillsList,
        bundle: bundleUrl || ''
      },
      tryAsking
    };

    // 仅在有依赖值时才输出字段，免去 json 写入多余 null 键
    if (mcpServers.length > 0) {
      payloadKit.mcpServers = mcpServers;
    }
    if (connectors.length > 0) {
      payloadKit.connectors = connectors;
    }

    onSave(payloadKit);
  };

  const getSkillOptions = () => {
    const list: any[] = [];
    allSkills.forEach((s) => {
      list.push({
        value: s.id,
        label: `${s.id} (已注册)`
      });
    });

    const currentSelected = kit?.skills?.list?.map((s: any) => s.id) || [];
    currentSelected.forEach((selId: string) => {
      if (!allSkills.some((s) => s.id === selId)) {
        list.push({
          value: selId,
          label: `${selId} (历史保留)`
        });
      }
    });

    return list;
  };

  return (
    <Modal
      title={isNew ? '新增专家套件' : '编辑专家套件'}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 1fr', gap: '12px' }}>
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
            <Form.Item label="已下载次数" name="downloadCount">
              <Input placeholder="0" />
            </Form.Item>
          </div>
        </Card>

        {/* Card 2：云端资源与图标上传 */}
        <Card title="云端资源与图标" size="small" style={{ marginBottom: 16 }}>
          <Form.Item label="套件图标链接 (icon)" name="icon">
            <Input placeholder="请输入图标在线地址" />
          </Form.Item>
          
          {/* 实时的图标图片预览展示 */}
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

          <Divider style={{ margin: '16px 0 12px 0' }} />

          <Form.Item
            label="套件 Zip 资源包下载地址 (bundleUrl)"
            name="bundleUrl"
            rules={[{ required: true, message: '资源包下载地址必填' }]}
          >
            <Input placeholder="请输入 Zip 资源包在线地址" />
          </Form.Item>
          <UploadDropzone
            token={token}
            accept=".zip"
            placeholderText="点击或拖拽上传套件 Zip 包"
            onUploadSuccess={(url) => form.setFieldsValue({ bundleUrl: url })}
          />
        </Card>

        {/* Card 3：关联技能配置 */}
        <Card title="关联技能配置" size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            label="选择关联技能 (支持中文/英文/ID搜索，可多选)"
            name="skillsSelected"
            style={{ marginBottom: 0 }}
          >
            <Select
              mode="multiple"
              allowClear
              style={{ width: '100%' }}
              placeholder="从全局技能库中搜索和多选绑定..."
              optionFilterProp="label"
              options={getSkillOptions()}
            />
          </Form.Item>
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
