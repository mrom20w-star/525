import { AnimatePresence, motion } from 'motion/react';
import { SmsMessage } from '../types/wallet';

interface NotificationBannerProps {
  message: SmsMessage | null;
  onTap: (msg: SmsMessage) => void;
  onDismiss: () => void;
}

export function NotificationBanner({
  message,
  onTap,
  onDismiss,
}: NotificationBannerProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message.id}
          initial={{ y: -120, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -120, opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 430, damping: 33 }}
          drag="y"
          dragConstraints={{ top: -80, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.y < -25 || info.velocity.y < -250) {
              onDismiss();
            }
          }}
          className="fixed top-2 left-2 right-2 z-50 max-w-[420px] mx-auto"
        >
          <div
            role="button"
            tabIndex={0}
            dir="rtl"
            onClick={() => onTap(message)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onTap(message);
            }}
            className="w-full rounded-[24px] bg-[#C6C6CB]/95 backdrop-blur-2xl shadow-[0_12px_32px_rgba(0,0,0,0.45)] px-3.5 py-2.5 flex items-center gap-3 cursor-pointer select-none"
          >
            {/* Right side in RTL: Circular iOS Contact Avatar + Small Green Messages Badge in bottom-left */}
            <div className="relative w-[40px] h-[40px] shrink-0">
              {/* Circular Contact Avatar (#99A5BD with white person silhouette) */}
              <div className="w-[40px] h-[40px] rounded-full bg-[#98A4BC] flex items-center justify-center overflow-hidden">
                <svg viewBox="0 0 24 24" className="w-[26px] h-[26px] fill-white translate-y-[2px]" aria-hidden="true">
                  <circle cx="12" cy="8.2" r="4.1" />
                  <path d="M4.2 20.5c.6-3.9 3.7-6.3 7.8-6.3s7.2 2.4 7.8 6.3H4.2Z" />
                </svg>
              </div>

              {/* Small Green iOS Messages Icon Badge at bottom-left of avatar */}
              <div className="absolute -bottom-0.5 -left-0.5 w-[17px] h-[17px] rounded-[4.5px] bg-gradient-to-b from-[#60F376] to-[#27C242] flex items-center justify-center shadow-xs">
                <svg viewBox="0 0 24 24" className="w-[10.5px] h-[10.5px] fill-white" aria-hidden="true">
                  <path d="M12 3.2C6.7 3.2 2.4 6.85 2.4 11.35c0 2.52 1.35 4.78 3.47 6.27-.19 1.31-.78 2.65-1.65 3.6a.42.42 0 0 0 .36.71c1.93-.22 3.74-.93 5.03-1.78.74.18 1.52.28 2.39.28 5.3 0 9.6-3.65 9.6-8.08S17.3 3.2 12 3.2Z" />
                </svg>
              </div>
            </div>

            {/* Text Column: VF-Cash on right, "now" on left, 2-line RTL black body */}
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-baseline justify-between gap-2">
                <span dir="ltr" className="text-[14.5px] font-bold text-[#111113] tracking-tight">
                  {message.sender}
                </span>
                <span dir="ltr" className="text-[12px] font-normal text-[#55555B] shrink-0">
                  now
                </span>
              </div>
              <p
                dir="rtl"
                className="mt-0.5 text-[13.5px] leading-[1.35] text-[#111113] font-normal line-clamp-2"
              >
                {message.body}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
