import { useEffect, useRef, useState } from 'react';

import { getActiveBaseChibiSources } from '../lib/chibiPool';
import type { StoredLetter } from '../lib/letterDB';
import type { LetterUiMode } from '../types/settings';

// ─── Types ───────────────────────────────────────────────────────────────────

export type { StoredLetter };

export type LetterPageProps = {
  letters: StoredLetter[];
  letterFontFamily: string;
  uiMode?: LetterUiMode;
  /** Optional: set of letter names the user has favourited — wired by CODEX */
  favoritedNames?: Set<string>;
  /** Optional: called when user taps ❤ — wired by CODEX */
  onFavorite?: (name: string) => void;
  /** Optional: called when user taps the back arrow — wired by CODEX */
  onExit?: () => void;
};

const LOCAL_FAVORITES_KEY = 'memorial-letter-favorites-v1';
const LOCAL_VARIANT_CLASSIC_KEY = 'memorial-letter-ui-variant-v1';
const LOCAL_VARIANT_PREVIEW_KEY = 'memorial-letter-ui-variant-preview-v1';
const LETTER_VARIANTS = ['A', 'B', 'C'] as const;
const PREVIEW_VARIANTS = ['B', 'C'] as const;

type LetterUiVariant = (typeof LETTER_VARIANTS)[number];
type PreviewLetterVariant = (typeof PREVIEW_VARIANTS)[number];

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

function getAvailableVariants(uiMode: LetterUiMode): readonly LetterUiVariant[] {
  return uiMode === 'preview' ? PREVIEW_VARIANTS : LETTER_VARIANTS;
}

function isNightVariant(variant: LetterUiVariant) {
  return variant !== 'A';
}

// ─── LetterPage ───────────────────────────────────────────────────────────────

