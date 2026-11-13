const DEVICE_ID_KEY = 'vfcash_device_id_v1';

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const generated =
      'DEV-' +
      Math.random().toString(36).substring(2, 6).toUpperCase() +
      '-' +
      Date.now().toString(36).toUpperCase();
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return 'DEV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

export interface DetectedDeviceInfo {
  deviceId: string;
  deviceName: string;
  userAgent: string;
  platform: string;
  screenSize: string;
}

export function detectDeviceInfo(): DetectedDeviceInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = typeof navigator !== 'undefined' ? navigator.platform || '' : '';
  const screenSize =
    typeof window !== 'undefined'
      ? `${window.screen.width}x${window.screen.height}`
      : '0x0';

  let osLabel = 'جهاز غير معروف';
  if (/iPhone/i.test(ua)) {
    const iosMatch = ua.match(/OS (\d+[_\d]*)/i);
    const ver = iosMatch ? iosMatch[1].replace(/_/g, '.') : '';
    osLabel = ver ? `iPhone (iOS ${ver})` : 'iPhone';
  } else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    osLabel = 'iPad';
  } else if (/Android/i.test(ua)) {
    const modelMatch = ua.match(/Android\s[\d.]+;\s([^;)]+)/i);
    const model = modelMatch ? modelMatch[1].trim() : '';
    osLabel = model ? `Android (${model})` : 'هاتف Android';
  } else if (/Windows/i.test(ua)) {
    osLabel = 'Windows PC';
  } else if (/Mac OS X/i.test(ua)) {
    osLabel = 'Mac';
  } else if (/Linux/i.test(ua)) {
    osLabel = 'Linux';
  }

  let browserLabel = '';
  if (/CriOS|Chrome/i.test(ua) && !/Edg/i.test(ua)) {
    browserLabel = 'Chrome';
  } else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) {
    browserLabel = 'Safari';
  } else if (/Firefox|FxiOS/i.test(ua)) {
    browserLabel = 'Firefox';
  } else if (/Edg/i.test(ua)) {
    browserLabel = 'Edge';
  }

  const deviceName = browserLabel ? `${osLabel} · ${browserLabel}` : osLabel;

  return {
    deviceId: getOrCreateDeviceId(),
    deviceName,
    userAgent: ua,
    platform,
    screenSize,
  };
}

export function formatRemainingDuration(ms: number | null): string {
  if (ms === null) return 'غير محدد';
  if (ms <= 0) return 'منتهي';

  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) return `${days} يوم و ${hours} ساعة`;
  if (hours > 0) return `${hours} ساعة و ${mins} دقيقة`;
  if (mins > 0) return `${mins} دقيقة و ${secs} ثانية`;
  return `${secs} ثانية`;
}

