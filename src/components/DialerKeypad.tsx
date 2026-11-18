import { useRef } from 'react';
import { Contact } from '../types/wallet';
import { normalizeDigits } from '../utils/ussd';

interface DialerKeypadProps {
  dialValue: string;
  onAppendDigit: (digit: string) => void;
  onBackspace: () => void;
  onClearAll: () => void;
  onCall: () => void;
  onSetDialValue: (val: string) => void;
  contacts: Contact[];
}

interface KeyDef {
  digit: string;
  letters: string;
}

const KEYPAD_ROWS: KeyDef[][] = [
  [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
  ],
  [
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
  ],
  [
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
  ],
  [
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' },
  ],
];

export function DialerKeypad({
  dialValue,
  onAppendDigit,
  onBackspace,
  onClearAll,
  onCall,
  onSetDialValue,
  contacts,
}: DialerKeypadProps) {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const displayInputRef = useRef<HTMLInputElement | null>(null);

  const cleanInput = normalizeDigits(dialValue).replace(/\s+/g, '');
  const matchedContact = cleanInput.length >= 6
    ? contacts.find((c) => normalizeDigits(c.phone) === cleanInput)
    : undefined;

  const startLongPress = (action: () => void) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      action();
    }, 520);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Native long-press Paste ("لصق") / Ctrl+V handler:
  // Always appends pasted number/code right next to whatever the user already typed (e.g. *9*7* + pasted phone),
  // unless the user deliberately highlighted a substring to replace.
  const handleNativePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const rawText = e.clipboardData?.getData('text') || '';
    const filtered = normalizeDigits(rawText).replace(/[^0-9*#+]/g, '');
    if (!filtered) return;

    const inputEl = displayInputRef.current;
    const selStart = inputEl?.selectionStart ?? dialValue.length;
    const selEnd = inputEl?.selectionEnd ?? dialValue.length;

    const nextValue =
      selEnd > selStart
        ? dialValue.slice(0, selStart) + filtered + dialValue.slice(selEnd)
        : dialValue + filtered;

    const clamped = nextValue.slice(0, 40);
    onSetDialValue(clamped);

    requestAnimationFrame(() => {
      const el = displayInputRef.current;
      if (el) {
        const pos = clamped.length;
        try {
          el.setSelectionRange(pos, pos);
        } catch {}
      }
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filtered = normalizeDigits(e.target.value).replace(/[^0-9*#+]/g, '');
    onSetDialValue(filtered.slice(0, 40));
  };

  const displayFontClass =
    dialValue.length > 20
      ? 'text-[clamp(22px,6.2vw,28px)]'
      : dialValue.length > 14
      ? 'text-[clamp(26px,7.2vw,32px)]'
      : 'text-[clamp(30px,8.6vw,38px)]';

  return (
    <div className="flex flex-1 min-h-0 flex-col justify-between bg-black px-5 pt-[max(12px,2.5dvh)] pb-[max(8px,1.5dvh)]">
      <div className="max-w-md w-full mx-auto flex-1 min-h-0 flex flex-col justify-between">
      {/* Top Number Display Area — real editable input with inputMode="none" so native iOS/Android long-press "لصق" (Paste) works directly without opening keyboard */}
      <div className="flex flex-col items-center justify-center min-h-[min(96px,13dvh)] pt-1">
        <input
          ref={displayInputRef}
          type="text"
          inputMode="none"
          dir="ltr"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="الرقم أو الكود"
          value={dialValue}
          onPaste={handleNativePaste}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && dialValue.length > 0) {
              e.preventDefault();
              onCall();
            }
          }}
          onFocus={() => {
            const el = displayInputRef.current;
            if (el) {
              const len = el.value.length;
              requestAnimationFrame(() => {
                try {
                  el.setSelectionRange(len, len);
                } catch {}
              });
            }
          }}
          className={`w-full min-h-[56px] bg-transparent border-none outline-none text-center font-normal text-white tracking-tight tabular-nums leading-tight select-text caret-[#0A84FF] transition-all ${displayFontClass}`}
        />

        {matchedContact ? (
          <div className="mt-1 text-[14px] text-[#0A84FF] font-medium select-none">
            {matchedContact.name}
          </div>
        ) : (
          <div className="mt-1 h-[18px]" />
        )}
      </div>

      {/* Keypad + Call Row */}
      <div className="flex flex-col items-center pb-[max(4px,1dvh)] select-none">
        {/* 3x4 Circular Buttons (Fluid iPhone proportions) */}
        <div dir="ltr" className="grid grid-cols-3 gap-x-[min(22px,5.6vw)] gap-y-[min(14px,1.8dvh)]">
          {KEYPAD_ROWS.flat().map((keyItem) => {
            const isStar = keyItem.digit === '*';
            const isHash = keyItem.digit === '#';
            const isZero = keyItem.digit === '0';

            return (
              <button
                key={keyItem.digit}
                type="button"
                onPointerDown={() => {
                  if (isZero) {
                    startLongPress(() => onAppendDigit('+'));
                  }
                }}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onClick={() => {
                  if (isZero && longPressTriggeredRef.current) {
                    longPressTriggeredRef.current = false;
                    return;
                  }
                  onAppendDigit(keyItem.digit);
                }}
                className="w-[min(78px,19.5vw,10.6dvh)] h-[min(78px,19.5vw,10.6dvh)] rounded-full bg-[#333333] hover:bg-[#3f3f42] active:bg-[#737373] transition-colors duration-100 flex flex-col items-center justify-center text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <span
                  className={
                    isStar
                      ? 'text-[min(42px,10.5vw,5.4dvh)] leading-none font-light translate-y-1.5'
                      : isHash
                      ? 'text-[min(31px,7.8vw,4.1dvh)] leading-none font-normal'
                      : 'text-[min(34px,8.5vw,4.6dvh)] leading-none font-normal tabular-nums'
                  }
                >
                  {keyItem.digit}
                </span>
                {keyItem.letters ? (
                  <span className="mt-0.5 text-[9.5px] font-bold tracking-[0.18em] text-white/95 leading-none">
                    {keyItem.letters}
                  </span>
                ) : (
                  <span className="mt-0.5 h-[9.5px]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Action Row: Empty | Green Call Button | Backspace */}
        <div dir="ltr" className="mt-[min(14px,1.8dvh)] grid grid-cols-3 gap-x-[min(22px,5.6vw)] items-center">
          <div className="w-[min(78px,19.5vw,10.6dvh)] h-[min(78px,19.5vw,10.6dvh)]" />

          <button
            type="button"
            aria-label="اتصال"
            onClick={onCall}
            className="w-[min(78px,19.5vw,10.6dvh)] h-[min(78px,19.5vw,10.6dvh)] rounded-full bg-[#30D158] hover:bg-[#28bd4d] active:bg-[#22a341] active:scale-95 transition-all duration-100 flex items-center justify-center text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#30D158]/60"
          >
            <svg viewBox="0 0 24 24" className="w-[min(32px,8vw,4.2dvh)] h-[min(32px,8vw,4.2dvh)] fill-white" aria-hidden="true">
              <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2Z" />
            </svg>
          </button>

          <div className="w-[min(78px,19.5vw,10.6dvh)] h-[min(78px,19.5vw,10.6dvh)] flex items-center justify-center">
            {dialValue.length > 0 && (
              <button
                type="button"
                aria-label="حذف"
                onPointerDown={() => startLongPress(onClearAll)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onClick={() => {
                  if (longPressTriggeredRef.current) {
                    longPressTriggeredRef.current = false;
                    return;
                  }
                  onBackspace();
                }}
                className="w-12 h-12 rounded-full flex items-center justify-center text-[#98989D] hover:text-white active:scale-90 transition-all cursor-pointer"
              >
                <svg viewBox="0 0 28 20" className="w-[27px] h-[20px]" aria-hidden="true">
                  <path
                    d="M9.4 1.5H24.5A2.5 2.5 0 0 1 27 4V16A2.5 2.5 0 0 1 24.5 18.5H9.4A2.5 2.5 0 0 1 7.6 17.75L1.8 11.75A2.5 2.5 0 0 1 1.8 8.25L7.6 2.25A2.5 2.5 0 0 1 9.4 1.5Z"
                    fill="currentColor"
                  />
                  <path
                    d="M14.5 6.8L20.5 12.8M20.5 6.8L14.5 12.8"
                    stroke="#000000"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
