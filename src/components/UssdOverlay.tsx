import { useEffect, useRef, useState } from 'react';
import { UssdSession } from '../types/wallet';

interface UssdOverlayProps {
  session: UssdSession;
  onReplyOpen: () => void;
  onDismiss: () => void;
  onCancelReply: () => void;
  onSubmitReply: (value: string) => void;
  onKeyPressSound: () => void;
  onEndCall: () => void;
}

export function UssdOverlay({
  session,
  onReplyOpen,
  onDismiss,
  onCancelReply,
  onSubmitReply,
  onKeyPressSound,
  onEndCall,
}: UssdOverlayProps) {
  const [replyValue, setReplyValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (session.stage === 'reply') {
      setReplyValue('');
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [session.stage, session.flow]);

  const remaining = Math.max(0, 182 - replyValue.length);

  // Outgoing normal call screen (when dialing a phone number without USSD codes)
  if (session.stage === 'calling' && session.callingTarget) {
    return (
      <div className="fixed inset-0 z-30 flex flex-col justify-between bg-gradient-to-b from-[#1d2228] via-[#121417] to-black px-8 pt-14 pb-12 text-white">
        <div className="max-w-md w-full mx-auto flex flex-col items-center text-center mt-6">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-2xl font-semibold text-white/80 mb-4">
            {session.callingTarget.name.charAt(0)}
          </div>
          <h2 className="text-[28px] font-semibold tracking-tight">
            {session.callingTarget.name}
          </h2>
          <p dir="ltr" className="mt-1 text-[16px] text-white/60 tabular-nums">
            {session.callingTarget.phone}
          </p>
          <p className="mt-2 text-[14px] text-white/70">جاري الاتصال...</p>
        </div>

        <div className="max-w-md w-full mx-auto flex flex-col items-center gap-10">
          <div className="grid grid-cols-3 gap-7 text-center">
            {['كتم الصوت', 'لوحة المفاتيح', 'مكبر الصوت'].map((lbl) => (
              <div key={lbl} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center text-white/90 text-xs">
                  {lbl === 'كتم الصوت' ? '🔇' : lbl === 'لوحة المفاتيح' ? '⌨️' : '🔊'}
                </div>
                <span className="text-[12px] text-white/75">{lbl}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onEndCall}
            aria-label="إنهاء المكالمة"
            className="w-[74px] h-[74px] rounded-full bg-[#FF3B30] hover:bg-[#e5342a] active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white rotate-[135deg]" aria-hidden="true">
              <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2Z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Loading Screen (Matches 00:18 & 00:28)
  if (session.stage === 'loading') {
    return (
      <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-[#525252] text-white select-none">
        <div className="relative w-8 h-8 mb-3" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="ios-spinner-blade absolute left-1/2 top-0 w-[2.5px] h-[8px] -ml-[1.25px] rounded-full bg-white"
              style={{
                transform: `rotate(${i * 30}deg)`,
                transformOrigin: '50% 16px',
                animationDelay: `${-(11 - i) * (1 / 12)}s`,
              }}
            />
          ))}
        </div>
        <span dir="ltr" className="text-[15px] font-normal text-white/90 tracking-tight">
          Please Wait...
        </span>
      </div>
    );
  }

  // Prompt / Result Screen (Matches 00:19, 00:29, 00:31-00:34, and Photo)
  if (session.stage === 'prompt') {
    const isBalanceResult = session.flow === 'balance_done';

    return (
      <div className="fixed inset-0 z-30 flex flex-col justify-between bg-[#525252] pt-6 pb-8 px-4 text-white select-none">
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-between">
          {/* USSD Message positioned cleanly in upper third on transfer (matches 00:19 & 00:29 below notification), centered on balance photo */}
          <div
            className={`flex-1 flex flex-col items-center px-2 ${
              isBalanceResult ? 'justify-center' : 'justify-start pt-28'
            }`}
          >
            <p
              dir="rtl"
              className="whitespace-pre-line text-center text-[17px] leading-[1.68] font-normal text-white max-w-[360px]"
            >
              {session.message}
            </p>
          </div>

          {/* Bottom 2 Action Buttons */}
          <div dir="rtl" className="grid grid-cols-2 gap-3 pb-1">
            {session.replyOnRight ? (
              <>
                {session.canReply ? (
                  <button
                    type="button"
                    onClick={onReplyOpen}
                    className="h-[52px] rounded-[14px] bg-white text-black text-[18px] font-medium hover:bg-white/90 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    رد
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="h-[52px] rounded-[14px] bg-white text-black text-[18px] font-medium hover:bg-white/90 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    حسناً
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDismiss}
                  className="h-[52px] rounded-[14px] bg-black text-white text-[18px] font-medium hover:bg-black/85 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {session.dismissLabel}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="h-[52px] rounded-[14px] bg-white text-black text-[18px] font-medium hover:bg-white/90 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {session.dismissLabel}
                </button>
                <button
                  type="button"
                  onClick={onReplyOpen}
                  className="h-[52px] rounded-[14px] bg-black text-white text-[18px] font-medium hover:bg-black/85 active:scale-[0.98] transition-all cursor-pointer"
                >
                  رد
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Reply Screen using device's native keyboard (Exact layout from 00:21 - 00:27)
  if (session.stage === 'reply') {
    return (
      <div className="fixed inset-0 z-30 flex flex-col bg-[#525252] pt-3 pb-6 px-4 text-white">
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-between">
          {/* Top Header Bar: إرسال | رد | إلغاء */}
          <div dir="rtl" className="flex items-center justify-between py-2 text-[17px]">
            <button
              type="button"
              onClick={() => {
                if (replyValue.trim().length > 0) {
                  onSubmitReply(replyValue);
                }
              }}
              className={`font-normal transition-opacity cursor-pointer px-1 py-1 ${
                replyValue.trim().length > 0 ? 'text-white' : 'text-white/55'
              }`}
            >
              إرسال
            </button>
            <span className="font-semibold text-white">رد</span>
            <button
              type="button"
              onClick={onCancelReply}
              className="font-normal text-white hover:text-white/80 cursor-pointer px-1 py-1"
            >
              إلغاء
            </button>
          </div>

          {/* Prompt Message (top) & Left-aligned Input Box (bottom above device keyboard) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (replyValue.trim().length > 0) {
                onSubmitReply(replyValue);
              }
            }}
            className="flex-1 flex flex-col items-center justify-between pt-4 pb-6"
          >
            <p
              dir="rtl"
              className="whitespace-pre-line text-center text-[16px] leading-[1.65] text-white max-w-[350px]"
            >
              {session.message}
            </p>

            <div className="w-full flex flex-col items-center mt-auto">
              <div className="w-full rounded-[14px] bg-[#434345] border border-[#ABABB3] px-4 py-2.5 flex items-center">
                <input
                  ref={inputRef}
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  enterKeyHint="send"
                  dir="ltr"
                  value={replyValue}
                  onChange={(e) => {
                    onKeyPressSound();
                    setReplyValue(e.target.value.slice(0, 182));
                  }}
                  aria-label="إدخال الرقم السري أو الرد"
                  className="w-full bg-transparent text-left text-white text-[18px] tracking-normal tabular-nums focus:outline-none"
                />
              </div>
              <div dir="ltr" className="mt-1.5 text-[12px] text-white/75 tabular-nums">
                characters remaining {remaining}
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
