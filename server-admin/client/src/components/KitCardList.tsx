import { useState, useEffect } from 'react';
import { Card, Input, Button, Row, Col, Space, Tag, Empty, Popconfirm, Select, Pagination, Tabs } from 'antd';
import { SearchOutlined, FolderOpenOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

interface KitCardListProps {
  kitsList: any[];
  categories: any[];
  onEdit: (kit: any) => void;
  onDelete: (id: string, type: 'localKit' | 'marketplace') => void;
  onNewKit: (type: 'localKit' | 'marketplace') => void;
  onManageCategories: () => void;
}

export default function KitCardList({
  kitsList,
  categories,
  onEdit,
  onDelete,
  onNewKit,
  onManageCategories
}: KitCardListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<string>('marketplace');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // 当搜索条件、分类或大类 Tab 变化时，重置回第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedType]);

  const getLocText = (field: any, lang: 'zh' | 'en' = 'zh'): string => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field['en'] || '';
  };

  const filteredKits = kitsList.filter((k) => {
    const matchesSearch =
      k.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getLocText(k.name, 'zh').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory ? k.category === selectedCategory : true;
    const matchesType = (k._type || 'marketplace') === selectedType;
    return matchesSearch && matchesCategory && matchesType;
  });

  const displayedKits = filteredKits.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      {/* 专家套件次级 Tab 隔离 */}
      <Tabs
        activeKey={selectedType}
        onChange={(key) => {
          setSelectedType(key);
          setSelectedCategory(undefined); // 切换大类时重置分类过滤
        }}
        style={{ marginBottom: 16 }}
        items={[
          {
            key: 'marketplace',
            label: '云端市场专家 (marketplace)'
          },
          {
            key: 'localKit',
            label: '本地内置专家 (localKit)'
          }
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
          {selectedType === 'localKit' ? '本地内置专家列表' : '云端市场专家列表'} ({filteredKits.length})
        </h2>
        <Space size="middle" style={{ flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="搜索 ID 或套件名称"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="全部分类"
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val)}
            style={{ width: 140 }}
            allowClear
          >
            {categories.map((cat: any) => (
              <Select.Option key={cat.id} value={cat.id}>
                {getLocText(cat.name, 'zh')}
              </Select.Option>
            ))}
          </Select>
          <Button icon={<FolderOpenOutlined />} onClick={onManageCategories}>
            管理分类
          </Button>
          {selectedType === 'marketplace' ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => onNewKit('marketplace')}>
              新增专家套件
            </Button>
          ) : (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => onNewKit('localKit')}>
              新增本地内置专家
            </Button>
          )}
        </Space>
      </div>
      {filteredKits.length > 0 ? (
        <>
          <Row gutter={[16, 16]}>
            {displayedKits.map((k) => (
              <Col key={k.id} xs={24} sm={12} md={8} lg={8} xl={6}>
                <Card
                  hoverable
                  style={{ height: '100%', borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #f0f0f0' }}
                  actions={[
                    <Button type="link" icon={<EditOutlined />} onClick={() => onEdit(k)} size="small">
                      编辑
                    </Button>,
                    <Popconfirm
                      title={`确定删除套件「${k.id}」吗？`}
                      onConfirm={() => onDelete(k.id, k._type || 'marketplace')}
                      okText="确定"
                      cancelText="取消"
                      okType="danger"
                    >
                      <Button type="link" icon={<DeleteOutlined />} danger size="small">
                        删除
                      </Button>
                    </Popconfirm>
                  ]}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#262626', marginRight: 8, wordBreak: 'break-all' }}>
                        {getLocText(k.name, 'zh')}
                      </div>
                      <Tag color={k.id === 'computer-use' ? 'gold' : 'blue'} style={{ margin: 0 }}>
                        {k.id}
                      </Tag>
                    </div>
                    <div style={{ fontSize: '13px', color: '#8c8c8c', marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: 54 }}>
                      {getLocText(k.description, 'zh')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: '1px solid #f5f5f5', paddingTop: 12 }}>
                    <span style={{ fontSize: '12px', color: '#bfbfbf' }}>分类: {k.category || '未归类'}</span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#1890ff' }}>v{k.version}</span>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          {filteredKits.length > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredKits.length}
                onChange={(page) => setCurrentPage(page)}
                showSizeChanger={false}
              />
            </div>
          )}
        </>
      ) : (
        <Empty description="没有匹配的专家套件" style={{ marginTop: 60 }} />
      )}
    </div>
  );
}
