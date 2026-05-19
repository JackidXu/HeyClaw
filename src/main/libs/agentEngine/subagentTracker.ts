import type { SubagentRunStore } from '../../subagentRunStore';
import {
  extractGatewayMessageText,
  shouldSuppressHeartbeatText,
} from '../openclawHistory';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};

export type GatewayClientLike = {
  request: <T = Record<string, unknown>>(
    method: string,
    params?: unknown,
    opts?: { expectFinal?: boolean; timeoutMs?: number | null },
  ) => Promise<T>;
};

/**
 * Encapsulates all subagent (child session) tracking logic:
 * state maps, lifecycle detection, history fetching, and persistence.
 */
export class SubagentTracker {
  /** Maps agentId → OpenClaw session key for the subagent session */
  private readonly subagentSessionKeys = new Map<string, string>();
  /** Maps agentId → collected conversation messages */
  private readonly subagentMessages = new Map<string, Array<{ role: string; content: string }>>();
  /** Maps toolCallId → agentId for correlating spawn start → result */
  private readonly subagentToolCallIdToAgentId = new Map<string, string>();
  /** Maps agentId → lifecycle status */
  private readonly subagentStatus = new Map<string, 'running' | 'done'>();

  constructor(
    private readonly store: SubagentRunStore,
    private readonly getGatewayClient: () => GatewayClientLike | null,
  ) {}

  // ── Event hooks (called by adapter at key points) ──────────────────────

  /**
   * Called when a sessions_spawn tool call starts.
   * Tracks the subagent and persists the initial run record.
   */
  onToolStart(
    toolCallId: string,
    args: Record<string, unknown>,
    sessionId: string,
  ): void {
    const agentId = typeof args?.agentId === 'string' && args.agentId
      ? args.agentId
      : typeof args?.taskName === 'string' && args.taskName
        ? args.taskName
        : typeof args?.label === 'string' && args.label
          ? args.label
          : toolCallId; // fallback to toolCallId as unique identifier
    const task = typeof args?.task === 'string' ? args.task : '';
    const label = typeof args?.label === 'string' ? args.label : undefined;
    if (agentId) {
      this.subagentStatus.set(agentId, 'running');
      if (!this.subagentMessages.has(agentId)) {
        this.subagentMessages.set(agentId, []);
      }
      this.subagentToolCallIdToAgentId.set(toolCallId, agentId);
      this.store.insertSubagentRun({
        id: agentId,
        parentSessionId: sessionId,
        sessionKey: null,
        agentId,
        task: task || null,
        label: label ?? null,
        status: 'running',
        createdAt: Date.now(),
      });
    }
  }

  /**
   * Called when a sessions_spawn tool result arrives.
   * Extracts childSessionKey and persists it.
   */
  onSpawnResult(toolCallId: string, resultText: string, args: Record<string, unknown>): void {
    if (!resultText) return;
    try {
      const parsed = JSON.parse(resultText);
      const childSessionKey = typeof parsed?.childSessionKey === 'string' ? parsed.childSessionKey : '';
      const argsAgentId = typeof args?.agentId === 'string' ? args.agentId : '';
      const agentId = this.subagentToolCallIdToAgentId.get(toolCallId) || argsAgentId;
      if (agentId && childSessionKey) {
        this.subagentSessionKeys.set(agentId, childSessionKey);
        this.store.updateSubagentRunSessionKey(agentId, childSessionKey);
      }
    } catch { /* result may not be JSON */ }
  }

  /**
   * Called when sessions_resume or sessions_read tool result arrives.
   * Marks the subagent as done.
   */
  onResumeOrReadResult(args: Record<string, unknown>): void {
    const agentId = typeof args?.agentId === 'string' ? args.agentId : '';
    if (agentId && this.subagentStatus.has(agentId)) {
      this.subagentStatus.set(agentId, 'done');
      this.store.updateSubagentRunStatus(agentId, 'done', Date.now());
    }
  }

  /**
   * Called when backfill retrieves a sessions_spawn tool result text.
   * Extracts childSessionKey if not already known.
   */
  onBackfillResult(toolCallId: string, text: string): void {
    const agentId = this.subagentToolCallIdToAgentId.get(toolCallId);
    if (!agentId || this.subagentSessionKeys.has(agentId)) return;
    try {
      const parsed = JSON.parse(text);
      const childSessionKey = typeof parsed?.childSessionKey === 'string' ? parsed.childSessionKey : '';
      if (childSessionKey) {
        this.subagentSessionKeys.set(agentId, childSessionKey);
        this.store.updateSubagentRunSessionKey(agentId, childSessionKey);
        console.log('[SubagentTracker] session key from backfill:', agentId, childSessionKey);
      }
    } catch { /* not JSON */ }
  }

