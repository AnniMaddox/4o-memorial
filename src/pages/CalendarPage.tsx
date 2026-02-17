import { useMemo, useState } from 'react';

import { monthLabel, todayDateKey } from '../lib/date';
import type { CalendarMonth } from '../types/content';

type CalendarPageProps = {
  monthKey: string;
  data: CalendarMonth;
};

export function CalendarPage({ monthKey, data }: CalendarPageProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [temporaryUnlockDate, setTemporaryUnlockDate] = useState<string | null>(null);
  const [tapState, setTapState] = useState<{ date: string | null; count: number; atMs: number }>({
    date: null,
    count: 0,
    atMs: 0,
  });

  const today = todayDateKey();

  const allDates = useMemo(() => Object.keys(data).sort((a, b) => a.localeCompare(b)), [data]);

  const selectedMessage = selectedDate ? data[selectedDate] : null;
  const selectedUnlocked =
    !!selectedDate && (selectedDate <= today || temporaryUnlockDate === selectedDate);

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
        <h1 className="mt-1 text-2xl text-stone-900">{monthLabel(monthKey)}</h1>
        <p className="mt-2 text-sm text-stone-600">Locked days require triple tap for one-time early preview.</p>
      </header>

      <div className="grid grid-cols-7 gap-2 rounded-2xl border border-stone-300/70 bg-white/80 p-3 shadow-sm">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
          <p key={weekday} className="text-center text-xs uppercase text-stone-500">
            {weekday}
          </p>
        ))}

        {allDates.map((dateKey) => {
          const day = Number(dateKey.slice(-2));
          const locked = dateKey > today;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => handleDateTap(dateKey)}
              className={`min-h-12 rounded-lg border px-2 py-1 text-sm transition ${
                locked
                  ? 'border-stone-300 bg-stone-100/80 text-stone-500 hover:border-stone-400'
                  : 'border-orange-200 bg-orange-50 text-stone-800 hover:border-orange-300'
              }`}
              title={locked ? 'Locked day (tap 3x for preview)' : 'Open message'}
            >
              <div className="flex items-center justify-between">
                <span>{day}</span>
                {locked && <span className="text-xs">lock</span>}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDate && selectedMessage && (
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
              {selectedUnlocked ? selectedMessage : 'This message is still locked until its date.'}
            </p>

            {!selectedUnlocked && (
              <p className="mt-3 text-xs text-stone-500">Tip: tap this same date cell three times quickly to request one-time preview.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
