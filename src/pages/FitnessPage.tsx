import { useEffect, useRef, useState } from 'react';

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
const CHIBI_COUNT = 35;

function randomChibiSrc() {
  const idx = Math.floor(Math.random() * CHIBI_COUNT) + 1;
  return `${BASE}chibi/chibi-${String(idx).padStart(2, '0')}.png`;
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
  const [chibiSrc] = useState(randomChibiSrc);
  const weekRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch(`${BASE}data/fitness-weeks.json`)
      .then((r) => r.json())
      .then((d: WeekData[]) => setWeeks(d));
  }, []);

  useEffect(() => {
    const row = weekRowRef.current;
    if (!row) return;
    const chip = row.querySelector<HTMLElement>(`[data-week="${activeWeek}"]`);
    chip?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
  }, [activeWeek]);

  const week = weeks.find((w) => w.week === activeWeek) ?? null;

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
        ref={weekRowRef}
        className="mb-3 flex shrink-0 gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {Array.from({ length: 26 }, (_, i) => i + 1).map((w) => (
          <button
            key={w}
            type="button"
            data-week={w}
            onClick={() => setActiveWeek(w)}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
              w === activeWeek
                ? 'bg-rose-400 text-white shadow-sm'
                : 'border border-stone-200 bg-white/80 text-stone-500'
            }`}
          >
            W{w}
          </button>
        ))}
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
                    <Bubble text={meal.bubble} accent="rose" />
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
                    <Bubble text={week.exercise.bubbles[i]} accent="amber" />
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
              <Bubble text={week.book.bubble} accent="purple" />
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
        <img
          src={chibiSrc}
          alt=""
          draggable={false}
          className="calendar-chibi w-20 select-none"
        />
      </div>
    </div>
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({
  text,
  accent,
}: {
  text: string;
  accent: 'rose' | 'amber' | 'purple';
}) {
  const styles = {
    rose:   { bg: '#fff0f3', border: '#fecdd3' },
    amber:  { bg: '#fffbeb', border: '#fde68a' },
    purple: { bg: '#f5f0ff', border: '#ddd6fe' },
  }[accent];

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
