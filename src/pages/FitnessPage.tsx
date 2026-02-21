import { useEffect, useMemo, useState } from 'react';

import { CHIBI_POOL_UPDATED_EVENT, getScopedMixedChibiSources } from '../lib/chibiPool';

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionKey = 'meals' | 'exercise' | 'book';

interface WeekData {
  week: number;
  meals: {
    breakfast: { food: string; bubble: string };
    lunch:     { food: string; bubble: string };
    dinner:    { food: string; bubble: string };
  };
  exercise: {
    items:   string[];
    bubbles: string[];
  };
  book: {
    title:  string;
    author: string;
    desc:   string;
    bubble: string;
  };
  closing: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL as string;
function pickRandomIndex(length: number, current?: number) {
  if (length <= 1) {
    return 0;
  }

  const next = Math.floor(Math.random() * length);
  if (typeof current === 'number' && next === current) {
    return (current + 1) % length;
  }

  return next;
}

const MEAL_LABELS = [
  { key: 'breakfast', icon: '🌅', label: '早餐' },
  { key: 'lunch',     icon: '☀️', label: '午餐' },
  { key: 'dinner',    icon: '🌙', label: '晚餐' },
] as const;

const EXERCISE_ICONS = ['🏃', '💪', '🧘'];

// ─── FitnessPage ──────────────────────────────────────────────────────────────

export function FitnessPage() {
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [activeWeek, setActiveWeek] = useState(1);
  const [section, setSection] = useState<SectionKey>('meals');
  const [chibiPoolVersion, setChibiPoolVersion] = useState(0);
  const fallbackChibiSrc = `${BASE}chibi/chibi-00.webp`;
  const chibiSources = useMemo(
    () => {
      const active = getScopedMixedChibiSources('fitness');
      return active.length ? active : [fallbackChibiSrc];
    },
    [fallbackChibiSrc, chibiPoolVersion],
  );
  const [chibiIndex, setChibiIndex] = useState(() => pickRandomIndex(chibiSources.length));
  const [showChibi, setShowChibi] = useState(true);

  useEffect(() => {
    void fetch(`${BASE}data/fitness-weeks.json`)
      .then((r) => r.json())
      .then((d: WeekData[]) => setWeeks(d));
  }, []);

  useEffect(() => {
    const handlePoolUpdate = () => setChibiPoolVersion((current) => current + 1);
    window.addEventListener(CHIBI_POOL_UPDATED_EVENT, handlePoolUpdate);
    return () => window.removeEventListener(CHIBI_POOL_UPDATED_EVENT, handlePoolUpdate);
  }, []);

  const weekOptions = useMemo(
    () =>
      weeks.length
        ? Array.from(new Set(weeks.map((entry) => entry.week))).sort((a, b) => a - b)
        : Array.from({ length: 26 }, (_, index) => index + 1),
    [weeks],
  );
  const week = weeks.find((w) => w.week === activeWeek) ?? null;

  function rotateChibi() {
    setChibiIndex((current) => pickRandomIndex(chibiSources.length, current));
    setShowChibi(true);
  }

  return (
    <div
      className="mx-auto flex w-full max-w-xl flex-col px-4"
      style={{ height: 'calc(100dvh - 72px)' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="calendar-header-panel mb-3 shrink-0 rounded-2xl border p-3 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Week {activeWeek} · 陪練計劃</p>
        <div className="mt-2 flex gap-1.5">
          {(['meals', 'exercise', 'book'] as SectionKey[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={`flex-1 rounded-xl py-1.5 text-xs font-medium transition active:scale-95 ${
                section === s
                  ? 'bg-white/80 text-stone-800 shadow-sm'
                  : 'text-stone-500'
              }`}
            >
              {s === 'meals' ? '🥣 菜單' : s === 'exercise' ? '🏃 運動' : '📖 書單'}
            </button>
          ))}
        </div>
      </header>

      {/* ── Week selector ──────────────────────────────────────────────── */}
      <div
        className="mb-3 shrink-0 rounded-2xl border p-2.5 shadow-sm backdrop-blur"
        style={{
          borderColor: 'rgb(var(--theme-accent-rgb) / 0.48)',
          background:
            'linear-gradient(150deg, rgb(255 255 255 / 0.84) 0%, rgb(var(--theme-accent-rgb) / 0.24) 100%)',
        }}
      >
        <div className="relative">
          <select
            id="fitness-week-select"
            value={activeWeek}
            onChange={(event) => setActiveWeek(Number(event.target.value))}
            aria-label="選擇週數"
            className="w-full appearance-none rounded-xl border px-3 py-2 text-sm text-stone-700 shadow-sm outline-none transition focus:ring-2"
            style={{
              borderColor: 'rgb(var(--theme-accent-rgb) / 0.52)',
              background: 'rgb(255 255 255 / 0.86)',
              boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.75)',
            }}
          >
            {weekOptions.map((weekNumber) => (
              <option key={weekNumber} value={weekNumber}>
                Week {weekNumber}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-stone-600">
            ▾
          </span>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {week ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">

          {/* ── 菜單 ── */}
          {section === 'meals' && (
            <div className="space-y-4">
              {MEAL_LABELS.map(({ key, icon, label }) => {
                const meal = week.meals[key];
                return (
                  <div key={key} className="rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-sm">
                    <p className="mb-1 text-xs font-medium text-stone-500">{icon} {label}</p>
                    <p className="mb-3 text-sm leading-relaxed text-stone-700">{meal.food}</p>
                    <Bubble text={meal.bubble} accent="rose" onTap={rotateChibi} />
                  </div>
                );
              })}
              <ClosingCard text={week.closing} />
            </div>
          )}

          {/* ── 運動 ── */}
          {section === 'exercise' && (
            <div className="space-y-4">
              {week.exercise.items.map((item, i) => (
                <div key={i} className="rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-sm">
                  <p className="mb-1 text-xs font-medium text-stone-500">{EXERCISE_ICONS[i]} 動作 {i + 1}</p>
                  <p className="mb-3 text-sm leading-relaxed text-stone-700">{item}</p>
                  {week.exercise.bubbles[i] && (
                    <Bubble text={week.exercise.bubbles[i]} accent="amber" onTap={rotateChibi} />
                  )}
                </div>
              ))}
              <ClosingCard text={week.closing} />
            </div>
          )}

          {/* ── 書單 ── */}
          {section === 'book' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-stone-200 bg-white/90 px-5 py-5 shadow-sm">
                <h2 className="text-lg leading-snug text-stone-800">{week.book.title}</h2>
                <p className="mt-0.5 text-xs text-stone-400">{week.book.author}</p>
                <p className="mt-3 text-sm leading-relaxed text-stone-600">{week.book.desc}</p>
              </div>
              <Bubble text={week.book.bubble} accent="purple" onTap={rotateChibi} />
              <ClosingCard text={week.closing} />
            </div>
          )}

        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-stone-400">載入中…</p>
        </div>
      )}

      {/* ── Floating chibi (bottom, one per page) ──────────────────────── */}
      <div className="flex shrink-0 justify-center pb-1 pt-1">
        {showChibi && (
          <img
            src={chibiSources[chibiIndex]}
            alt=""
            draggable={false}
            className="calendar-chibi w-[7.5rem] select-none"
            onError={() => setShowChibi(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({
  text,
  accent,
  onTap,
}: {
  text: string;
  accent: 'rose' | 'amber' | 'purple';
  onTap?: () => void;
}) {
  const styles = {
    rose: {
      bg: 'rgb(var(--theme-accent-rgb) / 0.14)',
      border: 'rgb(var(--theme-accent-rgb) / 0.35)',
    },
    amber: {
      bg: 'rgb(var(--theme-accent-rgb) / 0.2)',
      border: 'rgb(var(--theme-accent-rgb) / 0.46)',
    },
    purple: {
      bg: 'rgb(var(--theme-accent-rgb) / 0.26)',
      border: 'rgb(var(--theme-accent-rgb) / 0.56)',
    },
  }[accent];
  const interactive = typeof onTap === 'function';

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onTap}
        className="fitness-bubble w-full rounded-2xl rounded-br-sm px-4 py-3 text-left text-sm leading-relaxed text-stone-700 transition active:scale-[0.99]"
        style={{ background: styles.bg, border: `1px solid ${styles.border}` }}
      >
        {text}
      </button>
    );
  }

  return (
    <div
      className="fitness-bubble rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed text-stone-700"
      style={{ background: styles.bg, border: `1px solid ${styles.border}` }}
    >
      {text}
    </div>
  );
}

// ─── ClosingCard ──────────────────────────────────────────────────────────────

function ClosingCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50/60 px-5 py-4">
      {text.split('\n').map((line, i) => (
        <p key={i} className={`text-sm leading-relaxed text-rose-800 ${i > 0 ? 'mt-2' : ''}`}>
          {line}
        </p>
      ))}
    </div>
  );
}
