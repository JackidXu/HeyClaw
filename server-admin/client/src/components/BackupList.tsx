import { Card, List, Button, Typography, Modal, Space, Tag } from 'antd';
import { HistoryOutlined, RollbackOutlined, DatabaseOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface BackupRecord {
  fileName: string;
  size: number;
  createdAt: number;
  type: 'kits' | 'skills';
}

interface BackupListProps {
  backups: BackupRecord[];
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

export default function BackupList({ backups, onRestore }: BackupListProps) {
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

  return (
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
  );
}
