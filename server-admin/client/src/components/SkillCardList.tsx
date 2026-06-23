import { useState, useEffect } from 'react';
import { Card, Input, Button, Row, Col, Space, Tag, Empty, Popconfirm, Select, Pagination } from 'antd';
import { SearchOutlined, TagsOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

interface SkillCardListProps {
  skillsList: any[];
  marketTags: any[];
  onEdit: (skill: any) => void;
  onDelete: (id: string, type: 'localSkill' | 'marketplace') => void;
  onNewSkill: () => void;
  onManageTags: () => void;
}

export default function SkillCardList({
  skillsList,
  marketTags,
  onEdit,
  onDelete,
  onNewSkill,
  onManageTags
}: SkillCardListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // 筛选条件变化时，自动重置回第 1 页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedType, selectedTag]);

  const getLocText = (field: any, lang: 'zh' | 'en' = 'zh'): string => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field['en'] || '';
  };

  const filteredSkills = skillsList.filter((s) => {
    const matchesSearch =
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = selectedType ? s._type === selectedType : true;
    const matchesTag = selectedTag ? (s.tags || []).includes(selectedTag) : true;

    return matchesSearch && matchesType && matchesTag;
  });

  const displayedSkills = filteredSkills.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>技能市场列表 ({filteredSkills.length})</h2>
        <Space size="middle" style={{ flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="搜索 ID 或技能别名"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="全部类型"
            value={selectedType}
            onChange={(val) => setSelectedType(val)}
            style={{ width: 130 }}
            allowClear
          >
            <Select.Option value="marketplace">市场技能 (MARKET)</Select.Option>
            <Select.Option value="localSkill">本地内置技能 (LOCAL)</Select.Option>
          </Select>
          <Select
            placeholder="筛选标签"
            value={selectedTag}
            onChange={(val) => setSelectedTag(val)}
            style={{ width: 130 }}
            allowClear
          >
            {marketTags.map((tag) => (
              <Select.Option key={tag.id} value={tag.id}>
                {tag.zh}
              </Select.Option>
            ))}
          </Select>
          <Button icon={<TagsOutlined />} onClick={onManageTags}>
            管理标签
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={onNewSkill}>
            新增技能项目
          </Button>
        </Space>
      </div>

      {filteredSkills.length > 0 ? (
        <>
          <Row gutter={[16, 16]}>
            {displayedSkills.map((s) => (
              <Col key={`${s.id}-${s._type}`} xs={24} sm={12} md={8} lg={8} xl={6}>
                <Card
                  hoverable
                  style={{ height: '100%', borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #f0f0f0' }}
                  actions={[
                    <Button type="link" icon={<EditOutlined />} onClick={() => onEdit(s)} size="small">
                      编辑
                    </Button>,
                    <Popconfirm
                      title={`确定删除技能「${s.id}」吗？`}
                      onConfirm={() => onDelete(s.id, s._type)}
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
                        {s.name}
                      </div>
                      <Tag color={s._type === 'localSkill' ? 'success' : 'purple'} style={{ margin: 0 }}>
                        {s._type === 'localSkill' ? 'LOCAL' : 'MARKET'}
                      </Tag>
                    </div>
                    <div style={{ fontSize: '13px', color: '#8c8c8c', marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: 54 }}>
                      {getLocText(s.description, 'zh')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: '1px solid #f5f5f5', paddingTop: 12 }}>
                    <span style={{ fontSize: '12px', color: '#bfbfbf', wordBreak: 'break-all' }}>ID: {s.id}</span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#1890ff' }}>v{s.version || '1.0.0'}</span>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          {filteredSkills.length > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredSkills.length}
                onChange={(page) => setCurrentPage(page)}
                showSizeChanger={false}
              />
            </div>
          )}
        </>
      ) : (
        <Empty description="没有匹配的技能项目" style={{ marginTop: 60 }} />
      )}
    </div>
  );
}
