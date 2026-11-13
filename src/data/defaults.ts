import { Contact, DialRecord, SmsMessage, WalletSettings } from '../types/wallet';

export const INITIAL_BALANCE = 255750.5;

export const DEFAULT_CONTACTS: Contact[] = [
  {
    id: 'c-1',
    name: 'أحمد كمال محمد حامد',
    maskedName: 'أحمد ك* م*** ح******',
    phone: '01125774158',
    isFavorite: true,
  },
  {
    id: 'c-2',
    name: 'محمود عبد الرحمن سيد',
    maskedName: 'محمود ع** ا***** س**',
    phone: '01094823110',
    isFavorite: true,
  },
  {
    id: 'c-3',
    name: 'سارة حسن إبراهيم',
    maskedName: 'سارة ح** إ******',
    phone: '01023458912',
    isFavorite: false,
  },
  {
    id: 'c-4',
    name: 'كريم طارق علي',
    maskedName: 'كريم ط*** ع**',
    phone: '01287419055',
    isFavorite: false,
  },
];

export const DEFAULT_MESSAGES: SmsMessage[] = [
  {
    id: 'msg-init-1',
    sender: 'VF-Cash',
    body: 'رصيد حسابك فى فودافون كاش الحالي 255750.50 جنيه. اطلب #9* واستمتع بخدمات محفظتك.',
    timestamp: '٨:١٤ م',
    createdAt: Date.now() - 3600_000,
    balanceAfter: INITIAL_BALANCE,
    type: 'balance',
  },
];

export const DEFAULT_RECENTS: DialRecord[] = [
  {
    id: 'rec-1',
    code: '*9*7*01125774158*100#',
    label: 'تحويل فودافون كاش',
    sublabel: '01125774158 · 100 ج',
    timestamp: '٤:٢٦ م',
    createdAt: Date.now() - 1800_000,
    type: 'transfer',
  },
  {
    id: 'rec-2',
    code: '#139*',
    label: 'الاستعلام عن الرصيد',
    sublabel: 'فودافون كاش',
    timestamp: '٨:١٤ م',
    createdAt: Date.now() - 3600_000,
    type: 'balance',
  },
];

export const DEFAULT_SETTINGS: WalletSettings = {
  soundEnabled: true,
  dtmfEnabled: true,
  keyboardClickEnabled: true,
  customRecipientName: '',
};
