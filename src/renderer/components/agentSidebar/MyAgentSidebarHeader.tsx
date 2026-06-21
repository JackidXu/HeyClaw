import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import React from 'react';

import { i18nService } from '../../services/i18n';

interface MyAgentSidebarHeaderProps {
  onCreateAgent: () => void;
  onSearchTasks?: () => void;
}

const MyAgentSidebarHeader: React.FC<MyAgentSidebarHeaderProps> = ({
  onCreateAgent,
  onSearchTasks,
}) => {
  return (
    <div className="sticky top-0 z-30 -ml-[6px] flex h-10 w-[calc(100%+12px)] items-center justify-between bg-surface-raised pl-3 pr-1">
      <h2 className="min-w-0 truncate text-[14px] font-normal text-foreground opacity-[0.28]">
        {i18nService.t('myAgents')}
      </h2>
      <div className="flex items-center gap-0.5">
        {onSearchTasks && (
          <button
            type="button"
            onClick={onSearchTasks}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-foreground opacity-[0.34] transition-opacity hover:opacity-[0.5]"
            aria-label="搜索任务"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onCreateAgent}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-foreground opacity-[0.34] transition-opacity hover:opacity-[0.5]"
          aria-label={i18nService.t('createNewAgent')}
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default MyAgentSidebarHeader;
