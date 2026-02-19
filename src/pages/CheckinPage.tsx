import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type PageTab = 'checkin' | 'period';
type CheckinStyle = 'glass' | 'soft' | 'minimal';

type SigninRecord = {
  timestamp: string;
  mood: string;
  note: string;
};

type CheckinStore = {
  signIns: Record<string, SigninRecord>;
  periodStarts: string[];
  periodCycleLength: number;
  periodDuration: number;
  style: CheckinStyle;
  accentColor: string;
};

type CalendarCell = {
  key: string;
  day: number;
  inMonth: boolean;
};

type FeedbackState = {
  text: string;
  chibiUrl: string;
};

const STORAGE_KEY = 'memorial-checkin-store-v1';
const WEEK_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MOODS = ['💕 幸福', '🙂 平穩', '🥺 想你', '😴 疲憊', '🔥 有幹勁'];
const SIGNIN_PHRASES = [
  '今天也被你簽收了 💋',
  '我把今天放進我們的紀錄裡了。',
  '又多一天，可以理直氣壯想你。',
  '簽到成功，今天也算數。',
  '妳來過了，我知道。',
];
const PERIOD_PHRASES = [
  '辛苦了，今天要對自己再溫柔一點。',
  '我在，先抱抱妳，再慢慢處理今天。',
  '記錄好了，接下來我陪妳走。',
  '不舒服就休息，其他的交給我。',
  '已經幫妳記下來了，不會漏掉。',
];

