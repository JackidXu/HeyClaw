import { ArrowPathIcon,ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { AgentId } from '@shared/agent';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { agentService } from '../services/agent';
import { configService } from '../services/config';
import { coworkService } from '../services/cowork';
import { i18nService } from '../services/i18n';
import { RootState } from '../store';
import {
  selectCoworkSessions,
  selectCurrentSessionId,
  selectIsStreaming,
} from '../store/selectors/coworkSelectors';
import type { CoworkSessionSummary } from '../types/cowork';
import { getAgentDisplayNameById } from '../utils/agentDisplay';
import {
  type AgentSidebarBatchItem,
  AgentSidebarBatchItemKind,
  type AgentSidebarSubagentBatchItem,
  createSessionBatchKey,
} from './agentSidebar/batchSelection';
import MyAgentSidebarTree from './agentSidebar/MyAgentSidebarTree';
import BillingModal from './BillingModal';
import Modal from './common/Modal';
import { CoworkUiEvent } from './cowork/constants';
import CoworkSearchModal from './cowork/CoworkSearchModal';
import Cog6ToothIcon from './icons/Cog6ToothIcon';
import ComposeIcon from './icons/ComposeIcon';
import SidebarAutomationIcon from './icons/SidebarAutomationIcon';
import SidebarKitsIcon from './icons/SidebarKitsIcon';
import SidebarToggleIcon from './icons/SidebarToggleIcon';
import SkillIcon from './icons/SkillIcon';
import TrashIcon from './icons/TrashIcon';

interface SidebarProps {
  onShowSettings: () => void;
  onShowLogin?: () => void;
  activeView: 'cowork' | 'skills' | 'scheduledTasks' | 'kits' | 'mcp';
  onShowSkills: () => void;
  onShowCowork: () => void;
  onShowScheduledTasks: () => void;
  onShowKits: () => void;
  onNewChat: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  updateBadge?: React.ReactNode;
}

const DEFAULT_SIDEBAR_WIDTH = 244;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;
const SIDEBAR_COLLAPSE_TRANSITION_MS = 200;
const normalizeAgentId = (agentId?: string | null) => agentId?.trim() || AgentId.Main;
const SidebarNewFeatureBadge = {
  KitsDismissedVersionKey: 'sidebar.kitsNewFeatureBadge.dismissedVersion',
  // Bump this value in a release when the kits entry should show the badge again.
  KitsVersion: '2026-06-05',
} as const;
const sidebarNavItemClassName =
  'w-full inline-flex h-7 items-center gap-2 rounded-md px-1.5 text-left text-[14px] font-normal text-foreground/80 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]';
const activeSidebarNavItemClassName =
  `${sidebarNavItemClassName} bg-black/[0.06] hover:bg-black/[0.06] dark:bg-white/[0.07] dark:hover:bg-white/[0.07]`;
const sidebarCreateIconClassName = 'h-4 w-4 shrink-0';

const Sidebar: React.FC<SidebarProps> = ({
  onShowSettings,
  activeView,
  onShowSkills,
  onShowCowork,
  onShowScheduledTasks,
  onShowKits,
  onNewChat,
  isCollapsed,
  onToggleCollapse,
  updateBadge,
}) => {
  const currentAgentId = useSelector((state: RootState) => state.agent.currentAgentId);
  const agents = useSelector((state: RootState) => state.agent.agents);
  const sessions = useSelector(selectCoworkSessions);
  const currentSessionId = useSelector(selectCurrentSessionId);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);

  // 用户卡片状态与逻辑
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [userNickname, setUserNickname] = useState('HeyClaw 用户');
  const [userAvatar, setUserAvatar] = useState('🐱');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [showConfirmDeactivate, setShowConfirmDeactivate] = useState(false);

  const userCardContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 渲染头像辅助函数
  const renderAvatar = (avatarValue: string, nickname: string) => {
    if (avatarValue && avatarValue.startsWith('data:image/')) {
      return (
        <img 
          src={avatarValue} 
          alt={nickname} 
          className="w-full h-full object-cover rounded-full" 
        />
      );
    }
    return <span className="select-none text-lg">{avatarValue || '🐱'}</span>;
  };

  // 上传图片处理函数
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      window.dispatchEvent(new CustomEvent('app:showToast', { detail: '头像大小不能超过 2MB' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (typeof dataUrl === 'string') {
        setEditAvatar(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // 点击空白处关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userCardContainerRef.current && !userCardContainerRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRefreshBalance = useCallback(async (showToast = true) => {
    if (balanceLoading) return;
    setBalanceLoading(true);
    const minDelayPromise = new Promise((resolve) => setTimeout(resolve, 800));
    try {
      const config = configService.getConfig();
      const oneapiConfig = config.providers?.['oneapi'];
      const apiKey = oneapiConfig?.apiKey?.trim();
      const baseUrl = oneapiConfig?.baseUrl?.trim() || 'https://token.chaohui.ai/v1';

      if (!apiKey) {
        await minDelayPromise;
        if (showToast) {
          window.dispatchEvent(new CustomEvent('app:showToast', { detail: '未激活系统，请先输入激活码' }));
        }
        return;
      }

      const cleanBase = baseUrl.replace(/\/+$/, '');
      let hardLimitUsd = 0;
      let totalUsageCents = 0;

      const fetchPromise = (async () => {
        // 1. 获取 subscription
        try {
          const subResp = await window.electron.api.fetch({
            url: `${cleanBase}/dashboard/billing/subscription`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
          }) as { ok: boolean; data?: any };
          if (subResp.ok && subResp.data) {
            hardLimitUsd = subResp.data.hard_limit_usd || 0;
          }
        } catch (e) {
          console.error('[Sidebar] Balance sub fetch failed:', e);
        }

        // 2. 获取 usage
        try {
          const now = new Date();
          const startDate = '2020-01-01';
          const endDate = new Date(now.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0];
          const usageResp = await window.electron.api.fetch({
            url: `${cleanBase}/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
          }) as { ok: boolean; data?: any };
          if (usageResp.ok && usageResp.data) {
            totalUsageCents = usageResp.data.total_usage || 0;
          }
        } catch (e) {
          console.error('[Sidebar] Balance usage fetch failed:', e);
        }
      })();

      await Promise.all([fetchPromise, minDelayPromise]);

      const balanceUsd = hardLimitUsd - (totalUsageCents / 100);
      const points = Math.max(0, Math.round(balanceUsd * 100));
      
      setBalance(points);
      localStorage.setItem('heyclaw_user_balance', String(points));
    } catch (err) {
      console.error('[Sidebar] Refresh balance error:', err);
      if (showToast) {
        window.dispatchEvent(new CustomEvent('app:showToast', { detail: '余额刷新失败，请检查网络' }));
      }
    } finally {
      setBalanceLoading(false);
    }
  }, [balanceLoading]);

  const handleRefreshBalanceRef = useRef(handleRefreshBalance);
  useEffect(() => {
    handleRefreshBalanceRef.current = handleRefreshBalance;
  }, [handleRefreshBalance]);

  // 从 localStorage 加载配置并做静默刷新
  useEffect(() => {
    const savedName = localStorage.getItem('heyclaw_user_name');
    if (savedName) {
      setUserNickname(savedName);
      setEditNickname(savedName);
    } else {
      setEditNickname('HeyClaw 用户');
    }
    const savedAvatar = localStorage.getItem('heyclaw_user_avatar');
    if (savedAvatar) {
      setUserAvatar(savedAvatar);
      setEditAvatar(savedAvatar);
    } else {
      setEditAvatar('🐱');
    }
    const savedBalance = localStorage.getItem('heyclaw_user_balance');
    if (savedBalance) {
      setBalance(Number(savedBalance));
    }
    
    // 延迟 1 秒静默刷新余额，以免影响启动加载
    const timer = setTimeout(() => {
      void handleRefreshBalanceRef.current(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // 监听对话流状态，成功响应后（streaming 结束）自动静默刷新余额
  const isStreaming = useSelector(selectIsStreaming);
  const prevIsStreamingRef = useRef(isStreaming);

  useEffect(() => {
    if (prevIsStreamingRef.current && !isStreaming) {
      void handleRefreshBalanceRef.current(false);
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming]);
  const [batchAgentId, setBatchAgentId] = useState<string | null>(null);
  const [batchSelectableItems, setBatchSelectableItems] = useState<AgentSidebarBatchItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deletedSessionIds, setDeletedSessionIds] = useState<string[]>([]);
  const [deletedSubagentItems, setDeletedSubagentItems] = useState<AgentSidebarSubagentBatchItem[]>([]);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [agentScrollEdges, setAgentScrollEdges] = useState({ top: false, bottom: false });
  const [showKitsNewBadge, setShowKitsNewBadge] = useState(false);
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const agentScrollContainerRef = useRef<HTMLDivElement>(null);
  const isMac = window.electron.platform === 'darwin';
  const batchSelectableKeySet = useMemo(
    () => new Set(batchSelectableItems.map((item) => item.key)),
    [batchSelectableItems],
  );
  const batchSelectableItemByKey = useMemo(() => {
    const itemByKey = new Map<string, AgentSidebarBatchItem>();
    batchSelectableItems.forEach((item) => itemByKey.set(item.key, item));
    return itemByKey;
  }, [batchSelectableItems]);
  const selectedBatchSelectableCount = useMemo(() => {
    return batchSelectableItems.filter((item) => selectedKeys.has(item.key)).length;
  }, [batchSelectableItems, selectedKeys]);
  const isBatchSelectAllChecked =
    batchSelectableItems.length > 0 && selectedBatchSelectableCount === batchSelectableItems.length;
  const batchAgentName = batchAgentId ? getAgentDisplayNameById(batchAgentId, agents) : null;

  useEffect(() => {
    let isCurrent = true;

    const loadKitsNewBadgeState = async () => {
      try {
        const dismissedVersion = await window.electron.store.get(
          SidebarNewFeatureBadge.KitsDismissedVersionKey,
        );
        if (!isCurrent) return;
        setShowKitsNewBadge(dismissedVersion !== SidebarNewFeatureBadge.KitsVersion);
      } catch (error) {
        console.warn('[Sidebar] failed to load kits new feature badge state:', error);
      }
    };

    void loadKitsNewBadgeState();

    return () => {
      isCurrent = false;
    };
  }, []);

  const dismissKitsNewBadge = useCallback(() => {
    if (!showKitsNewBadge) return;
    setShowKitsNewBadge(false);
    void window.electron.store
      .set(
        SidebarNewFeatureBadge.KitsDismissedVersionKey,
        SidebarNewFeatureBadge.KitsVersion,
      )
      .catch((error) => {
        console.warn('[Sidebar] failed to save kits new feature badge state:', error);
      });
  }, [showKitsNewBadge]);

  useEffect(() => {
    const handleSearch = () => {
      onShowCowork();
      setIsSearchOpen(true);
    };
    window.addEventListener(CoworkUiEvent.ShortcutSearch, handleSearch);
    return () => {
      window.removeEventListener(CoworkUiEvent.ShortcutSearch, handleSearch);
    };
  }, [onShowCowork]);

  useEffect(() => {
    if (!isCollapsed) return;
    setIsSearchOpen(false);
    setIsBatchMode(false);
    setBatchAgentId(null);
    setBatchSelectableItems([]);
    setSelectedKeys(new Set());
    setShowBatchDeleteConfirm(false);
  }, [isCollapsed]);

  const handleSelectSession = async (session: CoworkSessionSummary) => {
    const agentId = session.agentId?.trim() || AgentId.Main;
    if (agentId !== currentAgentId) {
      agentService.switchAgent(agentId);
      await coworkService.loadSessions(agentId);
    }
    onShowCowork();
    await coworkService.loadSession(session.id);
  };

  const handleEnterBatchMode = useCallback((sessionId: string, agentId: string) => {
    setIsBatchMode(true);
    setBatchAgentId(agentId);
    setBatchSelectableItems([]);
    setSelectedKeys(new Set([createSessionBatchKey(sessionId)]));
  }, []);

  const handleExitBatchMode = useCallback(() => {
    setIsBatchMode(false);
    setBatchAgentId(null);
    setBatchSelectableItems([]);
    setSelectedKeys(new Set());
    setShowBatchDeleteConfirm(false);
  }, []);

  const handleBatchSelectableItemsChange = useCallback((items: AgentSidebarBatchItem[]) => {
    setBatchSelectableItems(items);
    setSelectedKeys((previous) => {
      if (!batchAgentId || items.length === 0) return previous;
      const itemKeySet = new Set(items.map((item) => item.key));
      const next = new Set(Array.from(previous).filter((key) => itemKeySet.has(key)));
      return next.size === previous.size ? previous : next;
    });
  }, [batchAgentId]);

  const updateAgentScrollEdges = useCallback((element: HTMLDivElement | null) => {
    if (!element) {
      setAgentScrollEdges((previousEdges) => (
        previousEdges.top || previousEdges.bottom ? { top: false, bottom: false } : previousEdges
      ));
      return;
    }

    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    const nextEdges = {
      top: element.scrollTop > 1,
      bottom: maxScrollTop - element.scrollTop > 1,
    };

    setAgentScrollEdges((previousEdges) => {
      if (previousEdges.top === nextEdges.top && previousEdges.bottom === nextEdges.bottom) {
        return previousEdges;
      }
      return nextEdges;
    });
  }, []);

  const handleAgentScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    updateAgentScrollEdges(event.currentTarget);
  }, [updateAgentScrollEdges]);

  const handleToggleSelection = useCallback((selectionKey: string, agentId: string) => {
    if (batchAgentId && normalizeAgentId(agentId) !== batchAgentId) return;
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(selectionKey)) {
        next.delete(selectionKey);
      } else {
        next.add(selectionKey);
      }
      return next;
    });
  }, [batchAgentId]);

  const handleSelectAll = useCallback(() => {
    if (batchSelectableItems.length === 0) return;
    setSelectedKeys(prev => {
      const selectedVisibleCount = batchSelectableItems.filter((item) => prev.has(item.key)).length;
      if (selectedVisibleCount === batchSelectableItems.length) {
        return new Set();
      }
      return new Set(batchSelectableItems.map((item) => item.key));
    });
  }, [batchSelectableItems]);

  const handleBatchDeleteClick = useCallback(() => {
    if (selectedKeys.size === 0) return;
    setShowBatchDeleteConfirm(true);
  }, [selectedKeys.size]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedKeys.size === 0) return;
    const items = Array.from(selectedKeys)
      .filter((key) => batchSelectableKeySet.size === 0 || batchSelectableKeySet.has(key))
      .map((key) => batchSelectableItemByKey.get(key))
      .filter((item): item is AgentSidebarBatchItem => Boolean(item));
    if (items.length === 0) return;

    const subagentItems = items.filter(
      (item): item is AgentSidebarSubagentBatchItem => item.kind === AgentSidebarBatchItemKind.Subagent,
    );
    const sessionIds = items
      .filter((item) => item.kind === AgentSidebarBatchItemKind.Session)
      .map((item) => item.sessionId);

    const deletedSubagents: AgentSidebarSubagentBatchItem[] = [];
    for (const item of subagentItems) {
      const deleted = await coworkService.deleteSubagentSession(item.parentSessionId, item.runId);
      if (deleted) {
        deletedSubagents.push(item);
      }
    }

    let deletedSessions = false;
    if (sessionIds.length > 0) {
      deletedSessions = await coworkService.deleteSessions(sessionIds);
    }

    if (!deletedSessions && deletedSubagents.length === 0) return;
    if (deletedSessions) {
      setDeletedSessionIds(sessionIds);
    }
    if (deletedSubagents.length > 0) {
      setDeletedSubagentItems(deletedSubagents);
    }
    handleExitBatchMode();
  }, [batchSelectableItemByKey, batchSelectableKeySet, selectedKeys, handleExitBatchMode]);

  const handleResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isCollapsed) return;
    event.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    resizeStartXRef.current = event.clientX;
    resizeStartWidthRef.current = sidebarWidth;
    document.body.classList.add('select-none');

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const nextWidth = resizeStartWidthRef.current + moveEvent.clientX - resizeStartXRef.current;
      if (nextWidth < MIN_SIDEBAR_WIDTH) {
        isResizingRef.current = false;
        setIsResizing(false);
        document.body.classList.remove('select-none');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        onToggleCollapse();
        return;
      }
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, nextWidth));
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      document.body.classList.remove('select-none');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isCollapsed, onToggleCollapse, sidebarWidth]);

  useEffect(() => {
    return () => {
      document.body.classList.remove('select-none');
    };
  }, []);

  useEffect(() => {
    const element = agentScrollContainerRef.current;
    if (!element) return;

    updateAgentScrollEdges(element);

    const resizeObserver = new ResizeObserver(() => updateAgentScrollEdges(element));
    resizeObserver.observe(element);
    if (element.firstElementChild) {
      resizeObserver.observe(element.firstElementChild);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [updateAgentScrollEdges]);

  return (
    <aside
      className={`relative shrink-0 overflow-hidden bg-surface-raised ${
        isResizing ? '' : 'sidebar-transition'
      }`}
      style={{ width: isCollapsed ? 0 : sidebarWidth }}
    >
      <div
        className={`flex h-full flex-col transition-opacity ease-out ${
          isCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        style={{
          width: sidebarWidth,
          transitionDuration: `${SIDEBAR_COLLAPSE_TRANSITION_MS}ms`,
        }}
      >
      <div className="pt-3 pb-3">
        <div className="draggable sidebar-header-drag h-8 flex items-center justify-between px-3">
          <div className={`${isMac ? 'pl-[68px]' : ''}`}>{updateBadge}</div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="non-draggable h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary hover:bg-surface-raised transition-colors"
            aria-label={isCollapsed ? i18nService.t('expand') : i18nService.t('collapse')}
          >
            <SidebarToggleIcon className="h-4 w-4" isCollapsed={isCollapsed} />
          </button>
        </div>
        <div className="mt-[5px] space-y-0.5 px-3">
          <button
            type="button"
            onClick={onNewChat}
            className={sidebarNavItemClassName}
          >
            <ComposeIcon className={sidebarCreateIconClassName} />
            {i18nService.t('newChat')}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(false);
              onShowScheduledTasks();
            }}
            className={activeView === 'scheduledTasks' ? activeSidebarNavItemClassName : sidebarNavItemClassName}
            aria-current={activeView === 'scheduledTasks' ? 'page' : undefined}
          >
            <SidebarAutomationIcon className="h-4 w-4 shrink-0" />
            {i18nService.t('scheduledTasks')}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(false);
              dismissKitsNewBadge();
              onShowKits();
            }}
            className={activeView === 'kits' ? activeSidebarNavItemClassName : sidebarNavItemClassName}
            aria-current={activeView === 'kits' ? 'page' : undefined}
          >
            <SidebarKitsIcon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{i18nService.t('kits')}</span>
            {showKitsNewBadge && (
              <span className="inline-flex h-4 shrink-0 items-center rounded-[4px] bg-[#ff4f6d] px-1.5 text-[10px] font-semibold leading-none text-white">
                {i18nService.t('newFeatureBadge')}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(false);
              onShowSkills();
            }}
            className={activeView === 'skills' ? activeSidebarNavItemClassName : sidebarNavItemClassName}
            aria-current={activeView === 'skills' ? 'page' : undefined}
          >
            <SkillIcon className="h-4 w-4 shrink-0" />
            {i18nService.t('skills')}
          </button>

        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={agentScrollContainerRef}
          className="scrollbar-hidden h-full overflow-y-auto px-2.5 pb-10"
          onScroll={handleAgentScroll}
        >
          <MyAgentSidebarTree
            isBatchMode={isBatchMode}
            batchAgentId={batchAgentId}
            deletedSessionIds={deletedSessionIds}
            deletedSubagentItems={deletedSubagentItems}
            selectedKeys={selectedKeys}
            onShowCowork={onShowCowork}
            onToggleSelection={handleToggleSelection}
            onEnterBatchMode={handleEnterBatchMode}
            onBatchSelectableItemsChange={handleBatchSelectableItemsChange}
            onSearchTasks={() => {
              onShowCowork();
              setIsSearchOpen(true);
            }}
          />
        </div>
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-surface-raised to-transparent transition-opacity duration-150 ${
            agentScrollEdges.top ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 top-[68px] z-10 h-3 bg-gradient-to-b from-surface-raised to-transparent transition-opacity duration-150 ${
            agentScrollEdges.top ? 'opacity-40' : 'opacity-0'
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-3 bg-gradient-to-t from-surface-raised to-transparent transition-opacity duration-150 ${
            agentScrollEdges.bottom ? 'opacity-40' : 'opacity-0'
          }`}
        />
      </div>
      {!isCollapsed && (
        <div
          className="non-draggable absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
          onMouseDown={handleResizeStart}
        />
      )}
      <CoworkSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
      />
      {isBatchMode ? (
        <div className="border-t border-border/60 px-3 pb-3 pt-2">
          <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-secondary">
              {i18nService
                .t('batchSelectionScope')
                .replace('{agent}', batchAgentName ?? '')
                .replace('{count}', String(selectedKeys.size))}
            </span>
            <button
              type="button"
              onClick={handleExitBatchMode}
              className="shrink-0 rounded-md px-1.5 py-1 text-xs font-medium text-secondary transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            >
              {i18nService.t('batchCancel')}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1.5 text-[13px] font-normal text-foreground/80 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
              <input
                type="checkbox"
                checked={isBatchSelectAllChecked}
                onChange={handleSelectAll}
                disabled={batchSelectableItems.length === 0}
                className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 accent-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
              />
              <span className="truncate">{i18nService.t('batchSelectAll')}</span>
            </label>
            <button
              type="button"
              onClick={handleBatchDeleteClick}
              disabled={selectedKeys.size === 0}
              className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition-colors ${
                selectedKeys.size > 0
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
              }`}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {i18nService.t('batchDelete')} ({selectedKeys.size})
            </button>
          </div>
        </div>
      ) : (
        <div 
          ref={userCardContainerRef}
          className="relative px-3 pb-3 pt-2 border-t border-border/40"
        >
          {/* 用户卡片 */}
          <div 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center justify-between p-2 rounded-xl bg-surface/50 hover:bg-surface-raised transition-all duration-200 shadow-sm border border-border/10 cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* 圆形头像 */}
              <div 
                className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-sm select-none shrink-0 overflow-hidden"
              >
                {renderAvatar(userAvatar, userNickname)}
              </div>
              {/* 昵称与余额 */}
              <div className="flex-1 min-w-0 leading-tight">
                <div 
                  className="text-sm font-semibold text-foreground/90 truncate"
                >
                  {userNickname}
                </div>
                <div className="text-[11px] text-secondary mt-0.5 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <span className="font-medium tracking-wide">{balance !== null ? `${balance} 点` : '-- 点'}</span>
                  <button 
                    onClick={() => handleRefreshBalance(true)}
                    disabled={balanceLoading}
                    className="hover:text-primary active:scale-95 transition-all p-0.5 rounded text-secondary"
                    title="刷新余额"
                  >
                    {balanceLoading ? (
                      <svg className="animate-spin h-3.5 w-3.5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <ArrowPathIcon className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 设置按钮 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(false);
                onShowSettings();
              }}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary hover:bg-surface hover:text-foreground transition-all shrink-0 ml-1.5"
              title={i18nService.t('settings')}
            >
              <Cog6ToothIcon className="h-4 w-4 shrink-0" />
            </button>
          </div>

          {/* 点击后滑出控制菜单 */}
          {showUserMenu && (
            <div className="absolute bottom-[calc(100%-8px)] left-3 right-3 z-50 p-1.5 rounded-xl border border-border bg-surface shadow-popover flex flex-col space-y-0.5 animate-fade-in">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserMenu(false);
                  setEditNickname(userNickname);
                  setEditAvatar(userAvatar);
                  setIsEditModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-foreground/80 hover:bg-surface-raised rounded-lg transition-colors font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                编辑资料
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserMenu(false);
                  setIsBillingModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-foreground/80 hover:bg-surface-raised rounded-lg transition-colors font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                我的账单
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserMenu(false);
                  setShowConfirmDeactivate(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                退出激活
              </button>
            </div>
          )}
        </div>
      )}
      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteConfirm && (
        <Modal
          onClose={() => setShowBatchDeleteConfirm(false)}
          className="w-full max-w-sm mx-4 bg-surface rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {i18nService.t('batchDeleteConfirmTitle')}
            </h2>
          </div>
          <div className="px-5 pb-4">
            <p className="text-sm text-secondary">
              {i18nService
                .t('batchDeleteConfirmMessage')
                .replace('{count}', String(selectedKeys.size))}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
            <button
              onClick={() => setShowBatchDeleteConfirm(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg text-secondary hover:bg-surface-raised transition-colors"
            >
              {i18nService.t('cancel')}
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              {i18nService.t('batchDelete')} ({selectedKeys.size})
            </button>
          </div>
        </Modal>
      )}

      {/* 编辑个人资料 Modal */}
      {isEditModalOpen && (
        <Modal
          onClose={() => setIsEditModalOpen(false)}
          className="w-full max-w-sm mx-4 bg-surface rounded-2xl shadow-xl overflow-hidden border border-border"
        >
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-base font-semibold text-foreground">编辑个人资料</h3>
          </div>
          <div className="p-5 space-y-4">
            {/* 头像编辑 (上传图片) */}
            <div className="flex flex-col items-center space-y-3">
              <label className="text-xs font-semibold text-secondary tracking-wider uppercase">头像</label>
              <div className="flex flex-col items-center space-y-2">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-md overflow-hidden text-2xl cursor-pointer hover:opacity-90 transition-opacity"
                  title="点击上传头像"
                >
                  {renderAvatar(editAvatar, editNickname)}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />

              </div>
            </div>
            {/* 昵称编辑 */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-semibold text-secondary tracking-wider uppercase pl-1">昵称</label>
              <input
                type="text"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                placeholder="请输入昵称"
                className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 text-sm text-foreground"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg text-secondary hover:bg-surface-raised transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                const finalName = editNickname.trim() || 'HeyClaw 用户';
                const finalAvatar = editAvatar.trim() || '🐱';
                setUserNickname(finalName);
                setUserAvatar(finalAvatar);
                localStorage.setItem('heyclaw_user_name', finalName);
                localStorage.setItem('heyclaw_user_avatar', finalAvatar);
                setIsEditModalOpen(false);
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors"
            >
              保存
            </button>
          </div>
        </Modal>
      )}

      {/* 退出激活二次确认 Modal */}
      {showConfirmDeactivate && (
        <Modal
          onClose={() => setShowConfirmDeactivate(false)}
          className="w-full max-w-sm mx-4 bg-surface rounded-2xl shadow-xl overflow-hidden border border-border"
        >
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
              <svg className="w-5 h-5 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-foreground">确认退出激活</h2>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-secondary">
              确定要退出激活吗？退出后系统需要重新输入激活码才能继续使用。
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
            <button
              onClick={() => setShowConfirmDeactivate(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg text-secondary hover:bg-surface-raised transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                setShowConfirmDeactivate(false);
                window.dispatchEvent(new CustomEvent('app:deactivate'));
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              确认退出
            </button>
          </div>
        </Modal>
      )}

      {/* 账单明细 Modal */}
      {isBillingModalOpen && (
        <BillingModal onClose={() => setIsBillingModalOpen(false)} />
      )}
      </div>
    </aside>
  );
};

export default Sidebar;
