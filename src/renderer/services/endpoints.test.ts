import { afterEach, expect, test, vi } from 'vitest';

import { configService } from './config';
import {
  getPortalInvitationUrl,
  getPortalPricingUrl,
  getPortalProfileUrl,
  getPortalRechargeUrl,
  PortalPricingKeyfrom,
} from './endpoints';

const mockTestMode = (testMode: boolean) => {
  vi.spyOn(configService, 'getConfig').mockReturnValue({
    app: { testMode },
  } as ReturnType<typeof configService.getConfig>);
};

afterEach(() => {
  vi.restoreAllMocks();
});

test('portal account urls use production base when test mode is disabled', () => {
  mockTestMode(false);

  expect(getPortalProfileUrl()).toBe('https://portal.heyclaw.com/portal#/profile');
  expect(getPortalRechargeUrl()).toBe('https://portal.heyclaw.com/portal#/');
  expect(getPortalInvitationUrl()).toBe('https://portal.heyclaw.com/portal#/invitation');
});

test('portal account urls use test base when test mode is enabled', () => {
  mockTestMode(true);

  expect(getPortalProfileUrl()).toBe('https://inner.heyclaw.com/portal#/profile');
  expect(getPortalRechargeUrl()).toBe('https://inner.heyclaw.com/portal#/');
  expect(getPortalInvitationUrl()).toBe('https://inner.heyclaw.com/portal#/invitation');
});

test('portal pricing url can include html share keyfrom', () => {
  mockTestMode(false);

  expect(getPortalPricingUrl(PortalPricingKeyfrom.HtmlShare)).toBe(
    'https://portal.heyclaw.com/portal#/pricing?keyfrom=html_share',
  );
});
