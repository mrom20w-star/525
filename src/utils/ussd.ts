import { Contact } from '../types/wallet';

const ARABIC_TO_EN_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

const EN_TO_ARABIC_DIGITS: Record<string, string> = {
  '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
  '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
};

export function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => ARABIC_TO_EN_DIGITS[ch] ?? ch);
}

export function toArabicNumerals(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => EN_TO_ARABIC_DIGITS[d] ?? d);
}

export function formatBalanceNumber(balance: number): string {
  return balance.toFixed(2);
}

export function formatAmountDisplay(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

export function calculateTransferFee(amount: number): number {
  if (amount <= 0) return 0;
  // Standard Vodafone Cash transfer fee: 1 EGP (or 0.5% capped at 15 EGP for very large transfers, minimum 1 EGP)
  if (amount <= 2000) return 1;
  return Math.min(15, Math.max(1, Math.round(amount * 0.005)));
}

const FALLBACK_MASKED_NAMES = [
  'محمد ع*** ا***** ح***',
  'أحمد م**** س*** ع**',
  'محمود ح** إ****** خ***',
  'مصطفى س** م*** ع****',
  'كريم أ*** ح** ط***',
  'يوسف ع** م**** ف***',
  'سارة م**** ع** ح**',
  'إبراهيم ط** ع** س***',
];

export function maskArabicName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'عميل ف**** ك**';
  if (parts.length === 1) return parts[0];
  return parts
    .map((word, idx) => {
      if (idx === 0) return word;
      const first = word.charAt(0);
      const starsCount = Math.max(1, Math.min(6, word.length - 1));
      return `${first}${'*'.repeat(starsCount)}`;
    })
    .join(' ');
}

export function resolveMaskedRecipient(
  phone: string,
  contacts: Contact[],
  customOverride?: string
): string {
  if (customOverride && customOverride.trim().length > 0) {
    const trimmed = customOverride.trim();
    return trimmed.includes('*') ? trimmed : maskArabicName(trimmed);
  }

  const cleanPhone = normalizeDigits(phone).replace(/\s+/g, '');
  const match = contacts.find((c) => normalizeDigits(c.phone).replace(/\s+/g, '') === cleanPhone);
  if (match) {
    return match.maskedName || maskArabicName(match.name);
  }

  // Deterministic realistic Egyptian masked name based on phone digits
  let hash = 0;
  for (let i = 0; i < cleanPhone.length; i++) {
    hash = (hash * 31 + cleanPhone.charCodeAt(i)) % 100000;
  }
  return FALLBACK_MASKED_NAMES[hash % FALLBACK_MASKED_NAMES.length];
}

export type ParsedDialIntent =
  | { type: 'transfer'; phone: string; amount: number; rawCode: string }
  | { type: 'balance'; rawCode: string }
  | { type: 'main_menu'; rawCode: string }
  | { type: 'recharge'; phone: string; amount: number; rawCode: string }
  | { type: 'unknown_ussd'; rawCode: string }
  | { type: 'call'; phone: string; rawCode: string };

export function parseDialIntent(rawInput: string): ParsedDialIntent {
  const code = normalizeDigits(rawInput).trim().replace(/\s+/g, '');

  // Balance inquiry variants:
  // *9*13#, *139#, #139*, #13*9*, *9*13
  if (
    code === '*9*13#' ||
    code === '*9*13' ||
    code === '*139#' ||
    code === '*139' ||
    code === '#139*' ||
    code === '#13*9*' ||
    code === '*9*13*'
  ) {
    return { type: 'balance', rawCode: code };
  }

  // Transfer USSD patterns:
  // *9*7*<phone>*<amount>#  (or without trailing #)
  const transferMatch = code.match(/^\*9\*7\*(\d{7,15})\*(\d+(?:\.\d+)?)#?$/);
  if (transferMatch) {
    return {
      type: 'transfer',
      phone: transferMatch[1],
      amount: parseFloat(transferMatch[2]),
      rawCode: code,
    };
  }

  // RTL typed transfer variant: #<amount>*<phone>*7*9*
  const rtlTransferMatch = code.match(/^#(\d+(?:\.\d+)?)\*(\d{7,15})\*7\*9\*$/);
  if (rtlTransferMatch) {
    return {
      type: 'transfer',
      phone: rtlTransferMatch[2],
      amount: parseFloat(rtlTransferMatch[1]),
      rawCode: code,
    };
  }

  // Self recharge: *9*10*<amount># or *9*0*<amount>#
  const selfRechargeMatch = code.match(/^\*9\*(?:10|0)\*(\d+(?:\.\d+)?)#?$/);
  if (selfRechargeMatch) {
    return {
      type: 'recharge',
      phone: 'رقمك الحالي',
      amount: parseFloat(selfRechargeMatch[1]),
      rawCode: code,
    };
  }

  // Other number recharge: *9*3*<phone>*<amount>#
  const otherRechargeMatch = code.match(/^\*9\*3\*(\d{7,15})\*(\d+(?:\.\d+)?)#?$/);
  if (otherRechargeMatch) {
    return {
      type: 'recharge',
      phone: otherRechargeMatch[1],
      amount: parseFloat(otherRechargeMatch[2]),
      rawCode: code,
    };
  }

  // Main Vodafone Cash menu: *9# or #9*
  if (code === '*9#' || code === '#9*' || code === '*9') {
    return { type: 'main_menu', rawCode: code };
  }

  // Any other USSD pattern
  if (code.startsWith('*') || code.startsWith('#') || code.includes('*') || code.includes('#')) {
    return { type: 'unknown_ussd', rawCode: code };
  }

  return { type: 'call', phone: code, rawCode: code };
}
