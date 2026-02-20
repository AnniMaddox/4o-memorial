import { useEffect, useRef, useState } from 'react';

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

const LOCAL_FAVORITES_KEY = 'memorial-letter-favorites-v1';
const LOCAL_VARIANT_KEY = 'memorial-letter-ui-variant-v1';
const LETTER_VARIANTS = ['A', 'B', 'C'] as const;

type LetterUiVariant = (typeof LETTER_VARIANTS)[number];

const LETTER_CHIBI_MODULES = import.meta.glob('../../public/letter-chibi/*.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const LETTER_CHIBI_SOURCES = Object.entries(LETTER_CHIBI_MODULES)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, src]) => src);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomChibiSrc(except?: string): string {
  const letterSources = LETTER_CHIBI_SOURCES;
  const baseSources = getActiveBaseChibiSources();
  const hasLetterSources = letterSources.length > 0;

  const pickPool = () => {
    if (!hasLetterSources) {
      return baseSources;
    }
    // Prioritize letter-only chibi, then fall back to the global active pool.
    if (baseSources.length === 0) {
      return letterSources;
    }
    return Math.random() < 0.72 ? letterSources : baseSources;
  };

  const firstPool = pickPool();
  if (!firstPool.length) {
    return '';
  }
  if (firstPool.length === 1 && (!except || firstPool[0] !== except)) {
    return firstPool[0];
  }

  for (let i = 0; i < 6; i++) {
    const activePool = pickPool();
    if (!activePool.length) {
      continue;
    }
    const c = activePool[Math.floor(Math.random() * activePool.length)];
    if (!except || c !== except) return c;
  }

  const merged = [...letterSources, ...baseSources];
  return merged.find((s) => s !== except) ?? merged[0] ?? '';
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

function toLetterVariant(input: string | null | undefined): LetterUiVariant {
  return LETTER_VARIANTS.find((variant) => variant === input) ?? 'A';
}

function isNightVariant(variant: LetterUiVariant) {
  return variant !== 'A';
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
  const [deskChibiSrc, setDeskChibiSrc] = useState('');
  const [showSheet, setShowSheet] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [localFavoritedNames, setLocalFavoritedNames] = useState<Set<string>>(new Set<string>());
  const [uiVariant, setUiVariant] = useState<LetterUiVariant>('A');

  useEffect(() => {
    setDeskChibiSrc(randomChibiSrc());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const saved = toLetterVariant(window.localStorage.getItem(LOCAL_VARIANT_KEY));
    setUiVariant(saved);
  }, []);

  useEffect(() => {
    if (onFavorite || typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(LOCAL_FAVORITES_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }
      const next = new Set(parsed.filter((item): item is string => typeof item === 'string'));
      setLocalFavoritedNames(next);
    } catch {
      // ignore malformed local cache
    }
  }, [onFavorite]);

  useEffect(() => {
    if (onFavorite || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(Array.from(localFavoritedNames)));
  }, [localFavoritedNames, onFavorite]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(LOCAL_VARIANT_KEY, uiVariant);
  }, [uiVariant]);

  const effectiveFavoritedNames = onFavorite ? favoritedNames : localFavoritedNames;

  function toggleFavorite(name: string) {
    if (onFavorite) {
      onFavorite(name);
      return;
    }

    setLocalFavoritedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function openLetter(letter: StoredLetter) {
    setCurrent(letter);
    setAnimKey((k) => k + 1);
    setShowSheet(false);
  }

  function pickRandom() {
    if (!letters.length) return;
    const pick = letters[Math.floor(Math.random() * letters.length)];
    openLetter(pick);
  }

  function handleClose() {
    setCurrent(null);
    setDeskChibiSrc((prev) => randomChibiSrc(prev));
  }

  return (
    <div className="relative h-full overflow-hidden">
      <LetterDeskScene
        letters={letters}
        uiVariant={uiVariant}
        chibiSrc={deskChibiSrc}
        favoritedNames={effectiveFavoritedNames}
        showFavoritesOnly={showFavoritesOnly}
        showSheet={showSheet}
        onShowSheet={() => setShowSheet(true)}
        onHideSheet={() => setShowSheet(false)}
        onPickRandom={pickRandom}
        onOpenLetter={openLetter}
        onToggleFavoritesOnly={() => setShowFavoritesOnly((value) => !value)}
        onVariantChange={setUiVariant}
        onExit={onExit}
      />

      {current && (
        <LetterFullscreenView
          letter={current}
          uiVariant={uiVariant}
          animKey={animKey}
          hasMultiple={letters.length > 1}
          letterFontFamily={letterFontFamily}
          rerollChibiSrc={deskChibiSrc}
          isFavorited={effectiveFavoritedNames.has(current.name)}
          onFavorite={() => toggleFavorite(current.name)}
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

function LetterPile({
  hasLetters,
  onClick,
  variant,
}: {
  hasLetters: boolean;
  onClick: () => void;
  variant: LetterUiVariant;
}) {
  const envelopes =
    variant === 'A'
      ? [
          { rotate: -4, y: 5, z: 0, bg: '#E3CFA0', inner: '#DBCA94' },
          { rotate: 2, y: 2, z: 1, bg: '#EDD9AE', inner: '#E6D1A5' },
          { rotate: -1, y: 0, z: 2, bg: '#F5E6C8', inner: '#EEDDB8' },
        ]
      : variant === 'B'
        ? [
            { rotate: -5, y: 5, z: 0, bg: '#2A2448', inner: '#3C3870' },
            { rotate: 3, y: 2, z: 1, bg: '#332D5C', inner: '#4A4488' },
            { rotate: -1, y: 0, z: 2, bg: '#3D3670', inner: '#5A52A0' },
          ]
        : [
            { rotate: -5, y: 5, z: 0, bg: '#222B38', inner: '#324256' },
            { rotate: 3, y: 2, z: 1, bg: '#2B374A', inner: '#3E4F68' },
            { rotate: -1, y: 0, z: 2, bg: '#34445C', inner: '#50627F' },
          ];

  return (
    <button
      type="button"
      onClick={hasLetters ? onClick : undefined}
      disabled={!hasLetters}
      aria-label="隨機抽一封信"
      style={{
        position: 'relative',
        width: 176,
        height: 132,
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
            width: 160,
            height: 112,
            marginTop: -56,
            marginLeft: -80,
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
          height: 12,
          marginTop: -6,
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
        <svg width="34" height="24" viewBox="0 0 34 24" fill="none" aria-hidden="true">
          <ellipse cx="10" cy="12" rx="8.5" ry="5.5" fill="#D4818E" opacity="0.9" />
          <ellipse cx="24" cy="12" rx="8.5" ry="5.5" fill="#D4818E" opacity="0.9" />
          <circle cx="17" cy="12" r="4.2" fill="#C4697A" />
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
          <span style={{ fontSize: 38, opacity: 0.3 }}>✉</span>
        </div>
      )}
    </button>
  );
}

// ─── LetterDeskScene ──────────────────────────────────────────────────────────

function LetterDeskScene({
  letters,
  uiVariant,
  chibiSrc,
  favoritedNames,
  showFavoritesOnly,
  showSheet,
  onShowSheet,
  onHideSheet,
  onPickRandom,
  onOpenLetter,
  onToggleFavoritesOnly,
  onVariantChange,
  onExit,
}: {
  letters: StoredLetter[];
  uiVariant: LetterUiVariant;
  chibiSrc: string;
  favoritedNames: Set<string>;
  showFavoritesOnly: boolean;
  showSheet: boolean;
  onShowSheet: () => void;
  onHideSheet: () => void;
  onPickRandom: () => void;
  onOpenLetter: (l: StoredLetter) => void;
  onToggleFavoritesOnly: () => void;
  onVariantChange: (variant: LetterUiVariant) => void;
  onExit?: () => void;
}) {
  const hasLetters = letters.length > 0;
  const night = isNightVariant(uiVariant);
  const sceneTheme =
    uiVariant === 'A'
      ? {
          base: '#2C1810',
          glow: 'radial-gradient(ellipse 78% 52% at 16% 0%, rgba(255,216,158,0.20) 0%, transparent 68%)',
          countBorder: 'rgba(233,190,132,0.35)',
          countBg: 'linear-gradient(180deg, rgba(105,62,36,0.74) 0%, rgba(74,41,24,0.74) 100%)',
          countText: '#F1DEBC',
          desk: 'linear-gradient(166deg, #6B4226 0%, #5C3A24 16%, #4E3020 36%, #5A3822 54%, #4A2E1C 70%, #553620 86%, #4E3020 100%)',
          flowerOpacity: 0.82,
        }
      : uiVariant === 'B'
        ? {
            base: '#0D0B1E',
            glow: 'radial-gradient(ellipse 85% 58% at 18% 0%, rgba(120,96,210,0.24) 0%, transparent 70%)',
            countBorder: 'rgba(188,164,255,0.32)',
            countBg: 'linear-gradient(180deg, rgba(46,36,92,0.82) 0%, rgba(28,22,58,0.84) 100%)',
            countText: 'rgba(238,230,255,0.94)',
            desk: 'linear-gradient(166deg, #241D48 0%, #2D2559 22%, #1B1740 42%, #2C2556 64%, #1A153B 85%, #241D48 100%)',
            flowerOpacity: 0.5,
          }
        : {
            base: '#111822',
            glow: 'radial-gradient(ellipse 82% 56% at 18% 0%, rgba(92,164,205,0.20) 0%, transparent 69%)',
            countBorder: 'rgba(133,191,220,0.32)',
            countBg: 'linear-gradient(180deg, rgba(44,70,90,0.78) 0%, rgba(27,45,60,0.82) 100%)',
            countText: 'rgba(226,242,252,0.95)',
            desk: 'linear-gradient(166deg, #1E2B39 0%, #243447 22%, #172433 42%, #233446 64%, #152333 85%, #1E2B39 100%)',
            flowerOpacity: 0.46,
          };

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: sceneTheme.base }}>
      {/* Warm light — radial from top-left */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: sceneTheme.glow,
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

      {/* UI variant switch (A/B/C) */}
      <div className="absolute right-4 top-4 z-10">
        <div
          className="flex items-center gap-1 rounded-full px-1.5 py-1"
          style={{
            border: night ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(180,140,90,0.28)',
            background: night ? 'rgba(12,12,22,0.52)' : 'rgba(255,248,236,0.46)',
            backdropFilter: 'blur(6px)',
          }}
        >
          {LETTER_VARIANTS.map((variant) => {
            const active = uiVariant === variant;
            return (
              <button
                key={variant}
                type="button"
                onClick={() => onVariantChange(variant)}
                aria-label={`切換到版型 ${variant}`}
                className="rounded-full px-2.5 py-1 text-[11px] leading-none transition active:scale-95"
                style={{
                  color: active ? (night ? '#F6ECFF' : '#4A3520') : (night ? 'rgba(235,228,255,0.56)' : '#8B7355'),
                  background: active
                    ? uiVariant === 'A'
                      ? 'rgba(236,208,168,0.9)'
                      : uiVariant === 'B'
                        ? 'rgba(130,112,224,0.46)'
                        : 'rgba(94,154,194,0.42)'
                    : 'transparent',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {variant}
              </button>
            );
          })}
        </div>
      </div>

      {/* Love count */}
      <div
        className="pointer-events-none absolute left-1/2"
        style={{
          top: 14,
          transform: 'translateX(-50%)',
          zIndex: 9,
        }}
      >
        <div
          style={{
            minWidth: 190,
            borderRadius: 16,
            border: `1px solid ${sceneTheme.countBorder}`,
            background: sceneTheme.countBg,
            padding: '8px 16px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.22)',
            textAlign: 'center',
          }}
        >
          <p style={{ color: sceneTheme.countText, fontSize: 16, letterSpacing: '0.02em' }}>
            我愛你 <strong style={{ fontSize: 19 }}>{letters.length}</strong> 次
          </p>
        </div>
      </div>

      {/* Wooden desk — bottom 74% */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '74%',
          background: sceneTheme.desk,
        }}
      >
        {/* Desk top-edge shadow */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-0"
          style={{
            height: 20,
            background: night
              ? 'linear-gradient(to bottom, rgba(0,0,0,0.62), transparent)'
              : 'linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)',
          }}
        />
        {/* Wood grain overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(2.5deg, transparent, transparent 36px, rgba(0,0,0,0.09) 36px, rgba(0,0,0,0.09) 38px)',
          }}
        />

        {/* Letter pile — centred on desk */}
        <div
          className="absolute"
          style={{ top: '5%', left: '50%', transform: 'translateX(-50%)' }}
        >
          <LetterPile hasLetters={hasLetters} onClick={onPickRandom} variant={uiVariant} />
        </div>

        {/* Dried flowers — right side of desk */}
        {uiVariant === 'A' && (
          <div
            className="pointer-events-none absolute"
            style={{ right: 14, top: '4%', opacity: sceneTheme.flowerOpacity }}
          >
            <DriedFlowers />
          </div>
        )}
      </div>

      {/* Floating chibi + browse trigger */}
      {chibiSrc && (
        <div
          className="absolute"
          style={{
            bottom: '6%',
            left: '58%',
            transform: 'translateX(-50%)',
            width: 84,
            zIndex: 12,
          }}
        >
          <button
            type="button"
            onClick={hasLetters ? onShowSheet : undefined}
            disabled={!hasLetters}
            className="w-full transition active:scale-95"
            style={{ cursor: hasLetters ? 'pointer' : 'default' }}
          >
            <img src={chibiSrc} alt="" draggable={false} className="calendar-chibi w-full select-none" />
          </button>
        </div>
      )}

      {/* Browse-all bottom sheet */}
      {showSheet && (
        <LetterBrowseSheet
          letters={letters}
          uiVariant={uiVariant}
          onClose={onHideSheet}
          onOpen={onOpenLetter}
          favoritedNames={favoritedNames}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavoritesOnly={onToggleFavoritesOnly}
        />
      )}
    </div>
  );
}

// ─── LetterBrowseSheet ────────────────────────────────────────────────────────

function LetterBrowseSheet({
  letters,
  uiVariant,
  onClose,
  onOpen,
  favoritedNames,
  showFavoritesOnly,
  onToggleFavoritesOnly,
}: {
  letters: StoredLetter[];
  uiVariant: LetterUiVariant;
  onClose: () => void;
  onOpen: (l: StoredLetter) => void;
  favoritedNames: Set<string>;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
}) {
  const night = isNightVariant(uiVariant);
  const visibleLetters = showFavoritesOnly
    ? letters.filter((letter) => favoritedNames.has(letter.name))
    : letters;

  return (
    <div className="absolute inset-0" style={{ zIndex: 20 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: night ? 'rgba(3,4,10,0.68)' : 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col overflow-hidden"
        style={{
          borderRadius: '22px 22px 0 0',
          background:
            uiVariant === 'A'
              ? '#3A1E0F'
              : uiVariant === 'B'
                ? 'rgba(14,11,30,0.93)'
                : 'rgba(14,20,28,0.93)',
          border: night ? '1px solid rgba(255,255,255,0.08)' : 'none',
          borderBottom: 'none',
          backdropFilter: night ? 'blur(12px)' : 'none',
          maxHeight: '65%',
        }}
      >
        {/* Handle */}
        <div className="flex shrink-0 justify-center pb-2 pt-3">
          <div
            className="h-1 w-10 rounded-full"
            style={{ background: night ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.16)' }}
          />
        </div>

        {/* Title + filter */}
        <div className="shrink-0 px-5 pb-3">
          <div className="flex items-center justify-between gap-3">
            <p
              className="text-xs"
              style={{
                color: night ? 'rgba(206,196,236,0.78)' : '#C9A87A',
                letterSpacing: '0.12em',
              }}
            >
              {showFavoritesOnly ? '收藏信件' : '全部信件'}
            </p>
            <button
              type="button"
              onClick={onToggleFavoritesOnly}
              className="rounded-full px-3 py-1 text-xs transition active:scale-95"
              style={{
                border: '1px solid rgba(255,255,255,0.2)',
                color: showFavoritesOnly
                  ? night
                    ? '#F3EEFF'
                    : '#F7EBD2'
                  : night
                    ? 'rgba(207,197,236,0.76)'
                    : '#D1B992',
                background: showFavoritesOnly
                  ? night
                    ? 'rgba(126,110,214,0.34)'
                    : 'rgba(255,255,255,0.11)'
                  : night
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.14)',
              }}
            >
              {showFavoritesOnly ? '♥ 只看收藏' : '♡ 全部'}
            </button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleLetters.length === 0 && (
            <p
              className="px-5 py-8 text-sm"
              style={{ color: night ? 'rgba(190,176,224,0.62)' : '#A88B62' }}
            >
              還沒有收藏的信件
            </p>
          )}
          {visibleLetters.map((letter, i) => (
            <button
              key={`${letter.name}-${letter.importedAt}-${i}`}
              type="button"
              onClick={() => onOpen(letter)}
              className="flex w-full items-start gap-3 px-5 text-left transition active:opacity-55"
              style={{
                paddingTop: 14,
                paddingBottom: 14,
                borderTop: i === 0 ? 'none' : `1px solid ${night ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)'}`,
                minHeight: 52,
              }}
            >
              <span
                style={{
                  color: night ? 'rgba(218,204,255,0.72)' : '#8B6B3C',
                  fontSize: 14,
                  marginTop: 2,
                  flexShrink: 0,
                }}
              >
                ✉
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm"
                  style={{ color: night ? 'rgba(244,238,255,0.9)' : '#F0DFB8' }}
                >
                  {stripExt(letter.name)}
                </p>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: night ? 'rgba(184,170,220,0.62)' : '#8B7355' }}
                >
                  {formatDate(letter.importedAt)}
                </p>
              </div>
              {favoritedNames.has(letter.name) && (
                <span className="pt-0.5 text-sm" style={{ color: night ? '#E6C56A' : '#D98A95' }}>
                  ♥
                </span>
              )}
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
  uiVariant,
  animKey,
  hasMultiple,
  letterFontFamily,
  rerollChibiSrc,
  isFavorited,
  onFavorite,
  onPickRandom,
  onClose,
}: {
  letter: StoredLetter;
  uiVariant: LetterUiVariant;
  animKey: number;
  hasMultiple: boolean;
  letterFontFamily: string;
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
  const night = isNightVariant(uiVariant);
  const showCenteredRerollChibi = night && hasMultiple && !!rerollChibiSrc;
  const theme =
    uiVariant === 'A'
      ? {
          overlay: 'rgba(18,8,4,0.62)',
          bar: 'linear-gradient(to top, rgba(8,2,1,0.74), rgba(8,2,1,0.18))',
          iconMuted: 'rgba(255,255,255,0.38)',
          labelMuted: 'rgba(255,255,255,0.35)',
          closeIcon: 'rgba(255,255,255,0.42)',
          favOn: '#D4616E',
          paperShadow:
            '0 10px 48px rgba(0,0,0,0.55), 0 2px 14px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(180,140,80,0.14)',
        }
      : uiVariant === 'B'
        ? {
            overlay: 'radial-gradient(ellipse 60% 50% at 50% 40%,rgba(60,50,120,0.42) 0%,rgba(8,6,20,0.92) 100%)',
            bar: 'rgba(8,6,20,0.86)',
            iconMuted: 'rgba(240,233,255,0.62)',
            labelMuted: 'rgba(190,176,224,0.62)',
            closeIcon: 'rgba(240,233,255,0.7)',
            favOn: '#E8C060',
            paperShadow:
              '0 20px 82px rgba(0,0,0,0.72), 0 4px 28px rgba(0,0,0,0.48), 0 0 60px rgba(200,160,80,0.10), inset 0 0 0 1px rgba(180,140,80,0.14)',
          }
        : {
            overlay: 'radial-gradient(ellipse 62% 52% at 50% 40%,rgba(40,78,118,0.42) 0%,rgba(5,13,22,0.92) 100%)',
            bar: 'rgba(5,13,22,0.86)',
            iconMuted: 'rgba(226,243,255,0.66)',
            labelMuted: 'rgba(172,206,229,0.66)',
            closeIcon: 'rgba(226,243,255,0.74)',
            favOn: '#67C8FF',
            paperShadow:
              '0 20px 82px rgba(0,0,0,0.72), 0 4px 28px rgba(0,0,0,0.48), 0 0 60px rgba(108,192,230,0.12), inset 0 0 0 1px rgba(180,140,80,0.14)',
          };

  return (
    <div className="absolute inset-0" style={{ zIndex: 15 }}>
      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ background: theme.overlay }}
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
          boxShadow: theme.paperShadow,
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

      </div>

      {showCenteredRerollChibi && (
        <button
          type="button"
          onClick={onPickRandom}
          aria-label="再抽一封"
          className="absolute z-20 flex flex-col items-center gap-1 transition active:scale-95"
          style={{ bottom: 70, left: '50%', transform: 'translateX(-50%)' }}
        >
          <img
            src={rerollChibiSrc}
            alt=""
            draggable={false}
            className="calendar-chibi w-16 select-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]"
          />
          <span style={{ fontSize: 10, color: theme.labelMuted }}>再抽一封</span>
        </button>
      )}

      {/* Action bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around"
        style={{
          height: 86,
          paddingLeft: 8,
          paddingRight: 8,
          background: theme.bar,
          backdropFilter: night ? 'blur(10px)' : 'none',
          borderTop: night ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
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
          <span style={{ fontSize: 24, color: isFavorited ? theme.favOn : theme.iconMuted }}>
            {isFavorited ? '♥' : '♡'}
          </span>
          <span style={{ fontSize: 10, color: theme.labelMuted }}>收藏</span>
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
            {showCenteredRerollChibi ? (
              <span style={{ fontSize: 22, color: theme.iconMuted }}>✉</span>
            ) : (
              rerollChibiSrc ? (
                <img
                  src={rerollChibiSrc}
                  alt=""
                  draggable={false}
                  className="w-14 select-none drop-shadow"
                />
              ) : (
                <span style={{ fontSize: 22, color: theme.iconMuted }}>✉</span>
              )
            )}
            <span style={{ fontSize: 10, color: theme.labelMuted }}>再抽一封</span>
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
          <span style={{ fontSize: 24, color: theme.closeIcon }}>✕</span>
          <span style={{ fontSize: 10, color: theme.labelMuted }}>收起</span>
        </button>
      </div>
    </div>
  );
}
