import { XMarkIcon } from '@heroicons/react/24/outline';
import React, { useCallback, useEffect, useState } from 'react';

import { configService } from '../services/config';
import Modal from './common/Modal';

interface BillingModalProps {
  onClose: () => void;
}

interface LogItem {
  id: number;
  type: number; // 1=充值, 2=消费, 3=管理, 4=错误, 5=系统
  content: string;
  model_name: string;
  quota: number;
  created_at: number;
}

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getThirtyDaysAgoStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const BillingModal: React.FC<BillingModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // 分页状态 (1-indexed)
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 筛选类型：all=全部, consume=消费, recharge=充值
  const [filterType, setFilterType] = useState<'all' | 'consume' | 'recharge'>('all');

  // 日期筛选范围，默认初始化为最近 30 天
  const [startDate, setStartDate] = useState<string>(getThirtyDaysAgoStr());
  const [endDate, setEndDate] = useState<string>(getTodayStr());

  const fetchBillingLogs = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const config = configService.getConfig();
      const oneapiConfig = config.providers?.['oneapi'];
      const apiKey = oneapiConfig?.apiKey?.trim();
      const baseUrl = oneapiConfig?.baseUrl?.trim() || 'https://token.chaohui.ai/v1';

      if (!apiKey) {
        setErrorMsg('未激活系统，请先输入激活码');
        setLoading(false);
        return;
      }

      // 提取 New-API 根路径的鲁棒写法
      let apiRoot = baseUrl.trim().replace(/\/+$/, '');
      try {
        if (!/^https?:\/\//i.test(apiRoot)) {
          apiRoot = `http://${apiRoot}`;
        }
        apiRoot = new URL(apiRoot).origin;
      } catch {
        apiRoot = apiRoot.replace(/\/v1$/, '');
      }

      // 一次性拉取较多条目（例如最多200条），在前端做精确的过滤和满页分页
      const url = `${apiRoot}/api/log/token?key=${apiKey}&page_size=200`;

      const resp = await window.electron.api.fetch({
        url,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }) as { ok: boolean; data?: any; error?: string };

      if (resp.data && typeof resp.data === 'object') {
        if (resp.data.success) {
          setLogs(resp.data.data || []);
          setPage(1); // 重新加载后重置到第1页
        } else {
          setErrorMsg(resp.data.message || '获取账单流水失败');
        }
      } else {
        setErrorMsg(resp.error || '请求网络错误，请稍后重试');
      }
    } catch (e) {
      console.error('[BillingModal] Fetch logs error:', e);
      setErrorMsg('网络请求异常，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }, []);

  // 挂载时拉取一次数据
  useEffect(() => {
    fetchBillingLogs();
  }, [fetchBillingLogs]);

  // 将 quota 转换为虚拟点数
  const formatPoints = (quota: number) => {
    const pts = quota / 5000;
    if (pts === 0) return '0';
    if (pts > 0 && pts < 0.01) return '<0.01';
    if (Number.isInteger(pts)) return pts.toString();
    return pts.toFixed(2);
  };

  // 格式化时间
  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // 前端过滤流程（先过滤，确保分页切片时每页都是完整的满行）
  const filteredLogs = logs.filter((item) => {
    // 1. 类型过滤
    if (filterType === 'consume' && item.type !== 2) return false;
    if (filterType === 'recharge' && item.type !== 1 && item.type !== 3) return false;

    // 2. 日期过滤
    const itemDate = new Date(item.created_at * 1000);
    // 转换为本地 YYYY-MM-DD
    const localYear = itemDate.getFullYear();
    const localMonth = String(itemDate.getMonth() + 1).padStart(2, '0');
    const localDay = String(itemDate.getDate()).padStart(2, '0');
    const itemDateStr = `${localYear}-${localMonth}-${localDay}`;

    if (startDate && itemDateStr < startDate) return false;
    if (endDate && itemDateStr > endDate) return false;

    return true;
  });

  // 分页计算
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Modal
      onClose={onClose}
      className="w-full max-w-2xl mx-4 bg-surface rounded-2xl shadow-xl overflow-hidden border border-border/40 animate-fade-in flex flex-col max-h-[85vh]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
        <h3 className="text-base font-semibold text-foreground">我的账单</h3>
        <button
          onClick={onClose}
          className="p-1.5 text-secondary hover:text-foreground rounded-lg hover:bg-surface-raised transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs & Date Filter */}
      <div className="px-5 py-2.5 border-b border-border/10 shrink-0 flex flex-wrap items-center justify-between gap-3 bg-surface-raised/20">
        {/* 类型 Tabs */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setFilterType('all'); setPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              filterType === 'all'
                ? 'bg-primary/10 text-primary'
                : 'text-secondary hover:bg-surface-raised hover:text-foreground'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => { setFilterType('consume'); setPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              filterType === 'consume'
                ? 'bg-primary/10 text-primary'
                : 'text-secondary hover:bg-surface-raised hover:text-foreground'
            }`}
          >
            消费明细
          </button>
          <button
            onClick={() => { setFilterType('recharge'); setPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              filterType === 'recharge'
                ? 'bg-primary/10 text-primary'
                : 'text-secondary hover:bg-surface-raised hover:text-foreground'
            }`}
          >
            充值明细
          </button>
        </div>

        {/* 日期选择器 */}
        <div className="flex items-center gap-1.5 text-xs text-secondary shrink-0">
          <span>日期：</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-2 py-1 rounded-lg border border-border/60 bg-surface text-foreground focus:outline-none focus:border-primary"
          />
          <span className="text-secondary/60">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-2 py-1 rounded-lg border border-border/60 bg-surface text-foreground focus:outline-none focus:border-primary"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
              className="text-primary hover:text-primary-hover font-medium ml-1"
            >
              清空
            </button>
          )}
        </div>
      </div>

      {/* Content Table Container */}
      <div className="flex-1 overflow-y-hidden px-5 py-3 min-h-[300px] flex flex-col">
        {loading && logs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-16">
            <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-xs text-secondary">正在获取账单...</span>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 space-y-2">
            <div className="text-sm font-medium text-red-500">{errorMsg}</div>
            <button
              onClick={fetchBillingLogs}
              className="text-xs text-primary hover:underline"
            >
              点击重新加载
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-secondary space-y-1">
            <svg className="w-8 h-8 text-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs">暂无账单记录</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-secondary space-y-1">
            <svg className="w-8 h-8 text-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-xs">当前筛选条件（分类或日期）下无账单流水</span>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 text-secondary/80 font-semibold">
                  <th className="py-2.5 px-3">类型</th>
                  <th className="py-2.5 px-3">模型</th>
                  <th className="py-2.5 px-3 text-right">额度变动</th>
                  <th className="py-2.5 px-3 text-center">发生时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {paginatedLogs.map((item) => {
                  const isConsume = item.type === 2;
                  const points = formatPoints(item.quota);
                  const displayTime = formatTime(item.created_at);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-raised/50 transition-colors group"
                    >
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium leading-none ${
                            isConsume
                              ? 'bg-secondary/10 text-secondary'
                              : 'bg-green-500/10 text-green-600 dark:text-green-400'
                          }`}
                        >
                          {isConsume ? '消费' : '充值'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-foreground/80 break-all max-w-[240px] truncate" title={item.content}>
                        {isConsume ? item.model_name || '未知模型' : (item.content || '充值/赠送')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span className={isConsume ? 'text-foreground/80' : 'text-green-500 dark:text-green-400'}>
                          {isConsume ? `-${points}` : `+${points}`}
                        </span>
                        <span className="text-[10px] font-normal text-secondary ml-0.5">点</span>
                      </td>
                      <td className="py-3 px-3 text-center text-secondary text-[11px] whitespace-nowrap">
                        {displayTime}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="px-5 py-3 border-t border-border/60 shrink-0 flex items-center justify-between bg-surface-raised/20">
        {/* 移除提示文案，保留左下角空白以保持布局平衡 */}
        <div className="text-[11px] text-secondary shrink-0" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-2.5 py-1 rounded-lg text-xs border border-border/80 hover:bg-surface-raised hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-secondary"
          >
            上一页
          </button>
          <span className="text-xs font-semibold text-foreground px-2">
            第 {page} / {totalPages} 页
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="px-2.5 py-1 rounded-lg text-xs border border-border/80 hover:bg-surface-raised hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-secondary"
          >
            下一页
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BillingModal;
