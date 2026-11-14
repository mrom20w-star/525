import { useEffect, useState } from 'react';
import { DetectedDeviceInfo } from '../utils/device';
import { subscribeToDeveloperContact } from '../utils/firebaseRtdb';

const DEFAULT_DEVELOPER_URL = 'https://t.me/VENOM03333';

export interface AccessState {
  allowed: boolean;
  status: 'loading' | 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: number | null;
  durationLabel?: string;
  deviceName?: string;
  remainingMs?: number | null;
}

interface AccessGateProps {
  deviceInfo: DetectedDeviceInfo;
  accessState: AccessState;
}

function formatTelegramHandle(url: string): string {
  const cleaned = url.trim().replace(/\/+$/, '');
  const match = cleaned.match(/t\.me\/([A-Za-z0-9_]+)/i);
  if (match && match[1]) return `@${match[1]}`;
  if (cleaned.startsWith('@')) return cleaned;
  return cleaned;
}

function normalizeTelegramUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_DEVELOPER_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, '');
  return `https://t.me/${handle}`;
}

export function AccessGate({ deviceInfo, accessState }: AccessGateProps) {
  const [developerUrl, setDeveloperUrl] = useState<string>(DEFAULT_DEVELOPER_URL);

  useEffect(() => {
    const unsub = subscribeToDeveloperContact((remoteUrl) => {
      if (remoteUrl) {
        setDeveloperUrl(normalizeTelegramUrl(remoteUrl));
      } else {
        setDeveloperUrl(DEFAULT_DEVELOPER_URL);
      }
    });
    return () => unsub();
  }, []);

  if (accessState.status === 'loading') {
    return (
      <div className="w-full h-dvh bg-[#0a0a0c] flex flex-col items-center justify-center text-white px-6">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mb-3" />
        <p className="text-[14px] text-white/70">جاري التحقق من صلاحية الدخول...</p>
      </div>
    );
  }

  const isExpired = accessState.status === 'expired';
  const isRejected = accessState.status === 'rejected';
  const handleText = formatTelegramHandle(developerUrl);

  return (
    <div
      dir="rtl"
      className="w-full min-h-dvh bg-[#09090b] text-white flex items-center justify-center p-5"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#141417] border border-white/10 p-6 shadow-2xl space-y-5">
        <div className="flex flex-col items-center text-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
              isExpired
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-red-500/15 text-red-400'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-none stroke-current" strokeWidth="2">
              <rect x="4" y="11" width="16" height="10" rx="2.5" />
              <path d="M8 11V7a4 4 0 1 1 8 0v4" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="text-[20px] font-bold text-white">
            {isExpired
              ? 'انتهت مدة صلاحية الدخول'
              : isRejected
              ? 'تم رفض طلب الدخول'
              : 'خطأ في الدخول — يلزم موافقة المطور'}
          </h1>

          <p className="mt-2 text-[14px] leading-relaxed text-white/70">
            {isExpired
              ? 'تم إغلاق التطبيق تلقائياً لانتهاء الوقت المحدد لك. لا يمكن إعادة الفتح إلا بعد موافقة المطور أو تجديد الإذن.'
              : isRejected
              ? 'تم منع هذا الجهاز من الدخول من قبل المطور.'
              : 'لا يمكنك الدخول إلى الموقع إلا بعد موافقة المطور على جهازك. بمجرد الموافقة سيفتح التطبيق تلقائياً.'}
          </p>
        </div>

        {/* Device Profile Card */}
        <div className="rounded-2xl bg-black/50 border border-white/10 p-4 space-y-2.5 text-[13px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50">اسم الجهاز:</span>
            <span dir="ltr" className="font-medium text-white text-left truncate">
              {accessState.deviceName || deviceInfo.deviceName}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50">معرف الجهاز:</span>
            <span dir="ltr" className="font-mono text-[12px] text-white/80">
              {deviceInfo.deviceId}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50">الحالة:</span>
            <span
              className={`font-semibold ${
                isExpired
                  ? 'text-amber-400'
                  : isRejected
                  ? 'text-red-400'
                  : 'text-sky-400'
              }`}
            >
              {isExpired
                ? 'منتهي الصلاحية'
                : isRejected
                ? 'مرفوض'
                : 'بانتظار موافقة المطور (تحديث تلقائي)'}
            </span>
          </div>
        </div>

        {/* Developer Telegram Contact Button */}
        <a
          href={developerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between gap-3 rounded-2xl bg-[#229ED9]/15 hover:bg-[#229ED9]/25 border border-[#229ED9]/35 px-4 py-3.5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#229ED9] flex items-center justify-center text-white shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
              </svg>
            </div>
            <div className="text-right">
              <div className="text-[13.5px] font-bold text-white">تواصل مع المطور للموافقة</div>
              <div dir="ltr" className="text-[12.5px] font-mono text-[#64c7f7] text-right">
                {handleText}
              </div>
            </div>
          </div>
          <span className="text-[12.5px] font-semibold text-[#64c7f7]">تيليجرام ↗</span>
        </a>

        {!isRejected && (
          <div className="text-center text-[12.5px] text-white/50">
            لا يلزم إدخال أي بيانات — سيفتح تلقائياً فور موافقة المطور
          </div>
        )}
      </div>
    </div>
  );
}
