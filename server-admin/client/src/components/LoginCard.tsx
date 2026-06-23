import { useState } from 'react';
import { Card, Form, Input, Button, Alert, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';

const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8082'
    : '';

interface LoginCardProps {
  onLoginSuccess: (token: string) => void;
}

export default function LoginCard({ onLoginSuccess }: LoginCardProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const onFinish = async (values: any) => {
    const { password } = values;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.token);
        message.success('登录成功');
      } else {
        setErrorMsg(data.error || '登录失败，请重试');
      }
    } catch (err) {
      setErrorMsg('连接后端服务失败，请确认服务已启动');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f7fa' }}>
      <Card title={null} style={{ width: 400, borderRadius: 12, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 8px 0', color: '#1890ff', fontSize: '24px' }}>HeyClaw Cloud</h2>
          <div style={{ color: '#8c8c8c' }}>专家套件与技能市场管理控制台</div>
        </div>

        {errorMsg && <Alert message={errorMsg} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form name="login" onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            label="云端管理授权密码"
            name="password"
            rules={[{ required: true, message: '请输入管理员授权密码' }]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="请输入管理员密码" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
              验证并登入
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
