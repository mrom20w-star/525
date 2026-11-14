import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessGate, AccessState } from './components/AccessGate';
import { DialerKeypad } from './components/DialerKeypad';
import { MessagesModal } from './components/MessagesModal';
import { NotificationBanner } from './components/NotificationBanner';
import {
  BottomTabBar,
  ContactsView,
  FavoritesView,
  RecentsView,
  VoicemailWalletView,
} from './components/PhoneTabs';
import { UssdOverlay } from './components/UssdOverlay';
import {
  DEFAULT_CONTACTS,
  DEFAULT_MESSAGES,
  DEFAULT_RECENTS,
  DEFAULT_SETTINGS,
  INITIAL_BALANCE,
} from './data/defaults';
import {
  Contact,
  DialRecord,
  SmsMessage,
  TabId,
  UssdSession,
  WalletSettings,
} from './types/wallet';
import { detectDeviceInfo } from './utils/device';
import {
  getFirebaseServerNow,
  registerDeviceInRtdb,
  subscribeToDevice,
} from './utils/firebaseRtdb';
import {
  playDtmfTone,
  playKeyClick,
  playNotificationChime,
  primeAudio,
} from './utils/sound';
import {
  calculateTransferFee,
  formatAmountDisplay,
  formatBalanceNumber,
  normalizeDigits,
  parseDialIntent,
  resolveMaskedRecipient,
  toArabicNumerals,
} from './utils/ussd';

