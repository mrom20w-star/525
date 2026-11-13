import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const FIREBASE_RTDB_URL = (
  process.env.FIREBASE_DATABASE_URL || 'https://mrwan-dd795-default-rtdb.firebaseio.com'
).replace(/\/$/, '');
const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'access-store.json');

interface DeviceRecord {
  deviceId: string;
  deviceName: string;
  customLabel: string;
  userAgent: string;
  platform: string;
  screenSize: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  durationLabel: string;
  approvedAt: number | null;
  expiresAt: number | null;
  createdAt: number;
  lastSeenAt: number;
}

interface AccessStore {
  devices: Record<string, DeviceRecord>;
}

function ensureStore(): AccessStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial: AccessStore = { devices: {} };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AccessStore>;
    return {
      devices: parsed.devices ?? {},
    };
  } catch {
    return { devices: {} };
  }
}

let store: AccessStore = ensureStore();

function saveStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist access store:', err);
  }
}

async function rtdbPutDevice(device: DeviceRecord): Promise<void> {
  try {
    await fetch(`${FIREBASE_RTDB_URL}/devices/${encodeURIComponent(device.deviceId)}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });
  } catch (err) {
    console.error('Firebase RTDB sync write failed:', err);
  }
}

async function rtdbGetDevice(deviceId: string): Promise<DeviceRecord | null> {
  try {
    const res = await fetch(
      `${FIREBASE_RTDB_URL}/devices/${encodeURIComponent(deviceId)}.json`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as DeviceRecord | null;
    return data || null;
  } catch {
    return null;
  }
}

function syncDeviceExpiration(dev: DeviceRecord): boolean {
  if (
    dev.status === 'approved' &&
    dev.expiresAt !== undefined &&
    dev.expiresAt !== null &&
    Date.now() >= dev.expiresAt
  ) {
    dev.status = 'expired';
    saveStore();
    return true;
  }
  return false;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Never serve .php files or admin routes from the web app
  app.use((req, res, next) => {
    const lower = req.path.toLowerCase();
    if (lower.endsWith('.php') || lower.startsWith('/api/admin')) {
      res.status(404).send('Not Found');
      return;
    }
    next();
  });

  // Register device (developer approval via external admin.php + Firebase RTDB)
  app.post('/api/access/register', async (req: Request, res: Response) => {
    const body = req.body as {
      deviceId?: string;
      deviceName?: string;
      userAgent?: string;
      platform?: string;
      screenSize?: string;
    };

    const deviceId = String(body.deviceId || '').trim().slice(0, 120);
    if (!deviceId) {
      res.status(400).json({ error: 'معرف الجهاز مطلوب' });
      return;
    }

    const now = Date.now();
    const remote = await rtdbGetDevice(deviceId);
    const existing = remote || store.devices[deviceId];

    const record: DeviceRecord = existing
      ? {
          ...existing,
          deviceName: String(body.deviceName || existing.deviceName).slice(0, 120),
          customLabel: existing.customLabel || '',
          userAgent: String(body.userAgent || existing.userAgent || '').slice(0, 300),
          platform: String(body.platform || existing.platform || '').slice(0, 80),
          screenSize: String(body.screenSize || existing.screenSize || '').slice(0, 40),
          durationLabel: existing.durationLabel || '',
          approvedAt: existing.approvedAt ?? null,
          expiresAt: existing.expiresAt ?? null,
          createdAt: existing.createdAt || now,
          lastSeenAt: now,
        }
      : {
          deviceId,
          deviceName: String(body.deviceName || 'جهاز غير معروف').slice(0, 120),
          customLabel: '',
          userAgent: String(body.userAgent || '').slice(0, 300),
          platform: String(body.platform || '').slice(0, 80),
          screenSize: String(body.screenSize || '').slice(0, 40),
          status: 'pending',
          durationLabel: '',
          approvedAt: null,
          expiresAt: null,
          createdAt: now,
          lastSeenAt: now,
        };

    syncDeviceExpiration(record);
    store.devices[deviceId] = record;
    saveStore();
    await rtdbPutDevice(record);

    res.json({
      allowed: record.status === 'approved',
      status: record.status,
      expiresAt: record.expiresAt,
      durationLabel: record.durationLabel,
      deviceName: record.customLabel || record.deviceName,
      remainingMs:
        record.expiresAt !== null ? Math.max(0, record.expiresAt - Date.now()) : null,
      serverTime: Date.now(),
    });
  });

  // Live status check synced with Firebase RTDB
  app.get('/api/access/status', async (req: Request, res: Response) => {
    const deviceId = String(req.query.deviceId || '').trim();
    if (!deviceId) {
      res.json({
        allowed: false,
        status: 'pending',
        expiresAt: null,
        remainingMs: null,
        serverTime: Date.now(),
      });
      return;
    }

    const remote = await rtdbGetDevice(deviceId);
    const current = remote || store.devices[deviceId];
    if (!current) {
      res.json({
        allowed: false,
        status: 'pending',
        expiresAt: null,
        remainingMs: null,
        serverTime: Date.now(),
      });
      return;
    }

    const expiredNow = syncDeviceExpiration(current);
    current.lastSeenAt = Date.now();
    store.devices[deviceId] = current;
    saveStore();
    if (expiredNow) {
      await rtdbPutDevice(current);
    }

    res.json({
      allowed: current.status === 'approved',
      status: current.status,
      expiresAt: current.expiresAt ?? null,
      durationLabel: current.durationLabel || '',
      deviceName: current.customLabel || current.deviceName,
      remainingMs:
        current.expiresAt !== undefined && current.expiresAt !== null
          ? Math.max(0, current.expiresAt - Date.now())
          : null,
      serverTime: Date.now(),
    });
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
