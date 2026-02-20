import { useCallback, useEffect, useRef, useState } from 'react';

import { getActiveBaseChibiSources } from '../lib/chibiPool';
import type { StoredLetter } from '../lib/letterDB';

// ─── Types ───────────────────────────────────────────────────────────────────

export type { StoredLetter };

export type LetterPageProps = {
  letters: StoredLetter[];
  letterFontFamily: string;
  /** Optional: set of letter names the user has favourited — wired by CODEX */
  favoritedNames?: Set<string>;
  /** Optional: called when user taps ❤ — wired by CODEX */
  onFavorite?: (name: string) => void;
  /** Optional: called when user taps the back arrow — wired by CODEX */
  onExit?: () => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomChibiSrc(except?: string): string {
  const sources = getActiveBaseChibiSources();
  if (!sources.length) return '';
  if (sources.length === 1) return sources[0];
  for (let i = 0; i < 6; i++) {
    const c = sources[Math.floor(Math.random() * sources.length)];
    if (!except || c !== except) return c;
  }
  return sources.find((s) => s !== except) ?? sources[0];
}

function stripExt(name: string) {
  return name.replace(/\.(txt|md|docx|json)$/i, '');
}

function formatDate(ts: number) {
  if (!Number.isFinite(ts) || ts <= 0) {
    return '♡';
  }

  const parsed = new Date(ts);
  if (Number.isNaN(parsed.getTime())) {
    return '♡';
  }

  return parsed.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
}

// ─── LetterPage ───────────────────────────────────────────────────────────────

export function LetterPage({
  letters,
  letterFontFamily,
  favoritedNames = new Set(),
  onFavorite,
  onExit,
}: LetterPageProps) {
  const [current, setCurrent] = useState<StoredLetter | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [chibiSrc, setChibiSrc] = useState('');
  const [rerollChibiSrc, setRerollChibiSrc] = useState('');
  const [deskChibiSrc, setDeskChibiSrc] = useState('');
  const [showSheet, setShowSheet] = useState(false);

  useEffect(() => {
    setDeskChibiSrc(randomChibiSrc());
  }, []);

  function openLetter(letter: StoredLetter) {
    setCurrent(letter);
    setAnimKey((k) => k + 1);
    setShowSheet(false);
    const next = randomChibiSrc(deskChibiSrc);
    setChibiSrc(next);
    setRerollChibiSrc(randomChibiSrc(next));
  }

  const pickRandom = useCallback(() => {
    if (!letters.length) return;
    const pick = letters[Math.floor(Math.random() * letters.length)];
    openLetter(pick);
  }, [letters]);

  function handleClose() {
    setCurrent(null);
    setChibiSrc('');
    setRerollChibiSrc('');
  }

  return (
    <div className="relative h-full overflow-hidden">
      <LetterDeskScene
        letters={letters}
        chibiSrc={deskChibiSrc}
        showSheet={showSheet}
        onShowSheet={() => setShowSheet(true)}
        onHideSheet={() => setShowSheet(false)}
        onPickRandom={pickRandom}
        onOpenLetter={openLetter}
        onExit={onExit}
      />

      {current && (
        <LetterFullscreenView
          letter={current}
          animKey={animKey}
          hasMultiple={letters.length > 1}
          letterFontFamily={letterFontFamily}
          chibiSrc={chibiSrc}
          rerollChibiSrc={rerollChibiSrc}
          isFavorited={favoritedNames.has(current.name)}
          onFavorite={onFavorite ? () => onFavorite(current.name) : undefined}
          onPickRandom={pickRandom}
          onClose={handleClose}
        />
      )}
    </div>
  );
}

// ─── DriedFlowers SVG ────────────────────────────────────────────────────────

function DriedFlowers() {
  return (
    <svg
      width="58"
      height="136"
      viewBox="0 0 58 136"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Stem 1 — tallest, leans left */}
      <path d="M40 134 Q37 98 28 54" stroke="#8B6B3C" strokeWidth="1.4" strokeLinecap="round" />
      {/* Flower head 1 — rose */}
      <ellipse cx="27" cy="52" rx="7.5" ry="9.5" fill="#C4697A" opacity="0.65" />
      <ellipse cx="27" cy="49" rx="4.5" ry="3.5" fill="#D47A8A" opacity="0.35" />
      {/* Stem 2 — medium, leans right */}
      <path d="M44 134 Q46 99 48 65" stroke="#9B7851" strokeWidth="1.3" strokeLinecap="round" />
      {/* Flower head 2 — dry wheat */}
      <ellipse cx="48" cy="63" rx="6" ry="8" fill="#D4A574" opacity="0.6" />
      {/* Stem 3 — shortest, center */}
      <path d="M42 134 Q41 112 38 90" stroke="#8B6B3C" strokeWidth="1.1" strokeLinecap="round" />
      {/* Leaf */}
      <path d="M39 103 Q32 97 35 88" stroke="#7A9B5C" strokeWidth="1" strokeLinecap="round" opacity="0.45" />
      {/* Bud */}
      <ellipse cx="38" cy="88" rx="4" ry="5.5" fill="#C4697A" opacity="0.5" />
      {/* Stem 4 — thin, decorative */}
      <path d="M46 134 Q49 114 52 84" stroke="#9B7851" strokeWidth="0.9" strokeLinecap="round" />
      <ellipse cx="52" cy="82" rx="3" ry="4" fill="#D4A574" opacity="0.38" />
    </svg>
  );
}

