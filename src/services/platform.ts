import { Capacitor } from '@capacitor/core';

export type PlatformOS = 'android' | 'ios' | 'web';

export interface PlatformCapabilities {
  readonly isNative: boolean;
  readonly os: PlatformOS;
  readonly canScrape: boolean;
}

function resolvePlatformOS(): PlatformOS {
  const raw = Capacitor.getPlatform();
  if (raw === 'android' || raw === 'ios') {
    return raw;
  }
  return 'web';
}

const isNative = Capacitor.isNativePlatform();

/**
 * Centralized platform capability facade.
 * UI components must query semantic capabilities here instead of calling Capacitor directly.
 */
export const platform: PlatformCapabilities = {
  isNative,
  os: resolvePlatformOS(),
  canScrape: isNative,
};
