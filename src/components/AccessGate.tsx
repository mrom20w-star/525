import { DetectedDeviceInfo } from '../utils/device';

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

export function AccessGate({ deviceInfo, accessState }: AccessGateProps) {
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

        {!isRejected && (
          <div className="text-center text-[12.5px] text-white/50">
            لا يلزم إدخال أي بيانات — سيفتح تلقائياً فور موافقة المطور
          </div>
        )}
      </div>
    </div>
  );
}
