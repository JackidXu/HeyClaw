import React, { useState } from 'react';
import { i18nService } from '../../services/i18n';
import SkillsManager from './SkillsManager';
import McpManager from '../mcp/McpManager';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import ComposeIcon from '../icons/ComposeIcon';
import WindowTitleBar from '../window/WindowTitleBar';

interface SkillsViewProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
  onCreateSkillByChat?: () => void;
  updateBadge?: React.ReactNode;
  readOnly?: boolean;
  activeTab?: 'skills' | 'mcp';
  onChangeTab?: (tab: 'skills' | 'mcp') => void;
}

const SkillsView: React.FC<SkillsViewProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onNewChat,
  onCreateSkillByChat,
  updateBadge,
  readOnly,
  activeTab,
  onChangeTab,
}) => {
  const isMac = window.electron.platform === 'darwin';
  const [localTab, setLocalTab] = useState<'skills' | 'mcp'>('skills');
  const currentTab = activeTab ?? localTab;
  const handleTabChange = onChangeTab ?? setLocalTab;

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      <div className="draggable flex h-12 items-center justify-between px-4 border-b border-border shrink-0">
        <div className="flex items-center space-x-3 h-8">
          {isSidebarCollapsed && (
            <div className={`non-draggable flex items-center gap-1 ${isMac ? 'pl-[68px]' : ''}`}>
              <button
                type="button"
                onClick={onToggleSidebar}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary hover:bg-surface-raised transition-colors"
              >
                <SidebarToggleIcon className="h-4 w-4" isCollapsed={true} />
              </button>
              <button
                type="button"
                onClick={onNewChat}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary hover:bg-surface-raised transition-colors"
              >
                <ComposeIcon className="h-4 w-4" />
              </button>
              {updateBadge}
            </div>
          )}
          
          {/* 技能 / MCP 切换 Tab 组 */}
          <div className="non-draggable flex items-center space-x-5 h-8 text-base font-semibold select-none">
            <button
              type="button"
              onClick={() => handleTabChange('skills')}
              className={`relative py-1 transition-colors focus:outline-none ${
                currentTab === 'skills'
                  ? 'text-foreground font-semibold'
                  : 'text-secondary hover:text-foreground font-medium'
              }`}
            >
              {i18nService.t('skills')}
              <div
                className={`absolute bottom-[-10px] left-0 right-0 h-0.5 rounded-full transition-colors ${
                  currentTab === 'skills' ? 'bg-primary' : 'bg-transparent'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('mcp')}
              className={`relative py-1 transition-colors focus:outline-none ${
                currentTab === 'mcp'
                  ? 'text-foreground font-semibold'
                  : 'text-secondary hover:text-foreground font-medium'
              }`}
            >
              {i18nService.t('mcpServers')}
              <div
                className={`absolute bottom-[-10px] left-0 right-0 h-0.5 rounded-full transition-colors ${
                  currentTab === 'mcp' ? 'bg-primary' : 'bg-transparent'
                }`}
              />
            </button>
          </div>
        </div>
        <WindowTitleBar inline />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 [scrollbar-gutter:stable]">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {currentTab === 'skills' ? (
            <SkillsManager readOnly={readOnly} onCreateByChat={onCreateSkillByChat} />
          ) : (
            <McpManager />
          )}
        </div>
      </div>
    </div>
  );
};

export default SkillsView;
