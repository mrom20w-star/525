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

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const filtered = normalizeDigits(text).replace(/[^0-9*#+]/g, '');
        if (filtered) {
          onSetDialValue(filtered.slice(0, 32));
        }
      }
    } catch {
      // Clipboard permission may be restricted; ignore silently
    }
  };

  const displayFontClass =
    dialValue.length > 20
      ? 'text-[26px]'
      : dialValue.length > 14
      ? 'text-[31px]'
      : 'text-[36px]';

  return (
    <div className="flex flex-1 flex-col justify-between bg-black px-6 pt-6 pb-4 select-none">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-between">
      {/* Top Number Display Area (Matches 00:06 - 00:17) */}
      <div className="flex flex-col items-center justify-center min-h-[108px] pt-2">
        <div
          dir="ltr"
          onClick={dialValue.length === 0 ? handlePasteClick : undefined}
          title={dialValue.length === 0 ? 'اضغط للصق رقم أو كود' : undefined}
          className={`w-full text-center font-normal text-white tracking-tight tabular-nums leading-tight break-all transition-all ${displayFontClass} ${
            dialValue.length === 0 ? 'cursor-pointer min-h-[44px]' : ''
          }`}
        >
          {dialValue || '\u00A0'}
        </div>

        {matchedContact ? (
          <div className="mt-1.5 text-[14px] text-[#0A84FF] font-medium">
            {matchedContact.name}
          </div>
        ) : (
          <div className="mt-1.5 h-[20px]" />
        )}
      </div>

      {/* Keypad + Call Row */}
      <div className="flex flex-col items-center pb-2">
        {/* 3x4 Circular Buttons (Always LTR layout 1-2-3 just like iOS Arabic Phone) */}
        <div dir="ltr" className="grid grid-cols-3 gap-x-5 gap-y-3.5">
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
                className="w-[74px] h-[74px] sm:w-[78px] sm:h-[78px] rounded-full bg-[#333333] hover:bg-[#3f3f42] active:bg-[#737373] transition-colors duration-100 flex flex-col items-center justify-center text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <span
                  className={
                    isStar
                      ? 'text-[42px] leading-none font-light translate-y-1.5'
                      : isHash
                      ? 'text-[31px] leading-none font-normal'
                      : 'text-[34px] leading-none font-normal tabular-nums'
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

        {/* Bottom Action Row: Empty | Green Call Button | Backspace (Matches 00:07-00:17) */}
        <div dir="ltr" className="mt-3.5 grid grid-cols-3 gap-x-5 items-center">
          <div className="w-[74px] h-[74px] sm:w-[78px] sm:h-[78px]" />

          <button
            type="button"
            aria-label="اتصال"
            onClick={onCall}
            className="w-[74px] h-[74px] sm:w-[78px] sm:h-[78px] rounded-full bg-[#30D158] hover:bg-[#28bd4d] active:bg-[#22a341] active:scale-95 transition-all duration-100 flex items-center justify-center text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#30D158]/60"
          >
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white" aria-hidden="true">
              <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01l-2.2 2.2Z" />
            </svg>
          </button>

          <div className="w-[74px] h-[74px] sm:w-[78px] sm:h-[78px] flex items-center justify-center">
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
