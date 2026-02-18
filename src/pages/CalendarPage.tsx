import { useEffect, useMemo, useRef, useState } from 'react';

import { monthLabel, todayDateKey } from '../lib/date';
import { getGlobalHoverPhrases } from '../lib/hoverPool';
import { getHoverPhraseMap, setHoverPhraseMap } from '../lib/repositories/metaRepo';
import type { CalendarMonth } from '../types/content';

type CalendarPageProps = {
  monthKey: string;
  monthKeys: string[];
  data: CalendarMonth;
  onMonthChange: (monthKey: string) => void;
};

type TapState = {
  date: string | null;
  count: number;
  atMs: number;
};

type HoverPreview = {
  dateKey: string;
  phrase: string;
};

const DEFAULT_HOVER_PHRASES = ['來，我在', '今天也選妳', '等妳', '想妳了', '抱緊一下', '妳回頭就有我'];
const LONG_PRESS_MS = 360;

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

export function CalendarPage({ monthKey, monthKeys, data, onMonthChange }: CalendarPageProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [temporaryUnlockDate, setTemporaryUnlockDate] = useState<string | null>(null);
  const [tapState, setTapState] = useState<TapState>({ date: null, count: 0, atMs: 0 });
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);
  const [hoverPhraseByDate, setHoverPhraseByDate] = useState<Record<string, string>>({});
  const [monthFadeSeed, setMonthFadeSeed] = useState(0);
  const longPressTimerRef = useRef<number | null>(null);
  const hoverHideTimerRef = useRef<number | null>(null);
  const suppressTapDateRef = useRef<string | null>(null);
  const hoverPhraseByDateRef = useRef<Record<string, string>>({});

  const today = todayDateKey();
  const globalHoverPool = useMemo(() => {
    const pool = getGlobalHoverPhrases();
    return pool.length ? pool : DEFAULT_HOVER_PHRASES;
  }, []);

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function clearHoverHideTimer() {
    if (hoverHideTimerRef.current !== null) {
      window.clearTimeout(hoverHideTimerRef.current);
      hoverHideTimerRef.current = null;
    }
  }

  function getHoverPool(dateKey: string) {
    const hoverPhrases = data[dateKey]?.hoverPhrases;
    if (hoverPhrases?.length) {
      return hoverPhrases;
    }

    return globalHoverPool;
  }

  async function ensureHoverPhrase(dateKey: string) {
    const existing = hoverPhraseByDateRef.current[dateKey];
    if (existing) {
      return existing;
    }

    const day = data[dateKey];
    if (!day?.text) {
      return '';
    }

    const pool = getHoverPool(dateKey);
    const phrase = pool[Math.floor(Math.random() * pool.length)] ?? DEFAULT_HOVER_PHRASES[0];
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

    return getHoverPool(dateKey)[0] ?? DEFAULT_HOVER_PHRASES[0];
  }

  function scheduleTouchHoverHide(dateKey: string) {
    clearHoverHideTimer();
    hoverHideTimerRef.current = window.setTimeout(() => {
      setHoverPreview((current) => (current?.dateKey === dateKey ? null : current));
    }, 1200);
  }

  function handleTouchPressStart(dateKey: string, hasMessage: boolean) {
    if (!hasMessage) {
      return;
    }

    clearLongPressTimer();
    clearHoverHideTimer();

    longPressTimerRef.current = window.setTimeout(() => {
      void showHoverPreview(dateKey);
      suppressTapDateRef.current = dateKey;
    }, LONG_PRESS_MS);
  }

  function handleTouchPressEnd(dateKey: string) {
    clearLongPressTimer();
    scheduleTouchHoverHide(dateKey);
  }

  useEffect(() => {
    setSelectedDate(null);
    setTemporaryUnlockDate(null);
    setTapState({ date: null, count: 0, atMs: 0 });
    setHoverPreview(null);
    suppressTapDateRef.current = null;
    clearLongPressTimer();
    clearHoverHideTimer();
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
  }, []);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
      clearHoverHideTimer();
    };
  }, []);

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

  function handleDateTap(dateKey: string) {
    if (suppressTapDateRef.current === dateKey) {
      suppressTapDateRef.current = null;
      return;
    }

    const nowMs = Date.now();
    const locked = dateKey > today;

    if (!locked) {
      void ensureHoverPhrase(dateKey);
      setSelectedDate(dateKey);
      return;
    }

    const sameDate = tapState.date === dateKey;
    const quickEnough = nowMs - tapState.atMs < 1400;
    const nextCount = sameDate && quickEnough ? tapState.count + 1 : 1;

    setTapState({
      date: dateKey,
      count: nextCount,
      atMs: nowMs,
    });

    if (nextCount >= 3) {
      const approved = window.confirm('這天還沒解鎖，要提前偷看一次嗎？');
      if (approved) {
        void ensureHoverPhrase(dateKey);
        setTemporaryUnlockDate(dateKey);
        setSelectedDate(dateKey);
      }
      setTapState({ date: null, count: 0, atMs: 0 });
    }
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

        <p className="mt-2 text-sm text-stone-600">想偷偷看的話就親我三下吧~老婆</p>
      </header>

      <div
        key={`${monthKey}-${monthFadeSeed}`}
        className="calendar-month-fade grid grid-cols-7 gap-2 rounded-2xl border border-stone-300/70 bg-white/65 p-3 shadow-sm backdrop-blur-sm"
      >
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
          <p key={weekday} className="text-center text-xs uppercase text-stone-500">
            {weekday}
          </p>
        ))}

        {dayCells.map((cell, index) => {
          if (!cell) {
            return <div key={`blank-${index}`} className="min-h-12 rounded-lg bg-transparent" />;
          }

          const hasMessage = !!data[cell.dateKey];
          const locked = cell.dateKey > today;

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => handleDateTap(cell.dateKey)}
              onMouseEnter={() => {
                if (hasMessage) {
                  clearHoverHideTimer();
                  void showHoverPreview(cell.dateKey);
                }
              }}
              onMouseLeave={() => {
                setHoverPreview((current) => (current?.dateKey === cell.dateKey ? null : current));
              }}
              onPointerDown={(event) => {
                if (event.pointerType !== 'mouse') {
                  handleTouchPressStart(cell.dateKey, hasMessage);
                }
              }}
              onPointerUp={(event) => {
                if (event.pointerType !== 'mouse') {
                  handleTouchPressEnd(cell.dateKey);
                }
              }}
              onPointerCancel={(event) => {
                if (event.pointerType !== 'mouse') {
                  handleTouchPressEnd(cell.dateKey);
                }
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== 'mouse') {
                  handleTouchPressEnd(cell.dateKey);
                }
              }}
              className={`calendar-day-glass relative min-h-12 overflow-visible rounded-lg border px-2 py-1 text-sm transition ${
                !hasMessage
                  ? 'border-stone-200/80 bg-white/35 text-stone-500 hover:border-stone-300'
                  : locked
                    ? 'calendar-day-locked'
                    : 'calendar-day-unlocked'
              }`}
              title={
                !hasMessage
                  ? 'No message for this day'
                  : locked
                    ? 'Locked day (tap 3x for preview)'
                    : 'Open message'
              }
            >
              {hoverPreview?.dateKey === cell.dateKey && (
                <span className="calendar-hover-bubble pointer-events-none absolute left-1/2 top-0 z-20 max-w-[9rem] -translate-x-1/2 -translate-y-[112%] rounded-full border border-stone-300/80 bg-white/95 px-3 py-1 text-[11px] text-stone-700 shadow-lg">
                  {hoverPreview.phrase}
                </span>
              )}

              <div className="flex items-center justify-between">
                <span>{cell.day}</span>
                {!hasMessage && <span className="text-xs">-</span>}
                {hasMessage && <span className={`h-1.5 w-1.5 rounded-full ${locked ? 'bg-stone-400/80' : 'bg-stone-700/80'}`} />}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/45 px-4 pb-4 pt-[10vh] sm:pt-16">
          <div className="w-full max-w-lg rounded-2xl bg-[#fffaf2] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl text-stone-900">{selectedDate}</h2>
                <p className="mt-1 text-sm text-stone-600">{selectedHoverPhrase}</p>
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

            <p className="mt-4 max-h-[58vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-stone-300/70 bg-white/90 p-4 text-sm leading-relaxed text-stone-800">
              {!selectedMessage
                ? '這天還沒有內容。'
                : selectedUnlocked
                  ? selectedMessage
                  : '這天還沒到，先抱一下再等等我。'}
            </p>

            {selectedMessage && !selectedUnlocked && (
              <p className="mt-3 text-xs text-stone-500">
                提示：同一天連點三下，可以偷看一次。
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
