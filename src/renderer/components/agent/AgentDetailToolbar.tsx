import React from 'react';
import AgentWorkingDirectoryField from './AgentWorkingDirectoryField';

interface AgentDetailToolbarProps {
  workingDirectory: string;
  onWorkingDirectoryChange: (value: string) => void;
}

const AgentDetailToolbar: React.FC<AgentDetailToolbarProps> = ({
  workingDirectory,
  onWorkingDirectoryChange,
}) => (
  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
    <AgentWorkingDirectoryField
      value={workingDirectory}
      onChange={onWorkingDirectoryChange}
      compact
    />
  </div>
);

export default AgentDetailToolbar;
