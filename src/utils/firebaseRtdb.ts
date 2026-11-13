import { initializeApp } from 'firebase/app';
import { getDatabase, onValue, ref, type Unsubscribe } from 'firebase/database';

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
    }
  );
}