  /**
   * Detects announce-style runIds that signal subagent completion.
   * Announce runIds follow the pattern: announce:v<N>:agent:<parent>:subagent:<uuid>:<runUuid>
   * Returns true if the runId was an announce pattern (even if no matching subagent was found).
   */
  tryMarkDoneFromAnnounceRunId(runId: string): boolean {
    const match = runId.match(/^announce:.*:subagent:([0-9a-f-]+)/i);
    if (!match) return false;
    const subagentUuid = match[1];
    for (const [agentId, sessionKey] of this.subagentSessionKeys) {
      if (sessionKey.includes(subagentUuid)) {
        if (this.subagentStatus.get(agentId) !== 'done') {
          this.subagentStatus.set(agentId, 'done');
          this.store.updateSubagentRunStatus(agentId, 'done', Date.now());
          console.log('[SubagentTracker] marked subagent as done via announce:', agentId);
        }
        return true;
      }
    }
    console.debug('[SubagentTracker] announce runId detected but no matching subagent:', runId);
    return true;
  }

  /**
   * Clears all in-memory subagent tracking state.
   */
  onSessionDeleted(): void {
    this.subagentSessionKeys.clear();
    this.subagentMessages.clear();
    this.subagentStatus.clear();
    this.subagentToolCallIdToAgentId.clear();
  }

  // ── Public query API ───────────────────────────────────────────────────

  /**
   * Returns persisted subagent runs for a parent session.
   * Merges in-memory status with database records for real-time accuracy.
   */
  listSubagentRuns(parentSessionId: string): Array<{
    id: string;
    agentId: string | null;
    task: string | null;
    label: string | null;
    sessionKey: string | null;
    status: 'running' | 'done' | 'error';
    createdAt: number;
  }> {
    const runs = this.store.listSubagentRuns(parentSessionId);
    return runs.map((run) => {
      const memoryStatus = run.agentId ? this.subagentStatus.get(run.agentId) : undefined;
      const memorySessionKey = run.agentId ? this.subagentSessionKeys.get(run.agentId) : undefined;
      return {
        id: run.id,
        agentId: run.agentId,
        task: run.task,
        label: run.label,
        sessionKey: memorySessionKey ?? run.sessionKey,
        status: memoryStatus ?? run.status,
        createdAt: run.createdAt,
      };
    });
  }

