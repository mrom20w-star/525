import { useState } from 'react';
import { Contact, DialRecord, SmsMessage, TabId } from '../types/wallet';
import { formatBalanceNumber, maskArabicName, normalizeDigits } from '../utils/ussd';

interface BottomTabBarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  unreadSmsCount: number;
}

export function BottomTabBar({
  activeTab,
  onSelectTab,
  unreadSmsCount,
}: BottomTabBarProps) {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'favorites', label: 'المفضلة' },
    { id: 'recents', label: 'الأخيرة' },
    { id: 'contacts', label: 'جهات الاتصال' },
    { id: 'keypad', label: 'لوحة الأرقام' },
    { id: 'voicemail', label: 'البريد الصوتي' },
  ];

  const renderIcon = (id: TabId, isActive: boolean) => {
    const cls = `w-[22px] h-[22px] ${isActive ? 'text-[#0A84FF]' : 'text-[#8E8E93]'}`;
    switch (id) {
      case 'favorites':
        return (
          <svg viewBox="0 0 24 24" className={`${cls} fill-current`} aria-hidden="true">
            <path d="M12 2.5l2.85 5.78 6.38.93-4.61 4.5 1.09 6.35L12 17.06l-5.71 3 1.09-6.35-4.61-4.5 6.38-.93L12 2.5Z" />
          </svg>
        );
      case 'recents':
        return (
          <svg viewBox="0 0 24 24" className={`${cls} fill-current`} aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 10.41-3.29 3.3a1 1 0 1 1-1.42-1.42L11 11.59V7a1 1 0 0 1 2 0v5.41Z" />
          </svg>
        );
      case 'contacts':
        return (
          <svg viewBox="0 0 24 24" className={`${cls} fill-current`} aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 4a3.2 3.2 0 1 1-3.2 3.2A3.2 3.2 0 0 1 12 6Zm0 13.6a7.6 7.6 0 0 1-5.6-2.45c.03-1.99 3.74-3.08 5.6-3.08 1.85 0 5.57 1.09 5.6 3.08A7.6 7.6 0 0 1 12 19.6Z" />
          </svg>
        );
      case 'keypad':
        return (
          <svg viewBox="0 0 24 24" className={`${cls} fill-current`} aria-hidden="true">
            <circle cx="6" cy="5" r="2" />
            <circle cx="12" cy="5" r="2" />
            <circle cx="18" cy="5" r="2" />
            <circle cx="6" cy="11" r="2" />
            <circle cx="12" cy="11" r="2" />
            <circle cx="18" cy="11" r="2" />
            <circle cx="6" cy="17" r="2" />
            <circle cx="12" cy="17" r="2" />
            <circle cx="18" cy="17" r="2" />
          </svg>
        );
      case 'voicemail':
        return (
          <svg viewBox="0 0 24 24" className={`${cls} fill-none stroke-current`} strokeWidth="1.9" aria-hidden="true">
            <circle cx="6.5" cy="12" r="3.5" />
            <circle cx="17.5" cy="12" r="3.5" />
            <line x1="6.5" y1="15.5" x2="17.5" y2="15.5" />
          </svg>
        );
    }
  };

  return (
    <nav
      dir="rtl"
      aria-label="تنقل الهاتف"
      className="bg-[#121212]/95 backdrop-blur-xl border-t border-white/10 px-2 pt-1.5 pb-3 select-none"
    >
      <div className="max-w-md mx-auto w-full grid grid-cols-5 items-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className="relative flex flex-col items-center justify-center gap-1 py-1 min-h-[44px] cursor-pointer focus:outline-none"
            >
              <div className="relative">
                {renderIcon(tab.id, isActive)}
                {tab.id === 'voicemail' && unreadSmsCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#FF3B30] text-[10px] font-bold text-white flex items-center justify-center tabular-nums">
                    {unreadSmsCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium tracking-tight whitespace-nowrap ${
                  isActive ? 'text-[#0A84FF]' : 'text-[#8E8E93]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

interface FavoritesViewProps {
  contacts: Contact[];
  onQuickDial: (code: string, executeImmediately?: boolean) => void;
}

export function FavoritesView({ contacts, onQuickDial }: FavoritesViewProps) {
  const favorites = contacts.filter((c) => c.isFavorite);

  return (
    <div dir="rtl" className="flex-1 overflow-y-auto no-scrollbar bg-black px-4 pt-5 pb-6">
      <div className="max-w-md mx-auto w-full">
      <h1 className="text-[28px] font-bold text-white mb-4">المفضلة</h1>

      {/* Quick VF-Cash Shortcuts */}
      <div className="mb-6">
        <p className="text-[12px] text-white/50 mb-2">اختصارات فودافون كاش السريعة</p>
        <div className="divide-y divide-white/10 rounded-2xl bg-[#1C1C1E] overflow-hidden">
          <button
            type="button"
            onClick={() => onQuickDial('*9*7*01125774158*100#', true)}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 active:bg-white/10 text-right cursor-pointer"
          >
            <div>
              <div className="text-[15px] font-medium text-white">تحويل 100 ج (مثل الفيديو)</div>
              <div dir="ltr" className="text-[12.5px] text-white/55 tabular-nums text-right">
                *9*7*01125774158*100#
              </div>
            </div>
            <span className="text-[13px] font-medium text-[#0A84FF]">اتصال</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickDial('#139*', true)}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 active:bg-white/10 text-right cursor-pointer"
          >
            <div>
              <div className="text-[15px] font-medium text-white">الاستعلام عن الرصيد</div>
              <div dir="ltr" className="text-[12.5px] text-white/55 tabular-nums text-right">
                #139*
              </div>
            </div>
            <span className="text-[13px] font-medium text-[#0A84FF]">اتصال</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickDial('*9#', true)}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 active:bg-white/10 text-right cursor-pointer"
          >
            <div>
              <div className="text-[15px] font-medium text-white">القائمة الرئيسية فودافون كاش</div>
              <div dir="ltr" className="text-[12.5px] text-white/55 tabular-nums text-right">
                *9#
              </div>
            </div>
            <span className="text-[13px] font-medium text-[#0A84FF]">اتصال</span>
          </button>
        </div>
      </div>

      {/* Favorite Contacts */}
      <p className="text-[12px] text-white/50 mb-2">أرقام التحويل المفضلة</p>
      <div className="divide-y divide-white/10 rounded-2xl bg-[#1C1C1E] overflow-hidden">
        {favorites.map((c) => (
          <div
            key={c.id}
            className="px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-white truncate">{c.name}</div>
              <div dir="ltr" className="text-[12.5px] text-white/55 tabular-nums text-right">
                {c.phone}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onQuickDial(`*9*7*${c.phone}*`, false)}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-[#0A84FF]/15 text-[#0A84FF] text-[13px] font-medium hover:bg-[#0A84FF]/25 cursor-pointer"
            >
              تحويل
            </button>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

interface RecentsViewProps {
  records: DialRecord[];
  onDialCode: (code: string) => void;
  onClearRecents: () => void;
}

export function RecentsView({
  records,
  onDialCode,
  onClearRecents,
}: RecentsViewProps) {
  return (
    <div dir="rtl" className="flex-1 overflow-y-auto no-scrollbar bg-black px-4 pt-5 pb-6">
      <div className="max-w-md mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[28px] font-bold text-white">الأخيرة</h1>
        {records.length > 0 && (
          <button
            type="button"
            onClick={onClearRecents}
            className="text-[14px] text-[#0A84FF] hover:opacity-80 cursor-pointer"
          >
            مسح
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="py-20 text-center text-white/45 text-[15px]">
          لا توجد مكالمات أو أكواد حديثة
        </div>
      ) : (
        <div className="divide-y divide-white/10">
          {records.map((rec) => (
            <button
              key={rec.id}
              type="button"
              onClick={() => onDialCode(rec.code)}
              className="w-full py-3 flex items-center justify-between gap-3 text-right hover:bg-white/5 px-1 rounded-lg transition-colors cursor-pointer"
            >
              <div className="min-w-0">
                <div className="text-[15.5px] font-medium text-white truncate">
                  {rec.label}
                </div>
                <div className="text-[13px] text-white/55 truncate">
                  {rec.sublabel} · <span dir="ltr" className="tabular-nums">{rec.code}</span>
                </div>
              </div>
              <span className="text-[13px] text-white/45 shrink-0 tabular-nums">
                {rec.timestamp}
              </span>
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

interface ContactsViewProps {
  contacts: Contact[];
  onAddContact: (contact: Omit<Contact, 'id'>) => void;
  onSelectForTransfer: (phone: string) => void;
  onCallNumber: (phone: string) => void;
}

export function ContactsView({
  contacts,
  onAddContact,
  onSelectForTransfer,
  onCallNumber,
}: ContactsViewProps) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  const filtered = contacts.filter(
    (c) =>
      c.name.includes(search) ||
      normalizeDigits(c.phone).includes(normalizeDigits(search))
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizeDigits(phoneInput).replace(/[^0-9]/g, '');
    if (!nameInput.trim() || cleanPhone.length < 7) return;
    onAddContact({
      name: nameInput.trim(),
      maskedName: maskArabicName(nameInput.trim()),
      phone: cleanPhone,
      isFavorite: false,
    });
    setNameInput('');
    setPhoneInput('');
    setShowAdd(false);
  };

  return (
    <div dir="rtl" className="flex-1 overflow-y-auto no-scrollbar bg-black px-4 pt-5 pb-6">
      <div className="max-w-md mx-auto w-full">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[28px] font-bold text-white">جهات الاتصال</h1>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="w-8 h-8 rounded-full bg-[#1C1C1E] text-[#0A84FF] text-xl flex items-center justify-center hover:bg-white/10 cursor-pointer"
          title="إضافة جهة اتصال"
        >
          {showAdd ? '×' : '+'}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleSave}
          className="mb-4 p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/10 space-y-2.5"
        >
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="الاسم الكامل (مثال: محمد أحمد علي)"
            className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[14px] text-white placeholder:text-white/40 focus:outline-none focus:border-[#0A84FF]"
          />
          <input
            type="tel"
            dir="ltr"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="01012345678"
            className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[14px] text-white text-right placeholder:text-white/40 tabular-nums focus:outline-none focus:border-[#0A84FF]"
          />
          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-[#0A84FF] text-white text-[14px] font-semibold hover:bg-[#0077ed] cursor-pointer"
          >
            حفظ جهة الاتصال
          </button>
        </form>
      )}

      <div className="mb-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الرقم..."
          className="w-full rounded-xl bg-[#1C1C1E] px-3.5 py-2 text-[14px] text-white placeholder:text-white/40 focus:outline-none"
        />
      </div>

      <div className="divide-y divide-white/10">
        {filtered.map((c) => (
          <div key={c.id} className="py-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[15.5px] font-medium text-white truncate">
                {c.name}
              </div>
              <div dir="ltr" className="text-[12.5px] text-white/50 tabular-nums text-right">
                {c.phone} · <span className="text-white/40">{c.maskedName}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onSelectForTransfer(c.phone)}
                className="px-2.5 py-1.5 rounded-lg bg-[#0A84FF]/15 text-[#0A84FF] text-[12px] font-medium hover:bg-[#0A84FF]/25 cursor-pointer"
              >
                تحويل
              </button>
              <button
                type="button"
                onClick={() => onCallNumber(c.phone)}
                className="px-2.5 py-1.5 rounded-lg bg-[#30D158]/15 text-[#30D158] text-[12px] font-medium hover:bg-[#30D158]/25 cursor-pointer"
              >
                اتصال
              </button>
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

interface VoicemailWalletViewProps {
  balance: number;
  messages: SmsMessage[];
  onOpenMessages: () => void;
  onUpdateBalance: (next: number) => void;
  onTestSound: () => void;
  onRunBalanceCode: () => void;
}

export function VoicemailWalletView({
  balance,
  messages,
  onOpenMessages,
  onUpdateBalance,
  onTestSound,
  onRunBalanceCode,
}: VoicemailWalletViewProps) {
  const [balanceDraft, setBalanceDraft] = useState(formatBalanceNumber(balance));

  return (
    <div dir="rtl" className="flex-1 overflow-y-auto no-scrollbar bg-black px-4 pt-5 pb-6">
      <div className="max-w-md mx-auto w-full">
      <h1 className="text-[28px] font-bold text-white mb-4">البريد والرسائل</h1>

      {/* Balance Quick Card */}
      <div className="rounded-2xl bg-[#1C1C1E] p-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[13px] text-white/60">رصيد محفظة فودافون كاش</span>
          <button
            type="button"
            onClick={onRunBalanceCode}
            className="text-[12.5px] text-[#0A84FF] font-medium cursor-pointer"
          >
            استعلام #139*
          </button>
        </div>
        <div dir="ltr" className="text-[26px] font-bold text-white tabular-nums text-right">
          {formatBalanceNumber(balance)} <span className="text-[14px] font-normal text-white/70">EGP</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            dir="ltr"
            value={balanceDraft}
            onChange={(e) => setBalanceDraft(e.target.value)}
            className="flex-1 rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[14px] text-white tabular-nums focus:outline-none focus:border-[#0A84FF]"
          />
          <button
            type="button"
            onClick={() => {
              const parsed = parseFloat(balanceDraft);
              if (!Number.isNaN(parsed) && parsed >= 0) {
                onUpdateBalance(parsed);
              }
            }}
            className="px-4 py-2 rounded-xl bg-[#0A84FF] text-white text-[13px] font-semibold cursor-pointer"
          >
            تحديث
          </button>
        </div>
      </div>

      {/* Messages & Sound Actions */}
      <div className="rounded-2xl bg-[#1C1C1E] divide-y divide-white/10 overflow-hidden mb-4">
        <button
          type="button"
          onClick={onOpenMessages}
          className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#34C759] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" aria-hidden="true">
                <path d="M12 3C6.48 3 2 6.84 2 11.57c0 2.66 1.42 5.03 3.64 6.59-.2 1.38-.82 2.79-1.74 3.79a.45.45 0 0 0 .38.75c2.03-.23 3.94-.98 5.29-1.88.78.19 1.6.3 2.43.3 5.52 0 10-3.84 10-8.55S17.52 3 12 3Z" />
              </svg>
            </div>
            <div className="text-right">
              <div className="text-[15px] font-medium text-white">رسائل VF-Cash</div>
              <div className="text-[12px] text-white/55">
                {messages.length} رسالة واردة
              </div>
            </div>
          </div>
          <span className="text-white/40 text-lg">‹</span>
        </button>

        <button
          type="button"
          onClick={onTestSound}
          className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 cursor-pointer"
        >
          <span className="text-[15px] font-medium text-white">اختبار صوت إشعار الرسائل</span>
          <span className="text-[13px] font-medium text-[#0A84FF]">تشغيل</span>
        </button>
      </div>
      </div>
    </div>
  );
}