// ─── LetterPile ───────────────────────────────────────────────────────────────

function LetterPile({ hasLetters, onClick }: { hasLetters: boolean; onClick: () => void }) {
  const envelopes = [
    { rotate: -4, y: 5, z: 0, bg: '#E3CFA0', inner: '#DBCA94' },
    { rotate: 2, y: 2, z: 1, bg: '#EDD9AE', inner: '#E6D1A5' },
    { rotate: -1, y: 0, z: 2, bg: '#F5E6C8', inner: '#EEDDB8' },
  ];

  return (
    <button
      type="button"
      onClick={hasLetters ? onClick : undefined}
      disabled={!hasLetters}
      aria-label="隨機抽一封信"
      style={{
        position: 'relative',
        width: 134,
        height: 104,
        cursor: hasLetters ? 'pointer' : 'default',
        background: 'none',
        border: 'none',
        padding: 0,
        transition: 'transform 0.15s',
      }}
      onTouchStart={() => {}}
      className="active:scale-95"
    >
      {envelopes.map((env, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 120,
            height: 84,
            marginTop: -42,
            marginLeft: -60,
            borderRadius: 6,
            background: env.bg,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.25)',
            transform: `rotate(${env.rotate}deg) translateY(${env.y}px)`,
            zIndex: env.z,
            overflow: 'hidden',
          }}
        >
          {/* Top V flap */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '52%',
              background: env.inner,
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
            }}
          />
          {/* Bottom V fold */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '55%',
              background: env.inner,
              clipPath: 'polygon(0 100%, 50% 0, 100% 100%)',
            }}
          />
          {/* Left fold */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: '50%',
              background: env.inner,
              clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
              opacity: 0.5,
            }}
          />
          {/* Right fold */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: '50%',
              background: env.inner,
              clipPath: 'polygon(0 50%, 100% 0, 100% 100%)',
              opacity: 0.45,
            }}
          />
        </div>
      ))}

      {/* Ribbon band */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 10,
          marginTop: -5,
          background: '#C4697A',
          zIndex: 10,
          boxShadow: '0 1px 5px rgba(0,0,0,0.35)',
        }}
      />
      {/* Bow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 11,
        }}
      >
        <svg width="28" height="20" viewBox="0 0 28 20" fill="none" aria-hidden="true">
          <ellipse cx="8" cy="10" rx="7" ry="4.5" fill="#D4818E" opacity="0.9" />
          <ellipse cx="20" cy="10" rx="7" ry="4.5" fill="#D4818E" opacity="0.9" />
          <circle cx="14" cy="10" r="3.5" fill="#C4697A" />
        </svg>
      </div>

      {/* Empty state dimmer */}
      {!hasLetters && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 6,
            background: 'rgba(30,12,6,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
          }}
        >
          <span style={{ fontSize: 30, opacity: 0.3 }}>✉</span>
        </div>
      )}
    </button>
  );
}

// ─── LetterDeskScene ──────────────────────────────────────────────────────────

