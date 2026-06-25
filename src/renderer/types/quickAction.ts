/**
 * QuickAction 类型定义
 * 用于首页快捷操作功能
 */

/**
 * 预制提示词（原始结构，包含多语言，从单一 JSON 加载）
 */
export interface Prompt {
  /** 唯一标识 */
  id: string;
  /** 图标（如 emoji） */
  icon?: string;
  /** 中文显示标题 */
  labelZh: string;
  /** 英文显示标题 */
  labelEn: string;
  /** 中文简短描述 */
  descriptionZh?: string;
  /** 英文简短描述 */
  descriptionEn?: string;
  /** 中文完整提示词内容 */
  promptZh: string;
  /** 英文完整提示词内容 */
  promptEn: string;
  /** 关联技能标签 */
  tags?: string[];
}

/**
 * 本地化后的预制提示词（仅含当前语言的文本，供 UI 组件渲染使用）
 */
export interface LocalizedPrompt {
  /** 唯一标识 */
  id: string;
  /** 经过本地化翻译后的显示标题 */
  label: string;
  /** 经过本地化翻译后的简短描述 */
  description?: string;
  /** 经过本地化翻译后的完整提示词内容 */
  prompt: string;
  /** 关联技能标签 */
  tags?: string[];
  /** 图标（如 emoji） */
  icon?: string;
}

/**
 * 快捷操作主项（原始结构，包含多语言，从单一 JSON 加载）
 */
export interface QuickAction {
  /** 唯一标识 */
  id: string;
  /** 图标名称（Heroicons） */
  icon: string;
  /** 主题色（hex） */
  color: string;
  /** 映射到 Skill ID */
  skillMapping: string;
  /** 中文显示卡片标题 */
  labelZh: string;
  /** 英文显示卡片标题 */
  labelEn: string;
  /** 预制提示词列表 */
  prompts: Prompt[];
}

/**
 * 本地化后的快捷操作主项（仅含当前语言的文本，供 UI 组件渲染使用）
 */
export interface LocalizedQuickAction {
  /** 唯一标识 */
  id: string;
  /** 经过本地化翻译后的卡片显示标题 */
  label: string;
  /** 图标名称（Heroicons） */
  icon: string;
  /** 主题色（hex） */
  color: string;
  /** 映射到 Skill ID */
  skillMapping: string;
  /** 预制提示词列表（已本地化） */
  prompts: LocalizedPrompt[];
}

/**
 * 快捷操作配置（原始结构）
 */
export interface QuickActionsConfig {
  /** 配置版本 */
  version: number;
  /** 快捷操作列表 */
  actions: QuickAction[];
}

