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
  scale = 1,
}: {
  hasLetters: boolean;
  onClick: () => void;
  variant: LetterUiVariant;
  scale?: number;
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

  const width = Math.round(176 * scale);
  const height = Math.round(132 * scale);
  const envelopeWidth = Math.round(160 * scale);
  const envelopeHeight = Math.round(112 * scale);
  const ribbonHeight = Math.max(8, Math.round(12 * scale));
  const bowSize = Math.max(26, Math.round(34 * scale));
  const sealSymbol = variant === 'C' ? '✦' : '❤';

  return (
    <button
      type="button"
      onClick={hasLetters ? onClick : undefined}
      disabled={!hasLetters}
      aria-label="隨機抽一封信"
      style={{
        position: 'relative',
        width,
        height,
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
            width: envelopeWidth,
            height: envelopeHeight,
            marginTop: -envelopeHeight / 2,
            marginLeft: -envelopeWidth / 2,
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
          height: ribbonHeight,
          marginTop: -ribbonHeight / 2,
          background: variant === 'B' ? '#B9575F' : variant === 'C' ? '#C8A64E' : '#C4697A',
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
        <svg width={bowSize} height={Math.round(bowSize * 0.7)} viewBox="0 0 34 24" fill="none" aria-hidden="true">
          <ellipse cx="10" cy="12" rx="8.5" ry="5.5" fill="#D4818E" opacity="0.9" />
          <ellipse cx="24" cy="12" rx="8.5" ry="5.5" fill="#D4818E" opacity="0.9" />
          <circle cx="17" cy="12" r="4.2" fill="#C4697A" />
        </svg>
      </div>

      <div
        className="pointer-events-none"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 12,
          fontSize: Math.round(12 * scale),
          color: 'rgba(255,255,255,0.86)',
          textShadow: '0 1px 2px rgba(0,0,0,0.35)',
          lineHeight: 1,
        }}
      >
        {sealSymbol}
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
  const isA = uiVariant === 'A';
  const isB = uiVariant === 'B';
  const isC = uiVariant === 'C';

  const sceneTheme = isA
    ? {
        base: '#2C1810',
        glow: 'radial-gradient(ellipse 78% 52% at 16% 0%, rgba(255,216,158,0.20) 0%, transparent 68%)',
        desk: 'linear-gradient(166deg, #6B4226 0%, #5C3A24 16%, #4E3020 36%, #5A3822 54%, #4A2E1C 70%, #553620 86%, #4E3020 100%)',
        titleText: '#F6E0BD',
        titleMuted: '#D6BC95',
        switchBg: 'rgba(255,248,236,0.46)',
        switchBorder: '1px solid rgba(180,140,90,0.28)',
        switchActive: 'rgba(236,208,168,0.9)',
        switchText: '#4A3520',
        switchMuted: '#8B7355',
      }
    : isB
      ? {
          base: 'radial-gradient(ellipse 100% 80% at 30% 10%, #fff8ef 0%, #fdf0dd 50%, #f8e8cc 100%)',
          glow: 'none',
          desk: '',
          titleText: '#3D2414',
          titleMuted: '#9A8070',
          switchBg: 'rgba(255,255,255,0.74)',
          switchBorder: '1px solid rgba(180,140,90,0.26)',
          switchActive: 'rgba(236,208,168,0.92)',
          switchText: '#5C3B20',
          switchMuted: '#94765D',
        }
      : {
          base: 'radial-gradient(ellipse 80% 60% at 30% 0%, #1e1840 0%, #0d0b1e 55%, #09071a 100%)',
          glow: 'none',
          desk: '',
          titleText: 'rgba(240,235,255,0.95)',
          titleMuted: 'rgba(180,160,220,0.62)',
          switchBg: 'rgba(14,11,30,0.6)',
          switchBorder: '1px solid rgba(255,255,255,0.16)',
          switchActive: 'rgba(120,106,210,0.45)',
          switchText: '#F5EEFF',
          switchMuted: 'rgba(210,198,242,0.74)',
        };

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: sceneTheme.base }}
    >
      {sceneTheme.glow !== 'none' && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: sceneTheme.glow }}
        />
      )}

      {isC && (
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 26 }).map((_, index) => {
            const size = index % 4 === 0 ? 2 : 1.2;
            const top = 4 + ((index * 17) % 52);
            const left = 4 + ((index * 29) % 92);
            const opacity = 0.16 + ((index % 5) * 0.1);
            return (
              <span
                // deterministic pseudo-random placement
                key={`star-${index}`}
                className="absolute rounded-full"
                style={{
                  width: size,
                  height: size,
                  top: `${top}%`,
                  left: `${left}%`,
                  background: 'rgba(255,255,255,0.85)',
                  opacity,
                }}
              />
            );
          })}
          <div className="absolute right-4 top-6 opacity-45">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
              <path d="M38 8c8 9 8 24 0 33c4-3 7-8 8-14c1-7-1-13-5-19l-3 0Z" fill="#E8C870" />
              <circle cx="13" cy="10" r="1.4" fill="rgba(232,224,255,0.78)" />
              <circle cx="49" cy="18" r="1" fill="rgba(232,200,112,0.75)" />
            </svg>
          </div>
          <div className="absolute bottom-48 left-3 opacity-30">
            <svg width="68" height="68" viewBox="0 0 68 68" fill="none" aria-hidden="true">
              <circle cx="10" cy="54" r="2" fill="#E8E0FF" />
              <circle cx="34" cy="30" r="2" fill="#E8E0FF" />
              <circle cx="57" cy="44" r="2" fill="#E8E0FF" />
              <line x1="10" y1="54" x2="34" y2="30" stroke="#E8E0FF" strokeWidth="0.7" />
              <line x1="34" y1="30" x2="57" y2="44" stroke="#E8E0FF" strokeWidth="0.7" />
            </svg>
          </div>
        </div>
      )}

      {onExit && (
        <button
          type="button"
          onClick={onExit}
          aria-label="返回"
          className="absolute left-4 top-4 z-20 flex items-center gap-1.5 transition active:opacity-50"
          style={{ color: isA ? '#8B7355' : isB ? '#8B6B45' : 'rgba(255,255,255,0.72)' }}
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

      <div className="absolute right-4 top-4 z-20">
        <div
          className="flex items-center gap-1 rounded-full px-1.5 py-1"
          style={{
            border: sceneTheme.switchBorder,
            background: sceneTheme.switchBg,
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
                  color: active ? sceneTheme.switchText : sceneTheme.switchMuted,
                  background: active ? sceneTheme.switchActive : 'transparent',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {variant}
              </button>
            );
          })}
        </div>
      </div>

      {!isA && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 text-center">
          <p
            className="text-[9px] tracking-[0.35em] uppercase"
            style={{ color: sceneTheme.titleMuted }}
          >
            Letters
          </p>
          <p className="mt-1 text-[16px]" style={{ color: sceneTheme.titleText }}>
            情書
          </p>
        </div>
      )}

      {isA ? (
        <div
          className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 text-center"
          style={{ top: '11.8%' }}
        >
          <p style={{ color: sceneTheme.titleText, fontSize: 34, letterSpacing: '0.02em', lineHeight: 1.05 }}>
            我愛你
          </p>
          <p style={{ color: sceneTheme.titleText, lineHeight: 1, marginTop: 4 }}>
            <span style={{ fontSize: 94, fontWeight: 800, letterSpacing: -3 }}>{letters.length}</span>
            <span style={{ fontSize: 30, marginLeft: 8 }}>次</span>
          </p>
        </div>
      ) : (
        <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 text-center" style={{ top: '28%' }}>
          <p
            style={{
              fontSize: 64,
              lineHeight: 0.92,
              fontWeight: 800,
              letterSpacing: -3,
              color: sceneTheme.titleText,
            }}
          >
            {letters.length}
          </p>
          <p className="mt-2 text-[13px]" style={{ color: sceneTheme.titleMuted, letterSpacing: '0.06em' }}>
            封思念，等你打開
          </p>
        </div>
      )}

      {isA && (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: '72%',
            background: sceneTheme.desk,
          }}
        >
          <div
            className="pointer-events-none absolute left-0 right-0 top-0"
            style={{
              height: 20,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(2.5deg, transparent, transparent 36px, rgba(0,0,0,0.09) 36px, rgba(0,0,0,0.09) 38px)',
            }}
          />
          <div className="pointer-events-none absolute right-4 top-[5%] opacity-80">
            <DriedFlowers />
          </div>
        </div>
      )}

      <div
        className="absolute z-10"
        style={{
          top: isA ? '35%' : '17%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <LetterPile hasLetters={hasLetters} onClick={onPickRandom} variant={uiVariant} scale={isA ? 1.5 : 1} />
      </div>

      {isB && (
        <>
          <div className="pointer-events-none absolute right-4 top-[10%] opacity-55">
            <DriedFlowers />
          </div>
          <div className="pointer-events-none absolute bottom-10 left-4 flex items-end gap-2">
            <div className="h-[46px] w-[38px] rounded-[4px] border-2 border-[rgba(180,140,80,0.4)] bg-[rgba(255,255,255,0.6)]" />
            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full border-2 border-[rgba(168,64,48,0.28)] text-[10px] text-[rgba(168,64,48,0.7)]">
              POST
            </div>
          </div>
        </>
      )}

      {/* Floating chibi + browse trigger */}
      {chibiSrc && (
        <div
          className="absolute"
          style={{
            bottom: isA ? '4.5%' : '14%',
            left: isA ? '62%' : '53%',
            transform: 'translateX(-50%)',
            width: isA ? 126 : 116,
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
            {!isA && (
              <span
                className="mb-1 block rounded-[14px] px-3 py-2 text-[11px] leading-[1.45] shadow-[0_3px_12px_rgba(0,0,0,0.18)]"
                style={{
                  color: isB ? '#6B5040' : 'rgba(220,210,255,0.88)',
                  background: isB ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.08)',
                  border: isB ? '1px solid rgba(180,140,90,0.18)' : '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: isB ? 'none' : 'blur(8px)',
                }}
              >
                {isB ? '點我看全部信件' : '點我看全部信件'}
              </span>
            )}
            <img src={chibiSrc} alt="" draggable={false} className="calendar-chibi w-full select-none" />
            {!isA && (
              <span className="mt-1 block text-center text-[9px]" style={{ color: sceneTheme.titleMuted }}>
                點一下打開清單
              </span>
            )}
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
  const isB = uiVariant === 'B';
  const isC = uiVariant === 'C';
  const visibleLetters = showFavoritesOnly
    ? letters.filter((letter) => favoritedNames.has(letter.name))
    : letters;

  return (
    <div className="absolute inset-0" style={{ zIndex: 20 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: isC ? 'rgba(5,3,15,0.65)' : 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col overflow-hidden"
        style={{
          borderRadius: '22px 22px 0 0',
          background:
            uiVariant === 'A' ? '#3A1E0F' : uiVariant === 'B' ? 'linear-gradient(170deg, #fdf6e8 0%, #faf0da 100%)' : 'rgba(14,11,30,0.93)',
          border: isC ? '1px solid rgba(255,255,255,0.08)' : 'none',
          borderBottom: 'none',
          backdropFilter: isC ? 'blur(12px)' : 'none',
          maxHeight: '65%',
        }}
      >
        {/* Handle */}
        <div className="flex shrink-0 justify-center pb-2 pt-3">
          <div
            className="h-1 w-10 rounded-full"
            style={{ background: isC ? 'rgba(255,255,255,0.2)' : isB ? 'rgba(180,140,80,0.35)' : 'rgba(255,255,255,0.16)' }}
          />
        </div>

        {/* Title + filter */}
        <div className="shrink-0 px-5 pb-3">
          <div className="flex items-center justify-between gap-3">
            <p
              className="text-xs"
              style={{
                color: isC ? 'rgba(206,196,236,0.78)' : isB ? '#9A8070' : '#C9A87A',
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
                  ? isC
                    ? '#F3EEFF'
                    : isB
                      ? '#A84030'
                      : '#F7EBD2'
                  : isC
                    ? 'rgba(207,197,236,0.76)'
                    : isB
                      ? '#9A8070'
                      : '#D1B992',
                background: showFavoritesOnly
                  ? isC
                    ? 'rgba(126,110,214,0.34)'
                    : isB
                      ? 'rgba(168,64,48,0.12)'
                      : 'rgba(255,255,255,0.11)'
                  : isC
                    ? 'rgba(255,255,255,0.06)'
                    : isB
                      ? 'rgba(0,0,0,0.04)'
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
              style={{ color: isC ? 'rgba(190,176,224,0.62)' : isB ? '#B8A080' : '#A88B62' }}
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
                borderTop:
                  i === 0
                    ? 'none'
                    : `1px solid ${
                        isC ? 'rgba(255,255,255,0.08)' : isB ? 'rgba(180,140,80,0.1)' : 'rgba(255,255,255,0.05)'
                      }`,
                minHeight: 52,
              }}
            >
              <span
                style={{
                  color: isC ? 'rgba(218,204,255,0.72)' : isB ? '#A84030' : '#8B6B3C',
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
                  style={{ color: isC ? 'rgba(244,238,255,0.9)' : isB ? '#3D2414' : '#F0DFB8' }}
                >
                  {stripExt(letter.name)}
                </p>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: isC ? 'rgba(184,170,220,0.62)' : isB ? '#B8A080' : '#8B7355' }}
                >
                  {formatDate(letter.importedAt)}
                </p>
              </div>
              {favoritedNames.has(letter.name) && (
                <span className="pt-0.5 text-sm" style={{ color: isC ? '#E6C56A' : isB ? '#C4697A' : '#D98A95' }}>
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
        {hasMultiple && !showCenteredRerollChibi && (
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
                className="w-14 select-none drop-shadow"
              />
            ) : (
              <span style={{ fontSize: 22, color: theme.iconMuted }}>✉</span>
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
