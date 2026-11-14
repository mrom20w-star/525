import { initializeApp } from 'firebase/app';
import { get, getDatabase, onValue, ref, set, update, type Unsubscribe } from 'firebase/database';
import { DetectedDeviceInfo } from './device';

const firebaseConfig = {
  apiKey: 'AIzaSyAlX1ASvDrf5BBtaB72AUYqSoW34YvP_y4',
  authDomain: 'mrwan-dd795.firebaseapp.com',
  databaseURL: 'https://mrwan-dd795-default-rtdb.firebaseio.com',
  projectId: 'mrwan-dd795',
  storageBucket: 'mrwan-dd795.firebasestorage.app',
  messagingSenderId: '12538399995',
  appId: '1:12538399995:web:4a7e6b40f611891fecb45e',
  measurementId: 'G-KBTHXXDYBL',
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);

let serverTimeOffsetMs = 0;
onValue(ref(rtdb, '.info/serverTimeOffset'), (snap) => {
  const val = snap.val();
  if (typeof val === 'number' && Number.isFinite(val)) {
    serverTimeOffsetMs = val;
  }
});

export function getFirebaseServerNow(): number {
  return Date.now() + serverTimeOffsetMs;
}

export interface RtdbDeviceRecord {
  deviceId: string;
  deviceName: string;
  customLabel?: string;
  userAgent?: string;
  platform?: string;
  screenSize?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  durationLabel?: string;
  approvedAt?: number | null;
  expiresAt?: number | null;
  createdAt?: number;
  lastSeenAt?: number;
}

export async function registerDeviceInRtdb(
  deviceInfo: DetectedDeviceInfo
): Promise<RtdbDeviceRecord | null> {
  try {
    const deviceRef = ref(rtdb, `devices/${deviceInfo.deviceId}`);
    const snap = await get(deviceRef);
    const now = getFirebaseServerNow();

    if (snap.exists()) {
      const existing = snap.val() as RtdbDeviceRecord;
      await update(deviceRef, {
        deviceName: deviceInfo.deviceName,
        userAgent: deviceInfo.userAgent,
        platform: deviceInfo.platform,
        screenSize: deviceInfo.screenSize,
        lastSeenAt: now,
      });
      return { ...existing, lastSeenAt: now };
    }

    const created: RtdbDeviceRecord = {
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
      customLabel: '',
      userAgent: deviceInfo.userAgent,
      platform: deviceInfo.platform,
      screenSize: deviceInfo.screenSize,
      status: 'pending',
      durationLabel: '',
      approvedAt: null,
      expiresAt: null,
      createdAt: now,
      lastSeenAt: now,
    };
    await set(deviceRef, created);
    return created;
  } catch (err) {
    console.error('Firebase RTDB direct register error:', err);
    return null;
  }
}

export function subscribeToDevice(
  deviceId: string,
  onUpdate: (data: RtdbDeviceRecord | null) => void
): Unsubscribe {
  const deviceRef = ref(rtdb, `devices/${deviceId}`);
  return onValue(
    deviceRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.val() as RtdbDeviceRecord);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error('Firebase RTDB device listener error:', error);
      onUpdate(null);
    }
  );
}

export function subscribeToDeveloperContact(
  onUpdate: (url: string | null) => void
): Unsubscribe {
  const devRef = ref(rtdb, 'settings/developerUrl');
  return onValue(
    devRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        onUpdate(typeof val === 'string' && val.trim() ? val.trim() : null);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.error('Firebase RTDB developer contact listener error:', error);
    }
  );
}
