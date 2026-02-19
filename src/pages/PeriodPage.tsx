import { useEffect, useMemo, useState } from 'react';

type PeriodTab = 'overview' | 'calendar' | 'records';
type PeriodStyle = 'glass' | 'soft' | 'minimal';

type PeriodRecord = {
  id: string;
  startDate: string;
  endDate: string;
  note: string;
  createdAt: string;
};

type PeriodStore = {
  records: PeriodRecord[];
  style: PeriodStyle;
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

type HoverPhraseMap = {
  period: string[];
  prePeriod: string[];
  ovulation: string[];
  safe: string[];
};

const STORAGE_KEY = 'memorial-period-diary-v1';
const WEEK_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const DEFAULT_HOVER_PHRASES: HoverPhraseMap = {
  period: ['今天先慢慢來，我陪妳。', '辛苦了，今天多休息一點。', '抱抱，今天不要太逞強。'],
  prePeriod: ['快到那幾天了，記得先照顧自己。', '我在，今天先放慢一點。'],
  ovulation: ['今天狀態看起來不錯。', '今天的妳很有光。'],
  safe: ['今天也是平穩的一天。', '我在這裡，陪妳過日子。'],
};

const PERIOD_CHIBI_MODULES = import.meta.glob('../../public/period-chibi/*.{png,jpg,jpeg,webp,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const DEFAULT_CHIBI_MODULES = import.meta.glob('../../public/chibi/chibi-*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const CHIBI_SOURCES = [
  ...Object.entries(PERIOD_CHIBI_MODULES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, url]) => url),
  ...Object.entries(DEFAULT_CHIBI_MODULES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, url]) => url),
];