const STORAGE_KEYS = {
  balance: 'vfcash_sim_balance_v1',
  contacts: 'vfcash_sim_contacts_v1',
  messages: 'vfcash_sim_messages_v1',
  recents: 'vfcash_sim_recents_v1',
  settings: 'vfcash_sim_settings_v1',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getArabicNowStamp(): string {
  const now = new Date();
  const h24 = now.getHours();
  const suffix = h24 >= 12 ? 'م' : 'ص';
  const h12 = h24 % 12 || 12;
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${toArabicNumerals(h12)}:${toArabicNumerals(mins)} ${suffix}`;
}

export default function App() {
  return <WalletApp />;
}

function WalletApp() {
  const deviceInfo = useMemo(() => detectDeviceInfo(), []);
  const [accessState, setAccessState] = useState<AccessState>({
    allowed: false,
    status: 'loading',
    expiresAt: null,
  });

  const [balance, setBalance] = useState<number>(() =>
    loadFromStorage(STORAGE_KEYS.balance, INITIAL_BALANCE)
  );
  const [contacts, setContacts] = useState<Contact[]>(() =>
    loadFromStorage(STORAGE_KEYS.contacts, DEFAULT_CONTACTS)
  );
  const [messages, setMessages] = useState<SmsMessage[]>(() =>
    loadFromStorage(STORAGE_KEYS.messages, DEFAULT_MESSAGES)
  );
  const [recents, setRecents] = useState<DialRecord[]>(() =>
    loadFromStorage(STORAGE_KEYS.recents, DEFAULT_RECENTS)
  );
  const [settings, setSettings] = useState<WalletSettings>(() =>
    loadFromStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  );

  const [activeTab, setActiveTab] = useState<TabId>('keypad');
  const [dialValue, setDialValue] = useState<string>('');
  const [ussdSession, setUssdSession] = useState<UssdSession | null>(null);
  const [activeBanner, setActiveBanner] = useState<SmsMessage | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Refs for cleanup of timers
  const loadingTimerRef = useRef<number | null>(null);
  const notifyTimerRef = useRef<number | null>(null);
  const bannerHideTimerRef = useRef<number | null>(null);

  const registerDevice = useCallback(async () => {
    try {
      const rtdbRecord = await registerDeviceInRtdb(deviceInfo);
      if (rtdbRecord) {
        const expired =
          rtdbRecord.status === 'approved' &&
          rtdbRecord.expiresAt !== undefined &&
          rtdbRecord.expiresAt !== null &&
          getFirebaseServerNow() >= rtdbRecord.expiresAt;
        const resolvedStatus = expired ? 'expired' : rtdbRecord.status;
        setAccessState({
          allowed: resolvedStatus === 'approved',
          status: resolvedStatus,
          expiresAt: rtdbRecord.expiresAt ?? null,
          durationLabel: rtdbRecord.durationLabel,
          deviceName: rtdbRecord.customLabel || rtdbRecord.deviceName,
        });
      }

      const res = await fetch('/api/access/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceInfo),
      });
      if (res.ok) {
        const data = (await res.json()) as AccessState;
        setAccessState(data);
      } else {
        setAccessState((prev) =>
          prev.status === 'loading' ? { ...prev, status: 'pending' } : prev
        );
      }
    } catch {
      setAccessState((prev) =>
        prev.status === 'loading' ? { ...prev, status: 'pending' } : prev
      );
    }
  }, [deviceInfo]);

  const refreshAccessStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/access/status?deviceId=${encodeURIComponent(deviceInfo.deviceId)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as AccessState;
      setAccessState(data);
      if (!data.allowed) {
        setUssdSession(null);
        setMessagesOpen(false);
      }
    } catch {
      // Ignore transient errors
    }
  }, [deviceInfo.deviceId]);

  useEffect(() => {
    registerDevice();

    // Never hang on "loading": show the developer approval error screen immediately if check takes > 1.2s
    const fallbackTimer = window.setTimeout(() => {
      setAccessState((prev) =>
        prev.status === 'loading' ? { ...prev, status: 'pending' } : prev
      );
    }, 1200);

    // Instant real-time Firebase RTDB listener: opens/locks immediately when Admin acts!
    const unsubscribe = subscribeToDevice(deviceInfo.deviceId, (rtdbData) => {
      if (!rtdbData) {
        setAccessState((prev) =>
          prev.status === 'loading' ? { ...prev, status: 'pending' } : prev
        );
        return;
      }
      const nowServer = getFirebaseServerNow();
      const expired =
        rtdbData.status === 'approved' &&
        rtdbData.expiresAt !== undefined &&
        rtdbData.expiresAt !== null &&
        nowServer >= rtdbData.expiresAt;

      const resolvedStatus = expired ? 'expired' : rtdbData.status;
      const isAllowed = resolvedStatus === 'approved';

      setAccessState({
        allowed: isAllowed,
        status: resolvedStatus,
        expiresAt: rtdbData.expiresAt ?? null,
        durationLabel: rtdbData.durationLabel,
        deviceName: rtdbData.customLabel || rtdbData.deviceName,
      });

      if (!isAllowed) {
        setUssdSession(null);
        setMessagesOpen(false);
      }
    });

    const pollId = window.setInterval(refreshAccessStatus, 5000);
    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
      clearInterval(pollId);
    };
  }, [deviceInfo.deviceId, refreshAccessStatus, registerDevice]);

  // Exact-second auto-lock when granted access expires
  useEffect(() => {
    if (!accessState.allowed || accessState.expiresAt === null) return;
    const msLeft = accessState.expiresAt - getFirebaseServerNow();
    if (msLeft <= 0) {
      setAccessState((prev) => ({ ...prev, allowed: false, status: 'expired' }));
      setUssdSession(null);
      setMessagesOpen(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setAccessState((prev) => ({ ...prev, allowed: false, status: 'expired' }));
      setUssdSession(null);
      setMessagesOpen(false);
      refreshAccessStatus();
    }, msLeft + 50);
    return () => clearTimeout(timer);
  }, [accessState.allowed, accessState.expiresAt, refreshAccessStatus]);

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.balance, JSON.stringify(balance));
    } catch {}
  }, [balance]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.contacts, JSON.stringify(contacts));
    } catch {}
  }, [contacts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.recents, JSON.stringify(recents));
    } catch {}
  }, [recents]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const clearPendingTimers = useCallback(() => {
    if (loadingTimerRef.current !== null) {
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPendingTimers();
      if (notifyTimerRef.current !== null) clearTimeout(notifyTimerRef.current);
      if (bannerHideTimerRef.current !== null) clearTimeout(bannerHideTimerRef.current);
    };
  }, [clearPendingTimers]);

  const triggerSmsNotification = useCallback(
    (msg: SmsMessage, delayMs = 1100) => {
      if (notifyTimerRef.current !== null) {
        clearTimeout(notifyTimerRef.current);
      }
      if (bannerHideTimerRef.current !== null) {
        clearTimeout(bannerHideTimerRef.current);
      }

      notifyTimerRef.current = window.setTimeout(() => {
        setMessages((prev) => [msg, ...prev]);
        setUnreadCount((c) => c + 1);
        setActiveBanner(msg);

        if (settings.soundEnabled) {
          playNotificationChime();
        }

        bannerHideTimerRef.current = window.setTimeout(() => {
          setActiveBanner((curr) => (curr?.id === msg.id ? null : curr));
        }, 5500);
      }, delayMs);
    },
    [settings.soundEnabled]
  );

  const pushRecent = useCallback(
    (record: Omit<DialRecord, 'id' | 'timestamp' | 'createdAt'>) => {
      const next: DialRecord = {
        ...record,
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: getArabicNowStamp(),
        createdAt: Date.now(),
      };
      setRecents((prev) => [next, ...prev].slice(0, 40));
    },
    []
  );

  const executeDial = useCallback(
    (rawCode: string) => {
      const trimmed = rawCode.trim();
      if (!trimmed) return;

      primeAudio();
      clearPendingTimers();
      setDialValue('');

      const intent = parseDialIntent(trimmed);

      if (intent.type === 'call') {
        const matched = contacts.find(
          (c) => normalizeDigits(c.phone) === normalizeDigits(intent.phone)
        );
        pushRecent({
          code: intent.rawCode,
          label: matched ? matched.name : intent.phone,
          sublabel: 'مكالمة صادرة',
          type: 'call',
        });
        setUssdSession({
          stage: 'calling',
          flow: 'error',
          code: intent.rawCode,
          message: '',
          dismissLabel: 'تجاهل',
          replyOnRight: true,
          canReply: false,
          callingTarget: {
            name: matched ? matched.name : intent.phone,
            phone: intent.phone,
          },
        });
        return;
      }

      // Show "Please Wait..." USSD spinner (Matches 00:18)
      setUssdSession({
        stage: 'loading',
        flow: 'main_menu',
        code: intent.rawCode,
        message: '',
        dismissLabel: 'تجاهل',
        replyOnRight: true,
        canReply: true,
      });

      loadingTimerRef.current = window.setTimeout(() => {
        if (intent.type === 'transfer') {
          const fee = calculateTransferFee(intent.amount);
          const totalNeeded = intent.amount + fee;

          pushRecent({
            code: intent.rawCode,
            label: 'تحويل فودافون كاش',
            sublabel: `${intent.phone} · ${formatAmountDisplay(intent.amount)} ج`,
            type: 'transfer',
          });

          if (intent.amount <= 0) {
            setUssdSession({
              stage: 'prompt',
              flow: 'error',
              code: intent.rawCode,
              message: 'برجاء إدخال مبلغ صحيح للتحويل.',
              dismissLabel: 'تجاهل',
              replyOnRight: true,
              canReply: false,
            });
            return;
          }

          if (totalNeeded > balance) {
            setUssdSession({
              stage: 'prompt',
              flow: 'error',
              code: intent.rawCode,
              message: `عذراً، رصيد حسابك فى فودافون كاش غير كافي لاتمام التحويل.\nرصيدك الحالي ${formatBalanceNumber(balance)} جنيه`,
              dismissLabel: 'تجاهل',
              replyOnRight: true,
              canReply: false,
            });
            return;
          }

          const maskedName = resolveMaskedRecipient(
            intent.phone,
            contacts,
            settings.customRecipientName
          );
          const amtText = formatAmountDisplay(intent.amount);
          const feeText = formatAmountDisplay(fee);

          // Exact text from video 00:19
          const message = `تحويل ${amtText} ج بالإضافة ل${feeText} ج رسوم لرقم ${intent.phone}\nبإسم ${maskedName}\n0:مزيد`;

          setUssdSession({
            stage: 'prompt',
            flow: 'transfer_confirm',
            code: intent.rawCode,
            message,
            dismissLabel: 'تجاهل',
            replyOnRight: true,
            canReply: true,
            pendingTransfer: {
              phone: intent.phone,
              amount: intent.amount,
              fee,
              maskedName,
            },
          });
          return;
        }

        if (intent.type === 'balance') {
          pushRecent({
            code: intent.rawCode,
            label: 'الاستعلام عن الرصيد',
            sublabel: 'فودافون كاش',
            type: 'balance',
          });

          setUssdSession({
            stage: 'prompt',
            flow: 'balance_pin',
            code: intent.rawCode,
            message:
              'للاستعلام عن رصيد حسابك فى فودافون كاش\nادخل الرقم السرى المكون من 6 ارقام',
            dismissLabel: 'تجاهل',
            replyOnRight: true,
            canReply: true,
          });
          return;
        }

        if (intent.type === 'recharge') {
          pushRecent({
            code: intent.rawCode,
            label: 'شحن رصيد فودافون كاش',
            sublabel: `${intent.phone} · ${formatAmountDisplay(intent.amount)} ج`,
            type: 'recharge',
          });

          if (intent.amount <= 0 || intent.amount > balance) {
            setUssdSession({
              stage: 'prompt',
              flow: 'error',
              code: intent.rawCode,
              message: `رصيدك الحالي ${formatBalanceNumber(balance)} جنيه غير كافي لاتمام عملية الشحن.`,
              dismissLabel: 'تجاهل',
              replyOnRight: true,
              canReply: false,
            });
            return;
          }

          setUssdSession({
            stage: 'prompt',
            flow: 'recharge_pin',
            code: intent.rawCode,
            message: `شحن رصيد بقيمة ${formatAmountDisplay(intent.amount)} ج لرقم ${intent.phone}\nادخل الرقم السرى لتأكيد العملية`,
            dismissLabel: 'تجاهل',
            replyOnRight: true,
            canReply: true,
            pendingRecharge: {
              phone: intent.phone,
              amount: intent.amount,
            },
          });
          return;
        }

        if (intent.type === 'main_menu') {
          pushRecent({
            code: intent.rawCode,
            label: 'القائمة الرئيسية فودافون كاش',
            sublabel: 'خدمة USSD',
            type: 'menu',
          });

          setUssdSession({
            stage: 'prompt',
            flow: 'main_menu',
            code: intent.rawCode,
            message:
              'فودافون كاش:\n1: تحويل اموال\n2: شحن رصيد\n3: الاستعلام عن الرصيد',
            dismissLabel: 'تجاهل',
            replyOnRight: true,
            canReply: true,
          });
          return;
        }

        // Unknown USSD code fallback
        setUssdSession({
          stage: 'prompt',
          flow: 'error',
          code: intent.rawCode,
          message:
            'عذراً، الكود المطلوب غير صحيح.\nللتحويل اطلب *9*7*الرقم*المبلغ#\nللاستعلام عن الرصيد اطلب #139*\nللقائمة الرئيسية اطلب *9#',
          dismissLabel: 'تجاهل',
          replyOnRight: true,
          canReply: false,
        });
      }, 950);
    },
    [balance, clearPendingTimers, contacts, pushRecent, settings.customRecipientName]
  );

  const handleUssdReplySubmit = useCallback(
    (rawReply: string) => {
      if (!ussdSession) return;
      const reply = normalizeDigits(rawReply).trim();
      if (!reply) return;

      primeAudio();
      clearPendingTimers();

      const currentSession = ussdSession;

      // Transition to "Please Wait..." (Matches 00:28)
      setUssdSession({
        ...currentSession,
        stage: 'loading',
      });

      loadingTimerRef.current = window.setTimeout(() => {
        // 1. Transfer confirmation PIN or "0:مزيد"
        if (currentSession.flow === 'transfer_confirm' && currentSession.pendingTransfer) {
          if (reply === '0') {
            setUssdSession({
              ...currentSession,
              stage: 'prompt',
              flow: 'more_info',
              message:
                'رسوم التحويل لمحفظة فودافون كاش 1 جنيه بحد أقصى.\nالحد الأقصى للتحويل اليومي 60000 جنيه.\nادخل الرقم السرى لاتمام التحويل:',
              canReply: true,
            });
            return;
          }

          const { phone, amount, fee } = currentSession.pendingTransfer;
          const nextBalance = Math.max(0, Number((balance - (amount + fee)).toFixed(2)));
          setBalance(nextBalance);

          const amtText = formatAmountDisplay(amount);
          const feeText = formatAmountDisplay(fee);

          // Exact success text from video 00:29
          const successUssdMessage = `تم تحويل ${amtText} جنيه لرقم ${phone} مصاريف الخدمة ${feeText}\nجنيه . اطلب #9* و اشحن\n0:مزيد`;

          setUssdSession({
            stage: 'prompt',
            flow: 'transfer_done',
            code: currentSession.code,
            message: successUssdMessage,
            dismissLabel: 'تجاهل',
            replyOnRight: true,
            canReply: true,
            lastBalance: nextBalance,
          });

          // Exact SMS text from video 00:31-00:34
          const smsBody = `تم تحويل ${amtText} جنيه لرقم ${phone} مصاريف الخدمة ${feeText} جنيه رصيد حسابك في فودافون كاش الحالي ${formatBalanceNumber(
            nextBalance
          )} جنيه.`;

          triggerSmsNotification(
            {
              id: `sms-${Date.now()}`,
              sender: 'VF-Cash',
              body: smsBody,
              timestamp: getArabicNowStamp(),
              createdAt: Date.now(),
              amount,
              fee,
              recipient: phone,
              balanceAfter: nextBalance,
              type: 'transfer',
            },
            1150
          );
          return;
        }

        // 2. Balance inquiry PIN (Any password accepted + sends VF-Cash SMS notification with sound)
        if (currentSession.flow === 'balance_pin') {
          const balStr = formatBalanceNumber(balance);
          // Exact text & button layout from attached photo!
          setUssdSession({
            stage: 'prompt',
            flow: 'balance_done',
            code: currentSession.code,
            message: `رصيد حسابك فى فودافون كاش الحالي ${balStr} جنيه\nلاستخدام محفظتك دوس 1`,
            dismissLabel: 'استبعاد',
            replyOnRight: false,
            canReply: true,
            lastBalance: balance,
          });

          triggerSmsNotification(
            {
              id: `sms-${Date.now()}`,
              sender: 'VF-Cash',
              body: `رصيد حسابك فى فودافون كاش الحالي ${balStr} جنيه`,
              timestamp: getArabicNowStamp(),
              createdAt: Date.now(),
              balanceAfter: balance,
              type: 'balance',
            },
            950
          );
          return;
        }

        // 3. On balance_done, replying "1" opens VF-Cash main menu
        if (currentSession.flow === 'balance_done') {
          if (reply === '1') {
            setUssdSession({
              stage: 'prompt',
              flow: 'main_menu',
              code: '*9#',
              message:
                'فودافون كاش:\n1: تحويل اموال\n2: شحن رصيد\n3: الاستعلام عن الرصيد',
              dismissLabel: 'تجاهل',
              replyOnRight: true,
              canReply: true,
            });
          } else {
            setUssdSession(null);
          }
          return;
        }

        // 4. Main menu navigation (*9#)
        if (currentSession.flow === 'main_menu') {
          if (reply === '1') {
            setUssdSession({
              stage: 'prompt',
              flow: 'menu_transfer_phone',
              code: '*9#',
              message: 'ادخل رقم الموبايل المراد التحويل له:',
              dismissLabel: 'تجاهل',
              replyOnRight: true,
              canReply: true,
            });
            return;
          }
          if (reply === '2') {
            setUssdSession({
              stage: 'prompt',
              flow: 'recharge_pin',
              code: '*9*10*50#',
              message: 'شحن رصيد بقيمة 50 ج لرقمك الحالي\nادخل الرقم السرى لتأكيد العملية',
              dismissLabel: 'تجاهل',
              replyOnRight: true,
              canReply: true,
              pendingRecharge: { phone: 'رقمك الحالي', amount: 50 },
            });
            return;
          }
          if (reply === '3') {
            setUssdSession({
              stage: 'prompt',
              flow: 'balance_pin',
              code: '#139*',
              message:
                'للاستعلام عن رصيد حسابك فى فودافون كاش\nادخل الرقم السرى المكون من 6 ارقام',
              dismissLabel: 'تجاهل',
              replyOnRight: true,
              canReply: true,
            });
            return;
          }
          setUssdSession({
            stage: 'prompt',
            flow: 'error',
            code: '*9#',
            message: 'اختيار غير صحيح. من فضلك اختر 1 أو 2 أو 3.',
            dismissLabel: 'تجاهل',
            replyOnRight: true,
            canReply: false,
          });
          return;
        }

        // 5. Menu step: enter phone -> ask amount
        if (currentSession.flow === 'menu_transfer_phone') {
          const cleanPhone = reply.replace(/[^0-9]/g, '');
          if (cleanPhone.length < 7) {
            setUssdSession({
              stage: 'prompt',
              flow: 'error',
              code: currentSession.code,
              message: 'رقم الموبايل غير صحيح. برجاء المحاولة مرة أخرى.',
              dismissLabel: 'تجاهل',
              replyOnRight: true,
              canReply: false,
            });
            return;
          }
          setUssdSession({
            stage: 'prompt',
            flow: 'menu_transfer_amount',
            code: `*9*7*${cleanPhone}`,
            message: `ادخل المبلغ المراد تحويله لرقم ${cleanPhone}:`,
            dismissLabel: 'تجاهل',
            replyOnRight: true,
            canReply: true,
            pendingTransfer: {
              phone: cleanPhone,
              amount: 0,
              fee: 1,
              maskedName: resolveMaskedRecipient(
                cleanPhone,
                contacts,
                settings.customRecipientName
              ),
            },
          });
          return;
        }

        // 6. Menu step: enter amount -> show transfer confirmation
        if (
          currentSession.flow === 'menu_transfer_amount' &&
          currentSession.pendingTransfer
        ) {
          const amount = parseFloat(reply);
          const fee = calculateTransferFee(amount);
          if (Number.isNaN(amount) || amount <= 0) {
            setUssdSession({
              stage: 'prompt',
              flow: 'error',
              code: currentSession.code,
              message: 'برجاء إدخال مبلغ صحيح.',
              dismissLabel: 'تجاهل',
              replyOnRight: true,
              canReply: false,
            });
            return;
          }
          if (amount + fee > balance) {
            setUssdSession({
              stage: 'prompt',
              flow: 'error',
              code: currentSession.code,
              message: `رصيدك الحالي ${formatBalanceNumber(balance)} جنيه غير كافي لاتمام التحويل.`,
              dismissLabel: 'تجاهل',
              replyOnRight: true,
              canReply: false,
            });
            return;
          }

          const { phone, maskedName } = currentSession.pendingTransfer;
          setUssdSession({
            stage: 'prompt',
            flow: 'transfer_confirm',
            code: `*9*7*${phone}*${amount}#`,
            message: `تحويل ${formatAmountDisplay(amount)} ج بالإضافة ل${formatAmountDisplay(
              fee
            )} ج رسوم لرقم ${phone}\nبإسم ${maskedName}\n0:مزيد`,
            dismissLabel: 'تجاهل',
            replyOnRight: true,
            canReply: true,
            pendingTransfer: { phone, amount, fee, maskedName },
          });
          return;
        }

        // 7. Recharge PIN confirmation
        if (currentSession.flow === 'recharge_pin' && currentSession.pendingRecharge) {
          const { phone, amount } = currentSession.pendingRecharge;
          const nextBalance = Math.max(0, Number((balance - amount).toFixed(2)));
          setBalance(nextBalance);

          setUssdSession({
            stage: 'prompt',
            flow: 'recharge_done',
            code: currentSession.code,
            message: `تم شحن رصيد بقيمة ${formatAmountDisplay(
              amount
            )} جنيه لرقم ${phone} بنجاح.\nرصيد محفظتك الحالي ${formatBalanceNumber(
              nextBalance
            )} جنيه`,
            dismissLabel: 'تجاهل',
            replyOnRight: true,
            canReply: false,
          });

          triggerSmsNotification(
            {
              id: `sms-${Date.now()}`,
              sender: 'VF-Cash',
              body: `تم شحن رصيد بقيمة ${formatAmountDisplay(
                amount
              )} جنيه من محفظة فودافون كاش. رصيد حسابك الحالي ${formatBalanceNumber(
                nextBalance
              )} جنيه.`,
              timestamp: getArabicNowStamp(),
              createdAt: Date.now(),
              amount,
              recipient: phone,
              balanceAfter: nextBalance,
              type: 'recharge',
            },
            1000
          );
          return;
        }

        // 8. On more_info -> if user entered PIN, treat as confirmation if pendingTransfer exists
        if (currentSession.flow === 'more_info' && currentSession.pendingTransfer) {
          const { phone, amount, fee } = currentSession.pendingTransfer;
          const nextBalance = Math.max(0, Number((balance - (amount + fee)).toFixed(2)));
          setBalance(nextBalance);
          const amtText = formatAmountDisplay(amount);
          const feeText = formatAmountDisplay(fee);

          setUssdSession({
            stage: 'prompt',
            flow: 'transfer_done',
            code: currentSession.code,
            message: `تم تحويل ${amtText} جنيه لرقم ${phone} مصاريف الخدمة ${feeText}\nجنيه . اطلب #9* و اشحن\n0:مزيد`,
            dismissLabel: 'تجاهل',
            replyOnRight: true,
            canReply: true,
          });

          triggerSmsNotification(
            {
              id: `sms-${Date.now()}`,
              sender: 'VF-Cash',
              body: `تم تحويل ${amtText} جنيه لرقم ${phone} مصاريف الخدمة ${feeText} جنيه رصيد حسابك في فودافون كاش الحالي ${formatBalanceNumber(
                nextBalance
              )} جنيه.`,
              timestamp: getArabicNowStamp(),
              createdAt: Date.now(),
              amount,
              fee,
              recipient: phone,
              balanceAfter: nextBalance,
              type: 'transfer',
            },
            1150
          );
          return;
        }

        // 9. Transfer done "0:مزيد"
        if (currentSession.flow === 'transfer_done') {
          if (reply === '0') {
            setUssdSession({
              stage: 'prompt',
              flow: 'error',
              code: currentSession.code,
              message: `رصيد حسابك فى فودافون كاش الحالي ${formatBalanceNumber(balance)} جنيه.`,
              dismissLabel: 'تجاهل',
              replyOnRight: true,
              canReply: false,
            });
          } else {
            setUssdSession(null);
          }
          return;
        }

        setUssdSession(null);
      }, 950);
    },
    [
      balance,
      clearPendingTimers,
      contacts,
      settings.customRecipientName,
      triggerSmsNotification,
      ussdSession,
    ]
  );

  // Physical keyboard support when on Keypad tab
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (ussdSession || messagesOpen || activeTab !== 'keypad') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (/^[0-9*#+]$/.test(e.key)) {
        e.preventDefault();
        if (settings.dtmfEnabled) playDtmfTone(e.key);
        setDialValue((prev) => (prev.length < 32 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setDialValue((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter' && dialValue.length > 0) {
        e.preventDefault();
        executeDial(dialValue);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, dialValue, executeDial, messagesOpen, settings.dtmfEnabled, ussdSession]);

  const handleAppendDigit = (digit: string) => {
    primeAudio();
    if (settings.dtmfEnabled) {
      playDtmfTone(digit);
    }
    setDialValue((prev) => (prev.length < 32 ? prev + digit : prev));
  };

  const handleOpenMessages = () => {
    setUnreadCount(0);
    setActiveBanner(null);
    setMessagesOpen(true);
  };

  const handleTestNotification = () => {
    primeAudio();
    const testSms: SmsMessage = {
      id: `sms-test-${Date.now()}`,
      sender: 'VF-Cash',
      body: `تم تحويل 100 جنيه لرقم 01125774158 مصاريف الخدمة 1 جنيه ورصيد حسابك فى فودافون كاش الحالي ${formatBalanceNumber(
        balance
      )} جنيه.`,
      timestamp: getArabicNowStamp(),
      createdAt: Date.now(),
      balanceAfter: balance,
      type: 'transfer',
    };
    triggerSmsNotification(testSms, 80);
  };

  const handleRunShortcut = (code: string, executeNow = true) => {
    primeAudio();
    setMessagesOpen(false);
    setActiveTab('keypad');
    setDialValue(code);
    if (executeNow) {
      executeDial(code);
    }
  };

  const handleAddContact = (newContact: Omit<Contact, 'id'>) => {
    setContacts((prev) => [
      { ...newContact, id: `c-${Date.now()}` },
      ...prev,
    ]);
  };

  if (!accessState.allowed) {
    return <AccessGate deviceInfo={deviceInfo} accessState={accessState} />;
  }

  return (
    <div className="w-full h-dvh bg-black overflow-hidden flex flex-col">
      {/* Main Full-Screen Interface */}
      <main className="relative flex-1 min-h-0 w-full bg-black flex flex-col overflow-hidden">
        {/* Active Tab Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          {activeTab === 'keypad' && (
            <DialerKeypad
              dialValue={dialValue}
              onAppendDigit={handleAppendDigit}
              onBackspace={() => setDialValue((prev) => prev.slice(0, -1))}
              onClearAll={() => setDialValue('')}
              onCall={() => executeDial(dialValue)}
              onSetDialValue={setDialValue}
              contacts={contacts}
            />
          )}

          {activeTab === 'favorites' && (
            <FavoritesView
              contacts={contacts}
              onQuickDial={(code, runNow) => handleRunShortcut(code, runNow ?? true)}
            />
          )}

          {activeTab === 'recents' && (
            <RecentsView
              records={recents}
              onDialCode={(code) => handleRunShortcut(code, true)}
              onClearRecents={() => setRecents([])}
            />
          )}

          {activeTab === 'contacts' && (
            <ContactsView
              contacts={contacts}
              onAddContact={handleAddContact}
              onSelectForTransfer={(phone) => handleRunShortcut(`*9*7*${phone}*`, false)}
              onCallNumber={(phone) => handleRunShortcut(phone, true)}
            />
          )}

          {activeTab === 'voicemail' && (
            <VoicemailWalletView
              balance={balance}
              messages={messages}
              onOpenMessages={handleOpenMessages}
              onUpdateBalance={setBalance}
              onTestSound={handleTestNotification}
              onRunBalanceCode={() => handleRunShortcut('#139*', true)}
            />
          )}
        </div>

        {/* Bottom Phone Tab Bar */}
        <BottomTabBar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'voicemail') setUnreadCount(0);
          }}
          unreadSmsCount={unreadCount}
        />

        {/* USSD Full-Screen Overlay */}
        {ussdSession && (
          <UssdOverlay
            session={ussdSession}
            onReplyOpen={() =>
              setUssdSession((prev) => (prev ? { ...prev, stage: 'reply' } : null))
            }
            onDismiss={() => {
              clearPendingTimers();
              setUssdSession(null);
            }}
            onCancelReply={() =>
              setUssdSession((prev) => (prev ? { ...prev, stage: 'prompt' } : null))
            }
            onSubmitReply={handleUssdReplySubmit}
            onKeyPressSound={() => {
              if (settings.keyboardClickEnabled) playKeyClick();
            }}
            onEndCall={() => setUssdSession(null)}
          />
        )}

        {/* Messages Thread Modal */}
        <MessagesModal
          isOpen={messagesOpen}
          messages={messages}
          onClose={() => setMessagesOpen(false)}
        />

        {/* VF-Cash Push/SMS Notification Banner */}
        <NotificationBanner
          message={activeBanner}
          onTap={() => handleOpenMessages()}
          onDismiss={() => setActiveBanner(null)}
        />
      </main>
    </div>
  );
}
