import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

import type { SkillManager } from '../../skillManager';
import { updatePluginSkillIdsFromReport } from '../../skills';

export interface SkillHandlerDeps {
  getSkillManager: () => SkillManager;
  getSkillStoreUrl: () => string;
  getOpenClawRuntimeAdapter: () => {
    connectGatewayIfNeeded: () => Promise<void>;
    getGatewayClient: () => {
      request: <T = Record<string, unknown>>(
        method: string,
        params?: unknown,
        opts?: { timeoutMs?: number },
      ) => Promise<T>;
    } | null;
  } | null;
}

const MY_SKILLS = new Set([
  'campaign-analytics',
  'cmo',
  'content-marketing',
  'content-strategy',
  'geo-content-optimizer',
  'marketing-brand-playbook',
  'marketing-psychology',
  'social-content-calendar',
  'short-form-video',
  'clip-editor',
  'ffmpeg-video-editor',
  'remotion-video-toolkit',
  'video-clip-assistant',
  'video-editor',
  'hook-and-headline-writing'
]);

export function registerSkillHandlers(deps: SkillHandlerDeps): void {
  const { getSkillManager, getSkillStoreUrl, getOpenClawRuntimeAdapter } = deps;

  ipcMain.handle('skills:list', () => {
    try {
      const allSkills = getSkillManager().listSkills();
      // TODO: 以后如需开放有道原本内置的默认技能，直接恢复返回 allSkills 即可。目前通过白名单过滤，只返回我自己的 15 个专有技能，在 UI 界面上彻底隐藏其他有道技能。
      const skills = allSkills.filter(s => s && (MY_SKILLS.has(s.skillKey) || MY_SKILLS.has((s as any).id)));
      return { success: true, skills };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load skills',
      };
    }
  });

  ipcMain.handle('skills:setEnabled', async (_event, options: { id: string; enabled: boolean }) => {
    try {
      const skills = getSkillManager().setSkillEnabled(options.id, options.enabled);
      // Best-effort sync to OpenClaw
      try {
        const adapter = getOpenClawRuntimeAdapter();
        if (adapter) {
          await adapter.connectGatewayIfNeeded();
          const client = adapter.getGatewayClient();
          if (client) {
            await client.request(
              'skills.update',
              { skillKey: options.id, enabled: options.enabled },
              { timeoutMs: 10_000 },
            );
          }
        }
      } catch (ocError) {
        console.warn('[skills] Failed to sync enabled state to OpenClaw:', ocError);
      }
      return { success: true, skills };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update skill',
      };
    }
  });

  ipcMain.handle('skills:delete', async (_event, id: string) => {
    try {
      // Read _meta.json before deletion to get OpenClaw source path
      let openclawSourceDir: string | null = null;
      try {
        const skillRoot = getSkillManager().getSkillsRoot();
        const metaPath = path.join(skillRoot, id, '_meta.json');
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          if (meta.openclawSourceDir) {
            openclawSourceDir = meta.openclawSourceDir;
          }
        }
      } catch {
        /* best-effort */
      }

      const skills = await getSkillManager().deleteSkill(id);

      // Also remove from OpenClaw workspace so the skill won't reappear on next sync
      if (openclawSourceDir && fs.existsSync(openclawSourceDir)) {
        try {
          await fs.promises.rm(openclawSourceDir, { recursive: true, force: true });
          console.log('[skills] Also removed OpenClaw workspace skill:', openclawSourceDir);
        } catch (ocError) {
          console.warn('[skills] Failed to remove skill from OpenClaw workspace:', ocError);
        }
      }

      return { success: true, skills };
    } catch (error) {
      console.error('[skills] Failed to delete skill:', id, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete skill',
      };
    }
  });

  ipcMain.handle('skills:download', async (_event, source: string) => {
    return getSkillManager().downloadSkill(source);
  });

  ipcMain.handle('skills:upgrade', async (_event, skillId: string, downloadUrl: string) => {
    return getSkillManager().upgradeSkill(skillId, downloadUrl);
  });

  ipcMain.handle('skills:confirmInstall', async (_event, pendingId: string, action: string) => {
    const validActions = ['install', 'installDisabled', 'cancel'];
    if (!validActions.includes(action)) {
      return { success: false, error: 'Invalid action' };
    }
    return getSkillManager().confirmPendingInstall(
      pendingId,
      action as 'install' | 'installDisabled' | 'cancel',
    );
  });

  ipcMain.handle('skills:getRoot', () => {
    try {
      const root = getSkillManager().getSkillsRoot();
      return { success: true, path: root };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve skills root',
      };
    }
  });

  ipcMain.handle('skills:autoRoutingPrompt', () => {
    try {
      const prompt = getSkillManager().buildAutoRoutingPrompt();
      return { success: true, prompt };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to build auto-routing prompt',
      };
    }
  });

  ipcMain.handle('skills:getConfig', (_event, skillId: string) => {
    return getSkillManager().getSkillConfig(skillId);
  });

  ipcMain.handle('skills:setConfig', (_event, skillId: string, config: Record<string, string>) => {
    return getSkillManager().setSkillConfig(skillId, config);
  });

  ipcMain.handle(
    'skills:testEmailConnectivity',
    async (_event, skillId: string, config: Record<string, string>) => {
      return getSkillManager().testEmailConnectivity(skillId, config);
    },
  );

  ipcMain.handle('skills:fetchMarketplace', async () => {
    const url = `${getSkillStoreUrl()}?t=${Date.now()}`;
    console.log(`[SkillMarketplace] fetching from: ${url}`);
    try {
      const http = await import('http');
      const https = await import('https');
      const mod = url.startsWith('https:') ? https : http;
      const data = await new Promise<string>((resolve, reject) => {
        const req = mod.get(url, { timeout: 10000 }, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            res.resume();
            return;
          }
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => { body += chunk; });
          res.on('end', () => resolve(body));
          res.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      });
      return { success: true, data };
    } catch (error) {
      console.error('[SkillMarketplace] fetch failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch skill marketplace' };
    }
  });

  ipcMain.handle('skills:detectFromOpenClaw', async () => {
    try {
      const adapter = getOpenClawRuntimeAdapter();
      if (!adapter) {
        return { skills: [], error: 'OpenClaw runtime not available' };
      }
      await adapter.connectGatewayIfNeeded();
      const client = adapter.getGatewayClient();
      if (!client) {
        return { skills: [], error: 'Gateway client not connected' };
      }
      const report = await client.request<{ skills: Array<Record<string, unknown>> }>(
        'skills.status',
        {},
        { timeoutMs: 10_000 },
      );
      const sm = getSkillManager();
      updatePluginSkillIdsFromReport(sm, report as any);
      return sm.detectSkillsFromOpenClaw(report as any);
    } catch (error) {
      return { skills: [], error: error instanceof Error ? error.message : 'Detection failed' };
    }
  });

  ipcMain.handle('skills:syncFromOpenClaw', async () => {
    try {
      const adapter = getOpenClawRuntimeAdapter();
      if (!adapter) {
        return { synced: [], error: 'OpenClaw runtime not available' };
      }
      await adapter.connectGatewayIfNeeded();
      const client = adapter.getGatewayClient();
      if (!client) {
        return { synced: [], error: 'Gateway client not connected' };
      }
      const report = await client.request<{ skills: Array<Record<string, unknown>> }>(
        'skills.status',
        {},
        { timeoutMs: 10_000 },
      );
      const sm = getSkillManager();
      updatePluginSkillIdsFromReport(sm, report as any);
      return sm.syncSkillsFromOpenClaw(report as any);
    } catch (error) {
      return { synced: [], error: error instanceof Error ? error.message : 'Sync failed' };
    }
  });

  ipcMain.handle('skills:refreshPluginSkillIds', async () => {
    try {
      const adapter = getOpenClawRuntimeAdapter();
      if (!adapter) {
        return { success: false, error: 'OpenClaw runtime not available' };
      }
      await adapter.connectGatewayIfNeeded();
      const client = adapter.getGatewayClient();
      if (!client) {
        return { success: false, error: 'Gateway client not connected' };
      }
      const report = await client.request<{ skills: Array<Record<string, unknown>> }>(
        'skills.status',
        {},
        { timeoutMs: 10_000 },
      );
      const sm = getSkillManager();
      updatePluginSkillIdsFromReport(sm, report as any);
      return { success: true, pluginSkillIds: [...sm.getPluginSkillIds()] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Refresh failed' };
    }
  });
}
