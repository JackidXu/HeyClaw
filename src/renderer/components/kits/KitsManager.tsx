import { ArrowDownTrayIcon, ArrowLeftIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';

import { i18nService } from '../../services/i18n';
import { kitService } from '../../services/kit';
import { compareVersions, resolveLocalizedText } from '../../services/skill';
import { setInstalledKits as setInstalledKitsAction, setMarketplaceKits } from '../../store/slices/kitSlice';
import type { InstalledKit, KitCategory, MarketplaceKit } from '../../types/kit';
import Modal from '../common/Modal';
import SearchIcon from '../icons/SearchIcon';
import KitIcon from './KitIcon';

const KitOperationType = {
  Install: 'install',
  Uninstall: 'uninstall',
} as const;

type KitOperationType = typeof KitOperationType[keyof typeof KitOperationType];

interface KitsManagerProps {
  onTryAsking?: (text: string, kitId: string) => void;
}

interface KitUpdateInfo {
  installedVersion: string;
  currentVersion: string;
}

const KitsManager: React.FC<KitsManagerProps> = ({ onTryAsking }) => {
  const dispatch = useDispatch();
  const [kits, setKits] = useState<MarketplaceKit[]>([]);
  const [installedKits, setInstalledKits] = useState<Record<string, InstalledKit>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('market');
  const [categories, setCategories] = useState<KitCategory[]>([]);
  const [selectedKit, setSelectedKit] = useState<MarketplaceKit | null>(null);
  const [operatingKitId, setOperatingKitId] = useState<string | null>(null);
  const [operationType, setOperationType] = useState<KitOperationType | null>(null);
  const [installPrompt, setInstallPrompt] = useState<{ kitId: string; text: string } | null>(null);
  const [kitPendingUninstall, setKitPendingUninstall] = useState<MarketplaceKit | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [marketKits, installed, marketCategories] = await Promise.all([
      kitService.fetchMarketplaceKits(),
      kitService.getInstalledKits(),
      kitService.fetchMarketplaceCategories(),
    ]);
    setKits(marketKits);
    setInstalledKits(installed);
    setCategories(marketCategories);

    if (marketCategories.length > 0) {
      setActiveTab((prev) => {
        const exists = marketCategories.some((cat) => cat.id === prev);
        return exists ? prev : marketCategories[0].id;
      });
    }

    dispatch(setMarketplaceKits(marketKits));
    dispatch(setInstalledKitsAction(installed));
    setIsLoading(false);
  }, [dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredKits = useMemo(() => {
    let results = kits;
    // Tab filtering
    const firstCategoryId = categories[0]?.id;
    if (activeTab === firstCategoryId) {
      results = results.filter((kit) => !kit.category || kit.category === activeTab);
    } else {
      results = results.filter((kit) => kit.category === activeTab);
    }
    // Search filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter((kit) => {
        const name = resolveLocalizedText(kit.name).toLowerCase();
        const desc = resolveLocalizedText(kit.description).toLowerCase();
        return name.includes(q) || desc.includes(q);
      });
    }
    return results;
  }, [kits, activeTab, categories, searchQuery]);

  const handleInstall = async (kit: MarketplaceKit) => {
    setOperatingKitId(kit.id);
    setOperationType(KitOperationType.Install);
    try {
      const result = await kitService.installKit(kit);
      if (result.success) {
        const installed = await kitService.getInstalledKits();
        setInstalledKits(installed);
        dispatch(setInstalledKitsAction(installed));
      } else {
        console.error('[KitsManager] Install failed:', result.error);
      }
    } finally {
      setOperatingKitId(null);
      setOperationType(null);
    }
  };

  const handleRequestUninstall = (kit: MarketplaceKit) => {
    setKitPendingUninstall(kit);
  };

  const handleCancelUninstall = () => {
    if (operationType === KitOperationType.Uninstall) return;
    setKitPendingUninstall(null);
  };

  const handleUninstall = async (kitId: string) => {
    setOperatingKitId(kitId);
    setOperationType(KitOperationType.Uninstall);
    try {
      const result = await kitService.uninstallKit(kitId);
      if (result.success) {
        const installed = await kitService.getInstalledKits();
        setInstalledKits(installed);
        dispatch(setInstalledKitsAction(installed));
      } else {
        console.error('[KitsManager] Uninstall failed:', result.error);
      }
    } finally {
      setOperatingKitId(null);
      setOperationType(null);
      setKitPendingUninstall(null);
    }
  };

  const handleConfirmUninstall = async () => {
    if (!kitPendingUninstall || operationType === KitOperationType.Uninstall) return;
    const kitId = kitPendingUninstall.id;
    setKitPendingUninstall(null);
    await handleUninstall(kitId);
  };

  const isKitInstalled = (kitId: string) => !!installedKits[kitId];
  const isOperating = (kitId: string) => operatingKitId === kitId;
  const getSkillCount = (kit: MarketplaceKit) => kit.skills?.list.length ?? 0;
  const getKitUpdateInfo = (kit: MarketplaceKit): KitUpdateInfo | null => {
    const installedKit = installedKits[kit.id];
    if (!installedKit || !kit.version) return null;

    const installedVersion = installedKit.version || '0.0.0';
    if (compareVersions(kit.version, installedVersion) <= 0) return null;
    return {
      installedVersion,
      currentVersion: kit.version,
    };
  };

  const handleTryAskingClick = (text: string, kitId: string) => {
    if (isKitInstalled(kitId)) {
      onTryAsking?.(text, kitId);
    } else {
      setInstallPrompt({ kitId, text });
    }
  };

  const handleInstallAndTry = async () => {
    if (!installPrompt || !selectedKit) return;
    const { kitId, text } = installPrompt;
    setInstallPrompt(null);
    await handleInstall(selectedKit);
    // After install, check if it succeeded and navigate
    const installed = await kitService.getInstalledKits();
    if (installed[kitId]) {
      onTryAsking?.(text, kitId);
    }
  };

  const uninstallConfirmModal = kitPendingUninstall ? (
    <Modal
      onClose={handleCancelUninstall}
      overlayClassName="fixed inset-0 z-[9999] flex items-center justify-center modal-backdrop px-4"
      className="modal-content w-full max-w-sm rounded-2xl border border-border bg-surface shadow-modal p-5"
    >
      <div className="text-lg font-semibold text-foreground">
        {i18nService.t('kitUninstall')}
      </div>
      <p className="mt-2 text-sm text-secondary">
        {i18nService.t('kitUninstallConfirm').replace(
          '{name}',
          resolveLocalizedText(kitPendingUninstall.name),
        )}
      </p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleCancelUninstall}
          disabled={operationType === KitOperationType.Uninstall}
          className="px-3 py-1.5 text-xs rounded-lg border border-border text-secondary hover:bg-surface-raised transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {i18nService.t('cancel')}
        </button>
        <button
          type="button"
          onClick={handleConfirmUninstall}
          disabled={operationType === KitOperationType.Uninstall}
          className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {i18nService.t('confirmDelete')}
        </button>
      </div>
    </Modal>
  ) : null;

  const handleDirectChat = () => {
    if (!selectedKit) return;
    const kitId = selectedKit.id;
    if (isKitInstalled(kitId)) {
      onTryAsking?.('', kitId);
      setSelectedKit(null);
    }
  };

  const getAvatarBgClass = (bg?: string) => {
    switch (bg) {
      case 'rose':
        return 'from-rose-50 to-rose-100 dark:from-rose-950/20 dark:to-rose-900/10 hover:from-rose-100 hover:to-rose-200 dark:hover:from-rose-900/30';
      case 'amber':
        return 'from-amber-50 to-amber-100 dark:from-amber-950/20 dark:to-amber-900/10 hover:from-amber-100 hover:to-amber-200 dark:hover:from-amber-900/30';
      case 'sky':
        return 'from-sky-50 to-sky-100 dark:from-sky-950/20 dark:to-sky-900/10 hover:from-sky-100 hover:to-sky-200 dark:hover:from-sky-900/30';
      case 'mint':
        return 'from-emerald-50 to-emerald-100 dark:from-emerald-950/20 dark:to-emerald-900/10 hover:from-emerald-100 hover:to-emerald-200 dark:hover:from-emerald-900/30';
      case 'lavender':
        return 'from-violet-50 to-violet-100 dark:from-violet-950/20 dark:to-violet-900/10 hover:from-violet-100 hover:to-violet-200 dark:hover:from-violet-900/30';
      case 'coral':
        return 'from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/10 hover:from-orange-100 hover:to-orange-200 dark:hover:from-orange-900/30';
      case 'slate':
      default:
        return 'from-slate-50 to-slate-100 dark:from-slate-800/40 dark:to-slate-800/20 hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-700/40';
    }
  };

  const getDetailHeroBgClass = (bg?: string) => {
    switch (bg) {
      case 'rose':
        return 'bg-gradient-to-br from-rose-50 via-rose-100/60 to-pink-50/20 dark:from-rose-950/40 dark:via-rose-950/20 dark:to-transparent';
      case 'amber':
        return 'bg-gradient-to-br from-amber-50 via-amber-100/60 to-orange-50/20 dark:from-amber-950/40 dark:via-amber-950/20 dark:to-transparent';
      case 'sky':
        return 'bg-gradient-to-br from-sky-50 via-sky-100/60 to-blue-50/20 dark:from-sky-950/40 dark:via-sky-950/20 dark:to-transparent';
      case 'mint':
        return 'bg-gradient-to-br from-emerald-50 via-emerald-100/60 to-teal-50/20 dark:from-emerald-950/40 dark:via-emerald-950/20 dark:to-transparent';
      case 'lavender':
        return 'bg-gradient-to-br from-violet-50 via-violet-100/60 to-fuchsia-50/20 dark:from-violet-950/40 dark:via-violet-950/20 dark:to-transparent';
      case 'coral':
        return 'bg-gradient-to-br from-orange-50 via-orange-100/60 to-red-50/20 dark:from-orange-950/40 dark:via-orange-950/20 dark:to-transparent';
      case 'slate':
      default:
        return 'bg-gradient-to-br from-slate-50 via-slate-100/60 to-zinc-50/20 dark:from-slate-800/40 dark:via-slate-800/20 dark:to-transparent';
    }
  };

  const getTagClass = (color?: string) => {
    switch (color) {
      case 'purple':
        return 'bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-100 dark:border-purple-900/10';
      case 'amber':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/10';
      case 'rose':
        return 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/10';
      case 'sky':
        return 'bg-sky-50 text-sky-600 dark:bg-sky-950/20 dark:text-sky-400 border border-sky-100 dark:border-sky-900/10';
      case 'mint':
        return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/10';
      case 'coral':
        return 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 border border-orange-100 dark:border-orange-900/10';
      case 'slate':
      default:
        return 'bg-slate-50 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 border border-slate-100 dark:border-slate-800/20';
    }
  };

  const installedList = useMemo(() => (
    filteredKits.filter(kit => !!installedKits[kit.id])
  ), [filteredKits, installedKits]);

  const recruitableList = useMemo(() => (
    filteredKits.filter(kit => !installedKits[kit.id])
  ), [filteredKits, installedKits]);

  const renderKitCard = (kit: MarketplaceKit, index: number) => {
    const installed = isKitInstalled(kit.id);
    const operating = isOperating(kit.id);
    const skillCount = getSkillCount(kit);
    const updateInfo = getKitUpdateInfo(kit);

    return (
      <div
        key={kit.id}
        className="group relative flex cursor-pointer rounded-xl border border-border bg-surface shadow-subtle transition-all hover:border-primary/40 hover:shadow-card overflow-hidden"
        onClick={() => setSelectedKit(kit)}
      >
        {/* 左侧头像区 */}
        <div className={`w-[100px] flex-shrink-0 flex flex-col items-center justify-center py-4 px-2 bg-gradient-to-b ${getAvatarBgClass(kit.avatarBg)} relative overflow-hidden rounded-l-xl border-r border-border/40`}>
          <KitIcon 
            icon={kit.icon} 
            className="h-[72px] w-[72px]" 
            style={{ animationDelay: `${[0, 0.5, 1.2, 1.8][index % 4]}s` }} 
          />
          {kit.motto && (
            <div className="text-[10px] text-secondary text-center line-clamp-2 leading-tight opacity-75 select-none font-normal z-10 px-1 italic">
              “{resolveLocalizedText(kit.motto)}”
            </div>
          )}
        </div>

        {/* 右侧主体区 */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {resolveLocalizedText(kit.name)}
                </h3>
                {kit.tagline && (
                  <p className="mt-0.5 text-xs text-secondary truncate">
                    {resolveLocalizedText(kit.tagline)}
                  </p>
                )}
              </div>
              
              {/* 召唤/召回按钮 */}
              <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                {installed ? (
                  <button
                    type="button"
                    disabled={operating}
                    onClick={() => handleRequestUninstall(kit)}
                    className="inline-flex h-6 items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 px-2 py-0.5 transition-colors hover:bg-amber-100/50"
                  >
                    <ArrowPathIcon className="h-3 w-3" />
                    召回
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={operating}
                    onClick={() => handleInstall(kit)}
                    className="inline-flex h-6 items-center gap-1.5 rounded-lg bg-primary text-[10px] font-semibold text-white px-2.5 py-0.5 transition-colors hover:bg-primary-hover shadow-sm"
                  >
                    <ArrowDownTrayIcon className="h-3 w-3" />
                    {operating && operationType === KitOperationType.Install
                      ? i18nService.t('kitInstalling')
                      : i18nService.t('kitInstall')}
                  </button>
                )}
              </div>
            </div>

            <p className="mt-2 text-[12px] leading-[18px] text-secondary line-clamp-2">
              {resolveLocalizedText(kit.description)}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1 min-w-0">
              {kit.tags?.map((tag, idx) => (
                <span key={idx} className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-medium leading-none shrink-0 ${getTagClass(tag.color)}`}>
                  {resolveLocalizedText(tag.text)}
                </span>
              ))}
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-secondary">
              {skillCount > 0 && (
                <span className="rounded-full bg-surface-raised border border-border/40 px-2 py-0.5">
                  {i18nService.t('kitSkillCount').replace('{count}', String(skillCount))}
                </span>
              )}
              {updateInfo && (
                <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                  {i18nService.t('kitReinstallRequiredBadge')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // List view
  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary">
        {i18nService.t('kitDescription')}
      </p>

      {/* Sticky toolbar: Search + Marketplace tab */}
      <div className="sticky top-0 z-10 space-y-4 bg-background pb-4">
        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={i18nService.t('kitSearchPlaceholder')}
              className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-8 text-sm text-foreground placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-secondary transition-colors hover:text-primary"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Market section */}
        <div className="flex items-center gap-6">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveTab(cat.id)}
              className={`relative px-2.5 pb-2.5 pt-0.5 text-[13px] font-semibold transition-colors focus:outline-none ${
                activeTab === cat.id ? 'text-foreground font-semibold' : 'text-secondary hover:text-foreground'
              }`}
            >
              {resolveLocalizedText(cat.name)}
              {activeTab === cat.id && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Kit grid */}
      {isLoading ? (
        <div className="text-center py-12 text-sm text-secondary">
          {i18nService.t('kitLoading')}
        </div>
      ) : filteredKits.length === 0 ? (
        <div className="text-center py-12 text-sm text-secondary">
          {i18nService.t('kitEmpty')}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 已召唤专家 */}
          {installedList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-secondary tracking-wider uppercase">
                  已召唤的专家
                </h4>
                <span className="text-[10px] text-secondary bg-surface-raised px-2 py-0.5 rounded-full border border-border/40">
                  {installedList.length} 人在岗
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {installedList.map((kit, index) => renderKitCard(kit, index))}
              </div>
            </div>
          )}

          {/* 可召唤专家 */}
          {recruitableList.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-secondary tracking-wider uppercase">
                可召唤的专家
              </h4>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {recruitableList.map((kit, index) => renderKitCard(kit, index))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Install confirmation dialog */}
      {installPrompt && (
        <Modal
          onClose={() => setInstallPrompt(null)}
          overlayClassName="fixed inset-0 z-[9999] flex items-center justify-center modal-backdrop px-4"
          className="modal-content w-full max-w-sm rounded-2xl border border-border bg-surface shadow-modal overflow-hidden"
        >
          <div className="px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">
              {i18nService.t('kitInstallRequired')}
            </h2>
            <p className="mt-1.5 text-sm leading-5 text-secondary">
              {i18nService.t('kitInstallRequiredDesc')}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={() => setInstallPrompt(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg text-secondary hover:bg-surface-raised transition-colors"
            >
              {i18nService.t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleInstallAndTry}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
            >
              {i18nService.t('kitInstall')}
            </button>
          </div>
        </Modal>
      )}

      {/* 专家详情弹窗 */}
      {selectedKit && (
        <Modal
          onClose={() => setSelectedKit(null)}
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
          className="modal-content w-full max-w-[540px] rounded-2xl border border-border bg-surface shadow-modal overflow-hidden flex flex-col max-h-[85vh] relative animate-slide-up"
        >
          {/* 渐变头部 Hero */}
          <div className={`px-6 py-6 flex items-start gap-4 border-b border-border/30 relative overflow-hidden ${getDetailHeroBgClass(selectedKit.avatarBg)}`}>
            <KitIcon icon={selectedKit.icon} className="h-20 w-20 shrink-0 relative z-10" />
            <div className="min-w-0 flex-1 relative z-10 pr-6">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-1.5">
                {resolveLocalizedText(selectedKit.name)}
              </h2>
              {selectedKit.tagline && (
                <p className="text-xs text-secondary mt-0.5">
                  {resolveLocalizedText(selectedKit.tagline)}
                </p>
              )}
              {selectedKit.motto && (
                <div className="mt-2.5 px-3 py-1.5 bg-white/70 dark:bg-white/5 rounded-lg border-l-2 border-primary text-xs leading-relaxed text-secondary italic select-none relative">
                  “{resolveLocalizedText(selectedKit.motto)}”
                </div>
              )}
            </div>
            {/* 关闭按钮 */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSelectedKit(null); }}
              className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center text-secondary transition-all cursor-pointer pointer-events-auto"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          {/* 滚动主体 */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* 擅长技能 */}
            {selectedKit.skills && selectedKit.skills.list.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-secondary mb-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  擅长技能
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedKit.skills.list.map((skill) => (
                    <span
                      key={skill.id}
                      className="inline-flex items-center rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-secondary"
                    >
                      {resolveLocalizedText(skill.name).replace(/^\//, '')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 试试这样问 */}
            {selectedKit.tryAsking && selectedKit.tryAsking.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-secondary mb-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  试试这样问 {resolveLocalizedText(selectedKit.name)}
                </h4>
                <div className="space-y-2">
                  {selectedKit.tryAsking.map((promptText, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleTryAskingClick(resolveLocalizedText(promptText), selectedKit.id)}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border bg-surface-raised hover:border-primary/40 hover:bg-surface transition-all cursor-pointer group"
                    >
                      <span className="text-xs text-secondary group-hover:text-foreground">
                        {resolveLocalizedText(promptText)}
                      </span>
                      <ArrowLeftIcon className="h-3 w-3 text-secondary group-hover:text-primary group-hover:translate-x-0.5 transition-all rotate-180 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 底部操作栏 */}
          <div className="border-t border-border/60 px-6 py-4 flex gap-3 bg-surface">
            {/* 召唤/召回按钮 */}
            {isKitInstalled(selectedKit.id) ? (
              <button
                type="button"
                disabled={isOperating(selectedKit.id)}
                onClick={() => handleRequestUninstall(selectedKit)}
                className="flex-1 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-amber-100/50 transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                召回
              </button>
            ) : (
              <button
                type="button"
                disabled={isOperating(selectedKit.id)}
                onClick={() => handleInstall(selectedKit)}
                className="flex-1 h-10 rounded-xl bg-primary text-white flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50"
              >
                <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                {isOperating(selectedKit.id) && operationType === KitOperationType.Install
                  ? i18nService.t('kitInstalling')
                  : i18nService.t('kitInstall')}
              </button>
            )}

            {/* 直接对话按钮 */}
            <button
              type="button"
              disabled={isOperating(selectedKit.id) || !isKitInstalled(selectedKit.id)}
              title={!isKitInstalled(selectedKit.id) ? i18nService.t('kitDirectChatDisabledTooltip') : undefined}
              onClick={handleDirectChat}
              className="h-10 rounded-xl bg-surface border border-border hover:bg-surface-raised px-4 text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface"
            >
              <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              直接对话
            </button>
          </div>
        </Modal>
      )}

      {uninstallConfirmModal}
    </div>
  );
};

export default KitsManager;
