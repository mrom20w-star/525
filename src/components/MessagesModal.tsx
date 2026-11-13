import { SmsMessage } from '../types/wallet';

interface MessagesModalProps {
  isOpen: boolean;
  messages: SmsMessage[];
  onClose: () => void;
}

export function MessagesModal({ isOpen, messages, onClose }: MessagesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-40 flex flex-col bg-black text-white"
    >
      {/* iOS Messages Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161618]/95 backdrop-blur-xl border-b border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-[#0A84FF] text-[16px] font-medium cursor-pointer"
        >
          <span>‹</span>
          <span>رجوع</span>
        </button>

        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-[#98A4BC] flex items-center justify-center overflow-hidden mb-0.5">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white translate-y-[1.5px]" aria-hidden="true">
              <circle cx="12" cy="8.2" r="4.1" />
              <path d="M4.2 20.5c.6-3.9 3.7-6.3 7.8-6.3s7.2 2.4 7.8 6.3H4.2Z" />
            </svg>
          </div>
          <span dir="ltr" className="text-[13px] font-semibold text-white">
            VF-Cash
          </span>
        </div>

        <div className="w-12" />
      </div>

      {/* SMS Thread */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-3">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col items-start max-w-[88%]">
            <div className="rounded-[18px] rounded-tr-[4px] bg-[#262629] px-4 py-2.5 text-[14.5px] leading-[1.55] text-white/95">
              {msg.body}
            </div>
            <span className="mt-1 px-1 text-[11px] text-white/40 tabular-nums">
              {msg.timestamp}
            </span>
          </div>
        ))}
      </div>

      {/* Read-only iOS SMS footer */}
      <div className="px-4 py-3 border-t border-white/10 bg-[#121214] text-center text-[12px] text-white/45">
        رسائل الخدمة التلقائية من VF-Cash
      </div>
    </div>
  );
}