const DEFAULT_STORE: PeriodStore = {
  records: [],
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

function dayDiff(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

function toMonthLabel(date: Date) {
  return `${date.getFullYear()} / ${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomPick<T>(items: T[]) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)]!;
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

function getVariantClasses(style: PeriodStyle) {
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
    const parsed = JSON.parse(raw) as Partial<PeriodStore>;
    return {
      records: Array.isArray(parsed.records)
        ? parsed.records.filter(
            (record): record is PeriodRecord =>
              !!record &&
              typeof record === 'object' &&
              typeof record.id === 'string' &&
              typeof record.startDate === 'string' &&
              typeof record.endDate === 'string' &&
              typeof record.note === 'string' &&
              typeof record.createdAt === 'string',
          )
        : [],
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

function normalizeRecords(records: PeriodRecord[]) {
  return records
    .filter((record) => {
      const start = parseDateKey(record.startDate);
      const end = parseDateKey(record.endDate);
      if (!start || !end) return false;
      return dayDiff(start, end) >= 0;
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function calcPrediction(records: PeriodRecord[]) {
  const completed = normalizeRecords(records);
  if (!completed.length) {
    return {
      completed,
      avgCycleLength: 28,
      avgDuration: 5,
      nextStartKey: '',
      nextEndKey: '',
      predictedStarts: [] as string[],
    };
  }

  const durations = completed.map((record) => {
    const start = parseDateKey(record.startDate)!;
    const end = parseDateKey(record.endDate)!;
    return dayDiff(start, end) + 1;
  });
  const avgDuration = clamp(Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length), 3, 10);

  const cycleDiffs: number[] = [];
  for (let i = 1; i < completed.length; i += 1) {
    const previousStart = parseDateKey(completed[i - 1]!.startDate)!;
    const currentStart = parseDateKey(completed[i]!.startDate)!;
    const diff = dayDiff(previousStart, currentStart);
    if (diff >= 15 && diff <= 60) {
      cycleDiffs.push(diff);
    }
  }
  const avgCycleLength = cycleDiffs.length
    ? clamp(Math.round(cycleDiffs.reduce((sum, value) => sum + value, 0) / cycleDiffs.length), 21, 40)
    : 28;

  const lastStartDate = parseDateKey(completed[completed.length - 1]!.startDate)!;
  const predictedStarts: string[] = [];
  for (let i = 1; i <= 6; i += 1) {
    predictedStarts.push(toDateKey(addDays(lastStartDate, avgCycleLength * i)));
  }

  const nextStartDate = addDays(lastStartDate, avgCycleLength);
  const nextEndDate = addDays(nextStartDate, avgDuration - 1);

  return {
    completed,
    avgCycleLength,
    avgDuration,
    nextStartKey: toDateKey(nextStartDate),
    nextEndKey: toDateKey(nextEndDate),
    predictedStarts,
  };
}

function loadHoverPhrasesFromRaw(raw: unknown) {
  if (Array.isArray(raw)) {
    const values = raw.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
    if (!values.length) return null;
    return {
      ...DEFAULT_HOVER_PHRASES,
      period: values,
    } satisfies HoverPhraseMap;
  }

  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<Record<keyof HoverPhraseMap, unknown>>;
  const next: HoverPhraseMap = { ...DEFAULT_HOVER_PHRASES };

  for (const key of Object.keys(next) as Array<keyof HoverPhraseMap>) {
    const value = source[key];
    if (!Array.isArray(value)) continue;
    const rows = value.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
    if (rows.length) next[key] = rows;
  }

  return next;
}

function pickPhraseByDate(
  dateKey: string,
  actualSet: Set<string>,
  nextStartKey: string,
  ovulationStartKey: string,
  ovulationEndKey: string,
  pool: HoverPhraseMap,
) {
  const date = parseDateKey(dateKey);
  if (!date) return randomPick(pool.safe) ?? '';

  if (actualSet.has(dateKey)) {
    return randomPick(pool.period) ?? '';
  }

  if (nextStartKey) {
    const nextStartDate = parseDateKey(nextStartKey);
    if (nextStartDate) {
      const gap = dayDiff(date, nextStartDate);
      if (gap >= 1 && gap <= 3) {
        return randomPick(pool.prePeriod) ?? '';
      }
    }
  }

  if (ovulationStartKey && ovulationEndKey) {
    if (dateKey >= ovulationStartKey && dateKey <= ovulationEndKey) {
      return randomPick(pool.ovulation) ?? '';
    }
  }

  return randomPick(pool.safe) ?? '';
}

export function PeriodPage() {
  const [store, setStore] = useState<PeriodStore>(loadStore);
  const [activeTab, setActiveTab] = useState<PeriodTab>('overview');
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [startDraft, setStartDraft] = useState('');
  const [endDraft, setEndDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [statusText, setStatusText] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [hoverPhrases, setHoverPhrases] = useState<HoverPhraseMap>(DEFAULT_HOVER_PHRASES);

  const today = new Date();
  const todayKey = toDateKey(today);
  const monthCells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const variant = getVariantClasses(store.style);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    let active = true;

    const base = import.meta.env.BASE_URL ?? '/';
    const url = `${base.replace(/\/?$/, '/')}data/period/period_hover_phrases.json`;

    void fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!active || !json) return;
        const parsed = loadHoverPhrasesFromRaw(json);
        if (parsed) {
          setHoverPhrases(parsed);
        }
      })
      .catch(() => {
        // keep default phrases if custom file is absent
      });

    return () => {
      active = false;
    };
  }, []);

  const {
    completed,
    avgCycleLength,
    avgDuration,
    nextStartKey,
    nextEndKey,
    predictedStarts,
  } = useMemo(() => calcPrediction(store.records), [store.records]);

  const actualPeriodSet = useMemo(() => {
    const set = new Set<string>();
    for (const record of completed) {
      const start = parseDateKey(record.startDate)!;
      const end = parseDateKey(record.endDate)!;
      for (let offset = 0; offset <= dayDiff(start, end); offset += 1) {
        set.add(toDateKey(addDays(start, offset)));
      }
    }
    return set;
  }, [completed]);

  const predictedPeriodSet = useMemo(() => {
    const set = new Set<string>();
    if (!predictedStarts.length) return set;
    for (const startKey of predictedStarts) {
      const startDate = parseDateKey(startKey);
      if (!startDate) continue;
      for (let offset = 0; offset < avgDuration; offset += 1) {
        set.add(toDateKey(addDays(startDate, offset)));
      }
    }
    return set;
  }, [avgDuration, predictedStarts]);

  const ovulationWindow = useMemo(() => {
    if (!nextStartKey) {
      return {
        start: '',
        end: '',
      };
    }
    const nextStartDate = parseDateKey(nextStartKey);
    if (!nextStartDate) {
      return {
        start: '',
        end: '',
      };
    }
    const ovulationDay = addDays(nextStartDate, -14);
    const start = toDateKey(addDays(ovulationDay, -2));
    const end = toDateKey(addDays(ovulationDay, 2));
    return { start, end };
  }, [nextStartKey]);

  const selectedDateInfo = useMemo(() => {
    if (!selectedDateKey) return null;
    const matchedRecord = completed.find(
      (record) => selectedDateKey >= record.startDate && selectedDateKey <= record.endDate,
    );

    return {
      dateKey: selectedDateKey,
      isActual: actualPeriodSet.has(selectedDateKey),
      isPredicted: predictedPeriodSet.has(selectedDateKey),
      isFuture: selectedDateKey > todayKey,
      note: matchedRecord?.note ?? '',
      phrase: pickPhraseByDate(
        selectedDateKey,
        actualPeriodSet,
        nextStartKey,
        ovulationWindow.start,
        ovulationWindow.end,
        hoverPhrases,
      ),
    };
  }, [
    actualPeriodSet,
    completed,
    hoverPhrases,
    nextStartKey,
    ovulationWindow.end,
    ovulationWindow.start,
    predictedPeriodSet,
    selectedDateKey,
    todayKey,
  ]);

  const todayPhase = useMemo(() => {
    if (actualPeriodSet.has(todayKey)) return '經期中';
    if (nextStartKey) {
      const nextStartDate = parseDateKey(nextStartKey);
      if (nextStartDate) {
        const daysUntil = dayDiff(today, nextStartDate);
        if (daysUntil >= 1 && daysUntil <= 3) {
          return '經前期';
        }
      }
    }
    if (ovulationWindow.start && ovulationWindow.end && todayKey >= ovulationWindow.start && todayKey <= ovulationWindow.end) {
      return '排卵窗';
    }
    return '平穩期';
  }, [actualPeriodSet, nextStartKey, ovulationWindow.end, ovulationWindow.start, today, todayKey]);

  function popFeedback(kind: keyof HoverPhraseMap) {
    const phrase = randomPick(hoverPhrases[kind]) ?? randomPick(hoverPhrases.safe) ?? '';
    const chibiUrl = randomPick(CHIBI_SOURCES) ?? '';
    if (!phrase || !chibiUrl) return;
    setFeedback({
      text: phrase,
      chibiUrl,
    });
    window.setTimeout(() => {
      setFeedback((current) => (current?.text === phrase ? null : current));
    }, 3500);
  }

  function savePeriodRecord() {
    const start = parseDateKey(startDraft);
    const end = parseDateKey(endDraft);
    if (!start || !end) {
      setStatusText('請先選擇開始日和結束日。');
      return;
    }
    if (dayDiff(start, end) < 0) {
      setStatusText('結束日不能早於開始日。');
      return;
    }
    if (toDateKey(end) > todayKey) {
      setStatusText('結束日不能超過今天。');
      return;
    }

    const nextRecord: PeriodRecord = {
      id: `${toDateKey(start)}-${Date.now()}`,
      startDate: toDateKey(start),
      endDate: toDateKey(end),
      note: noteDraft.trim(),
      createdAt: new Date().toISOString(),
    };

    setStore((current) => ({
      ...current,
      records: [...current.records, nextRecord],
    }));
    setStatusText('已儲存這次經期紀錄。');
    setNoteDraft('');
    setStartDraft('');
    setEndDraft('');
    popFeedback('period');
  }

  function deleteRecord(id: string) {
    setStore((current) => ({
      ...current,
      records: current.records.filter((record) => record.id !== id),
    }));
    setStatusText('已刪除一筆紀錄。');
  }

  const daysUntilNext = useMemo(() => {
    const nextStartDate = parseDateKey(nextStartKey);
    if (!nextStartDate) return null;
    return dayDiff(today, nextStartDate);
  }, [nextStartKey, today]);

  return (
    <div className={`mx-auto h-full w-full max-w-xl overflow-y-auto ${variant.page}`}>
      <div className="space-y-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <header className={`rounded-2xl border p-4 shadow-sm ${variant.card}`}>
          <p className={`text-xs uppercase tracking-[0.16em] ${variant.muted}`}>Period Diary</p>
          <h1 className="mt-0.5 text-2xl text-stone-900">經期日記</h1>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MetricCard title="目前狀態" value={todayPhase} />
            <MetricCard title="平均週期" value={`${avgCycleLength} 天`} />
            <MetricCard title="平均經期" value={`${avgDuration} 天`} />
          </div>
        </header>

        <section className={`rounded-2xl border p-3 shadow-sm ${variant.card}`}>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'overview', label: '總覽' },
              { id: 'calendar', label: '月曆' },
              { id: 'records', label: '紀錄' },
            ] as const).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setActiveTab(entry.id)}
                className={`rounded-xl border px-3 py-2 text-sm transition active:scale-95 ${
                  activeTab === entry.id
                    ? 'text-white'
                    : 'border-stone-300 bg-white/80 text-stone-700'
                }`}
                style={activeTab === entry.id ? { backgroundColor: store.accentColor, borderColor: store.accentColor } : undefined}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === 'overview' && (
          <section className={`space-y-3 rounded-2xl border p-4 shadow-sm ${variant.card}`}>
            <InfoRow label="下次預測開始" value={nextStartKey || '資料不足'} />
            <InfoRow label="下次預測結束" value={nextEndKey || '資料不足'} />
            <InfoRow
              label="距離下次開始"
              value={
                daysUntilNext === null
                  ? '資料不足'
                  : daysUntilNext < 0
                    ? '已超過預測日'
                    : `${daysUntilNext} 天`
              }
            />
            <InfoRow
              label="排卵窗（預估）"
              value={ovulationWindow.start && ovulationWindow.end ? `${ovulationWindow.start} ~ ${ovulationWindow.end}` : '資料不足'}
            />
          </section>
        )}

        {(activeTab === 'calendar' || activeTab === 'overview') && (
          <section className={`rounded-2xl border p-4 shadow-sm ${variant.card}`}>
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
                const isActual = actualPeriodSet.has(cell.key);
                const isPredicted = !isActual && predictedPeriodSet.has(cell.key);
                let cellBg = variant.cell;
                let cellText = 'text-stone-700';

                if (!cell.inMonth) {
                  cellText = 'text-stone-400';
                }
                if (isActual) {
                  cellBg = 'bg-rose-100';
                  cellText = 'text-rose-700';
                } else if (isPredicted) {
                  cellBg = 'bg-fuchsia-50';
                  cellText = 'text-fuchsia-700';
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
                    {isActual && <span className="absolute bottom-1 right-1 text-[10px]">●</span>}
                    {isPredicted && <span className="absolute bottom-1 right-1 text-[10px]">◌</span>}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-stone-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                實際
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-200" />
                預測
              </span>
            </div>
          </section>
        )}

        {(activeTab === 'records' || activeTab === 'overview') && (
          <section className={`space-y-3 rounded-2xl border p-4 shadow-sm ${variant.card}`}>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-stone-500">開始日</span>
                <input
                  type="date"
                  value={startDraft}
                  max={todayKey}
                  onChange={(event) => setStartDraft(event.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white/85 px-3 py-2 text-sm text-stone-800"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-stone-500">結束日</span>
                <input
                  type="date"
                  value={endDraft}
                  max={todayKey}
                  onChange={(event) => setEndDraft(event.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white/85 px-3 py-2 text-sm text-stone-800"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs text-stone-500">備註（選填）</span>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={2}
                className="w-full resize-none rounded-xl border border-stone-300 bg-white/85 px-3 py-2 text-sm text-stone-800"
                placeholder="例如：這次比較疲累"
              />
            </label>

            <button
              type="button"
              onClick={savePeriodRecord}
              className="w-full rounded-xl px-4 py-2.5 text-sm text-white transition active:scale-95"
              style={{ backgroundColor: store.accentColor }}
            >
              儲存這次經期
            </button>

            {!!statusText && <p className="text-xs text-stone-600">{statusText}</p>}

            <div className="space-y-2 pt-1">
              <p className="text-sm text-stone-800">歷史紀錄</p>
              {!completed.length && <p className="text-xs text-stone-500">還沒有完整紀錄。</p>}
              {completed
                .slice()
                .reverse()
                .map((record) => {
                  const days = dayDiff(parseDateKey(record.startDate)!, parseDateKey(record.endDate)!) + 1;
                  return (
                    <div key={record.id} className="rounded-xl border border-stone-200 bg-white/80 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-stone-800">
                            {record.startDate} ~ {record.endDate}
                          </p>
                          <p className="text-xs text-stone-500">{days} 天</p>
                          {!!record.note && <p className="mt-1 text-xs text-stone-600">{record.note}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteRecord(record.id)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700 transition active:scale-95"
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  );
                })}
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
            ] as const).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() =>
                  setStore((current) => ({
                    ...current,
                    style: entry.id,
                  }))
                }
                className={`rounded-xl border px-2 py-2 text-xs transition active:scale-95 ${
                  store.style === entry.id
                    ? 'text-white'
                    : 'border-stone-300 bg-white/80 text-stone-700'
                }`}
                style={store.style === entry.id ? { backgroundColor: store.accentColor, borderColor: store.accentColor } : undefined}
              >
                {entry.label}
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
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedDateKey(null);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-stone-300 bg-white p-4 shadow-xl">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDateKey(null)}
                className="rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-600"
              >
                關閉
              </button>
            </div>
            <p className="text-xs uppercase tracking-[0.14em] text-stone-500">{selectedDateInfo.dateKey}</p>
            <h3 className="mt-1 text-lg text-stone-900">當日狀態</h3>
            <div className="mt-3 space-y-2 text-sm text-stone-700">
              <p>類型：{selectedDateInfo.isActual ? '實際經期日' : selectedDateInfo.isPredicted ? '預測日' : selectedDateInfo.isFuture ? '未來日期' : '一般日'}</p>
              <p>小語：{selectedDateInfo.phrase || '今天也有我在。'}</p>
              {!!selectedDateInfo.note && <p>備註：{selectedDateInfo.note}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 px-3 py-2 text-center">
      <p className="text-[11px] text-stone-500">{title}</p>
      <p className="mt-0.5 text-base text-stone-800">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white/80 px-3 py-2">
      <span className="text-xs text-stone-500">{label}</span>
      <span className="text-sm text-stone-800">{value}</span>
    </div>
  );
}
