/**
 * 集中管理所有业务 API 端点。
 * 后续新增的业务接口也应在此文件中配置。
 */

import { configService } from './config';

export const isTestModeEnabled = () => {
  return configService.getConfig().app?.testMode === true;
};

// 自动更新
export const getUpdateCheckUrl = () =>
  'https://scrm0.cdn.banchengyun.com/heyclaw/downloads/version.json';

// 手动检查更新
export const getManualUpdateCheckUrl = () =>
  'https://scrm0.cdn.banchengyun.com/heyclaw/downloads/version.json';

export const getFallbackDownloadUrl = () =>
  'https://claw.chaohui.ai/';

// Skill 商店
export const getSkillStoreUrl = () => 'https://scrm0.cdn.banchengyun.com/heyclaw/server-assets/skill-store.json';

// Kit 商店
export const getKitStoreUrl = () => 'https://scrm0.cdn.banchengyun.com/heyclaw/server-assets/kit-store.json';

// 快速发问
export const getQuickActionsUrl = () => 'https://scrm0.cdn.banchengyun.com/heyclaw/server-assets/quick-actions.json';

// 登录地址
export const getLoginOvermindUrl = () => isTestModeEnabled()
  ? 'https://api-overmind.heyclaw.com/openapi/get/luna/hardware/lobsterai/test/login-url'
  : 'https://api-overmind.heyclaw.com/openapi/get/luna/hardware/lobsterai/prod/login-url';

// Portal 页面
const PORTAL_BASE_TEST = 'https://inner.heyclaw.com/portal#';
const PORTAL_BASE_PROD = 'https://portal.heyclaw.com/portal#';

const getPortalBase = () => isTestModeEnabled() ? PORTAL_BASE_TEST : PORTAL_BASE_PROD;

export const PortalPricingKeyfrom = {
  HtmlShare: 'html_share',
} as const;

export type PortalPricingKeyfrom =
  (typeof PortalPricingKeyfrom)[keyof typeof PortalPricingKeyfrom];

export const getPortalLoginUrl = () => `${getPortalBase()}/login`;
export const getPortalPricingUrl = (keyfrom?: PortalPricingKeyfrom) => (
  `${getPortalBase()}/pricing${keyfrom ? `?keyfrom=${encodeURIComponent(keyfrom)}` : ''}`
);
export const getPortalProfileUrl = () => `${getPortalBase()}/profile`;
export const getPortalRechargeUrl = () => `${getPortalBase()}/`;
export const getPortalInvitationUrl = () => `${getPortalBase()}/invitation`;
