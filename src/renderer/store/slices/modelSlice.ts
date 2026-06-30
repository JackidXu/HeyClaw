import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { ProviderName } from '@shared/providers/constants';

import { defaultConfig, getProviderDisplayName } from '../../config';
import { resolveOpenClawModelRef } from '../../utils/openclawModelRef';

export interface Model {
  id: string;
  name: string;
  provider?: string; // 模型所属的提供商
  providerKey?: string; // 模型所属的提供商 key（用于唯一标识）
  openClawProviderId?: string; // OpenClaw runtime provider id
  supportsImage?: boolean;
  supportsThinking?: boolean;
  contextWindow?: number;
  isServerModel?: boolean; // 是否为服务端套餐模型
  serverApiFormat?: string; // 服务端模型的 API 格式 ("openai" | "anthropic")
  explicitContextCache?: boolean; // 是否支持服务端显式上下文缓存
  description?: string; // 模型能力简介
  costMultiplier?: number; // 积分消耗倍率 (1.0=标准)
  accessible?: boolean; // false = 模型可见但用户无权使用（置灰）
  restrictionHint?: string; // 限制提示（如 "订阅套餐/购买加油包可用"）
  isAutoModel?: boolean; // true = 智能适配虚拟模型，由主进程根据复杂度路由到实际物理模型
}

/** 智能适配虚拟模型 ID。选择此模型后，主进程会根据 Prompt 复杂度动态路由到合适的物理模型。 */
export const AUTO_MODEL_ID = 'auto';

/** 智能适配虚拟模型定义（始终显示在模型列表首位）。 */
export const AUTO_MODEL: Model = {
  id: AUTO_MODEL_ID,
  name: '智能适配 (Auto)',
  provider: '系统',
  providerKey: 'system',
  supportsImage: true,
  supportsThinking: true,
  accessible: true,
  isAutoModel: true,
  description: '自动根据任务复杂度选择最合适的模型：简单问答用轻量模型，复杂推理/编程用高性能模型',
};

function isServerModelIdentity(model: Pick<Model, 'providerKey' | 'isServerModel'>): boolean {
  return model.isServerModel === true || model.providerKey === ProviderName.LobsteraiServer;
}

export function getModelIdentityKey(model: Pick<Model, 'id' | 'providerKey' | 'isServerModel'>): string {
  return `${model.providerKey ?? ''}::${model.id}`;
}

export function isSameModelIdentity(
  modelA: Pick<Model, 'id' | 'providerKey' | 'isServerModel'>,
  modelB: Pick<Model, 'id' | 'providerKey' | 'isServerModel'>
): boolean {
  if (modelA.id !== modelB.id) {
    return false;
  }
  if (isServerModelIdentity(modelA) !== isServerModelIdentity(modelB)) {
    return false;
  }
  if (modelA.providerKey && modelB.providerKey) {
    return modelA.providerKey === modelB.providerKey;
  }
  // 兼容旧配置：缺失 providerKey 时回退到 id 匹配
  return true;
}

function isModelAccessible(model: Model | undefined): model is Model {
  return !!model && model.accessible !== false;
}

function selectPreferredAccessibleModel(
  allAvailableModels: Model[],
  currentModel: Model,
): Model {
  const matchedModel = allAvailableModels.find(m => isSameModelIdentity(m, currentModel));
  if (isModelAccessible(matchedModel)) {
    return matchedModel;
  }
  return allAvailableModels.find(isModelAccessible) ?? matchedModel ?? allAvailableModels[0] ?? currentModel;
}

// 从 providers 配置中构建初始可用模型列表
function buildInitialModels(): Model[] {
  const models: Model[] = [];
  if (defaultConfig.providers) {
    Object.entries(defaultConfig.providers).forEach(([providerName, config]) => {
      if (config.enabled && config.models) {
        config.models.forEach(model => {
          models.push({
            id: model.id,
            name: model.name,
            provider: getProviderDisplayName(providerName, config),
            providerKey: providerName,
            supportsImage: model.supportsImage ?? false,
          });
        });
      }
    });
  }
  const physicalModels = models.length > 0 ? models : defaultConfig.model.availableModels;
  // 智能适配模型始终位于列表首位
  return [AUTO_MODEL, ...physicalModels];
}

/** 将 AUTO_MODEL 强制插入列表首位（过滤掉旧的同 id 项后重新插入）。 */
function withAutoModelAtHead(models: Model[]): Model[] {
  return [AUTO_MODEL, ...models.filter(m => m.id !== AUTO_MODEL_ID)];
}

// 初始可用模型列表（会在运行时更新）
export let availableModels: Model[] = buildInitialModels();
const defaultModelProvider = defaultConfig.model.defaultModelProvider;

interface ModelState {
  defaultSelectedModel: Model;
  selectedModelByAgent: Record<string, Model>;
  availableModels: Model[];
}

/**
 * Resolve the effective selected model for a given agent.
 *
 * Resolution chain:
 *   1. Per-agent user override from selectedModelByAgent map
 *   2. Agent's configured model string (resolved via resolveOpenClawModelRef)
 *   3. App-level defaultSelectedModel
 */
