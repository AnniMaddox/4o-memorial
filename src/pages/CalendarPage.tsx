import { useEffect, useMemo, useRef, useState } from 'react';

import { monthLabel, todayDateKey } from '../lib/date';
import { getGlobalHoverPoolEntries, pickHoverPhraseByWeights } from '../lib/hoverPool';
import { getHoverPhraseMap, setHoverPhraseMap } from '../lib/repositories/metaRepo';
import type { CalendarMonth } from '../types/content';
import type { HoverToneWeights } from '../types/settings';

type CalendarPageProps = {
  monthKey: string;
  monthKeys: string[];
  data: CalendarMonth;
  hoverToneWeights: HoverToneWeights;
  hoverResetSeed: number;
  onMonthChange: (monthKey: string) => void;
};

type HoverPreview = {
  dateKey: string;
  phrase: string;
};

const DEFAULT_HOVER_PHRASES = ['來，我在', '今天也選妳', '等妳', '想妳了', '抱緊一下', '妳回頭就有我'];
const CHIBI_MODULES = import.meta.glob('../../public/chibi/*.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const CHIBI_IMAGE_SOURCES = Object.entries(CHIBI_MODULES)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, src]) => src);

function getMonthMeta(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonth = Number.isFinite(month) ? month : 1;

  const firstWeekday = new Date(safeYear, safeMonth - 1, 1).getDay();
  const daysInMonth = new Date(safeYear, safeMonth, 0).getDate();

  return {
    year: safeYear,
    month: safeMonth,
    firstWeekday,
    daysInMonth,
  };
}

export function CalendarPage({
  monthKey,
  monthKeys,
  data,
  hoverToneWeights,
  hoverResetSeed,
  onMonthChange,
}: CalendarPageProps) {
  const fallbackChibiSrc = `${import.meta.env.BASE_URL}chibi.png`;
  const chibiSources = CHIBI_IMAGE_SOURCES.length ? CHIBI_IMAGE_SOURCES : [fallbackChibiSrc];
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [temporaryUnlockDate, setTemporaryUnlockDate] = useState<string | null>(null);
  const [primedDateKey, setPrimedDateKey] = useState<string | null>(null);
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);
  const [chibiIndex, setChibiIndex] = useState(0);
  const [showChibi, setShowChibi] = useState(true);
  const [hoverPhraseByDate, setHoverPhraseByDate] = useState<Record<string, string>>({});
  const [monthFadeSeed, setMonthFadeSeed] = useState(0);
  const hoverPhraseByDateRef = useRef<Record<string, string>>({});

  const today = todayDateKey();
  const globalHoverPool = useMemo(() => {
    const pool = getGlobalHoverPoolEntries();
    return pool.length
      ? pool
      : DEFAULT_HOVER_PHRASES.map((phrase) => ({
          phrase,
          category: 'general' as const,
        }));
  }, []);

  function getDateHoverPool(dateKey: string) {
    const hoverPhrases = data[dateKey]?.hoverPhrases;
    if (hoverPhrases?.length) {
      return hoverPhrases;
    }

    return null;
  }

  async function ensureHoverPhrase(dateKey: string) {
    const existing = hoverPhraseByDateRef.current[dateKey];
    if (existing) {
      return existing;
    }

    const datePool = getDateHoverPool(dateKey);
    const phrase = datePool?.length
      ? datePool[Math.floor(Math.random() * datePool.length)]
      : pickHoverPhraseByWeights(globalHoverPool, hoverToneWeights);

    if (!phrase) {
      return '';
    }

    const nextMap = {
      ...hoverPhraseByDateRef.current,
      [dateKey]: phrase,
    };

    hoverPhraseByDateRef.current = nextMap;
    setHoverPhraseByDate(nextMap);

    try {
      await setHoverPhraseMap(nextMap);
    } catch {
      // Keep optimistic local assignment if persistence fails.
    }

    return phrase;
  }

  async function showHoverPreview(dateKey: string) {
    const phrase = await ensureHoverPhrase(dateKey);
    if (!phrase) {
      return;
    }

    setHoverPreview({ dateKey, phrase });
  }

  function getPinnedHoverPhrase(dateKey: string) {
    const existing = hoverPhraseByDateRef.current[dateKey];
    if (existing) {
      return existing;
    }

    return getDateHoverPool(dateKey)?.[0] ?? DEFAULT_HOVER_PHRASES[0];
  }

  useEffect(() => {
    setSelectedDate(null);
    setTemporaryUnlockDate(null);
    setPrimedDateKey(null);
    setHoverPreview(null);
    setMonthFadeSeed((prev) => prev + 1);
  }, [monthKey]);

  useEffect(() => {
    hoverPhraseByDateRef.current = hoverPhraseByDate;
  }, [hoverPhraseByDate]);

  useEffect(() => {
    let active = true;

    void getHoverPhraseMap()
      .then((savedMap) => {
        if (!active) {
          return;
        }

        hoverPhraseByDateRef.current = savedMap;
        setHoverPhraseByDate(savedMap);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        hoverPhraseByDateRef.current = {};
        setHoverPhraseByDate({});
      });

    return () => {
      active = false;
    };
  }, [hoverResetSeed]);

  const monthMeta = useMemo(() => getMonthMeta(monthKey), [monthKey]);

  const dayCells = useMemo(() => {
    const cells: Array<{ dateKey: string; day: number } | null> = [];

    for (let i = 0; i < monthMeta.firstWeekday; i += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= monthMeta.daysInMonth; day += 1) {
      const dateKey = `${monthMeta.year}-${String(monthMeta.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ dateKey, day });
    }

    const remainder = cells.length % 7;
    if (remainder > 0) {
      for (let i = 0; i < 7 - remainder; i += 1) {
        cells.push(null);
      }
    }

    return cells;
  }, [monthMeta.daysInMonth, monthMeta.firstWeekday, monthMeta.month, monthMeta.year]);

  const selectedDay = selectedDate ? data[selectedDate] ?? null : null;
  const selectedMessage = selectedDay?.text ?? null;
  const selectedHoverPhrase = selectedDate ? getPinnedHoverPhrase(selectedDate) : null;
  const selectedUnlocked = !!selectedDate && (selectedDate <= today || temporaryUnlockDate === selectedDate);
  const hoverPreviewLocked = !!hoverPreview && hoverPreview.dateKey > today && temporaryUnlockDate !== hoverPreview.dateKey;

  const currentMonthIndex = monthKeys.findIndex((entry) => entry === monthKey);

  function goToNeighborMonth(offset: -1 | 1) {
    if (currentMonthIndex < 0) {
      return;
    }

    const nextIndex = currentMonthIndex + offset;
    if (nextIndex < 0 || nextIndex >= monthKeys.length) {
      return;
    }

    onMonthChange(monthKeys[nextIndex]);
  }

  function clearCalendarSelection() {
    setPrimedDateKey(null);
    setHoverPreview(null);
  }

  function handleDateTap(dateKey: string, hasMessage: boolean) {
    if (primedDateKey !== dateKey) {
      setPrimedDateKey(dateKey);
      void showHoverPreview(dateKey);
      return;
    }

    if (!hasMessage) {
      return;
    }

    clearCalendarSelection();
    void ensureHoverPhrase(dateKey);
    setSelectedDate(dateKey);
  }

  function handleHoverBubbleTap() {
    if (!hoverPreviewLocked || !hoverPreview) {
      return;
    }

    const approved = window.confirm('要提前解鎖這一天嗎？');
    if (!approved) {
      return;
    }

    setTemporaryUnlockDate(hoverPreview.dateKey);
    setSelectedDate(hoverPreview.dateKey);
    clearCalendarSelection();
  }

  function cycleChibi() {
    if (chibiSources.length <= 1) {
      return;
    }

    setChibiIndex((current) => (current + 1) % chibiSources.length);
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <header className="rounded-2xl border border-stone-300/70 bg-stone-50/90 p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Calendar</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goToNeighborMonth(-1)}
            disabled={currentMonthIndex <= 0}
            className="rounded-lg border border-stone-300 px-3 py-1 text-sm text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <h1 className="text-2xl text-stone-900">{monthLabel(monthKey)}</h1>
          <button
            type="button"
            onClick={() => goToNeighborMonth(1)}
            disabled={currentMonthIndex < 0 || currentMonthIndex >= monthKeys.length - 1}
            className="rounded-lg border border-stone-300 px-3 py-1 text-sm text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="month-select" className="text-xs uppercase tracking-[0.18em] text-stone-500">
            Month
          </label>
          <select
            id="month-select"
            value={monthKey}
            onChange={(event) => onMonthChange(event.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm text-stone-700"
          >
            {monthKeys.map((entry) => (
              <option key={entry} value={entry}>
                {monthLabel(entry)}
              </option>
            ))}
          </select>
        </div>

      </header>

      <div
        key={`${monthKey}-${monthFadeSeed}`}
        className="calendar-month-fade grid grid-cols-7 gap-2 rounded-2xl border border-stone-300/70 bg-white/65 p-3 shadow-sm backdrop-blur-sm"
      >
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday, index) => {
          const weekend = index === 0 || index === 6;
          return (
            <p key={weekday} className={`text-center text-xs uppercase ${weekend ? 'text-rose-500' : 'text-stone-500'}`}>
              {weekday}
            </p>
          );
        })}

        {dayCells.map((cell, index) => {
          if (!cell) {
            return <div key={`blank-${index}`} className="min-h-12 rounded-lg bg-transparent" />;
          }

          const hasMessage = !!data[cell.dateKey];
          const locked = cell.dateKey > today;
          const primed = primedDateKey === cell.dateKey;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => handleDateTap(cell.dateKey, hasMessage)}
              onMouseEnter={() => {
                if (!primedDateKey) {
                  void showHoverPreview(cell.dateKey);
                }
              }}
              onMouseLeave={() => {
                if (!primedDateKey || primedDateKey !== cell.dateKey) {
                  setHoverPreview((current) => (current?.dateKey === cell.dateKey ? null : current));
                }
              }}
              className={`calendar-day-glass relative min-h-12 overflow-visible border px-2 py-1 text-sm transition ${
                !hasMessage
                  ? 'border-stone-200/80 bg-white/35 text-stone-500 hover:border-stone-300'
                  : locked
                    ? 'calendar-day-locked'
                    : 'calendar-day-unlocked'
              } ${primed ? 'calendar-day-armed' : ''}`}
              title={
                !hasMessage
                  ? 'No message for this day'
                  : locked
                    ? 'Tap once for phrase; tap bubble to early unlock'
                    : 'Tap once for phrase, tap again to open'
              }
            >
              <div className="flex items-center justify-between">
                <span>{cell.day}</span>
                {!hasMessage && <span className="text-xs">-</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="calendar-hover-stage min-h-[4.5rem] px-2">
        {hoverPreview ? (
          <div
            className={`calendar-hover-bubble calendar-chat-bubble ml-1 w-fit max-w-[92%] rounded-2xl border px-4 py-2 text-sm text-stone-700 shadow-xl ${
              hoverPreviewLocked ? 'calendar-hover-bubble-locked calendar-hover-bubble-clickable' : 'calendar-hover-bubble-unlocked'
            }`}
            onClick={hoverPreviewLocked ? handleHoverBubbleTap : undefined}
            onKeyDown={
              hoverPreviewLocked
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleHoverBubbleTap();
                    }
                  }
                : undefined
            }
            role={hoverPreviewLocked ? 'button' : undefined}
            tabIndex={hoverPreviewLocked ? 0 : undefined}
            title={hoverPreviewLocked ? '點氣泡可提前解鎖' : undefined}
          >
            {hoverPreview.phrase}
          </div>
        ) : (
          showChibi && (
            <img
              src={chibiSources[chibiIndex]}
              alt="Q版角色"
              className={`calendar-chibi ml-auto mr-2 h-20 w-20 object-contain opacity-85 select-none ${
                chibiSources.length > 1 ? 'calendar-chibi-clickable' : 'pointer-events-none'
              }`}
              loading="lazy"
              onClick={cycleChibi}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  cycleChibi();
                }
              }}
              onError={() => setShowChibi(false)}
              role={chibiSources.length > 1 ? 'button' : undefined}
              tabIndex={chibiSources.length > 1 ? 0 : undefined}
              title={chibiSources.length > 1 ? '點我換下一張' : undefined}
            />
          )
        )}
      </div>

      {selectedDate && (
        <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/45 px-4 pb-4 pt-[10vh] sm:pt-16">
          <div className="w-full max-w-lg rounded-2xl bg-[#fffaf2] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl text-stone-900">{selectedDate}</h2>
                <p className="mt-1 text-stone-600" style={{ fontSize: 'calc(0.9rem * var(--app-font-scale, 1))' }}>
                  {selectedHoverPhrase}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-stone-300 px-3 py-1 text-sm text-stone-600"
                onClick={() => {
                  setSelectedDate(null);
                  setTemporaryUnlockDate(null);
                }}
              >
                Close
              </button>
            </div>

            <p
              className="mt-4 max-h-[58vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-stone-300/70 bg-white/90 p-4 leading-relaxed text-stone-800"
              style={{ fontSize: 'calc(0.92rem * var(--app-font-scale, 1))' }}
            >
              {!selectedMessage
                ? '這天還沒有內容。'
                : selectedUnlocked
                  ? selectedMessage
                  : '這天還沒到，先抱一下再等等我。'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
