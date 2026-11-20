import { Capacitor } from '@capacitor/core';

export type PlatformOS = 'android' | 'ios' | 'web';
export type PlatformChromeStyle = 'ios-glass' | 'material3';

export interface PlatformCapabilities {
  readonly isNative: boolean;
  readonly os: PlatformOS;
  readonly canScrape: boolean;
  readonly chromeStyle: PlatformChromeStyle;
  readonly hapticTap: () => void;
}

function resolvePlatformOS(): PlatformOS {
  const raw = Capacitor.getPlatform();
  if (raw === 'android' || raw === 'ios') {
    return raw;
  }
  return 'web';
}

function triggerHapticTap(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
    }
  } catch {
    // Ignore unsupported vibration calls in restricted WebViews.
  }
}

const isNative = Capacitor.isNativePlatform();
const os = resolvePlatformOS();

/**
 * Centralized platform capability facade.
 * UI components must query semantic capabilities here instead of calling Capacitor directly.
 */
export const platform: PlatformCapabilities = {
  isNative,
  os,
  canScrape: isNative,
  chromeStyle: os === 'ios' ? 'ios-glass' : 'material3',
  hapticTap: triggerHapticTap,
};
