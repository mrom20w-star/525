export type TabId = 'favorites' | 'recents' | 'contacts' | 'keypad' | 'voicemail';

export interface Contact {
  id: string;
  name: string;
  maskedName: string;
  phone: string;
  isFavorite?: boolean;
}

export interface SmsMessage {
  id: string;
  sender: string;
  body: string;
  timestamp: string;
  createdAt: number;
  amount?: number;
  fee?: number;
  recipient?: string;
  balanceAfter?: number;
  type: 'transfer' | 'balance' | 'recharge' | 'info';
}

export interface DialRecord {
  id: string;
  code: string;
  label: string;
  sublabel: string;
  timestamp: string;
  createdAt: number;
  type: 'transfer' | 'balance' | 'menu' | 'recharge' | 'call';
}

export interface WalletSettings {
  soundEnabled: boolean;
  dtmfEnabled: boolean;
  keyboardClickEnabled: boolean;
  customRecipientName: string;
}

export type UssdStage = 'idle' | 'loading' | 'prompt' | 'reply' | 'calling';

export type UssdFlowType =
  | 'transfer_confirm'
  | 'transfer_done'
  | 'balance_pin'
  | 'balance_done'
  | 'main_menu'
  | 'menu_transfer_phone'
  | 'menu_transfer_amount'
  | 'recharge_pin'
  | 'recharge_done'
  | 'more_info'
  | 'error';

export interface UssdSession {
  stage: UssdStage;
  flow: UssdFlowType;
  code: string;
  message: string;
  dismissLabel: 'تجاهل' | 'استبعاد';
  replyOnRight: boolean; // In video 00:19/00:29: رد is white on right, تجاهل is black on left. In photo: استبعاد is white on right, رد is black on left.
  canReply: boolean;
  pendingTransfer?: {
    phone: string;
    amount: number;
    fee: number;
    maskedName: string;
  };
  pendingRecharge?: {
    phone: string;
    amount: number;
  };
  callingTarget?: {
    name: string;
    phone: string;
  };
  lastBalance?: number;
}