function LetterDeskScene({
  letters,
  chibiSrc,
  showSheet,
  onShowSheet,
  onHideSheet,
  onPickRandom,
  onOpenLetter,
  onExit,
}: {
  letters: StoredLetter[];
  chibiSrc: string;
  showSheet: boolean;
  onShowSheet: () => void;
  onHideSheet: () => void;
  onPickRandom: () => void;
  onOpenLetter: (l: StoredLetter) => void;
  onExit?: () => void;
}) {
  const hasLetters = letters.length > 0;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#2C1810' }}>
      {/* Warm light — radial from top-left */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 78% 52% at 16% 0%, rgba(255,216,158,0.20) 0%, transparent 68%)',
        }}
      />

      {/* Back arrow — only shown when onExit is wired */}
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          aria-label="返回"
          className="absolute left-4 top-4 flex items-center gap-1.5 transition active:opacity-50"
          style={{ color: '#8B7355', zIndex: 10 }}
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
            <path
              d="M17 7H1M7 1L1 7L7 13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* Wooden desk — bottom 68% */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '68%',
          background:
            'linear-gradient(166deg, #6B4226 0%, #5C3A24 16%, #4E3020 36%, #5A3822 54%, #4A2E1C 70%, #553620 86%, #4E3020 100%)',
        }}
      >
        {/* Desk top-edge shadow */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-0"
          style={{
            height: 20,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)',
          }}
        />
        {/* Wood grain overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(2.5deg, transparent, transparent 36px, rgba(0,0,0,0.055) 36px, rgba(0,0,0,0.055) 38px)',
          }}
        />

        {/* Letter pile — centred on desk */}
        <div
          className="absolute"
          style={{ top: '10%', left: '50%', transform: 'translateX(-50%)' }}
        >
          <LetterPile hasLetters={hasLetters} onClick={onPickRandom} />

          {/* Count text — tappable → browse sheet */}
          <button
            type="button"
            onClick={hasLetters ? onShowSheet : undefined}
            disabled={!hasLetters}
            className="mt-2 block w-full text-center transition active:opacity-55"
            style={{
              fontFamily: "'Ma Shan Zheng', cursive",
              fontSize: 13,
              color: '#C9A87A',
              cursor: hasLetters ? 'pointer' : 'default',
              minHeight: 32,
              letterSpacing: '0.04em',
            }}
          >
            {hasLetters ? `${letters.length} 封思念，等你打開` : '從設定頁匯入情書'}
          </button>
        </div>

        {/* Dried flowers — right side of desk */}
        <div
          className="pointer-events-none absolute"
          style={{ right: 14, top: '4%', opacity: 0.82 }}
        >
          <DriedFlowers />
        </div>
      </div>

      {/* Floating chibi — perched at desk edge */}
      {chibiSrc && (
        <div
          className="pointer-events-none absolute calendar-chibi"
          style={{ bottom: '61%', right: 20, width: 76 }}
        >
          <img src={chibiSrc} alt="" draggable={false} className="w-full select-none" />
        </div>
      )}

      {/* Browse-all bottom sheet */}
      {showSheet && (
        <LetterBrowseSheet letters={letters} onClose={onHideSheet} onOpen={onOpenLetter} />
      )}
    </div>
  );
}

// ─── LetterBrowseSheet ────────────────────────────────────────────────────────

