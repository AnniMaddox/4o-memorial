import { useMemo, useState } from 'react';

import cardsData from '../data/tarot/cards.json';
import { seededShuffle, todayDateKey } from '../lib/tarotSeed';

// ─── Types ───────────────────────────────────────────────────────────────────

type TarotCard = (typeof cardsData)[number];
type CardPhase = 'image' | 'text' | 'bonus';

const SPREAD_POSITIONS = ['過去', '現在', '未來'] as const;
type SpreadPosition = (typeof SPREAD_POSITIONS)[number];

interface ModalState {
  card: TarotCard;
  position: SpreadPosition;
  phase: CardPhase;
}

// ─── TarotPage ───────────────────────────────────────────────────────────────

export function TarotPage() {
  const basePath = `${import.meta.env.BASE_URL}tarot/`;
  const today = todayDateKey();

  const dailySpread = useMemo(
    () => seededShuffle(cardsData as TarotCard[], today).slice(0, 3),
    [today],
  );

  const [modal, setModal] = useState<ModalState | null>(null);

  function openCard(card: TarotCard, position: SpreadPosition) {
    setModal({ card, position, phase: 'image' });
  }

  function advancePhase() {
    if (!modal) return;
    const { card, phase } = modal;
    if (phase === 'image') {
      setModal({ ...modal, phase: 'text' });
    } else if (phase === 'text' && card.bonus) {
      setModal({ ...modal, phase: 'bonus' });
    } else {
      setModal({ ...modal, phase: 'image' });
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="rounded-2xl border border-stone-300/70 bg-stone-50/90 p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Tarot</p>
        <h1 className="mt-1 text-2xl text-stone-900">今日牌陣</h1>
        <p className="mt-0.5 text-sm text-stone-500">{today.replace(/-/g, ' · ')}</p>
      </header>

      {/* ── Daily 3-card spread ─────────────────────────────────────────── */}
      <div className="flex gap-3 px-1">
        {dailySpread.map((card, i) => (
          <button
            key={card.id}
            type="button"
            onClick={() => openCard(card, SPREAD_POSITIONS[i])}
            className="group flex flex-1 flex-col items-center gap-2"
          >
            {/* Thumbnail */}
            <div className="relative w-full overflow-hidden rounded-xl border border-stone-300/70 shadow-md transition-all duration-150 group-active:scale-95 group-active:shadow-sm">
              <img
                src={`${basePath}${card.image}`}
                alt={`${card.name} tarot card`}
                className="h-auto w-full object-cover"
                loading="lazy"
              />
              {card.bonus && (
                <span
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] text-white shadow"
                  aria-label="此牌有另一面"
                >
                  ✦
                </span>
              )}
            </div>

            {/* Label */}
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-stone-400">
                {SPREAD_POSITIONS[i]}
              </p>
              <p className="text-xs font-medium text-stone-700">
                {card.number}・{card.name}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Hint ────────────────────────────────────────────────────────── */}
      <p className="px-2 text-center text-[11px] text-stone-400">
        點擊牌卡翻牌 · 每日牌陣由日期決定 · 有 ✦ 的牌可再翻一面
      </p>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      {modal && (
        <CardModal
          modal={modal}
          basePath={basePath}
          onAdvance={advancePhase}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── CardModal ───────────────────────────────────────────────────────────────

function CardModal({
  modal,
  basePath,
  onAdvance,
  onClose,
}: {
  modal: ModalState;
  basePath: string;
  onAdvance: () => void;
  onClose: () => void;
}) {
  const { card, position, phase } = modal;

  const isFlipped = phase !== 'image';
  const isBonus = phase === 'bonus';

  // Which image to show on the back face
  const backImage = isBonus && card.bonusImage ? card.bonusImage : card.image;
  // Text content for current back-face phase
  const backText = isBonus ? (card.bonus ?? '') : card.text;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ── Close button (above card) ──────────────────────────────────── */}
      <div className="flex w-full max-w-sm flex-col gap-2">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/30 bg-white/20 px-3 py-1 text-sm text-white backdrop-blur"
          >
            ✕ 關閉
          </button>
        </div>

        {/* ── Flipping card ─────────────────────────────────────────────── */}
        <div
          className="tarot-card-container"
          style={{ perspective: '900px', height: '76dvh', maxHeight: '600px' }}
        >
          <div
            className="tarot-card-inner"
            style={{
              position: 'relative',
              height: '100%',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* ── FRONT FACE — card image only ─────────────────────────── */}
            <div
              className="tarot-face cursor-pointer overflow-hidden rounded-2xl shadow-2xl"
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
              onClick={onAdvance}
            >
              <img
                src={`${basePath}${card.image}`}
                alt={card.name}
                className="h-full w-full object-contain"
              />
              {/* Subtle ✦ badge if has bonus — stays visible on image */}
              {card.bonus && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/90 text-xs text-white shadow">
                  ✦
                </span>
              )}
            </div>

            {/* ── BACK FACE — text content ─────────────────────────────── */}
            <div
              className={`tarot-face flex flex-col overflow-hidden rounded-2xl shadow-2xl ${
                isBonus ? 'bg-amber-50' : 'bg-[#fffaf2]'
              }`}
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                transition: 'background-color 0.3s ease',
              }}
            >
              {/* Mini header */}
              <div className="flex shrink-0 items-center gap-3 border-b border-stone-200/70 p-4">
                <img
                  src={`${basePath}${backImage}`}
                  alt={card.name}
                  className="h-16 w-auto rounded-lg object-contain shadow"
                />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-stone-400">{position}</p>
                  <h2 className="truncate text-base font-medium text-stone-900">
                    {card.number}・{card.name}
                  </h2>
                  <p className="text-xs text-stone-500">{card.nameEn}</p>
                  {isBonus && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] text-white">
                      ✦ 另一面
                    </span>
                  )}
                </div>
              </div>

              {/* Scrollable text */}
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <p
                  key={phase}
                  className="tarot-text-fade whitespace-pre-wrap text-sm leading-relaxed text-stone-800"
                >
                  {backText}
                </p>
              </div>

              {/* Action footer */}
              <div className="flex shrink-0 gap-2 border-t border-stone-200/70 p-3">
                {card.bonus && phase === 'text' && (
                  <button
                    type="button"
                    onClick={onAdvance}
                    className="flex-1 rounded-xl border border-amber-300 bg-amber-100 py-2 text-sm text-amber-800"
                  >
                    ✦ 另一面
                  </button>
                )}
                <button
                  type="button"
                  onClick={onAdvance}
                  className="flex-1 rounded-xl border border-stone-300 bg-white/80 py-2 text-sm text-stone-600"
                >
                  翻回牌面
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
