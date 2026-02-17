import { useEffect, useMemo, useState } from 'react';

import { monthLabel, todayDateKey } from '../lib/date';
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

  const today = todayDateKey();

  useEffect(() => {
    setSelectedDate(null);
    setTemporaryUnlockDate(null);
    setTapState({ date: null, count: 0, atMs: 0 });
  }, [monthKey]);

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

  const selectedMessage = selectedDate ? data[selectedDate] ?? null : null;
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
    const nowMs = Date.now();
    const locked = dateKey > today;

    if (!locked) {
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
      const approved = window.confirm('This date is still locked. Unlock once for preview?');
      if (approved) {
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

        <p className="mt-2 text-sm text-stone-600">Locked days require triple tap for one-time early preview.</p>
      </header>

      <div className="grid grid-cols-7 gap-2 rounded-2xl border border-stone-300/70 bg-white/80 p-3 shadow-sm">
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
              className={`min-h-12 rounded-lg border px-2 py-1 text-sm transition ${
                !hasMessage
                  ? 'border-stone-200 bg-stone-100/70 text-stone-500 hover:border-stone-300'
                  : locked
                    ? 'border-stone-300 bg-stone-100/80 text-stone-500 hover:border-stone-400'
                    : 'border-orange-200 bg-orange-50 text-stone-800 hover:border-orange-300'
              }`}
              title={
                !hasMessage
                  ? 'No message for this day'
                  : locked
                    ? 'Locked day (tap 3x for preview)'
                    : 'Open message'
              }
            >
              <div className="flex items-center justify-between">
                <span>{cell.day}</span>
                {!hasMessage && <span className="text-xs">-</span>}
                {hasMessage && locked && <span className="text-xs">lock</span>}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-[#fffaf2] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Daily note</p>
                <h2 className="mt-1 text-xl text-stone-900">{selectedDate}</h2>
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

            <p className="mt-4 whitespace-pre-wrap rounded-xl border border-stone-300/70 bg-white/90 p-4 text-sm leading-relaxed text-stone-800">
              {!selectedMessage
                ? 'No message is set for this date.'
                : selectedUnlocked
                  ? selectedMessage
                  : 'This message is still locked until its date.'}
            </p>

            {selectedMessage && !selectedUnlocked && (
              <p className="mt-3 text-xs text-stone-500">
                Tip: tap this same date cell three times quickly to request one-time preview.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
