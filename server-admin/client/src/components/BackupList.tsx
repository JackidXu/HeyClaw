import { useState } from 'react';
import { Card, List, Button, Typography, Modal, Space, Tag, Spin, message } from 'antd';
import { HistoryOutlined, RollbackOutlined, DatabaseOutlined, EyeOutlined } from '@ant-design/icons';

const { Text } = Typography;

// 自适应 API 端口基址
const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8082'
    : '';

interface BackupRecord {
  fileName: string;
  size: number;
  createdAt: number;
  type: 'kits' | 'skills';
}

interface BackupListProps {
  backups: BackupRecord[];
  token: string;
  onRestore: (fileName: string) => void;
}

// 字节大小换算
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function BackupList({ backups, token, onRestore }: BackupListProps) {
  const [viewVisible, setViewVisible] = useState(false);
  const [viewFileName, setViewFileName] = useState('');
  const [viewContent, setViewContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleRestoreClick = (fileName: string) => {
    Modal.confirm({
      title: '您确认将当前云端配置恢复吗？',
      content: `系统将一键将云端配置回退替换为备份「${fileName}」。\n在执行覆盖前，系统会自动对您当前最新的数据生成一份安全备份，以防误操作。`,
      okText: '确认恢复',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => onRestore(fileName)
    });
  };

  const handleViewClick = async (fileName: string) => {
    setViewFileName(fileName);
    setViewVisible(true);
    setLoading(true);
    setViewContent(null);
    try {
      const res = await fetch(`${API_BASE}/api/backup-content?filename=${encodeURIComponent(fileName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setViewContent(data.content);
      } else {
        message.error(`拉取备份内容失败: ${data.error}`);
      }
    } catch (err) {
      message.error('网络请求异常');
    } finally {
      setViewLoading(false);
    }
  };

  // 补丁：解决 handleViewClick 最后的 setViewLoading 错字为 setLoading
  const setViewLoading = setLoading;

  return (
    <>
      <Card 
        title={<Space><HistoryOutlined /><span>历史配置备份与安全回退 ({backups.length})</span></Space>}
        style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)' }}
      >
        <List
          itemLayout="horizontal"
          dataSource={backups}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="view"
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => handleViewClick(item.fileName)}
                  size="small"
                  style={{ marginRight: 8 }}
                >
                  查看
                </Button>,
                <Button
                  key="restore"
                  type="primary"
                  ghost
                  danger
                  icon={<RollbackOutlined />}
                  onClick={() => handleRestoreClick(item.fileName)}
                  size="small"
                >
                  恢复此配置
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={<DatabaseOutlined style={{ fontSize: 24, color: item.type === 'kits' ? '#1890ff' : '#52c41a', marginTop: 8 }} />}
                title={
                  <Space>
                    <Text strong>{item.fileName}</Text>
                    <Tag color={item.type === 'kits' ? 'blue' : 'green'}>
                      {item.type === 'kits' ? '套件配置 (Kits)' : '技能配置 (Skills)'}
                    </Tag>
                  </Space>
                }
                description={
                  <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                    备份大小: <Text code>{formatSize(item.size)}</Text>
                    <span style={{ margin: '0 8px' }}>|</span>
                    备份时间: {new Date(item.createdAt).toLocaleString()}
                  </div>
                }
              />
            </List.Item>
          )}
          locale={{
            emptyText: (
              <div style={{ padding: '40px 0', color: '#bfbfbf', textAlign: 'center' }}>
                暂无备份历史，保存任何更改后，系统将在此处自动生成带有时间戳的备份记录。
              </div>
            )
          }}
        />
      </Card>

      {/* 查看备份文件内容弹窗 */}
      <Modal
        title={
          <Space>
            <EyeOutlined style={{ color: '#1890ff' }} />
            <span>查看备份配置文件: {viewFileName}</span>
          </Space>
        }
        open={viewVisible}
        onCancel={() => setViewVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setViewVisible(false)}>
            关闭窗口
          </Button>
        ]}
        width={750}
        style={{ top: 40 }}
        destroyOnClose
      >
        <Spin spinning={loading} tip="正在从云端 OSS 获取备份内容...">
          <div style={{ 
            marginTop: '12px', 
            maxHeight: '60vh', 
            overflowY: 'auto', 
            background: '#fafafa', 
            border: '1px solid #f0f0f0', 
            borderRadius: 8, 
            padding: '16px'
          }}>
            {viewContent ? (
              <pre style={{ 
                margin: 0, 
                fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace', 
                fontSize: '13px', 
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: 'rgba(0, 0, 0, 0.88)'
              }}>
                {JSON.stringify(viewContent, null, 2)}
              </pre>
            ) : (
              !loading && <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '20px 0' }}>无法加载备份数据</div>
            )}
          </div>
        </Spin>
      </Modal>
    </>
  );
}