  /**
   * Fetch conversation history for a subagent session.
   * Tries local cache first, then falls back to gateway RPC.
   */
  async getSubTaskHistory(
    parentSessionId: string,
    agentId: string,
    sessionKey?: string,
  ): Promise<Array<{ role: string; content: string }>> {
    // 1. Try locally collected messages (only serve cache if subagent is done)
    const status = this.subagentStatus.get(agentId);
    const local = this.subagentMessages.get(agentId);
    if (local && local.length > 0 && status === 'done') {
      return local;
    }

    // 2. Resolve session key from multiple sources
    let key = sessionKey || this.subagentSessionKeys.get(agentId);

    // 2b. Try reading from persistent store if not in memory
    if (!key) {
      const runs = this.store.listSubagentRuns(parentSessionId);
      const matchingRun = runs.find((r) => r.id === agentId || r.agentId === agentId);
      if (matchingRun?.sessionKey) {
        key = matchingRun.sessionKey;
        this.subagentSessionKeys.set(agentId, key);
      }
      // 2c. If agentId didn't match directly, check if it's a UUID that appears in any session key
      if (!key) {
        const runWithKeyMatch = runs.find((r) =>
          r.sessionKey && r.sessionKey.includes(agentId),
        );
        if (runWithKeyMatch?.sessionKey) {
          key = runWithKeyMatch.sessionKey;
          this.subagentSessionKeys.set(agentId, key);
        }
      }
    }

    if (!key) {
      console.log('[SubagentTracker] getSubTaskHistory: no session key resolved for agentId:', agentId, 'parentSession:', parentSessionId);
      const discovered = await this.discoverSubagentSessionKey(agentId);
      if (!discovered) return [];
      this.subagentSessionKeys.set(agentId, discovered);
      return this.fetchSubagentHistory(discovered, agentId);
    }

    console.log('[SubagentTracker] getSubTaskHistory: fetching history for agentId:', agentId, 'key:', key);
    return this.fetchSubagentHistory(key, agentId);
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async discoverSubagentSessionKey(agentId: string): Promise<string | null> {
    const client = this.getGatewayClient();
    if (!client) return null;
    try {
      const result = await client.request<{ sessions?: unknown[] }>('sessions.list', {
        activeMinutes: 120,
      }, { timeoutMs: 5_000 });
      const sessions = Array.isArray(result?.sessions) ? result.sessions : [];
      for (const session of sessions) {
        if (!isRecord(session)) continue;
        const key = typeof session.key === 'string' ? session.key : '';
        if (key.includes(`:${agentId}:`) || key.includes(`:${agentId}`)
            || key.includes(`subagent:${agentId}`)) {
          return key;
        }
      }
    } catch (error) {
      console.warn('[SubagentTracker] Failed to discover subagent session key:', error);
    }
    return null;
  }

  private async fetchSubagentHistory(
    sessionKey: string,
    agentId: string,
  ): Promise<Array<{ role: string; content: string }>> {
    const client = this.getGatewayClient();
    if (!client) return [];
    try {
      const history = await client.request<{ messages?: unknown[] }>('chat.history', {
        sessionKey,
        limit: 100,
      }, { timeoutMs: 10_000 });

      if (!Array.isArray(history?.messages) || history.messages.length === 0) {
        console.log('[SubagentTracker] fetchSubagentHistory: no messages returned for key:', sessionKey);
        return [];
      }

      console.log('[SubagentTracker] fetchSubagentHistory: got', history.messages.length, 'raw messages for key:', sessionKey);

      const messages: Array<{ role: string; content: string }> = [];
      for (const raw of history.messages) {
        if (!isRecord(raw)) continue;
        const role = typeof raw.role === 'string' ? raw.role.trim().toLowerCase() : '';

        // Handle standard user/assistant/system messages
        if (role === 'user' || role === 'assistant' || role === 'system') {
          const text = extractGatewayMessageText(raw).trim();
          if (text && !shouldSuppressHeartbeatText(role as 'user' | 'assistant' | 'system', text)) {
            messages.push({ role, content: text });
          } else if (role === 'assistant' && !text && Array.isArray(raw.content)) {
            for (const block of raw.content as unknown[]) {
              if (!isRecord(block)) continue;
              const blockType = typeof block.type === 'string' ? block.type : '';
              if (blockType === 'tool_use' || blockType === 'tool_call' || blockType === 'toolCall') {
                const toolName = typeof block.name === 'string' ? block.name : 'tool';
                messages.push({ role: 'tool', content: `[Calling ${toolName}]` });
              }
            }
          }
          continue;
        }

        // Handle tool result messages
        if (role === 'tool_result' || role === 'tool' || role === 'function') {
          const text = extractGatewayMessageText(raw).trim();
          const toolName = typeof raw.toolName === 'string' ? raw.toolName
            : typeof raw.tool_name === 'string' ? raw.tool_name
              : typeof raw.name === 'string' ? raw.name : '';
          if (text) {
            const prefix = toolName ? `[${toolName}] ` : '';
            messages.push({ role: 'tool', content: `${prefix}${text}` });
          }
          continue;
        }

        // Handle messages with content arrays that contain tool_use blocks (no role field)
        if (!role && Array.isArray(raw.content)) {
          for (const block of raw.content as unknown[]) {
            if (!isRecord(block)) continue;
            const blockType = typeof block.type === 'string' ? block.type : '';
            if (blockType === 'tool_use' || blockType === 'tool_call' || blockType === 'toolCall') {
              const toolName = typeof block.name === 'string' ? block.name : 'tool';
              messages.push({ role: 'tool', content: `[Calling ${toolName}]` });
            } else if (blockType === 'text' && typeof block.text === 'string' && block.text.trim()) {
              messages.push({ role: 'assistant', content: block.text.trim() });
            }
          }
          continue;
        }
      }

      // Cache locally
      this.subagentMessages.set(agentId, messages);

      // Update status if we got messages and the session appears done
      if (messages.length > 0 && this.subagentStatus.get(agentId) !== 'done') {
        this.subagentStatus.set(agentId, 'done');
        this.store.updateSubagentRunStatus(agentId, 'done', Date.now());
        console.log('[SubagentTracker] marked subagent as done via history fallback:', agentId);
      }

      console.log('[SubagentTracker] fetchSubagentHistory: extracted', messages.length, 'display messages for agentId:', agentId);
      return messages;
    } catch (error) {
      console.warn('[SubagentTracker] Failed to fetch subagent history:', error);
      return [];
    }
  }
}
