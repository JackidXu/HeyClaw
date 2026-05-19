import { CheckCircleIcon } from '@heroicons/react/20/solid';
import React from 'react';

import { i18nService } from '../../services/i18n';
import type { SubagentSessionSummary } from '../../types/cowork';
import LoadingIcon from '../icons/LoadingIcon';

interface SubagentTaskRowProps {
  subagent: SubagentSessionSummary;
  onSelect: () => void;
}

const formatDuration = (createdAt: number): string => {
  const elapsed = Date.now() - createdAt;
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
};

const SubagentTaskRow: React.FC<SubagentTaskRowProps> = ({ subagent, onSelect }) => {
  const displayName = subagent.task
    ? subagent.task.length > 40 ? subagent.task.slice(0, 40) + '...' : subagent.task
    : subagent.agentId ?? i18nService.t('subagentUnnamed');
  const duration = formatDuration(subagent.createdAt);

  return (
    <div
      className="group relative -ml-[6px] flex h-[26px] w-[calc(100%+12px)] cursor-pointer items-center gap-1.5 rounded-md pl-[52px] pr-2.5 text-[13px] font-normal text-foreground/60 transition-colors hover:bg-black/[0.03] hover:text-foreground/80 dark:hover:bg-white/[0.04]"
      onClick={onSelect}
      role="treeitem"
      aria-level={3}
    >
      {subagent.status === 'running' ? (
        <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center">
          <LoadingIcon className="h-3 w-3 animate-spin text-blue-500" aria-hidden="true" />
        </span>
      ) : (
        <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center">
          <CheckCircleIcon className="h-3 w-3 text-green-500/70" aria-hidden="true" />
        </span>
      )}

      <span className="min-w-0 flex-1 truncate">
        {displayName}
      </span>

      {subagent.label && (
        <span className="shrink-0 text-[11px] font-medium text-blue-500/70">
          {subagent.label}
        </span>
      )}

      <span className="shrink-0 whitespace-nowrap text-[11px] font-normal text-foreground/25">
        {duration}
      </span>
    </div>
  );
};

export default SubagentTaskRow;
