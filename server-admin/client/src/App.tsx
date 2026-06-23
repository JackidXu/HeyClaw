import { useState, useEffect } from 'react';
import { Layout, Tabs, Button, Spin, message, App as AntdApp } from 'antd';
import { PoweroffOutlined, DatabaseOutlined, ApartmentOutlined, BuildOutlined } from '@ant-design/icons';
import LoginCard from './components/LoginCard';
import KitCardList from './components/KitCardList';
import KitEditModal from './components/KitEditModal';
import SkillCardList from './components/SkillCardList';
import SkillEditModal from './components/SkillEditModal';
import CategoryManagerModal from './components/CategoryManagerModal';
import TagManagerModal from './components/TagManagerModal';
import BackupList from './components/BackupList';

const { Header, Content } = Layout;

// 自适应 API Base URL
const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8082'
    : '';

function MainConsole() {
  const [token, setToken] = useState<string>(localStorage.getItem('admin_token') || '');
  const [activeTab, setActiveTab] = useState<'kits' | 'skills' | 'backups'>('kits');
  
  const [loading, setLoading] = useState(false);

  // 云端拉取的数据
  const [kitsContainer, setKitsContainer] = useState<any>(null);
  const [skillsContainer, setSkillsContainer] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);

  // 模态弹窗控制
  const [editingKit, setEditingKit] = useState<any | null>(null);
  const [editingSkill, setEditingSkill] = useState<any | null>(null);
  const [isNewKit, setIsNewKit] = useState(false);
  const [isNewSkill, setIsNewSkill] = useState(false);

  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [isManagingTags, setIsManagingTags] = useState(false);

  // 登入登出
  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken('');
    message.success('已安全登出');
  };

  // 数据拉取
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        setKitsContainer(data.kits);
        setSkillsContainer(data.skills);
      } else {
        message.error('拉取数据失败: ' + data.error);
      }
    } catch (err) {
      message.error('连接服务器 API 异常');
    } finally {
      setLoading(false);
    }
  };

  // 拉取备份
  const fetchBackups = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/backups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups || []);
      }
    } catch (err) {
      message.error('拉取备份记录失败');
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
      fetchBackups();
    }
  }, [token]);

  // 保存容器数据
  const saveContainer = async (type: 'kits' | 'skills', containerPayload: any) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ type, payload: containerPayload })
      });
      const data = await res.json();
      if (data.success) {
        if (data.backupCreated) {
          message.success(`配置已成功保存！自动物理备份: ${data.backupCreated}`);
        } else {
          message.success(`配置已成功保存！`);
        }
        fetchBackups();
        fetchData();
      } else {
        message.error('保存失败: ' + data.error);
      }
    } catch (err) {
      message.error('保存配置请求异常');
    } finally {
      setLoading(false);
    }
  };

  // 恢复备份
  const handleRestore = async (backupName: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ fileName: backupName })
      });
      const data = await res.json();
      if (data.success) {
        message.success(`恢复成功！已自动备份当前旧版本: ${data.safetyBackupCreated}`);
        fetchBackups();
        fetchData();
      } else {
        message.error('恢复备份失败: ' + data.error);
      }
    } catch (err) {
      message.error('恢复备份网络请求异常');
    } finally {
      setLoading(false);
    }
  };

  // Kit - 保存
  const handleKitSave = (payloadKit: any) => {
    if (!kitsContainer) return;
    const valueContainer = kitsContainer.data?.value;
    if (!valueContainer) return;

    let nextKits = Array.isArray(valueContainer.kits) ? [...valueContainer.kits] : [];

    if (isNewKit) {
      if (nextKits.some((k: any) => k.id === payloadKit.id)) {
        message.error('该套件 ID 已存在，请使用唯一 ID');
        return;
      }
      nextKits.push(payloadKit);
    } else {
      nextKits = nextKits.map((k: any) => (k.id === payloadKit.id ? payloadKit : k));
    }

    const nextContainer = {
      ...kitsContainer,
      data: {
        ...kitsContainer.data,
        value: {
          ...valueContainer,
          kits: nextKits
        }
      }
    };

    setKitsContainer(nextContainer);
    saveContainer('kits', nextContainer);
    setEditingKit(null);
  };

  // Kit - 删除
  const handleKitDelete = (kitId: string) => {
    if (!kitsContainer) return;
    const valueContainer = kitsContainer.data?.value;
    if (!valueContainer) return;

    const nextKits = valueContainer.kits.filter((k: any) => k.id !== kitId);
    const nextContainer = {
      ...kitsContainer,
      data: {
        ...kitsContainer.data,
        value: {
          ...valueContainer,
          kits: nextKits
        }
      }
    };

    setKitsContainer(nextContainer);
    saveContainer('kits', nextContainer);
  };

  // Skill - 保存
  const handleSkillSave = (payloadSkill: any) => {
    if (!skillsContainer) return;
    const valueContainer = skillsContainer.data?.value;
    if (!valueContainer) return;

    let nextLocal = Array.isArray(valueContainer.localSkill) ? [...valueContainer.localSkill] : [];
    let nextMarket = Array.isArray(valueContainer.marketplace) ? [...valueContainer.marketplace] : [];

    const targetType = payloadSkill._type || 'marketplace';
    
    // 移除临时辅助字段
    const { _type, ...finalSkill } = payloadSkill;

    if (isNewSkill) {
      if (targetType === 'localSkill') {
        if (nextLocal.some((s: any) => s.id === finalSkill.id)) {
          message.error('本地技能中已存在该 ID，请使用唯一 ID');
          return;
        }
        nextLocal.push(finalSkill);
      } else {
        if (nextMarket.some((s: any) => s.id === finalSkill.id)) {
          message.error('市场技能中已存在该 ID，请使用唯一 ID');
          return;
        }
        nextMarket.push(finalSkill);
      }
    } else {
      if (targetType === 'localSkill') {
        nextLocal = nextLocal.map((s: any) => (s.id === finalSkill.id ? finalSkill : s));
      } else {
        nextMarket = nextMarket.map((s: any) => (s.id === finalSkill.id ? finalSkill : s));
      }
    }

    const nextContainer = {
      ...skillsContainer,
      data: {
        ...skillsContainer.data,
        value: {
          ...valueContainer,
          localSkill: nextLocal,
          marketplace: nextMarket
        }
      }
    };

    setSkillsContainer(nextContainer);
    saveContainer('skills', nextContainer);
    setEditingSkill(null);
  };

  // Skill - 删除
  const handleSkillDelete = (skillId: string, type: 'localSkill' | 'marketplace') => {
    if (!skillsContainer) return;
    const valueContainer = skillsContainer.data?.value;
    if (!valueContainer) return;

    let nextLocal = Array.isArray(valueContainer.localSkill) ? [...valueContainer.localSkill] : [];
    let nextMarket = Array.isArray(valueContainer.marketplace) ? [...valueContainer.marketplace] : [];

    if (type === 'localSkill') {
      nextLocal = nextLocal.filter((s: any) => s.id !== skillId);
    } else {
      nextMarket = nextMarket.filter((s: any) => s.id !== skillId);
    }

    const nextContainer = {
      ...skillsContainer,
      data: {
        ...skillsContainer.data,
        value: {
          ...valueContainer,
          localSkill: nextLocal,
          marketplace: nextMarket
        }
      }
    };

    setSkillsContainer(nextContainer);
    saveContainer('skills', nextContainer);
  };

  // 分类管理 - 保存
  const handleCategoriesSave = (nextCategories: any[]) => {
    if (!kitsContainer) return;
    const nextContainer = {
      ...kitsContainer,
      data: {
        ...kitsContainer.data,
        value: {
          ...kitsContainer.data.value,
          categories: nextCategories
        }
      }
    };
    setKitsContainer(nextContainer);
    saveContainer('kits', nextContainer);
  };

  // 标签管理 - 保存
  const handleTagsSave = (nextTags: any[]) => {
    if (!skillsContainer) return;
    const nextContainer = {
      ...skillsContainer,
      data: {
        ...skillsContainer.data,
        value: {
          ...skillsContainer.data.value,
          marketTags: nextTags
        }
      }
    };
    setSkillsContainer(nextContainer);
    saveContainer('skills', nextContainer);
  };

  // 未登录显示登录组件
  if (!token) {
    return <LoginCard onLoginSuccess={handleLoginSuccess} />;
  }

  // 汇总所有可用技能，以备套件编辑器使用
  const getAllSkills = () => {
    if (!skillsContainer) return [];
    const value = skillsContainer.data?.value;
    return [
      ...(value?.localSkill || []),
      ...(value?.marketplace || [])
    ];
  };

  const getKitsList = () => kitsContainer?.data?.value?.kits || [];
  const getCategories = () => kitsContainer?.data?.value?.categories || [];
  const getSkillsList = () => {
    if (!skillsContainer) return [];
    const value = skillsContainer.data?.value;
    const local = (value?.localSkill || []).map((s: any) => ({ ...s, _type: 'localSkill' }));
    const market = (value?.marketplace || []).map((s: any) => ({ ...s, _type: 'marketplace' }));
    return [...local, ...market];
  };
  const getMarketTags = () => skillsContainer?.data?.value?.marketTags || [];

  const tabItems = [
    {
      key: 'kits',
      label: (
        <span>
          <ApartmentOutlined />
          专家套件
        </span>
      ),
      children: (
        <KitCardList
          kitsList={getKitsList()}
          categories={getCategories()}
          onEdit={(kit) => {
            setIsNewKit(false);
            setEditingKit(kit);
          }}
          onDelete={handleKitDelete}
          onNewKit={() => {
            setIsNewKit(true);
            setEditingKit({
              id: '',
              name: { zh: '', en: '' },
              description: { zh: '', en: '' },
              version: '1.0.0',
              category: 'market',
              author: 'HeyClaw',
              icon: '',
              downloadCount: '0',
              skills: null,
              tryAsking: []
            });
          }}
          onManageCategories={() => setIsManagingCategories(true)}
        />
      )
    },
    {
      key: 'skills',
      label: (
        <span>
          <BuildOutlined />
          技能市场
        </span>
      ),
      children: (
        <SkillCardList
          skillsList={getSkillsList()}
          marketTags={getMarketTags()}
          onEdit={(skill) => {
            setIsNewSkill(false);
            setEditingSkill(skill);
          }}
          onDelete={handleSkillDelete}
          onNewSkill={() => {
            setIsNewSkill(true);
            setEditingSkill({
              id: '',
              name: '',
              description: { zh: '', en: '' },
              version: '1.0.0',
              _type: 'marketplace',
              tagsSelected: [],
              url: '',
              source: null
            });
          }}
          onManageTags={() => setIsManagingTags(true)}
        />
      )
    },
    {
      key: 'backups',
      label: (
        <span>
          <DatabaseOutlined />
          备份回退
        </span>
      ),
      children: <BackupList backups={backups} onRestore={handleRestore} />
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fff',
          padding: '0 24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          zIndex: 1
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff' }}>
          HeyClaw Cloud Console
        </div>
        <Button type="text" danger icon={<PoweroffOutlined />} onClick={handleLogout}>
          安全登出
        </Button>
      </Header>

      <Content style={{ padding: '24px 40px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Spin size="large" tip="数据同步中，请稍候..." />
          </div>
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as any)}
            items={tabItems}
            size="large"
            style={{ marginBottom: 30 }}
          />
        )}
      </Content>

      {/* 套件编辑模态框 */}
      <KitEditModal
        visible={!!editingKit}
        kit={editingKit}
        isNew={isNewKit}
        allSkills={getAllSkills()}
        categories={getCategories()}
        token={token}
        onCancel={() => setEditingKit(null)}
        onSave={handleKitSave}
      />

      {/* 技能编辑模态框 */}
      <SkillEditModal
        visible={!!editingSkill}
        skill={editingSkill}
        isNew={isNewSkill}
        marketTags={getMarketTags()}
        token={token}
        onCancel={() => setEditingSkill(null)}
        onSave={handleSkillSave}
      />

      {/* 分类管理模态框 */}
      <CategoryManagerModal
        visible={isManagingCategories}
        categories={getCategories()}
        kitsList={getKitsList()}
        onCancel={() => setIsManagingCategories(false)}
        onSave={handleCategoriesSave}
      />

      {/* 标签管理模态框 */}
      <TagManagerModal
        visible={isManagingTags}
        marketTags={getMarketTags()}
        onCancel={() => setIsManagingTags(false)}
        onSave={handleTagsSave}
      />
    </Layout>
  );
}

export default function App() {
  return (
    <AntdApp>
      <MainConsole />
    </AntdApp>
  );
}