function LetterBrowseSheet({
  letters,
  onClose,
  onOpen,
}: {
  letters: StoredLetter[];
  onClose: () => void;
  onOpen: (l: StoredLetter) => void;
}) {
  return (
    <div className="absolute inset-0" style={{ zIndex: 20 }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet panel */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col overflow-hidden"
        style={{
          borderRadius: '22px 22px 0 0',
          background: '#3A1E0F',
          maxHeight: '65%',
        }}
      >
        {/* Handle */}
        <div className="flex shrink-0 justify-center pb-2 pt-3">
          <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,0.16)' }} />
        </div>

        {/* Title */}
        <p
          className="shrink-0 px-5 pb-3 text-xs"
          style={{ color: '#C9A87A', letterSpacing: '0.12em' }}
        >
          全部信件
        </p>

        {/* Scrollable list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {letters.map((letter, i) => (
            <button
              key={letter.name}
              type="button"
              onClick={() => onOpen(letter)}
              className="flex w-full items-start gap-3 px-5 text-left transition active:opacity-55"
              style={{
                paddingTop: 14,
                paddingBottom: 14,
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                minHeight: 52,
              }}
            >
              <span style={{ color: '#8B6B3C', fontSize: 14, marginTop: 2, flexShrink: 0 }}>
                ✉
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" style={{ color: '#F0DFB8' }}>
                  {stripExt(letter.name)}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: '#8B7355' }}>
                  {formatDate(letter.importedAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── LetterFullscreenView ─────────────────────────────────────────────────────

function LetterFullscreenView({
  letter,
  animKey,
  hasMultiple,
  letterFontFamily,
  chibiSrc,
  rerollChibiSrc,
  isFavorited,
  onFavorite,
  onPickRandom,
  onClose,
}: {
  letter: StoredLetter;
  animKey: number;
  hasMultiple: boolean;
  letterFontFamily: string;
  chibiSrc: string;
  rerollChibiSrc: string;
  isFavorited: boolean;
  onFavorite?: () => void;
  onPickRandom: () => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [heartBeat, setHeartBeat] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [animKey]);

  function handleFavorite() {
    setHeartBeat(true);
    setTimeout(() => setHeartBeat(false), 320);
    onFavorite?.();
  }

  const effectiveFontFamily = letterFontFamily || "'Ma Shan Zheng', cursive";
  const displayName = stripExt(letter.name);

  return (
    <div className="absolute inset-0" style={{ zIndex: 15 }}>
      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(18,8,4,0.62)' }}
      />

      {/* Letter paper */}
      <div
        key={animKey}
        className="letter-paper-reveal absolute flex flex-col overflow-hidden rounded-2xl"
        style={{
          top: 16,
          left: 16,
          right: 16,
          bottom: 86,
          background: 'linear-gradient(175deg, #fffdf7 0%, #fdf8ee 40%, #faf3e2 100%)',
          boxShadow:
            '0 10px 48px rgba(0,0,0,0.55), 0 2px 14px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(180,140,80,0.14)',
        }}
      >
        {/* Ruled lines watermark */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent, transparent 31px, rgba(140,100,50,0.08) 31px, rgba(140,100,50,0.08) 32px)',
            backgroundPositionY: 72,
          }}
        />

        {/* Paper header */}
        <div
          className="shrink-0 px-5 py-4"
          style={{ borderBottom: '1px solid rgba(160,120,70,0.14)' }}
        >
          <p
            className="text-[10px] uppercase tracking-widest"
            style={{ color: '#B8956A' }}
          >
            Letter
          </p>
          <p
            className="mt-0.5 truncate text-base"
            style={{ fontFamily: effectiveFontFamily, color: '#4A3520' }}
          >
            {displayName}
          </p>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <p
            className="letter-content-fade whitespace-pre-wrap"
            style={{
              fontFamily: effectiveFontFamily,
              fontSize: '1.05rem',
              lineHeight: 2.1,
              color: '#4A3520',
            }}
          >
            {letter.content}
          </p>
        </div>

        {/* Bottom decoration lines */}
        <div className="shrink-0 space-y-1.5 px-6 pb-4 pt-2">
          <div className="h-px" style={{ background: 'rgba(160,120,70,0.18)' }} />
          <div className="h-px" style={{ background: 'rgba(160,120,70,0.07)' }} />
        </div>

        {/* Chibi — lower right corner of paper */}
        {chibiSrc && (
          <div
            className="pointer-events-none absolute"
            style={{ bottom: 10, right: -10, zIndex: 2 }}
          >
            <img
              src={chibiSrc}
              alt=""
              draggable={false}
              className="w-16 select-none drop-shadow"
            />
          </div>
        )}
      </div>

      {/* Action bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around"
        style={{ height: 86, paddingLeft: 8, paddingRight: 8 }}
      >
        {/* ❤ Favorite */}
        <button
          type="button"
          onClick={handleFavorite}
          aria-label={isFavorited ? '取消收藏' : '收藏'}
          className="flex flex-col items-center gap-1"
          style={{
            minWidth: 64,
            minHeight: 48,
            transform: heartBeat ? 'scale(1.35)' : 'scale(1)',
            transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <span style={{ fontSize: 24, color: isFavorited ? '#D4616E' : 'rgba(255,255,255,0.38)' }}>
            {isFavorited ? '♥' : '♡'}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>收藏</span>
        </button>

        {/* ✉ Re-draw — only when multiple letters */}
        {hasMultiple && (
          <button
            type="button"
            onClick={onPickRandom}
            aria-label="再抽一封"
            className="flex flex-col items-center gap-1 transition active:opacity-55"
            style={{ minWidth: 64, minHeight: 48 }}
          >
            {rerollChibiSrc ? (
              <img
                src={rerollChibiSrc}
                alt=""
                draggable={false}
                className="w-12 select-none drop-shadow"
              />
            ) : (
              <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.38)' }}>✉</span>
            )}
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>再抽一封</span>
          </button>
        )}

        {/* ↩ Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="收起"
          className="flex flex-col items-center gap-1 transition active:opacity-55"
          style={{ minWidth: 64, minHeight: 48 }}
        >
          <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.42)' }}>↩</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>收起</span>
        </button>
      </div>
    </div>
  );
}