export function selectAgentSelectedModel(
  modelState: ModelState,
  agentId: string,
  agentModelRef: string,
): Model {
  const override = modelState.selectedModelByAgent[agentId];
  const trimmed = agentModelRef.trim();
  if (trimmed) {
    const resolved = resolveOpenClawModelRef(trimmed, modelState.availableModels);
    if (resolved && isModelAccessible(resolved)) {
      if (!isModelAccessible(override)) return resolved;
      return isSameModelIdentity(override, resolved) ? override : resolved;
    }
  }
  if (isModelAccessible(override)) return override;
  if (isModelAccessible(modelState.defaultSelectedModel)) {
    return modelState.defaultSelectedModel;
  }
  return modelState.availableModels.find(isModelAccessible) ?? modelState.defaultSelectedModel;
}

/**
 * Re-match each per-agent selected model against the current available models.
 * Removes entries that no longer match any available model.
 */
function syncSelectedModelByAgent(
  selectedModelByAgent: Record<string, Model>,
  allAvailableModels: Model[],
): void {
  for (const agentId of Object.keys(selectedModelByAgent)) {
    const agentModel = selectedModelByAgent[agentId];
    const matched = allAvailableModels.find(m => isSameModelIdentity(m, agentModel));
    if (isModelAccessible(matched)) {
      selectedModelByAgent[agentId] = matched;
    } else {
      delete selectedModelByAgent[agentId];
    }
  }
}

const initialState: ModelState = {
  // 优先将默认模型设为智能适配 (Auto)，如找不到则回退到配置的物理默认模型
  defaultSelectedModel: availableModels.find(model => model.id === AUTO_MODEL_ID)
    || availableModels.find(
      model => model.id === defaultConfig.model.defaultModel
        && (!defaultModelProvider || model.providerKey === defaultModelProvider)
    )
    || availableModels[0],
  selectedModelByAgent: {},
  availableModels: availableModels,
};

const modelSlice = createSlice({
  name: 'model',
  initialState,
  reducers: {
    setSelectedModel: (state, action: PayloadAction<{ agentId: string; model: Model }>) => {
      if (action.payload.model.accessible === false) return;
      state.selectedModelByAgent[action.payload.agentId] = action.payload.model;
    },
    setDefaultSelectedModel: (state, action: PayloadAction<Model>) => {
      if (action.payload.accessible === false) return;
      state.defaultSelectedModel = action.payload;
    },
    clearAgentSelectedModel: (state, action: PayloadAction<string>) => {
      delete state.selectedModelByAgent[action.payload];
    },
    setAvailableModels: (state, action: PayloadAction<Model[]>) => {
      // 保留已有的服务端模型，只更新用户自配模型（与 setServerModels 对称）
      const serverModels = state.availableModels.filter(m => m.isServerModel);
      const merged = [...serverModels, ...action.payload.filter(m => m.id !== AUTO_MODEL_ID)];
      state.availableModels = withAutoModelAtHead(merged);
      // 更新导出的 availableModels
      availableModels = state.availableModels;
      // 同步 defaultSelectedModel（若当前为智能适配模型则保留）
      if (state.availableModels.length > 0 && !state.defaultSelectedModel.isAutoModel) {
        state.defaultSelectedModel = selectPreferredAccessibleModel(
          state.availableModels,
          state.defaultSelectedModel,
        );
      }
      // 同步 per-agent 选中模型
      syncSelectedModelByAgent(state.selectedModelByAgent, state.availableModels);
    },
    setServerModels: (state, action: PayloadAction<Model[]>) => {
      // 服务端模型放前面，自配模型保留在后面（过滤掉旧的 AUTO_MODEL 占位）
      const userModels = state.availableModels.filter(m => !m.isServerModel && m.id !== AUTO_MODEL_ID);
      const serverModels = action.payload.filter(m => m.id !== AUTO_MODEL_ID);
      state.availableModels = withAutoModelAtHead([...serverModels, ...userModels]);
      availableModels = state.availableModels;
      // 同步 defaultSelectedModel（若当前为智能适配模型则保留）
      if (state.availableModels.length > 0 && !state.defaultSelectedModel.isAutoModel) {
        state.defaultSelectedModel = selectPreferredAccessibleModel(
          state.availableModels,
          state.defaultSelectedModel,
        );
      }
      // 同步 per-agent 选中模型
      syncSelectedModelByAgent(state.selectedModelByAgent, state.availableModels);
    },
    clearServerModels: (state) => {
      const nonServer = state.availableModels.filter(m => !m.isServerModel && m.id !== AUTO_MODEL_ID);
      state.availableModels = withAutoModelAtHead(nonServer);
      availableModels = state.availableModels;
      // 如果 defaultSelectedModel 是服务端模型，切换到第一个可用物理模型（不切到 Auto）
      if (state.defaultSelectedModel.isServerModel && state.availableModels.length > 0) {
        state.defaultSelectedModel = state.availableModels.find(m => isModelAccessible(m) && !m.isAutoModel)
          ?? state.availableModels.find(isModelAccessible)
          ?? state.defaultSelectedModel;
      }
      // 同步 per-agent 选中模型
      syncSelectedModelByAgent(state.selectedModelByAgent, state.availableModels);
    },
  },
});

export const {
  setSelectedModel,
  setDefaultSelectedModel,
  clearAgentSelectedModel,
  setAvailableModels,
  setServerModels,
  clearServerModels,
} = modelSlice.actions;
export default modelSlice.reducer;