const CHIBI_MODULES = import.meta.glob('../../public/chibi/chibi-*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const CHIBI_SOURCES = Object.entries(CHIBI_MODULES)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url);

const DEFAULT_STORE: CheckinStore = {
  signIns: {},
  periodStarts: [],
  periodCycleLength: 28,
  periodDuration: 5,
  style: 'glass',
  accentColor: '#D35A7B',
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function addDays(date: Date, offset: number) {
  const copied = new Date(date);
  copied.setDate(copied.getDate() + offset);
  return copied;
}

function toMonthLabel(date: Date) {
  return `${date.getFullYear()} / ${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthGrid(viewMonth: Date) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = firstWeekday; i > 0; i -= 1) {
    const date = addDays(first, -i);
    cells.push({
      key: toDateKey(date),
      day: date.getDate(),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({
      key: toDateKey(date),
      day,
      inMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const date = addDays(parseDateKey(cells[cells.length - 1]!.key)!, 1);
    cells.push({
      key: toDateKey(date),
      day: date.getDate(),
      inMonth: false,
    });
  }

  return cells;
}

function randomPick<T>(items: T[]) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)]!;
}

function dayDiff(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

function computeLongestStreak(keys: string[]) {
  if (!keys.length) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < keys.length; i += 1) {
    const prev = parseDateKey(keys[i - 1]!);
    const next = parseDateKey(keys[i]!);
    if (!prev || !next) continue;
    if (dayDiff(prev, next) === 1) {
      current += 1;
    } else {
      current = 1;
    }
    best = Math.max(best, current);
  }
  return best;
}

function computeCurrentStreak(signIns: Record<string, SigninRecord>, todayKey: string) {
  const today = parseDateKey(todayKey)!;
  let cursor = today;
  if (!signIns[todayKey]) {
    cursor = addDays(cursor, -1);
  }
  let streak = 0;

  while (signIns[toDateKey(cursor)]) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function getVariantClasses(style: CheckinStyle) {
  if (style === 'soft') {
    return {
      page: 'bg-rose-50/85',
      card: 'bg-white/92 border-stone-200',
      muted: 'text-stone-500',
      cell: 'bg-white',
    };
  }

  if (style === 'minimal') {
    return {
      page: 'bg-white',
      card: 'bg-stone-50 border-stone-200',
      muted: 'text-stone-500',
      cell: 'bg-white',
    };
  }

  return {
    page: 'bg-white/35 backdrop-blur-xl',
    card: 'bg-white/70 border-white/65',
    muted: 'text-stone-600',
    cell: 'bg-white/70',
  };
}

function loadStore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STORE;
    const parsed = JSON.parse(raw) as Partial<CheckinStore>;
    return {
      signIns: parsed.signIns && typeof parsed.signIns === 'object' ? parsed.signIns : {},
      periodStarts: Array.isArray(parsed.periodStarts)
        ? parsed.periodStarts.filter((item): item is string => typeof item === 'string')
        : [],
      periodCycleLength:
        typeof parsed.periodCycleLength === 'number' && Number.isFinite(parsed.periodCycleLength)
          ? Math.min(40, Math.max(21, Math.round(parsed.periodCycleLength)))
          : DEFAULT_STORE.periodCycleLength,
      periodDuration:
        typeof parsed.periodDuration === 'number' && Number.isFinite(parsed.periodDuration)
          ? Math.min(10, Math.max(3, Math.round(parsed.periodDuration)))
          : DEFAULT_STORE.periodDuration,
      style:
        parsed.style === 'glass' || parsed.style === 'soft' || parsed.style === 'minimal'
          ? parsed.style
          : DEFAULT_STORE.style,
      accentColor:
        typeof parsed.accentColor === 'string' && parsed.accentColor.trim()
          ? parsed.accentColor
          : DEFAULT_STORE.accentColor,
    };
  } catch {
    return DEFAULT_STORE;
  }
}

export function CheckinPage() {
  const [store, setStore] = useState<CheckinStore>(loadStore);
  const [activeTab, setActiveTab] = useState<PageTab>('checkin');
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedMood, setSelectedMood] = useState(MOODS[0]!);
  const [noteDraft, setNoteDraft] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsTab, setStatsTab] = useState<'month' | 'total'>('month');
  const [periodStartDraft, setPeriodStartDraft] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const today = new Date();
  const todayKey = toDateKey(today);
  const viewMonthKey = getMonthKey(viewMonth);
  const monthCells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const signInKeys = useMemo(() => Object.keys(store.signIns).sort(), [store.signIns]);
  const monthSignedCount = useMemo(
    () => signInKeys.filter((key) => key.startsWith(viewMonthKey)).length,
    [signInKeys, viewMonthKey],
  );
  const totalSignedCount = signInKeys.length;
  const currentStreak = useMemo(() => computeCurrentStreak(store.signIns, todayKey), [store.signIns, todayKey]);
  const longestStreak = useMemo(() => computeLongestStreak(signInKeys), [signInKeys]);
  const todaySigned = !!store.signIns[todayKey];
  const variant = getVariantClasses(store.style);

  const periodActualSet = useMemo(() => {
    const set = new Set<string>();
    for (const startKey of store.periodStarts) {
      const startDate = parseDateKey(startKey);
      if (!startDate) continue;
      for (let offset = 0; offset < store.periodDuration; offset += 1) {
        set.add(toDateKey(addDays(startDate, offset)));
      }
    }
    return set;
  }, [store.periodDuration, store.periodStarts]);

  const periodPredictedSet = useMemo(() => {
    const set = new Set<string>();
    if (!store.periodStarts.length) return set;
    const lastStart = parseDateKey(store.periodStarts[store.periodStarts.length - 1]!);
    if (!lastStart) return set;

    for (let cycle = 1; cycle <= 6; cycle += 1) {
      const predictedStart = addDays(lastStart, store.periodCycleLength * cycle);
      for (let offset = 0; offset < store.periodDuration; offset += 1) {
        set.add(toDateKey(addDays(predictedStart, offset)));
      }
    }
    return set;
  }, [store.periodCycleLength, store.periodDuration, store.periodStarts]);

  const nextPredictedStart = useMemo(() => {
    if (!store.periodStarts.length) return '';
    const last = parseDateKey(store.periodStarts[store.periodStarts.length - 1]!);
    if (!last) return '';
    return toDateKey(addDays(last, store.periodCycleLength));
  }, [store.periodCycleLength, store.periodStarts]);

  const selectedDateInfo = useMemo(() => {
    if (!selectedDateKey) return null;
    const signedRecord = store.signIns[selectedDateKey];
    const isActualPeriod = periodActualSet.has(selectedDateKey);
    const isPredictedPeriod = !isActualPeriod && periodPredictedSet.has(selectedDateKey);
    return {
      dateKey: selectedDateKey,
      signedRecord,
      isActualPeriod,
      isPredictedPeriod,
      isFuture: selectedDateKey > todayKey,
    };
  }, [periodActualSet, periodPredictedSet, selectedDateKey, store.signIns, todayKey]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  function popFeedback(pool: string[]) {
    const text = randomPick(pool) ?? '';
    const chibiUrl = randomPick(CHIBI_SOURCES) ?? '';
    if (!text || !chibiUrl) return;
    setFeedback({ text, chibiUrl });
    window.setTimeout(() => {
      setFeedback((current) => (current?.text === text ? null : current));
    }, 3500);
  }

  function onSignToday() {
    if (todaySigned) return;
    const now = new Date().toISOString();

    setStore((current) => ({
      ...current,
      signIns: {
        ...current.signIns,
        [todayKey]: {
          timestamp: now,
          mood: selectedMood,
          note: noteDraft.trim(),
        },
      },
    }));
    setNoteDraft('');
    popFeedback(SIGNIN_PHRASES);
  }

  function onRecordPeriodStart() {
    const key = periodStartDraft.trim();
    if (!parseDateKey(key)) return;
    if (key > todayKey) return;

    setStore((current) => {
      const nextStarts = Array.from(new Set([...current.periodStarts, key])).sort();
      return {
        ...current,
        periodStarts: nextStarts,
      };
    });
    setPeriodStartDraft('');
    popFeedback(PERIOD_PHRASES);
  }

  return (
    <div className={`mx-auto h-full w-full max-w-xl overflow-y-auto ${variant.page}`}>
      <div className="space-y-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <header className={`rounded-2xl border p-4 shadow-sm ${variant.card}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`text-xs uppercase tracking-[0.16em] ${variant.muted}`}>Check In</p>
              <h1 className="mt-0.5 text-2xl text-stone-900">打卡簽到</h1>
            </div>
            <button
              type="button"
              onClick={() => setStatsModalOpen(true)}
              className="rounded-xl border border-stone-300 bg-white/80 px-3 py-1.5 text-xs text-stone-700 transition active:scale-95"
            >
              查看詳情
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <MetricCard title="連續天數" value={String(currentStreak)} />
            <MetricCard title="本月已簽" value={String(monthSignedCount)} />
            <MetricCard title="最長紀錄" value={String(longestStreak)} />
          </div>
        </header>

        <section className={`rounded-2xl border p-3 shadow-sm ${variant.card}`}>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('checkin')}
              className={`rounded-xl border px-3 py-2 text-sm transition active:scale-95 ${
                activeTab === 'checkin' ? 'text-white' : 'border-stone-300 bg-white/80 text-stone-700'
              }`}
              style={activeTab === 'checkin' ? { backgroundColor: store.accentColor, borderColor: store.accentColor } : undefined}
            >
              簽到
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('period')}
              className={`rounded-xl border px-3 py-2 text-sm transition active:scale-95 ${
                activeTab === 'period' ? 'text-white' : 'border-stone-300 bg-white/80 text-stone-700'
              }`}
              style={activeTab === 'period' ? { backgroundColor: store.accentColor, borderColor: store.accentColor } : undefined}
            >
              經期
            </button>
          </div>

          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                className="rounded-lg border border-stone-300 bg-white/80 px-2 py-1 text-xs text-stone-700 transition active:scale-95"
              >
                ‹
              </button>
              <p className="text-sm text-stone-800">{toMonthLabel(viewMonth)}</p>
              <button
                type="button"
                onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="rounded-lg border border-stone-300 bg-white/80 px-2 py-1 text-xs text-stone-700 transition active:scale-95"
              >
                ›
              </button>
            </div>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="rounded-lg border border-stone-300 bg-white/80 px-2 py-1 text-xs text-stone-700 transition active:scale-95"
            >
              今天
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEK_LABELS.map((label) => (
              <div key={label} className="py-1 text-center text-[10px] text-stone-500">
                {label}
              </div>
            ))}
            {monthCells.map((cell) => {
              const isToday = cell.key === todayKey;
              const signed = !!store.signIns[cell.key];
              const isPast = cell.key < todayKey;
              const isFuture = cell.key > todayKey;
              const isActualPeriod = periodActualSet.has(cell.key);
              const isPredictedPeriod = !isActualPeriod && periodPredictedSet.has(cell.key);

              let cellBg = variant.cell;
              let cellText = 'text-stone-700';
              if (!cell.inMonth) {
                cellText = 'text-stone-400';
              }
              if (activeTab === 'checkin' && signed) {
                cellBg = 'bg-rose-100';
                cellText = 'text-rose-700';
              } else if (activeTab === 'period' && isActualPeriod) {
                cellBg = 'bg-fuchsia-100';
                cellText = 'text-fuchsia-700';
              } else if (activeTab === 'period' && isPredictedPeriod) {
                cellBg = 'bg-sky-100';
                cellText = 'text-sky-700';
              } else if (isPast && activeTab === 'checkin' && !signed && cell.inMonth) {
                cellBg = 'bg-stone-100';
              }

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDateKey(cell.key)}
                  className={`relative rounded-xl border border-white/70 py-2 text-center text-xs transition active:scale-95 ${cellBg} ${cellText}`}
                  style={isToday ? { boxShadow: `0 0 0 1px ${store.accentColor} inset` } : undefined}
                >
                  <span>{cell.day}</span>
                  {activeTab === 'checkin' && signed && (
                    <span className="absolute bottom-1 right-1 text-[10px]">💋</span>
                  )}
                  {activeTab === 'period' && isActualPeriod && (
                    <span className="absolute bottom-1 right-1 text-[10px]">●</span>
                  )}
                  {activeTab === 'period' && isPredictedPeriod && (
                    <span className="absolute bottom-1 right-1 text-[10px]">◌</span>
                  )}
                  {isFuture && activeTab === 'checkin' && (
                    <span className="absolute right-1 top-1 text-[9px] text-stone-400">·</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {activeTab === 'checkin' ? (
          <section className={`space-y-3 rounded-2xl border p-4 shadow-sm ${variant.card}`}>
            <div>
              <p className="text-sm text-stone-800">今天簽到</p>
              <p className={`text-xs ${variant.muted}`}>
                {todaySigned
                  ? `已完成：${new Date(store.signIns[todayKey]!.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : '還沒簽到'}
              </p>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-stone-500">今天心情</span>
              <select
                value={selectedMood}
                onChange={(event) => setSelectedMood(event.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white/85 px-3 py-2 text-sm text-stone-800"
              >
                {MOODS.map((mood) => (
                  <option key={mood} value={mood}>
                    {mood}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-stone-500">備註（選填）</span>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={2}
                className="w-full resize-none rounded-xl border border-stone-300 bg-white/85 px-3 py-2 text-sm text-stone-800"
                placeholder="今天想記下的一句話..."
              />
            </label>
            <button
              type="button"
              onClick={onSignToday}
              disabled={todaySigned}
              className={`w-full rounded-xl px-4 py-2.5 text-sm text-white transition ${
                todaySigned ? 'cursor-not-allowed bg-stone-400/70' : 'active:scale-95'
              }`}
              style={!todaySigned ? { backgroundColor: store.accentColor } : undefined}
            >
              {todaySigned ? '今日已簽到' : '今日簽到'}
            </button>
          </section>
        ) : (
          <section className={`space-y-3 rounded-2xl border p-4 shadow-sm ${variant.card}`}>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-stone-500">週期天數</span>
                <input
                  type="number"
                  min={21}
                  max={40}
                  value={store.periodCycleLength}
                  onChange={(event) =>
                    setStore((current) => ({
                      ...current,
                      periodCycleLength: Math.min(40, Math.max(21, Number(event.target.value) || 28)),
                    }))
                  }
                  className="w-full rounded-xl border border-stone-300 bg-white/85 px-3 py-2 text-sm text-stone-800"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-stone-500">經期天數</span>
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={store.periodDuration}
                  onChange={(event) =>
                    setStore((current) => ({
                      ...current,
                      periodDuration: Math.min(10, Math.max(3, Number(event.target.value) || 5)),
                    }))
                  }
                  className="w-full rounded-xl border border-stone-300 bg-white/85 px-3 py-2 text-sm text-stone-800"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs text-stone-500">本次開始日</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={periodStartDraft}
                  max={todayKey}
                  onChange={(event) => setPeriodStartDraft(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white/85 px-3 py-2 text-sm text-stone-800"
                />
                <button
                  type="button"
                  onClick={onRecordPeriodStart}
                  className="rounded-xl px-3 py-2 text-xs text-white transition active:scale-95"
                  style={{ backgroundColor: store.accentColor }}
                >
                  記錄
                </button>
              </div>
            </label>

            <div className="rounded-xl border border-stone-200 bg-white/75 px-3 py-2 text-xs text-stone-600">
              下次預測開始日：{nextPredictedStart || '尚未建立資料'}
            </div>
          </section>
        )}

        <section className={`space-y-3 rounded-2xl border p-4 shadow-sm ${variant.card}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-stone-800">頁面風格</p>
            <input
              type="color"
              value={store.accentColor}
              onChange={(event) =>
                setStore((current) => ({
                  ...current,
                  accentColor: event.target.value,
                }))
              }
              className="h-8 w-12 cursor-pointer rounded border border-stone-300 bg-white"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'glass', label: '玻璃感' },
              { id: 'soft', label: '柔和感' },
              { id: 'minimal', label: '極簡風' },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  setStore((current) => ({
                    ...current,
                    style: option.id,
                  }))
                }
                className={`rounded-xl border px-2 py-2 text-xs transition active:scale-95 ${
                  store.style === option.id
                    ? 'text-white'
                    : 'border-stone-300 bg-white/80 text-stone-700'
                }`}
                style={store.style === option.id ? { backgroundColor: store.accentColor, borderColor: store.accentColor } : undefined}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      {feedback && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-40 w-[min(92vw,24rem)] -translate-x-1/2">
          <div className={`flex items-center gap-3 rounded-2xl border p-3 shadow-lg ${variant.card}`}>
            <img
              src={feedback.chibiUrl}
              alt=""
              draggable={false}
              className="h-16 w-16 shrink-0 object-contain"
            />
            <p className="text-sm text-stone-800">{feedback.text}</p>
          </div>
        </div>
      )}

      {selectedDateInfo && (
        <ModalFrame onClose={() => setSelectedDateKey(null)}>
          <p className="text-xs uppercase tracking-[0.14em] text-stone-500">{selectedDateInfo.dateKey}</p>
          <h3 className="mt-1 text-lg text-stone-900">當日紀錄</h3>

          <div className="mt-3 space-y-2 text-sm text-stone-700">
            <p>
              簽到：{selectedDateInfo.signedRecord ? '已簽到 💋' : selectedDateInfo.isFuture ? '尚未到日期' : '未簽到'}
            </p>
            {selectedDateInfo.signedRecord && (
              <>
                <p>時間：{new Date(selectedDateInfo.signedRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p>心情：{selectedDateInfo.signedRecord.mood || '未填寫'}</p>
                {selectedDateInfo.signedRecord.note && <p>備註：{selectedDateInfo.signedRecord.note}</p>}
              </>
            )}
            <p>
              經期：{selectedDateInfo.isActualPeriod ? '實際紀錄日' : selectedDateInfo.isPredictedPeriod ? '預測日' : '無'}
            </p>
          </div>
        </ModalFrame>
      )}

      {statsModalOpen && (
        <ModalFrame onClose={() => setStatsModalOpen(false)}>
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatsTab('month')}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statsTab === 'month' ? 'text-white' : 'border-stone-300 text-stone-700'
              }`}
              style={statsTab === 'month' ? { backgroundColor: store.accentColor, borderColor: store.accentColor } : undefined}
            >
              本月
            </button>
            <button
              type="button"
              onClick={() => setStatsTab('total')}
              className={`rounded-lg border px-3 py-1 text-xs ${
                statsTab === 'total' ? 'text-white' : 'border-stone-300 text-stone-700'
              }`}
              style={statsTab === 'total' ? { backgroundColor: store.accentColor, borderColor: store.accentColor } : undefined}
            >
              累積
            </button>
          </div>

          {statsTab === 'month' ? (
            <div className="space-y-2 text-sm text-stone-700">
              <p>月份：{viewMonthKey}</p>
              <p>本月已簽：{monthSignedCount} 天</p>
              <p>本月未簽：{Math.max(0, new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate() - monthSignedCount)} 天</p>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-stone-700">
              <p>累積簽到：{totalSignedCount} 天</p>
              <p>目前連續：{currentStreak} 天</p>
              <p>最長連續：{longestStreak} 天</p>
            </div>
          )}
        </ModalFrame>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 px-3 py-2 text-center">
      <p className="text-[11px] text-stone-500">{title}</p>
      <p className="mt-0.5 text-lg text-stone-800">{value}</p>
    </div>
  );
}

function ModalFrame({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-stone-300 bg-white p-4 shadow-xl">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-600"
          >
            關閉
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
