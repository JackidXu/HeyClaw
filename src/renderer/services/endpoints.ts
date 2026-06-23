/**
 * 集中管理所有业务 API 端点。
 * 后续新增的业务接口也应在此文件中配置。
 */

import { configService } from './config';

export const isTestModeEnabled = () => {
  return configService.getConfig().app?.testMode === true;
};

// 自动更新
export const getUpdateCheckUrl = () => isTestModeEnabled()
  ? 'https://api-overmind.heyclaw.com/openapi/get/luna/hardware/lobsterai/test/update'
  : 'https://api-overmind.heyclaw.com/openapi/get/luna/hardware/lobsterai/prod/update';

// 手动检查更新
export const getManualUpdateCheckUrl = () => isTestModeEnabled()
  ? 'https://api-overmind.heyclaw.com/openapi/get/luna/hardware/lobsterai/test/update-manual'
  : 'https://api-overmind.heyclaw.com/openapi/get/luna/hardware/lobsterai/prod/update-manual';

export const getFallbackDownloadUrl = () => isTestModeEnabled()
  ? 'https://inner.heyclaw.com/#/download-list'
  : 'https://portal.heyclaw.com/#/download-list';

// Skill 商店
export const getSkillStoreUrl = () => 'http://101.96.234.167:8081/skill-store.json';

// Kit 商店
export const getKitStoreUrl = () => 'http://101.96.234.167:8081/kit-store.json';

// 快速发问
export const getQuickActionsUrl = () => 'http://101.96.234.167:8081/quick-actions.json';
export const getQuickActionsI18nUrl = () => 'http://101.96.234.167:8081/quick-actions-i18n.json';

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