export function LetterPage({
  letters,
  letterFontFamily,
  uiMode = 'classic',
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
  const availableVariants = getAvailableVariants(uiMode);

  useEffect(() => {
    setDeskChibiSrc(randomChibiSrc());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storageKey = uiMode === 'preview' ? LOCAL_VARIANT_PREVIEW_KEY : LOCAL_VARIANT_CLASSIC_KEY;
    const saved = toLetterVariant(window.localStorage.getItem(storageKey));
    setUiVariant(availableVariants.includes(saved) ? saved : availableVariants[0]);
  }, [availableVariants, uiMode]);

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
    if (!availableVariants.includes(uiVariant)) {
      return;
    }
    const storageKey = uiMode === 'preview' ? LOCAL_VARIANT_PREVIEW_KEY : LOCAL_VARIANT_CLASSIC_KEY;
    window.localStorage.setItem(storageKey, uiVariant);
  }, [availableVariants, uiMode, uiVariant]);

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
      {uiMode === 'preview' ? (
        <PreviewLetterDeskScene
          letters={letters}
          uiVariant={(uiVariant === 'A' ? 'B' : uiVariant) as PreviewLetterVariant}
          variants={availableVariants}
          chibiSrc={deskChibiSrc}
          favoritedNames={effectiveFavoritedNames}
          showFavoritesOnly={showFavoritesOnly}
          showSheet={showSheet}
          onShowSheet={() => setShowSheet(true)}
          onHideSheet={() => setShowSheet(false)}
          onPickRandom={pickRandom}
          onOpenLetter={openLetter}
          onToggleFavoritesOnly={() => setShowFavoritesOnly((value) => !value)}
          onVariantChange={(variant) => setUiVariant(availableVariants.includes(variant) ? variant : availableVariants[0])}
          onExit={onExit}
        />
      ) : (
        <LetterDeskScene
          letters={letters}
          uiVariant={uiVariant}
          variants={availableVariants}
          chibiSrc={deskChibiSrc}
          favoritedNames={effectiveFavoritedNames}
          showFavoritesOnly={showFavoritesOnly}
          showSheet={showSheet}
          onShowSheet={() => setShowSheet(true)}
          onHideSheet={() => setShowSheet(false)}
          onPickRandom={pickRandom}
          onOpenLetter={openLetter}
          onToggleFavoritesOnly={() => setShowFavoritesOnly((value) => !value)}
          onVariantChange={(variant) => setUiVariant(availableVariants.includes(variant) ? variant : availableVariants[0])}
          onExit={onExit}
        />
      )}

      {current && (
        uiMode === 'preview' ? (
          <PreviewLetterFullscreenView
            letter={current}
            uiVariant={(uiVariant === 'A' ? 'B' : uiVariant) as PreviewLetterVariant}
            animKey={animKey}
            hasMultiple={letters.length > 1}
            letterFontFamily={letterFontFamily}
            rerollChibiSrc={deskChibiSrc}
            isFavorited={effectiveFavoritedNames.has(current.name)}
            onFavorite={() => toggleFavorite(current.name)}
            onPickRandom={pickRandom}
            onClose={handleClose}
          />
        ) : (
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
        )
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

function PressedFlowerCluster({
  arrangement = 'single',
  tone = 'rose',
}: {
  arrangement?: 'single' | 'double';
  tone?: 'rose' | 'peach' | 'mauve';
}) {
  const palette =
    tone === 'peach'
      ? { petal: '#DDB89F', core: '#B68767' }
      : tone === 'mauve'
        ? { petal: '#CF9CB3', core: '#AA6780' }
        : { petal: '#D7A1AF', core: '#B26A7B' };

  const blossoms =
    arrangement === 'double'
      ? [
          { x: 16, y: 13, scale: 1 },
          { x: 34, y: 10, scale: 0.84 },
        ]
      : [{ x: 18, y: 12, scale: 1 }];
  const width = arrangement === 'double' ? 46 : 30;

  return (
    <svg
      width={width}
      height="24"
      viewBox={`0 0 ${width} 24`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d={arrangement === 'double' ? 'M4 21Q20 14 42 19' : 'M3 21Q12 16 27 19'}
        stroke="rgba(122,155,92,0.34)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {blossoms.map((flower, index) => (
        <g
          key={`pressed-flower-${arrangement}-${index}`}
          transform={`translate(${flower.x} ${flower.y}) scale(${flower.scale})`}
          opacity="0.75"
        >
          <circle cx="0" cy="-2.4" r="2.2" fill={palette.petal} />
          <circle cx="2.3" cy="-0.8" r="2.2" fill={palette.petal} />
          <circle cx="1.4" cy="1.9" r="2.2" fill={palette.petal} />
          <circle cx="-1.4" cy="1.9" r="2.2" fill={palette.petal} />
          <circle cx="-2.3" cy="-0.8" r="2.2" fill={palette.petal} />
          <circle cx="0" cy="0" r="1.5" fill={palette.core} />
        </g>
      ))}
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
            { rotate: -4, y: 5, z: 0, bg: '#D8E9CB', inner: '#CDE0BE' },
            { rotate: 2, y: 2, z: 1, bg: '#E6F2DC', inner: '#D8E9CB' },
            { rotate: -1, y: 0, z: 2, bg: '#F0F8E9', inner: '#E2F0D8' },
          ]
        : [
            { rotate: -4, y: 5, z: 0, bg: '#C8D8E8', inner: '#B8CCE0' },
            { rotate: 2, y: 2, z: 1, bg: '#D6E3EF', inner: '#C7D8E8' },
            { rotate: -1, y: 0, z: 2, bg: '#E4EDF5', inner: '#D8E5F1' },
          ];

  const width = Math.round(176 * scale);
  const height = Math.round(132 * scale);
  const envelopeWidth = Math.round(160 * scale);
  const envelopeHeight = Math.round(112 * scale);
  const ribbonHeight = Math.max(8, Math.round(12 * scale));
  const bowSize = Math.max(26, Math.round(34 * scale));
  const sealSymbol = variant === 'C' ? '✦' : '❤';
  const ribbonColor = variant === 'A' ? '#C4697A' : variant === 'B' ? '#86AD76' : '#6F98C0';
  const bowColor = variant === 'A' ? '#D4818E' : variant === 'B' ? '#A7C791' : '#97BEDD';
  const bowCenterColor = variant === 'A' ? '#C4697A' : variant === 'B' ? '#789E65' : '#6F98C0';

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
          background: ribbonColor,
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
          <ellipse cx="10" cy="12" rx="8.5" ry="5.5" fill={bowColor} opacity="0.9" />
          <ellipse cx="24" cy="12" rx="8.5" ry="5.5" fill={bowColor} opacity="0.9" />
          <circle cx="17" cy="12" r="4.2" fill={bowCenterColor} />
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
  variants,
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
  variants: readonly LetterUiVariant[];
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
  const bFlowerDecor: Array<{
    top: string;
    left: string;
    rotate: number;
    scale: number;
    opacity: number;
    arrangement: 'single' | 'double';
    tone: 'rose' | 'peach' | 'mauve';
  }> = [
    { top: '15%', left: '8%', rotate: -16, scale: 0.94, opacity: 0.58, arrangement: 'double', tone: 'mauve' },
    { top: '24%', left: '91%', rotate: 11, scale: 0.78, opacity: 0.5, arrangement: 'single', tone: 'peach' },
    { top: '37%', left: '6%', rotate: -9, scale: 0.72, opacity: 0.46, arrangement: 'single', tone: 'rose' },
    { top: '47%', left: '93%', rotate: 13, scale: 0.84, opacity: 0.55, arrangement: 'double', tone: 'mauve' },
    { top: '61%', left: '11%', rotate: -12, scale: 0.8, opacity: 0.48, arrangement: 'single', tone: 'peach' },
    { top: '73%', left: '90%', rotate: 8, scale: 0.74, opacity: 0.44, arrangement: 'single', tone: 'rose' },
    { top: '83%', left: '14%', rotate: -6, scale: 0.7, opacity: 0.4, arrangement: 'double', tone: 'peach' },
  ];

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
        deskGrain:
          'repeating-linear-gradient(2.5deg, transparent, transparent 36px, rgba(0,0,0,0.09) 36px, rgba(0,0,0,0.09) 38px)',
        backIcon: '#8B7355',
        flowerOpacity: 0.8,
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
          deskGrain: 'none',
          backIcon: '#8B6B45',
          flowerOpacity: 0,
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
          deskGrain: 'none',
          backIcon: 'rgba(255,255,255,0.72)',
          flowerOpacity: 0,
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
          style={{ color: sceneTheme.backIcon }}
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
          {variants.map((variant) => {
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
        <p className="mt-2 text-[11px]" style={{ color: sceneTheme.titleMuted, letterSpacing: '0.14em' }}>
          每封都在等你打開
        </p>
      </div>

      {isB && (
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 3 }}>
          {bFlowerDecor.map((decor, index) => (
            <div
              key={`b-flower-${index}`}
              className="absolute"
              style={{
                top: decor.top,
                left: decor.left,
                opacity: decor.opacity,
                transform: `translate(-50%, -50%) rotate(${decor.rotate}deg) scale(${decor.scale})`,
              }}
            >
              <PressedFlowerCluster arrangement={decor.arrangement} tone={decor.tone} />
            </div>
          ))}
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
            style={{ background: sceneTheme.deskGrain }}
          />
          <div className="pointer-events-none absolute right-4 top-[5%]" style={{ opacity: sceneTheme.flowerOpacity }}>
            <DriedFlowers />
          </div>
        </div>
      )}

      <div
        className="absolute z-10"
        style={{
          top: '35%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <LetterPile hasLetters={hasLetters} onClick={onPickRandom} variant={uiVariant} scale={1.5} />
      </div>

      {/* Floating chibi + browse trigger */}
      {chibiSrc && (
        <div
          className="absolute"
          style={{
            bottom: '4.5%',
            left: '62%',
            transform: 'translateX(-50%)',
            width: 126,
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
            <img
              src={chibiSrc}
              alt=""
              draggable={false}
              className="calendar-chibi w-full select-none"
            />
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

// ─── Preview B/C Scene ────────────────────────────────────────────────────────

function PreviewNightStars() {
  const stars = [
    { top: '8%', left: '15%', size: 1.5, delay: 0 },
    { top: '12%', left: '72%', size: 2, delay: 0.8 },
    { top: '5%', left: '45%', size: 1, delay: 1.4 },
    { top: '20%', left: '85%', size: 1.5, delay: 0.3 },
    { top: '28%', left: '8%', size: 1, delay: 1.8 },
    { top: '18%', left: '30%', size: 2, delay: 0.6 },
    { top: '35%', left: '92%', size: 1, delay: 1.2 },
    { top: '15%', left: '55%', size: 1.5, delay: 0.4 },
    { top: '42%', left: '20%', size: 1, delay: 2 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((star, index) => (
        <span
          key={`preview-star-${index}`}
          className="absolute rounded-full"
          style={{
            width: star.size,
            height: star.size,
            top: star.top,
            left: star.left,
            background: '#fff',
            animation: `letter-twinkle 3s ease-in-out ${star.delay}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

function PreviewMoonDeco({ faded = false }: { faded?: boolean }) {
  return (
    <div className="pointer-events-none absolute right-6 top-[18px]" style={{ opacity: faded ? 0.15 : 1 }}>
      <svg width="58" height="68" viewBox="0 0 58 68" fill="none" aria-hidden="true">
        <path d="M38 8Q52 20 50 40Q48 58 34 64Q46 58 50 44Q54 28 42 12Q40 10 38 8Z" fill="#E8C870" opacity="0.18" />
        <circle cx="28" cy="36" r="18" fill="none" stroke="#E8C870" strokeWidth="0.5" opacity="0.1" />
        <circle cx="14" cy="12" r="1.5" fill="#E8E0FF" opacity="0.4" />
        <circle cx="50" cy="20" r="1" fill="#E8C870" opacity="0.5" />
        <circle cx="8" cy="30" r="1" fill="#E8E0FF" opacity="0.35" />
      </svg>
    </div>
  );
}

function PreviewConstellationDeco() {
  return (
    <div className="pointer-events-none absolute bottom-[220px] left-[14px] opacity-[0.18]">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="10" cy="54" r="2" fill="#E8E0FF" />
        <circle cx="32" cy="32" r="2" fill="#E8E0FF" />
        <circle cx="54" cy="44" r="2" fill="#E8E0FF" />
        <circle cx="22" cy="14" r="1.5" fill="#E8E0FF" />
        <circle cx="50" cy="10" r="1.5" fill="#E8C870" />
        <line x1="10" y1="54" x2="32" y2="32" stroke="#E8E0FF" strokeWidth="0.6" />
        <line x1="32" y1="32" x2="54" y2="44" stroke="#E8E0FF" strokeWidth="0.6" />
        <line x1="32" y1="32" x2="22" y2="14" stroke="#E8E0FF" strokeWidth="0.6" />
        <line x1="22" y1="14" x2="50" y2="10" stroke="#E8C870" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

function PreviewBotanicalDeco({ faded = false }: { faded?: boolean }) {
  return (
    <div className="pointer-events-none absolute right-[18px] top-3" style={{ opacity: faded ? 0.3 : 0.55 }}>
      <svg width="72" height="90" viewBox="0 0 72 90" fill="none" aria-hidden="true">
        <path d="M54 88Q50 60 38 28" stroke="#9B8B5C" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M38 28Q20 22 24 8" stroke="#7A9B5C" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
        <ellipse cx="24" cy="10" rx="8" ry="12" fill="#9EB870" opacity="0.35" transform="rotate(-20 24 10)" />
        <path d="M44 50Q62 42 60 28" stroke="#7A9B5C" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        <ellipse cx="61" cy="29" rx="7" ry="10" fill="#9EB870" opacity="0.3" transform="rotate(15 61 29)" />
        <ellipse cx="37" cy="26" rx="9" ry="11" fill="#D4829A" opacity="0.55" />
        <ellipse cx="37" cy="22" rx="5.5" ry="4" fill="#E498B0" opacity="0.45" />
        <ellipse cx="37" cy="25" rx="3" ry="2.5" fill="#C4607A" opacity="0.4" />
        <ellipse cx="58" cy="27" rx="5" ry="6.5" fill="#C4828A" opacity="0.4" />
        <circle cx="30" cy="44" r="3" fill="#D4A0B0" opacity="0.3" />
        <circle cx="48" cy="38" r="2.5" fill="#C4B090" opacity="0.28" />
      </svg>
    </div>
  );
}

function PreviewEnvelopeStack({
  variant,
  hasLetters,
  onClick,
}: {
  variant: PreviewLetterVariant;
  hasLetters: boolean;
  onClick: () => void;
}) {
  const isB = variant === 'B';
  const envelopes = isB
    ? [
        { bg: '#E8D5A8', flap: '#D0B86E', transform: 'rotate(-7deg) translate(-4px, 8px)', z: 1, shadow: '0 8px 28px rgba(90,50,20,0.28)' },
        { bg: '#EDE0B8', flap: '#D9C078', transform: 'rotate(3deg) translate(2px, 3px)', z: 2, shadow: '0 8px 28px rgba(90,50,20,0.22)' },
        { bg: '#F7E8C4', flap: '#E8D090', transform: 'rotate(-1.5deg)', z: 3, shadow: '0 8px 28px rgba(90,50,20,0.18)' },
      ]
    : [
        { bg: '#2A2448', flap: '#3C3870', transform: 'rotate(-7deg) translate(-4px, 8px)', z: 1, shadow: '0 8px 28px rgba(0,0,0,0.55),0 0 20px rgba(100,80,200,0.12)' },
        { bg: '#332D5C', flap: '#4A4488', transform: 'rotate(3deg) translate(2px, 3px)', z: 2, shadow: '0 8px 28px rgba(0,0,0,0.5),0 0 20px rgba(100,80,200,0.1)' },
        { bg: '#3D3670', flap: '#5A52A0', transform: 'rotate(-1.5deg)', z: 3, shadow: '0 8px 32px rgba(0,0,0,0.55),0 0 30px rgba(120,100,220,0.2),inset 0 1px 0 rgba(255,255,255,0.08)' },
      ];

  return (
    <button
      type="button"
      onClick={hasLetters ? onClick : undefined}
      disabled={!hasLetters}
      aria-label="隨機抽一封信"
      className="active:scale-95"
      style={{
        position: 'relative',
        width: 200,
        height: 150,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: hasLetters ? 'pointer' : 'default',
        transition: 'transform 0.18s',
      }}
    >
      {envelopes.map((env, index) => (
        <div
          key={`${variant}-env-${index}`}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 180,
            height: 124,
            marginTop: -62,
            marginLeft: -90,
            borderRadius: 10,
            overflow: 'hidden',
            background: env.bg,
            transform: env.transform,
            zIndex: env.z,
            boxShadow: env.shadow,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '55%',
              background: env.flap,
              clipPath: 'polygon(0 0,100% 0,50% 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '58%',
              background: env.flap,
              clipPath: 'polygon(0 100%,50% 0,100% 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: '50%',
              background: env.flap,
              opacity: 0.45,
              clipPath: 'polygon(0 0,100% 50%,0 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: '50%',
              background: env.flap,
              opacity: 0.4,
              clipPath: 'polygon(0 50%,100% 0,100% 100%)',
            }}
          />
        </div>
      ))}

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 42,
          height: 42,
          transform: 'translate(-50%,-50%)',
          zIndex: 10,
          borderRadius: '50%',
          background:
            variant === 'B'
              ? 'radial-gradient(circle at 36% 32%, #D96858, #A84030 60%, #8A3028)'
              : 'radial-gradient(circle at 36% 32%, #D4C060, #C0A030 60%, #A08820)',
          boxShadow:
            variant === 'B'
              ? '0 3px 10px rgba(168,64,48,0.55), inset 0 1px 0 rgba(255,255,255,0.15)'
              : '0 3px 14px rgba(200,160,40,0.45), 0 0 20px rgba(200,160,40,0.2), inset 0 1px 0 rgba(255,255,255,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.9)',
          fontSize: 15,
        }}
      >
        {variant === 'B' ? '♡' : '✦'}
      </div>

      {!hasLetters && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            background: 'rgba(0,0,0,0.25)',
            zIndex: 20,
          }}
        />
      )}
    </button>
  );
}

function PreviewLetterDeskScene({
  letters,
  uiVariant,
  variants,
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
  uiVariant: PreviewLetterVariant;
  variants: readonly LetterUiVariant[];
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
  const isB = uiVariant === 'B';
  const switchVariants = variants.filter((variant): variant is PreviewLetterVariant => variant !== 'A');

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: isB
          ? 'radial-gradient(ellipse 100% 80% at 30% 10%, #fff8ef 0%, #fdf0dd 50%, #f8e8cc 100%)'
          : 'radial-gradient(ellipse 80% 60% at 30% 0%, #1e1840 0%, #0d0b1e 55%, #09071a 100%)',
      }}
    >
      {!isB && <PreviewNightStars />}
      {isB ? <PreviewBotanicalDeco faded={!hasLetters} /> : <PreviewMoonDeco faded={!hasLetters} />}

      {!isB && hasLetters && <PreviewConstellationDeco />}

      {onExit && (
        <button
          type="button"
          onClick={onExit}
          aria-label="返回"
          className="absolute left-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full transition active:opacity-55"
          style={{
            background: isB ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.06)',
            border: isB ? '1px solid rgba(180,140,90,0.25)' : '1px solid rgba(255,255,255,0.12)',
            color: isB ? '#8B6B45' : 'rgba(255,255,255,0.72)',
            boxShadow: isB ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
            <path d="M17 7H1M7 1L1 7L7 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      <div className="pointer-events-none absolute left-1/2 top-[18px] z-10 -translate-x-1/2 text-center">
        <p
          className="text-[9px] uppercase"
          style={{
            letterSpacing: '0.32em',
            color: isB ? '#B8A080' : 'rgba(180,160,230,0.5)',
          }}
        >
          LETTERS
        </p>
        <p className="mt-0.5 text-base" style={{ color: isB ? '#3D2414' : 'rgba(240,235,255,0.9)' }}>
          情書
        </p>
      </div>

      <div className="absolute right-4 top-16 z-20">
        <div
          className="flex items-center gap-1 rounded-full px-1.5 py-1"
          style={{
            border: isB ? '1px solid rgba(180,140,90,0.24)' : '1px solid rgba(255,255,255,0.16)',
            background: isB ? 'rgba(255,255,255,0.72)' : 'rgba(14,11,30,0.6)',
            backdropFilter: 'blur(6px)',
          }}
        >
          {switchVariants.map((variant) => {
            const active = uiVariant === variant;
            return (
              <button
                key={`preview-switch-${variant}`}
                type="button"
                onClick={() => onVariantChange(variant)}
                className="rounded-full px-2.5 py-1 text-[11px] leading-none transition active:scale-95"
                style={{
                  color: isB
                    ? active
                      ? '#4A3520'
                      : '#94765D'
                    : active
                      ? '#F5EEFF'
                      : 'rgba(210,198,242,0.74)',
                  background: active
                    ? isB
                      ? 'rgba(236,208,168,0.92)'
                      : 'rgba(120,106,210,0.45)'
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

      {hasLetters ? (
        <>
          <div className="absolute left-1/2 z-10 -translate-x-1/2" style={{ top: isB ? '22%' : '23%' }}>
            <PreviewEnvelopeStack variant={uiVariant} hasLetters={hasLetters} onClick={onPickRandom} />
          </div>
          <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 text-center" style={{ top: isB ? '45%' : '46%' }}>
            <p
              style={{
                fontSize: 64,
                lineHeight: 1,
                fontWeight: 800,
                letterSpacing: -3,
                color: isB ? '#3D2414' : 'rgba(240,235,255,0.95)',
                textShadow: isB ? '0 2px 0 rgba(200,140,80,0.25)' : '0 0 40px rgba(180,150,255,0.35),0 2px 0 rgba(0,0,0,0.4)',
              }}
            >
              {letters.length}
            </p>
            <p
              className="mt-1.5 text-[13px]"
              style={{
                color: isB ? '#9A8070' : 'rgba(180,160,220,0.6)',
                letterSpacing: '0.06em',
              }}
            >
              封思念，靜靜等你
            </p>
          </div>
        </>
      ) : (
        <div className="absolute left-1/2 z-10 w-full -translate-x-1/2 px-5 text-center" style={{ top: '24%' }}>
          <div className="mx-auto h-[110px] w-[160px] overflow-hidden rounded-lg border"
            style={{
              background: isB ? '#EEE2C8' : '#1E1C40',
              borderColor: isB ? 'rgba(180,140,80,0.3)' : 'rgba(120,100,200,0.2)',
              boxShadow: isB ? '0 6px 20px rgba(90,50,20,0.18)' : '0 6px 20px rgba(0,0,0,0.45), 0 0 20px rgba(100,80,200,0.12)',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                clipPath: 'polygon(0 0,100% 0,50% 100%)',
                height: '55%',
                background: isB ? '#DFD0A8' : '#2E2A60',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                top: '42%',
                clipPath: 'polygon(0 100%,50% 0,100% 100%)',
                background: isB ? '#D8C898' : '#282450',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                opacity: isB ? 0.22 : 0.15,
                color: isB ? '#3D2414' : '#E8E0FF',
              }}
            >
              ✉
            </div>
          </div>
          <p className="mt-9 text-[22px] font-bold" style={{ color: isB ? '#3D2414' : 'rgba(230,225,255,0.9)' }}>
            信箱還是空的
          </p>
          <p
            className="mt-2 text-[13px]"
            style={{ color: isB ? '#B8A080' : 'rgba(180,160,220,0.5)', lineHeight: 1.6 }}
          >
            還沒有收到情書。{'\n'}去設定頁匯入第一封吧。
          </p>
        </div>
      )}

      {isB && hasLetters && (
        <div className="pointer-events-none absolute bottom-7 left-5 z-[7] flex items-end gap-2">
          <div className="flex h-[46px] w-[38px] flex-col items-center justify-center gap-0.5 rounded border-2 bg-white/60" style={{ borderColor: 'rgba(180,140,80,0.4)' }}>
            <span className="text-base">🌸</span>
            <span className="text-[7px]" style={{ color: '#B8A080', letterSpacing: '0.05em' }}>LOVE</span>
          </div>
          <div className="flex h-[46px] w-[38px] flex-col items-center justify-center gap-0.5 rounded border-2 bg-white/60" style={{ borderColor: 'rgba(180,140,80,0.4)' }}>
            <span className="text-base">✉</span>
            <span className="text-[7px]" style={{ color: '#B8A080', letterSpacing: '0.05em' }}>MAIL</span>
          </div>
          <div
            className="flex h-[50px] w-[50px] flex-col items-center justify-center gap-0.5 rounded-full border-2"
            style={{ borderColor: 'rgba(168,64,48,0.3)', opacity: 0.65 }}
          >
            <span className="text-[6px] font-semibold" style={{ color: '#A84030' }}>2024</span>
            <span className="text-[6px] font-semibold" style={{ color: '#A84030' }}>TO YOU</span>
            <span className="text-[6px] font-semibold" style={{ color: '#A84030' }}>♡</span>
          </div>
        </div>
      )}

      {chibiSrc && (
        <div
          className="absolute z-10"
          style={{
            bottom: 112,
            left: '50%',
            transform: 'translateX(-15%)',
            width: 'min(170px, 46vw)',
          }}
        >
          <button
            type="button"
            onClick={hasLetters ? onShowSheet : undefined}
            disabled={!hasLetters}
            className="w-full transition active:scale-95"
            style={{ cursor: hasLetters ? 'pointer' : 'default' }}
          >
            <div
              className="mx-auto mb-2 max-w-[130px] rounded-[14px] px-3 py-2 text-[11px]"
              style={{
                borderRadius: isB ? '14px 14px 14px 2px' : '14px 14px 14px 2px',
                color: isB ? '#6B5040' : 'rgba(220,210,255,0.85)',
                lineHeight: 1.45,
                background: hasLetters
                  ? isB
                    ? 'rgba(255,255,255,0.88)'
                    : 'rgba(255,255,255,0.08)'
                  : isB
                    ? 'rgba(255,255,255,0.82)'
                    : 'rgba(255,255,255,0.06)',
                border: isB ? 'none' : '1px solid rgba(255,255,255,0.12)',
                boxShadow: isB ? '0 3px 12px rgba(90,50,20,0.14)' : 'none',
                backdropFilter: isB ? 'none' : 'blur(8px)',
                textAlign: 'center',
              }}
            >
              {hasLetters ? '每封都有你。' : '等信的感覺…'}
            </div>
            <img
              src={chibiSrc}
              alt=""
              draggable={false}
              className="calendar-chibi mx-auto select-none"
              style={{ width: '100%', maxHeight: 208, objectFit: 'contain' }}
            />
            {hasLetters && (
              <p className="mt-1 text-[9px]" style={{ color: isB ? 'rgba(139,107,69,0.5)' : 'rgba(180,160,220,0.4)', letterSpacing: '0.04em' }}>
                點我看全部
              </p>
            )}
          </button>
        </div>
      )}

      {showSheet && (
        <PreviewLetterBrowseSheet
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

function PreviewLetterBrowseSheet({
  letters,
  uiVariant,
  onClose,
  onOpen,
  favoritedNames,
  showFavoritesOnly,
  onToggleFavoritesOnly,
}: {
  letters: StoredLetter[];
  uiVariant: PreviewLetterVariant;
  onClose: () => void;
  onOpen: (l: StoredLetter) => void;
  favoritedNames: Set<string>;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
}) {
  const isB = uiVariant === 'B';
  const favoritesCount = letters.filter((letter) => favoritedNames.has(letter.name)).length;
  const visibleLetters = showFavoritesOnly
    ? letters.filter((letter) => favoritedNames.has(letter.name))
    : letters;
  const favOn = isB ? '♥' : '★';
  const favOff = isB ? '♡' : '☆';

  return (
    <div className="absolute inset-0" style={{ zIndex: 24 }}>
      <div
        className="absolute inset-0"
        style={{ background: isB ? 'rgba(30,14,6,0.45)' : 'rgba(5,3,15,0.65)' }}
        onClick={onClose}
      />

      <div
        className="absolute bottom-0 left-0 right-0 flex max-h-[72%] flex-col overflow-hidden"
        style={{
          borderRadius: '26px 26px 0 0',
          background: isB ? 'linear-gradient(170deg, #fdf6e8 0%, #faf0da 100%)' : 'rgba(14,11,30,0.93)',
          backdropFilter: isB ? 'none' : 'blur(20px)',
          border: isB ? 'none' : '1px solid rgba(255,255,255,0.06)',
          borderBottom: 'none',
          boxShadow: isB ? '0 -8px 32px rgba(60,30,10,0.22)' : '0 -8px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex shrink-0 justify-center pb-[14px] pt-3">
          <div
            className="h-1 w-10 rounded-full"
            style={{ background: isB ? 'rgba(180,140,80,0.35)' : 'rgba(255,255,255,0.15)' }}
          />
        </div>

        <div
          className="shrink-0 px-[22px] pb-3"
          style={{ borderBottom: isB ? '1px solid rgba(180,140,80,0.18)' : '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-semibold" style={{ color: isB ? '#3D2414' : 'rgba(230,225,255,0.9)' }}>
              {showFavoritesOnly ? `${favOn} 收藏信件` : '全部信件'}
            </span>
            <span className="text-xs" style={{ color: isB ? '#B8A080' : 'rgba(180,160,220,0.5)' }}>
              {visibleLetters.length} 封
            </span>
          </div>
        </div>

        <div
          className="flex shrink-0 gap-2 px-[22px] py-2.5"
          style={{ borderBottom: isB ? '1px solid rgba(180,140,80,0.1)' : '1px solid rgba(255,255,255,0.04)' }}
        >
          <button
            type="button"
            onClick={() => {
              if (showFavoritesOnly) {
                onToggleFavoritesOnly();
              }
            }}
            className="rounded-[20px] px-[14px] py-[5px] text-xs font-medium transition active:scale-95"
            style={{
              border: !showFavoritesOnly
                ? isB
                  ? '1px solid rgba(168,64,48,0.28)'
                  : '1px solid rgba(200,160,80,0.28)'
                : isB
                  ? '1px solid rgba(0,0,0,0.08)'
                  : '1px solid rgba(255,255,255,0.08)',
              background: !showFavoritesOnly
                ? isB
                  ? 'rgba(168,64,48,0.12)'
                  : 'rgba(200,160,80,0.12)'
                : isB
                  ? 'rgba(0,0,0,0.04)'
                  : 'rgba(255,255,255,0.04)',
              color: !showFavoritesOnly ? (isB ? '#A84030' : '#E8C870') : isB ? '#9A8070' : 'rgba(180,160,220,0.5)',
            }}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => {
              if (!showFavoritesOnly) {
                onToggleFavoritesOnly();
              }
            }}
            className="rounded-[20px] px-[14px] py-[5px] text-xs font-medium transition active:scale-95"
            style={{
              border: showFavoritesOnly
                ? isB
                  ? '1px solid rgba(168,64,48,0.28)'
                  : '1px solid rgba(200,160,80,0.28)'
                : isB
                  ? '1px solid rgba(0,0,0,0.08)'
                  : '1px solid rgba(255,255,255,0.08)',
              background: showFavoritesOnly
                ? isB
                  ? 'rgba(168,64,48,0.12)'
                  : 'rgba(200,160,80,0.12)'
                : isB
                  ? 'rgba(0,0,0,0.04)'
                  : 'rgba(255,255,255,0.04)',
              color: showFavoritesOnly ? (isB ? '#A84030' : '#E8C870') : isB ? '#9A8070' : 'rgba(180,160,220,0.5)',
            }}
          >
            {favOn} 收藏 {favoritesCount}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {visibleLetters.length === 0 && (
            <p className="px-[22px] py-6 text-sm" style={{ color: isB ? '#9A8070' : 'rgba(180,160,220,0.5)' }}>
              還沒有收藏的信件
            </p>
          )}
          {visibleLetters.map((letter, index) => {
            const favored = favoritedNames.has(letter.name);
            return (
              <button
                key={`${letter.name}-${letter.importedAt}-${index}`}
                type="button"
                onClick={() => onOpen(letter)}
                className="flex w-full items-center gap-3 px-[22px] py-[13px] text-left transition active:opacity-60"
                style={{
                  borderBottom:
                    index === visibleLetters.length - 1
                      ? 'none'
                      : isB
                        ? '1px solid rgba(180,140,80,0.1)'
                        : '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <span
                  className="relative h-[26px] w-9 shrink-0 overflow-hidden rounded"
                  style={{
                    background: isB ? 'linear-gradient(140deg,#f0dab2,#e8cc98)' : 'linear-gradient(140deg,#2a2450,#3a3268)',
                    border: isB ? '1px solid rgba(180,140,80,0.25)' : '1px solid rgba(120,100,200,0.25)',
                  }}
                >
                  <span
                    className="absolute left-0 right-0 top-0 h-[55%]"
                    style={{ background: isB ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.15)', clipPath: 'polygon(0 0,100% 0,50% 100%)' }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13px] font-medium"
                    style={{ color: isB ? '#3D2414' : 'rgba(230,225,255,0.85)' }}
                  >
                    {stripExt(letter.name)}
                  </span>
                  <span className="mt-0.5 block text-[10px]" style={{ color: isB ? '#B8A080' : 'rgba(180,160,220,0.45)' }}>
                    {formatDate(letter.importedAt)}
                  </span>
                </span>
                <span
                  className="text-base"
                  style={{ color: favored ? (isB ? '#C4697A' : '#E8C060') : isB ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)' }}
                >
                  {favored ? favOn : favOff}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PreviewLetterFullscreenView({
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
  uiVariant: PreviewLetterVariant;
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
  const isB = uiVariant === 'B';

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
  const rerollLabel = hasMultiple ? '再抽一封' : '再看一次';
  const rerollDisplaySrc = rerollChibiSrc || LETTER_CHIBI_SOURCES[0] || getActiveBaseChibiSources()[0] || '';
  const theme = isB
    ? {
        overlay: 'radial-gradient(ellipse 80% 60% at 20% 85%, rgba(120,60,20,0.55) 0%, rgba(20,8,2,0.80) 100%)',
        actionBarBg: 'transparent',
        actionBarBorder: 'none',
        iconMuted: 'rgba(255,255,255,0.38)',
        labelMuted: 'rgba(255,255,255,0.35)',
        favOn: '#D4616E',
        favoriteOnIcon: '♥',
        favoriteOffIcon: '♡',
        stampIcon: '🌸',
        stampLabel: 'LOVE',
        paperShadow:
          '0 20px 60px rgba(0,0,0,0.55), 0 4px 20px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(190,150,80,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
        chibiCardBg: 'linear-gradient(145deg, #fde9d7, #f0ddd0)',
        chibiCardBorder: '1px solid rgba(255,255,255,0.16)',
        chibiCardShadow: '0 8px 24px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.18)',
        floatLabelColor: 'rgba(255,255,255,0.3)',
      }
    : {
        overlay: 'radial-gradient(ellipse 60% 50% at 50% 40%,rgba(60,50,120,0.4) 0%,rgba(8,6,20,0.92) 100%)',
        actionBarBg: 'rgba(8,6,20,0.85)',
        actionBarBorder: '1px solid rgba(255,255,255,0.04)',
        iconMuted: 'rgba(255,255,255,0.3)',
        labelMuted: 'rgba(180,160,220,0.4)',
        favOn: '#E8C060',
        favoriteOnIcon: '★',
        favoriteOffIcon: '☆',
        stampIcon: '✦',
        stampLabel: '夜',
        paperShadow:
          '0 20px 80px rgba(0,0,0,0.7), 0 4px 30px rgba(0,0,0,0.5), 0 0 60px rgba(200,160,80,0.08), inset 0 0 0 1px rgba(200,160,80,0.14), inset 0 1px 0 rgba(255,255,255,0.85)',
        chibiCardBg: 'linear-gradient(145deg, rgba(120,100,200,0.3), rgba(80,60,160,0.2))',
        chibiCardBorder: '1px solid rgba(255,255,255,0.1)',
        chibiCardShadow: '0 8px 24px rgba(0,0,0,0.55), 0 0 20px rgba(120,100,220,0.2)',
        floatLabelColor: 'rgba(180,160,220,0.35)',
      };

  return (
    <div className="absolute inset-0" style={{ zIndex: 15 }}>
      <div className="absolute inset-0" style={{ background: theme.overlay }} />

      <div
        key={animKey}
        className="letter-paper-reveal absolute flex flex-col overflow-hidden rounded-[22px]"
        style={{
          top: 14,
          left: 14,
          right: 14,
          bottom: 80,
          background: 'linear-gradient(175deg, #fffdf7 0%, #fdf9ee 45%, #faf4e2 100%)',
          boxShadow: theme.paperShadow,
          zIndex: 12,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[22px]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent, transparent 32px, rgba(150,110,55,0.07) 32px, rgba(150,110,55,0.07) 33px)',
            backgroundPositionY: 82,
          }}
        />

        <div
          className="pointer-events-none absolute right-5 top-[18px] flex h-10 w-8 flex-col items-center justify-center gap-0.5 rounded border"
          style={{
            border: '1.5px solid rgba(180,140,80,0.35)',
            background: 'rgba(255,255,255,0.5)',
          }}
        >
          <span className="text-sm">{theme.stampIcon}</span>
          <span className="text-[6px]" style={{ color: '#C4A060', letterSpacing: '0.05em' }}>
            {theme.stampLabel}
          </span>
        </div>

        <div className="shrink-0 border-b px-[22px] pb-[14px] pt-[18px]" style={{ borderColor: 'rgba(160,120,60,0.14)' }}>
          <p className="text-[9px] uppercase" style={{ color: '#C4A060', letterSpacing: '0.32em' }}>
            Letter · 情書
          </p>
          <p className="mt-1 truncate text-[17px]" style={{ color: '#3D2414', fontFamily: effectiveFontFamily, lineHeight: 1.3 }}>
            {displayName}
          </p>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-[22px] py-[18px]">
          <p
            className="letter-content-fade whitespace-pre-wrap"
            style={{
              fontSize: 15,
              lineHeight: 2.15,
              color: '#4A3520',
              fontFamily: effectiveFontFamily,
            }}
          >
            {letter.content}
          </p>
        </div>

        <div className="shrink-0 px-[22px] pb-[14px] pt-[10px]">
          <div className="mb-[5px] h-px" style={{ background: 'rgba(160,120,60,0.16)' }} />
          <div className="h-px" style={{ background: 'rgba(160,120,60,0.07)' }} />
        </div>
      </div>

      <button
        type="button"
        onClick={onPickRandom}
        aria-label={rerollLabel}
        className="absolute left-1/2 z-[18] flex -translate-x-1/2 flex-col items-center gap-[3px] transition active:opacity-65"
        style={{ bottom: 58 }}
      >
        {rerollDisplaySrc ? (
          <img
            src={rerollDisplaySrc}
            alt=""
            draggable={false}
            className="calendar-chibi select-none"
            style={{
              width: 80,
              height: 96,
              objectFit: 'contain',
              background: theme.chibiCardBg,
              border: theme.chibiCardBorder,
              borderRadius: 16,
              boxShadow: theme.chibiCardShadow,
            }}
          />
        ) : (
          <span
            className="grid h-24 w-20 place-items-center rounded-2xl text-[42px]"
            style={{ background: theme.chibiCardBg, border: theme.chibiCardBorder, boxShadow: theme.chibiCardShadow }}
          >
            🧸
          </span>
        )}
        <span className="text-[9px]" style={{ color: theme.floatLabelColor, letterSpacing: '0.06em' }}>
          {rerollLabel}
        </span>
      </button>

      <div
        className="absolute bottom-0 left-0 right-0 z-[13] flex items-center justify-around px-5"
        style={{
          height: 80,
          background: theme.actionBarBg,
          backdropFilter: isB ? 'none' : 'blur(12px)',
          borderTop: theme.actionBarBorder,
        }}
      >
        <button
          type="button"
          onClick={handleFavorite}
          aria-label={isFavorited ? '取消收藏' : '收藏'}
          className="flex min-w-14 flex-col items-center gap-1"
          style={{
            transform: heartBeat ? 'scale(1.35)' : 'scale(1)',
            transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <span style={{ fontSize: 22, color: isFavorited ? theme.favOn : theme.iconMuted }}>
            {isFavorited ? theme.favoriteOnIcon : theme.favoriteOffIcon}
          </span>
          <span className="text-[10px]" style={{ color: theme.labelMuted, letterSpacing: '0.04em' }}>
            收藏
          </span>
        </button>

        <div style={{ minWidth: 80 }} />

        <button
          type="button"
          onClick={onClose}
          aria-label="收回"
          className="flex min-w-14 flex-col items-center gap-1 transition active:opacity-60"
        >
          <span style={{ fontSize: 22, color: theme.iconMuted }}>↩</span>
          <span className="text-[10px]" style={{ color: theme.labelMuted, letterSpacing: '0.04em' }}>
            收回
          </span>
        </button>
      </div>
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
  const visibleLetters = showFavoritesOnly
    ? letters.filter((letter) => favoritedNames.has(letter.name))
    : letters;
  const sheetTheme =
    uiVariant === 'A'
      ? {
          backdrop: 'rgba(0,0,0,0.5)',
          panelBg: '#3A1E0F',
          panelBorder: '1px solid rgba(255,255,255,0.08)',
          handle: 'rgba(255,255,255,0.16)',
          title: '#C9A87A',
          toggleBorder: '1px solid rgba(255,255,255,0.2)',
          toggleOnText: '#F7EBD2',
          toggleOffText: '#D1B992',
          toggleOnBg: 'rgba(255,255,255,0.11)',
          toggleOffBg: 'rgba(0,0,0,0.14)',
          emptyText: '#A88B62',
          rowDivider: 'rgba(255,255,255,0.05)',
          rowIcon: '#8B6B3C',
          rowTitle: '#F0DFB8',
          rowDate: '#8B7355',
          rowFavorite: '#D98A95',
        }
      : uiVariant === 'B'
        ? {
            backdrop: 'rgba(34,16,26,0.52)',
            panelBg: 'linear-gradient(170deg, #fef8fb 0%, #f8eaf1 100%)',
            panelBorder: '1px solid rgba(208,154,178,0.34)',
            handle: 'rgba(156,97,122,0.36)',
            title: '#A16C86',
            toggleBorder: '1px solid rgba(156,97,122,0.28)',
            toggleOnText: '#8A4D68',
            toggleOffText: '#A47D91',
            toggleOnBg: 'rgba(224,138,168,0.18)',
            toggleOffBg: 'rgba(255,255,255,0.64)',
            emptyText: '#B28EA1',
            rowDivider: 'rgba(162,112,137,0.18)',
            rowIcon: '#B86F90',
            rowTitle: '#5F3B4D',
            rowDate: '#A98A9B',
            rowFavorite: '#C4697A',
          }
        : {
            backdrop: 'rgba(8,18,30,0.58)',
            panelBg: 'linear-gradient(170deg, #edf5fb 0%, #dce9f5 100%)',
            panelBorder: '1px solid rgba(118,156,189,0.35)',
            handle: 'rgba(93,130,163,0.36)',
            title: '#6388AC',
            toggleBorder: '1px solid rgba(93,130,163,0.28)',
            toggleOnText: '#365E87',
            toggleOffText: '#7697B6',
            toggleOnBg: 'rgba(111,152,192,0.2)',
            toggleOffBg: 'rgba(255,255,255,0.64)',
            emptyText: '#6E8EAD',
            rowDivider: 'rgba(112,148,179,0.2)',
            rowIcon: '#5C84A8',
            rowTitle: '#2E4D6C',
            rowDate: '#6E8EAD',
            rowFavorite: '#6F98C0',
          };

  return (
    <div className="absolute inset-0" style={{ zIndex: 20 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: sheetTheme.backdrop }}
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col overflow-hidden"
        style={{
          borderRadius: '22px 22px 0 0',
          background: sheetTheme.panelBg,
          border: sheetTheme.panelBorder,
          borderBottom: 'none',
          maxHeight: '65%',
        }}
      >
        {/* Handle */}
        <div className="flex shrink-0 justify-center pb-2 pt-3">
          <div
            className="h-1 w-10 rounded-full"
            style={{ background: sheetTheme.handle }}
          />
        </div>

        {/* Title + filter */}
        <div className="shrink-0 px-5 pb-3">
          <div className="flex items-center justify-between gap-3">
            <p
              className="text-xs"
              style={{
                color: sheetTheme.title,
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
                border: sheetTheme.toggleBorder,
                color: showFavoritesOnly ? sheetTheme.toggleOnText : sheetTheme.toggleOffText,
                background: showFavoritesOnly ? sheetTheme.toggleOnBg : sheetTheme.toggleOffBg,
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
              style={{ color: sheetTheme.emptyText }}
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
                    : `1px solid ${sheetTheme.rowDivider}`,
                minHeight: 52,
              }}
            >
              <span
                style={{
                  color: sheetTheme.rowIcon,
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
                  style={{ color: sheetTheme.rowTitle }}
                >
                  {stripExt(letter.name)}
                </p>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: sheetTheme.rowDate }}
                >
                  {formatDate(letter.importedAt)}
                </p>
              </div>
              {favoritedNames.has(letter.name) && (
                <span className="pt-0.5 text-sm" style={{ color: sheetTheme.rowFavorite }}>
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
  const rerollLabel = hasMultiple ? '再抽一封' : '再看一次';
  const rerollDisplaySrc = rerollChibiSrc || LETTER_CHIBI_SOURCES[0] || getActiveBaseChibiSources()[0] || '';
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
            overlay: 'rgba(36,12,24,0.56)',
            bar: 'linear-gradient(to top, rgba(54,20,34,0.86), rgba(54,20,34,0.26))',
            iconMuted: 'rgba(255,237,246,0.72)',
            labelMuted: 'rgba(248,219,232,0.68)',
            closeIcon: 'rgba(255,240,248,0.76)',
            favOn: '#E08AA8',
            paperShadow:
              '0 12px 56px rgba(0,0,0,0.56), 0 3px 18px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(196,130,160,0.16)',
          }
        : {
            overlay: 'rgba(10,28,44,0.56)',
            bar: 'linear-gradient(to top, rgba(16,42,66,0.86), rgba(16,42,66,0.26))',
            iconMuted: 'rgba(220,238,255,0.72)',
            labelMuted: 'rgba(188,216,238,0.68)',
            closeIcon: 'rgba(226,244,255,0.76)',
            favOn: '#6F98C0',
            paperShadow:
              '0 12px 56px rgba(0,0,0,0.56), 0 3px 18px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(120,168,204,0.16)',
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
          overflow: 'visible',
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

        {/* ✉ Re-draw */}
        <button
          type="button"
          onClick={onPickRandom}
          aria-label={rerollLabel}
          className="flex flex-col items-center gap-1 transition active:opacity-55"
          style={{
            minWidth: 64,
            minHeight: 48,
            transform: 'translateY(-14px)',
          }}
        >
          {rerollDisplaySrc ? (
            <img
              src={rerollDisplaySrc}
              alt=""
              draggable={false}
              className="calendar-chibi w-20 select-none drop-shadow"
            />
          ) : (
            <span style={{ fontSize: 22, color: theme.iconMuted }}>✉</span>
          )}
          <span style={{ fontSize: 10, color: theme.labelMuted }}>{rerollLabel}</span>
        </button>

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
