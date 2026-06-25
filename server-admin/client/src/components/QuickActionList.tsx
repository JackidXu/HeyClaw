import { useState, useEffect } from 'react';
import { Card, Input, Button, Row, Col, Space, Empty, Popconfirm, Tag, Pagination } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';

interface QuickActionListProps {
  quickActions: any[];
  onEdit: (action: any) => void;
  onDelete: (id: string) => void;
  onNewQuickAction: () => void;
}

export default function QuickActionList({
  quickActions,
  onEdit,
  onDelete,
  onNewQuickAction
}: QuickActionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // 当搜索条件变化时，重置回第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredActions = (quickActions || []).filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item.id.toLowerCase().includes(query) ||
      (item.labelZh || '').toLowerCase().includes(query) ||
      (item.labelEn || '').toLowerCase().includes(query);
    return matchesSearch;
  });

  const displayedActions = filteredActions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          快速提问分类列表 ({filteredActions.length})
        </h2>
        <Space size="middle">
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="搜索 ID 或名称"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={onNewQuickAction}>
            新增快速提问分类
          </Button>
        </Space>
      </div>

      {displayedActions.length === 0 ? (
        <Card style={{ borderRadius: 8 }}>
          <Empty description="暂无符合条件的快捷发问分类数据" />
        </Card>
      ) : (
        <>
          <Row style={{ margin: '0 -8px' }}>
            {displayedActions.map((item) => (
              <Col key={item.id} xs={24} sm={12} md={12} lg={8} xl={6} style={{ padding: '8px' }}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 12,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                  }}
                  bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 18 }}
                  actions={[
                    <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(item)}>编辑</Button>,
                    <Popconfirm
                      title="确定要删除这个分类吗？这会同时移除该分类下的所有子提示词！"
                      onConfirm={() => onDelete(item.id)}
                      okText="确定"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                  ]}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: item.color || '#1890ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '18px',
                          fontWeight: 'bold'
                        }}
                      >
                        {item.id.substring(0, 1).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.labelZh || '未命名'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.labelEn || 'No English Title'}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: 12, fontSize: '13px', color: '#595959' }}>
                      <div style={{ marginBottom: 4 }}>
                        <strong>唯一标识 ID:</strong> <code style={{ background: '#f5f5f5', padding: '1px 5px', borderRadius: 4, fontSize: '12px' }}>{item.id}</code>
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <strong>图标 (Heroicon):</strong> <code style={{ background: '#f5f5f5', padding: '1px 5px', borderRadius: 4, fontSize: '12px' }}>{item.icon || '未设置'}</code>
                      </div>
                      {item.skillMapping && (
                        <div>
                          <strong>关联技能 ID:</strong> <code style={{ color: '#fa8c16', background: '#fff7e6', border: '1px solid #ffd591', padding: '1px 5px', borderRadius: 4, fontSize: '12px' }}>{item.skillMapping}</code>
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                      <div style={{ fontWeight: 500, fontSize: '13px', color: '#262626', marginBottom: 8 }}>
                        下属提示词 ({item.prompts?.length || 0})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(item.prompts || []).length === 0 ? (
                          <span style={{ fontSize: '12px', color: '#bfbfbf', fontStyle: 'italic' }}>暂无关联提示词</span>
                        ) : (
                          item.prompts.map((p: any) => (
                            <Tag
                              key={p.id}
                              color="blue"
                              icon={<InfoCircleOutlined />}
                              title={`${p.labelZh}\n${p.promptZh}`}
                              style={{
                                cursor: 'default',
                                margin: 0,
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              {p.icon && <span>{p.icon}</span>}
                              <span>{p.labelZh}</span>
                            </Tag>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          {filteredActions.length > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredActions.length}
                onChange={(page) => setCurrentPage(page)}
                showSizeChanger={false}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
