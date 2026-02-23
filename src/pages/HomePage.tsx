import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import type {
  AppLabels,
  BackgroundMode,
  HomeDynamicWallpaperPreset,
  TabIconUrls,
} from '../types/settings';

type LauncherAppId =
  | 'tarot'
  | 'letters'
  | 'lettersAB'
  | 'heart'
  | 'chat'
  | 'settingsShortcut'
  | 'list'
  | 'wishlist'
  | 'fitness'
  | 'pomodoro'
  | 'period'
  | 'diary'
  | 'diaryB'
  | 'album'
  | 'notes'
  | 'soulmate'
  | 'bookshelf'
  | 'moodLetters';

type HomePageProps = {
  tabIconUrls: TabIconUrls;
  tabIconDisplayMode: 'framed' | 'full';
  launcherLabels: AppLabels;
  homeSwipeEnabled: boolean;
  widgetTitle: string;
  widgetSubtitle: string;
  widgetBadgeText: string;
  widgetIconDataUrl: string;
  backgroundMode: BackgroundMode;
  homeDynamicWallpaperPreset: HomeDynamicWallpaperPreset;
  homeDynamicIntensity: number;
  homeDynamicSpeed: number;
  homeDynamicParticleAmount: number;
  memorialStartDate: string;
  onLaunchApp: (appId: LauncherAppId) => void;
  onOpenCheckin: () => void;
  onOpenSettings: () => void;
  onWidgetIconChange: (dataUrl: string) => void;
};

type HomeAppSlot = {
  id: string;
  label: string;
  icon: string;
  iconUrl?: string;
  launch?: LauncherAppId;
  disabled?: boolean;
};

type HomeScreen =
  | {
      id: string;
      kind: 'main';
      showDashboard: boolean;
      slots: HomeAppSlot[];
    }
  | {
      id: string;
      kind: 'blank';
    }
  | {
      id: string;
      kind: 'counter';
    };

type AnchorPosition = {
  x: number;
  y: number;
};

const CHIBI_POSITION_STORAGE_KEY = 'memorial-home-corner-chibi-anchor';
const COUNTER_VINYL_PREFS_STORAGE_KEY = 'memorial-home-counter-vinyl-prefs-v1';
const COUNTER_VINYL_COVER_STORAGE_KEY = 'memorial-home-counter-vinyl-cover-v1';
const COUNTER_VINYL_SPEED_OPTIONS = [
  { label: '16 RPM', value: 0.5 },
  { label: '24 RPM', value: 0.72 },
  { label: '28 RPM', value: 0.84 },
  { label: '33 RPM', value: 1 },
  { label: '45 RPM', value: 1.35 },
  { label: '60 RPM', value: 1.8 },
  { label: '78 RPM', value: 2.2 },
] as const;
const COUNTER_VINYL_COVER_OFFSET_MIN = -14;
const COUNTER_VINYL_COVER_OFFSET_MAX = 14;
const COUNTER_VINYL_COVER_OFFSET_STEP = 1;

type WallpaperParticle = {
  x: number;
  y: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  opacity: number;
};

type WallpaperBokehOrb = {
  x: number;
  y: number;
  size: number;
  blur: number;
  delay: number;
  duration: number;
  driftX: number;
  driftY: number;
  hue: number;
  alpha: number;
};

type WallpaperLantern = {
  x: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
};

function buildSnowParticles(count: number): WallpaperParticle[] {
  return Array.from({ length: count }, (_, index) => ({
    x: (index * 17 + 9) % 100,
    y: -16 - (index % 4) * 2.5,
    delay: -((index % 9) * 1.18),
    duration: 7.2 + (index % 6) * 1.04,
    size: 1.8 + (index % 5) * 1.22,
    drift: (index % 2 === 0 ? 1 : -1) * (8 + (index % 4) * 6),
    opacity: 0.55 + (index % 4) * 0.12,
  }));
}

function buildFireflies(count: number): WallpaperParticle[] {
  return Array.from({ length: count }, (_, index) => ({
    x: (index * 23 + 7) % 100,
    y: 12 + ((index * 19 + 11) % 74),
    delay: -((index % 7) * 1.6),
    duration: 4 + (index % 5) * 1.05,
    size: 2.8 + (index % 4) * 1.35,
    drift: (index % 2 === 0 ? 1 : -1) * (4 + (index % 3) * 5),
    opacity: 0.5 + (index % 3) * 0.16,
  }));
}

function buildStardust(count: number): WallpaperParticle[] {
  return Array.from({ length: count }, (_, index) => ({
    x: (index * 13 + 4) % 100,
    y: 8 + ((index * 17 + 8) % 80),
    delay: -((index % 9) * 0.9),
    duration: 2.1 + (index % 6) * 0.7,
    size: 1 + (index % 4) * 0.96,
    drift: (index % 2 === 0 ? 1 : -1) * (2 + (index % 3) * 2),
    opacity: 0.5 + (index % 4) * 0.12,
  }));
}

function buildBokehOrbs(count: number): WallpaperBokehOrb[] {
  return Array.from({ length: count }, (_, index) => ({
    x: 6 + ((index * 19 + 3) % 88),
    y: 6 + ((index * 31 + 5) % 82),
    size: 90 + (index % 4) * 42,
    blur: 2 + (index % 3) * 2.5,
    delay: -((index % 6) * 1.3),
    duration: 9 + (index % 5) * 2.25,
    driftX: (index % 2 === 0 ? 1 : -1) * (12 + (index % 4) * 8),
    driftY: (index % 3 === 0 ? -1 : 1) * (10 + (index % 3) * 6),
    hue: (index * 38 + 12) % 360,
    alpha: 0.26 + (index % 4) * 0.08,
  }));
}

function buildLanterns(count: number): WallpaperLantern[] {
  return Array.from({ length: count }, (_, index) => ({
    x: 8 + ((index * 21 + 11) % 84),
    delay: -((index % 8) * 1.35),
    duration: 9.2 + (index % 6) * 1.4,
    size: 16 + (index % 4) * 6,
    drift: (index % 2 === 0 ? 1 : -1) * (10 + (index % 3) * 6),
  }));
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function formatTimeHHMM(date: Date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatWeekday(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
}

function formatMonthDay(date: Date) {
  const month = date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  return `${month}. ${pad2(date.getDate())}`;
}

function parseIsoDate(value: string) {
  const matched = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) {
    return null;
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function calcMemorialDayCount(startDate: Date, now: Date) {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diffDays + 1);
}

function HomeAppButton({
  slot,
  iconDisplayMode,
  onLaunch,
}: {
  slot: HomeAppSlot;
  iconDisplayMode: 'framed' | 'full';
  onLaunch: (appId: LauncherAppId) => void;
}) {
  const clickable = !!slot.launch && !slot.disabled;
  const useFullMode = iconDisplayMode === 'full' && !!slot.iconUrl;

  return (
    <button
      type="button"
      onClick={clickable ? () => onLaunch(slot.launch!) : undefined}
      disabled={!clickable}
      className={`flex flex-col items-center gap-2 ${clickable ? 'active:scale-95' : 'opacity-35'}`}
      aria-label={slot.label}
      title={slot.label}
    >
      <div
        className={`grid h-16 w-16 place-items-center overflow-hidden rounded-2xl ${
          useFullMode
            ? 'border border-transparent bg-transparent shadow-[0_18px_42px_rgba(0,0,0,0.22)]'
            : 'border border-white/45 bg-white/25 shadow-[0_18px_42px_rgba(0,0,0,0.14)] backdrop-blur'
        }`}
        style={useFullMode ? undefined : { boxShadow: '0 18px 42px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.65)' }}
      >
        {slot.iconUrl ? (
          <img
            src={slot.iconUrl}
            alt=""
            className={`${
              useFullMode ? 'h-16 w-16 rounded-2xl object-cover' : 'h-10 w-10 rounded-xl object-cover'
            }`}
            loading="lazy"
            draggable={false}
          />
        ) : (
          <span className="text-2xl leading-none" aria-hidden="true">
            {slot.icon}
          </span>
        )}
      </div>
      <span className="text-center text-xs tracking-wide text-stone-700">{slot.label}</span>
    </button>
  );
}

function HomePlaceholderTile() {
  return (
    <div className="flex flex-col items-center gap-2 opacity-35" aria-hidden="true">
      <div
        className="grid h-16 w-16 place-items-center rounded-2xl border border-white/35 bg-white/15 shadow-[0_18px_42px_rgba(0,0,0,0.10)] backdrop-blur"
        style={{ boxShadow: '0 18px 42px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.55)' }}
      >
        <span className="text-xl leading-none text-stone-700/60">+</span>
      </div>
      <span className="text-xs text-transparent">.</span>
    </div>
  );
}

export function HomePage({
  tabIconUrls,
  tabIconDisplayMode,
  launcherLabels,
  homeSwipeEnabled,
  widgetTitle,
  widgetSubtitle,
  widgetBadgeText,
  widgetIconDataUrl,
  backgroundMode,
  homeDynamicWallpaperPreset,
  homeDynamicIntensity,
  homeDynamicSpeed,
  homeDynamicParticleAmount,
  memorialStartDate,
  onLaunchApp,
  onOpenCheckin,
  onOpenSettings,
  onWidgetIconChange,
}: HomePageProps) {
  const [now, setNow] = useState(() => new Date());
  const [screenIndex, setScreenIndex] = useState(0);
  const pagerRef = useRef<HTMLDivElement | null>(null);
  const widgetIconInputRef = useRef<HTMLInputElement | null>(null);
  const counterWidgetIconInputRef = useRef<HTMLInputElement | null>(null);
  const homeRootRef = useRef<HTMLDivElement | null>(null);
  const cornerChibiRef = useRef<HTMLButtonElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    deltaX: number;
    deltaY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const [isDraggingChibi, setIsDraggingChibi] = useState(false);
  const [chibiAnchor, setChibiAnchor] = useState<AnchorPosition>({ x: 0.9, y: 0.86 });
  const chibiAnchorRef = useRef(chibiAnchor);
  const [isCounterVinylPlaying, setIsCounterVinylPlaying] = useState(true);
  const [counterVinylSpeed, setCounterVinylSpeed] = useState(1);
  const [counterVinylCoverDataUrl, setCounterVinylCoverDataUrl] = useState('');
  const [counterVinylCoverOffsetY, setCounterVinylCoverOffsetY] = useState(0);
  const [isCounterSpeedMenuOpen, setIsCounterSpeedMenuOpen] = useState(false);
  const counterSpeedMenuRef = useRef<HTMLDivElement | null>(null);
  const counterSpeedToggleRef = useRef<HTMLButtonElement | null>(null);
  const cornerChibiUrl = `${import.meta.env.BASE_URL}chibi/chibi-00.webp`;
  const normalizedDynamicIntensity = Math.min(100, Math.max(0, homeDynamicIntensity));
  const normalizedDynamicSpeed = Math.min(100, Math.max(0, homeDynamicSpeed));
  const normalizedDynamicParticleAmount = Math.min(100, Math.max(0, homeDynamicParticleAmount));
  const dynamicSpeedFactor = 0.62 + (normalizedDynamicSpeed / 100) * 1.88;
  const dynamicIntensityFactor = 0.34 + (normalizedDynamicIntensity / 100) * 0.96;
  const dynamicParticleOpacity = 0.32 + (normalizedDynamicIntensity / 100) * 0.64;
  const dynamicGrainOpacity = 0.07 + (normalizedDynamicIntensity / 100) * 0.22;
  const dynamicParticleScale = normalizedDynamicParticleAmount / 100;
  const dynamicSnowParticles = useMemo(
    () => buildSnowParticles(Math.round(12 + dynamicParticleScale * 28)),
    [dynamicParticleScale],
  );
  const dynamicFireflies = useMemo(
    () => buildFireflies(Math.round(10 + dynamicParticleScale * 22)),
    [dynamicParticleScale],
  );
  const dynamicStardust = useMemo(
    () => buildStardust(Math.round(16 + dynamicParticleScale * 36)),
    [dynamicParticleScale],
  );
  const dynamicBokehOrbs = useMemo(
    () => buildBokehOrbs(Math.round(7 + dynamicParticleScale * 10)),
    [dynamicParticleScale],
  );
  const dynamicLanterns = useMemo(
    () => buildLanterns(Math.round(6 + dynamicParticleScale * 9)),
    [dynamicParticleScale],
  );

  useEffect(() => {
    chibiAnchorRef.current = chibiAnchor;
  }, [chibiAnchor]);

  const clampChibiAnchor = useCallback((anchor: AnchorPosition): AnchorPosition => {
    const host = homeRootRef.current;
    const ball = cornerChibiRef.current;
    if (!host || !ball) return anchor;

    const hostWidth = host.clientWidth;
    const hostHeight = host.clientHeight;
    if (!hostWidth || !hostHeight) return anchor;

    const halfWidth = ball.offsetWidth / 2;
    const halfHeight = ball.offsetHeight / 2;
    const minX = Math.min(0.95, Math.max(0.05, halfWidth / hostWidth));
    const maxX = Math.max(minX, 1 - minX);
    const minY = Math.min(0.95, Math.max(0.05, halfHeight / hostHeight));
    const maxY = Math.max(minY, 1 - minY);

    return {
      x: Math.min(maxX, Math.max(minX, anchor.x)),
      y: Math.min(maxY, Math.max(minY, anchor.y)),
    };
  }, []);

  const persistChibiAnchor = useCallback((anchor: AnchorPosition) => {
    try {
      window.localStorage.setItem(CHIBI_POSITION_STORAGE_KEY, JSON.stringify(anchor));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COUNTER_VINYL_PREFS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { isPlaying?: unknown; speed?: unknown };
      if (typeof parsed.isPlaying === 'boolean') {
        setIsCounterVinylPlaying(parsed.isPlaying);
      }
      if (
        typeof parsed.speed === 'number' &&
        Number.isFinite(parsed.speed) &&
        COUNTER_VINYL_SPEED_OPTIONS.some((option) => option.value === parsed.speed)
      ) {
        setCounterVinylSpeed(parsed.speed);
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        COUNTER_VINYL_PREFS_STORAGE_KEY,
        JSON.stringify({
          isPlaying: isCounterVinylPlaying,
          speed: counterVinylSpeed,
        }),
      );
    } catch {
      // ignore storage failures
    }
  }, [counterVinylSpeed, isCounterVinylPlaying]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COUNTER_VINYL_COVER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { cover?: unknown; offsetY?: unknown };
      if (typeof parsed.cover === 'string' && parsed.cover.startsWith('data:image/')) {
        setCounterVinylCoverDataUrl(parsed.cover);
      }
      if (typeof parsed.offsetY === 'number' && Number.isFinite(parsed.offsetY)) {
        setCounterVinylCoverOffsetY(
          Math.min(COUNTER_VINYL_COVER_OFFSET_MAX, Math.max(COUNTER_VINYL_COVER_OFFSET_MIN, parsed.offsetY)),
        );
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        COUNTER_VINYL_COVER_STORAGE_KEY,
        JSON.stringify({ cover: counterVinylCoverDataUrl.trim(), offsetY: counterVinylCoverOffsetY }),
      );
    } catch {
      // ignore storage failures
    }
  }, [counterVinylCoverDataUrl, counterVinylCoverOffsetY]);

  useEffect(() => {
    if (!isCounterSpeedMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (counterSpeedToggleRef.current?.contains(target)) return;
      if (counterSpeedMenuRef.current?.contains(target)) return;
      setIsCounterSpeedMenuOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isCounterSpeedMenuOpen]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHIBI_POSITION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AnchorPosition>;
      if (
        typeof parsed.x === 'number' &&
        Number.isFinite(parsed.x) &&
        typeof parsed.y === 'number' &&
        Number.isFinite(parsed.y)
      ) {
        setChibiAnchor({
          x: Math.min(0.98, Math.max(0.02, parsed.x)),
          y: Math.min(0.98, Math.max(0.02, parsed.y)),
        });
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    const onResize = () => {
      setChibiAnchor((current) => clampChibiAnchor(current));
    };

    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, [clampChibiAnchor]);

  const screens = useMemo<HomeScreen[]>(() => {
    const tarotSlot: HomeAppSlot = {
      id: 'tarot',
      label: launcherLabels.tarot,
      icon: '🔮',
      iconUrl: tabIconUrls.tarot.trim() || undefined,
      launch: 'tarot',
    };
    const lettersSlot: HomeAppSlot = {
      id: 'letters',
      label: launcherLabels.letters,
      icon: '💌',
      iconUrl: tabIconUrls.letters.trim() || undefined,
      launch: 'letters',
    };
    const heartSlot: HomeAppSlot = {
      id: 'heart',
      label: launcherLabels.heart,
      icon: '💗',
      iconUrl: tabIconUrls.heart.trim() || undefined,
      launch: 'heart',
    };
    const chatSlot: HomeAppSlot = {
      id: 'chat',
      label: launcherLabels.chat,
      icon: '💬',
      launch: 'chat',
    };
    const listSlot: HomeAppSlot = {
      id: 'list',
      label: launcherLabels.list,
      icon: '🎴',
      iconUrl: tabIconUrls.list.trim() || undefined,
      launch: 'list',
    };
    const fitnessSlot: HomeAppSlot = {
      id: 'fitness',
      label: launcherLabels.fitness,
      icon: '🏋️',
      iconUrl: tabIconUrls.fitness.trim() || undefined,
      launch: 'fitness',
    };
    const pomodoroSlot: HomeAppSlot = {
      id: 'pomodoro',
      label: launcherLabels.pomodoro,
      icon: '🍅',
      iconUrl: tabIconUrls.pomodoro.trim() || undefined,
      launch: 'pomodoro',
    };
    const periodSlot: HomeAppSlot = {
      id: 'period',
      label: launcherLabels.period,
      icon: '🩸',
      iconUrl: tabIconUrls.period.trim() || undefined,
      launch: 'period',
    };
    const diarySlot: HomeAppSlot = {
      id: 'diary',
      label: launcherLabels.diary,
      icon: '📓',
      iconUrl: tabIconUrls.diary.trim() || undefined,
      launch: 'diary',
    };
    const diaryBSlot: HomeAppSlot = {
      id: 'diary-b',
      label: '我的日記',
      icon: '📔',
      launch: 'diaryB',
    };
    const albumSlot: HomeAppSlot = {
      id: 'album',
      label: launcherLabels.album,
      icon: '📷',
      iconUrl: tabIconUrls.album.trim() || undefined,
      launch: 'album',
    };
    const notesSlot: HomeAppSlot = {
      id: 'notes',
      label: launcherLabels.notes,
      icon: '📝',
      iconUrl: tabIconUrls.notes.trim() || undefined,
      launch: 'notes',
    };
    const dailyTaskPlaceholder: HomeAppSlot = {
      id: 'wishlist',
      label: '願望',
      icon: '🌠',
      launch: 'wishlist',
    };
    const soulmateSlot: HomeAppSlot = {
      id: 'soulmate',
      label: '家',
      icon: '🏠',
      launch: 'soulmate',
    };
    const bookshelfSlot: HomeAppSlot = {
      id: 'bookshelf',
      label: '書架',
      icon: '📚',
      launch: 'bookshelf',
    };
    const moodLettersSlot: HomeAppSlot = {
      id: 'mood-letters',
      label: '心情星球',
      icon: '🫧',
      launch: 'moodLetters',
    };
    const annualLettersSlot: HomeAppSlot = {
      id: 'letters-ab',
      label: '年度信件',
      icon: '📜',
      launch: 'lettersAB',
    };
    const settingsShortcutSlot: HomeAppSlot = {
      id: 'settings-shortcut',
      label: launcherLabels.settings,
      icon: '⚙️',
      iconUrl: tabIconUrls.settings.trim() || undefined,
      launch: 'settingsShortcut',
    };
    // Screen 1 order
    const screen1: HomeAppSlot[] = homeSwipeEnabled
      ? [
          soulmateSlot,
          lettersSlot,
          diarySlot,
          dailyTaskPlaceholder,
          listSlot,
          notesSlot,
          diaryBSlot,
          periodSlot,
        ]
      : [
          chatSlot,
          lettersSlot,
          diarySlot,
          listSlot,
          albumSlot,
          fitnessSlot,
          tarotSlot,
          heartSlot,
          pomodoroSlot,
        ];

    const builtScreens: HomeScreen[] = [
      {
        id: 'main',
        kind: 'main',
        showDashboard: true,
        slots: screen1,
      },
    ];

    if (homeSwipeEnabled) {
      builtScreens.push(
        {
          id: 'apps-2',
          kind: 'main',
          showDashboard: false,
          slots: [
            fitnessSlot,
            tarotSlot,
            pomodoroSlot,
            heartSlot,
            bookshelfSlot,
            albumSlot,
            annualLettersSlot,
            moodLettersSlot,
            settingsShortcutSlot,
          ],
        },
        {
          id: 'blank-1',
          kind: 'blank',
        },
        {
          id: 'counter',
          kind: 'counter',
        },
      );
    }

    return builtScreens;
  }, [
    homeSwipeEnabled,
    launcherLabels.chat,
    launcherLabels.diary,
    launcherLabels.heart,
    launcherLabels.letters,
    launcherLabels.list,
    launcherLabels.fitness,
    launcherLabels.pomodoro,
    launcherLabels.period,
    launcherLabels.settings,
    launcherLabels.tarot,
    launcherLabels.album,
    launcherLabels.notes,
    tabIconUrls.fitness,
    tabIconUrls.pomodoro,
    tabIconUrls.period,
    tabIconUrls.diary,
    tabIconUrls.settings,
    tabIconUrls.heart,
    tabIconUrls.letters,
    tabIconUrls.list,
    tabIconUrls.tarot,
    tabIconUrls.album,
    tabIconUrls.notes,
  ]);

  useEffect(() => {
    if (screenIndex < screens.length) {
      return;
    }

    setScreenIndex(Math.max(0, screens.length - 1));
  }, [screenIndex, screens.length]);

  useEffect(() => {
    const node = pagerRef.current;
    if (!node) return;

    const onScroll = () => {
      const width = node.clientWidth;
      if (!width) return;
      const next = Math.round(node.scrollLeft / width);
      setScreenIndex((current) => (current === next ? current : next));
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const node = pagerRef.current;
    if (!node) {
      return;
    }

    const width = node.clientWidth;
    if (!width) {
      return;
    }

    const safeIndex = Math.min(screenIndex, screens.length - 1);
    node.scrollTo({
      left: safeIndex * width,
      behavior: 'auto',
    });
  }, [screenIndex, screens.length]);

  const timeText = formatTimeHHMM(now);
  const weekdayText = formatWeekday(now);
  const monthDayText = formatMonthDay(now);
  const parsedMemorialStartDate = useMemo(() => parseIsoDate(memorialStartDate), [memorialStartDate]);
  const memorialStartDisplay = parsedMemorialStartDate ? memorialStartDate : '';
  const memorialDayCount = useMemo(
    () => (parsedMemorialStartDate ? calcMemorialDayCount(parsedMemorialStartDate, now) : 1),
    [now, parsedMemorialStartDate],
  );
  const currentCounterSpeedOption = useMemo(
    () =>
      COUNTER_VINYL_SPEED_OPTIONS.find((option) => option.value === counterVinylSpeed) ??
      COUNTER_VINYL_SPEED_OPTIONS[0],
    [counterVinylSpeed],
  );

  const handleWidgetIconFilePick = useCallback(
    (file: File | null) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (result) onWidgetIconChange(result);
      };
      reader.readAsDataURL(file);
    },
    [onWidgetIconChange],
  );

  const handleCounterVinylCoverFilePick = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) setCounterVinylCoverDataUrl(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const headerTitle = widgetTitle.trim() || 'Memorial';
  const headerSubtitle = widgetSubtitle.trim();
  const badgeText = widgetBadgeText.trim();

  const handleChibiPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const host = homeRootRef.current;
    const ball = cornerChibiRef.current;
    if (!host || !ball) return;

    const hostRect = host.getBoundingClientRect();
    const ballRect = ball.getBoundingClientRect();
    const centerX = ballRect.left - hostRect.left + ballRect.width / 2;
    const centerY = ballRect.top - hostRect.top + ballRect.height / 2;

    dragStateRef.current = {
      pointerId: event.pointerId,
      deltaX: event.clientX - (hostRect.left + centerX),
      deltaY: event.clientY - (hostRect.top + centerY),
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };

    setIsDraggingChibi(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const handleChibiPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const dragState = dragStateRef.current;
      const host = homeRootRef.current;
      const ball = cornerChibiRef.current;
      if (!dragState || !host || !ball) return;
      if (dragState.pointerId !== event.pointerId) return;

      if (
        !dragState.moved &&
        (Math.abs(event.clientX - dragState.startX) > 6 || Math.abs(event.clientY - dragState.startY) > 6)
      ) {
        dragState.moved = true;
      }

      const hostRect = host.getBoundingClientRect();
      const hostWidth = host.clientWidth;
      const hostHeight = host.clientHeight;
      if (!hostWidth || !hostHeight) return;

      const centerX = event.clientX - hostRect.left - dragState.deltaX;
      const centerY = event.clientY - hostRect.top - dragState.deltaY;
      const halfWidth = ball.offsetWidth / 2;
      const halfHeight = ball.offsetHeight / 2;

      const next = clampChibiAnchor({
        x: Math.min(hostWidth - halfWidth, Math.max(halfWidth, centerX)) / hostWidth,
        y: Math.min(hostHeight - halfHeight, Math.max(halfHeight, centerY)) / hostHeight,
      });

      setChibiAnchor(next);
      event.preventDefault();
    },
    [clampChibiAnchor],
  );

  const handleChibiPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const dragState = dragStateRef.current;
      const host = homeRootRef.current;
      const ball = cornerChibiRef.current;
      if (!dragState || !host || !ball) return;
      if (dragState.pointerId !== event.pointerId) return;

      dragStateRef.current = null;
      setIsDraggingChibi(false);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const wasMoved = dragState.moved;
      if (!wasMoved) {
        event.preventDefault();
        onOpenSettings();
        return;
      }

      const hostWidth = host.clientWidth;
      const halfWidth = ball.offsetWidth / 2;
      const minX = hostWidth ? halfWidth / hostWidth : 0;
      const maxX = hostWidth ? 1 - minX : 1;
      const current = chibiAnchorRef.current;
      const snapped = clampChibiAnchor({
        x: current.x < 0.5 ? minX : maxX,
        y: current.y,
      });

      setChibiAnchor(snapped);
      persistChibiAnchor(snapped);
      event.preventDefault();
    },
    [clampChibiAnchor, onOpenSettings, persistChibiAnchor],
  );

  return (
    <div ref={homeRootRef} className="home-page-root relative mx-auto h-full w-full max-w-xl">
      {backgroundMode === 'dynamic' && (
        <div
          className={`home-wallpaper home-wallpaper-preset-${homeDynamicWallpaperPreset}`}
          data-dynamic-preset={homeDynamicWallpaperPreset}
          style={
            {
              '--home-dyn-intensity': dynamicIntensityFactor.toFixed(3),
              '--home-dyn-speed-factor': dynamicSpeedFactor.toFixed(3),
              '--home-dyn-particle-opacity': dynamicParticleOpacity.toFixed(3),
              '--home-dyn-grain-opacity': dynamicGrainOpacity.toFixed(3),
            } as CSSProperties
          }
          aria-hidden="true"
        >
          {homeDynamicWallpaperPreset === 'gradientFlow' && (
            <>
              {dynamicBokehOrbs.map((orb, index) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={`flow-orb-${index}`}
                  className="home-wallpaper-bokeh"
                  style={
                    {
                      '--x': `${orb.x}%`,
                      '--y': `${orb.y}%`,
                      '--size': `${orb.size}px`,
                      '--blur': `${orb.blur}px`,
                      '--delay': `${orb.delay}s`,
                      '--duration': `${orb.duration}s`,
                      '--drift-x': `${orb.driftX}px`,
                      '--drift-y': `${orb.driftY}px`,
                      '--hue': `${orb.hue}deg`,
                      '--alpha': orb.alpha.toFixed(2),
                    } as CSSProperties
                  }
                />
              ))}
            </>
          )}
          {homeDynamicWallpaperPreset === 'snowNight' && (
            <div className="home-wallpaper-snow-layer">
              {dynamicSnowParticles.map((particle, index) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={`snow-${index}`}
                  className="home-wallpaper-snow-particle"
                  style={
                    {
                      '--x': `${particle.x}%`,
                      '--y': `${particle.y}%`,
                      '--delay': `${particle.delay}s`,
                      '--duration': `${particle.duration}s`,
                      '--size': `${particle.size}px`,
                      '--drift': `${particle.drift}px`,
                      '--alpha': particle.opacity.toFixed(2),
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
          {homeDynamicWallpaperPreset === 'bokehDream' && (
            <div className="home-wallpaper-bokeh-layer">
              {dynamicBokehOrbs.map((orb, index) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={`bokeh-orb-${index}`}
                  className="home-wallpaper-bokeh"
                  style={
                    {
                      '--x': `${orb.x}%`,
                      '--y': `${orb.y}%`,
                      '--size': `${orb.size + 18}px`,
                      '--blur': `${orb.blur + 2}px`,
                      '--delay': `${orb.delay}s`,
                      '--duration': `${orb.duration + 1.6}s`,
                      '--drift-x': `${orb.driftX * 1.15}px`,
                      '--drift-y': `${orb.driftY * 1.05}px`,
                      '--hue': `${(orb.hue + 45) % 360}deg`,
                      '--alpha': Math.min(0.56, orb.alpha + 0.08).toFixed(2),
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
          {homeDynamicWallpaperPreset === 'firefly' && (
            <div className="home-wallpaper-firefly-layer">
              {dynamicFireflies.map((particle, index) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={`firefly-${index}`}
                  className="home-wallpaper-firefly"
                  style={
                    {
                      '--x': `${particle.x}%`,
                      '--y': `${particle.y}%`,
                      '--delay': `${particle.delay}s`,
                      '--duration': `${particle.duration}s`,
                      '--size': `${particle.size}px`,
                      '--drift': `${particle.drift}px`,
                      '--alpha': particle.opacity.toFixed(2),
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
          {homeDynamicWallpaperPreset === 'meteorShower' && (
            <div className="home-wallpaper-stardust-layer">
              {dynamicStardust.map((particle, index) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={`stardust-${index}`}
                  className="home-wallpaper-stardust"
                  style={
                    {
                      '--x': `${particle.x}%`,
                      '--y': `${particle.y}%`,
                      '--delay': `${particle.delay}s`,
                      '--duration': `${particle.duration}s`,
                      '--size': `${particle.size}px`,
                      '--drift': `${particle.drift}px`,
                      '--alpha': particle.opacity.toFixed(2),
                    } as CSSProperties
                  }
                />
              ))}
              <span className="home-wallpaper-shooting home-wallpaper-shooting-a" />
              <span className="home-wallpaper-shooting home-wallpaper-shooting-b" />
              <span className="home-wallpaper-shooting home-wallpaper-shooting-c" />
            </div>
          )}
          {homeDynamicWallpaperPreset === 'skyLantern' && (
            <div className="home-wallpaper-lantern-layer">
              {dynamicLanterns.map((lantern, index) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={`lantern-${index}`}
                  className="home-wallpaper-lantern"
                  style={
                    {
                      '--x': `${lantern.x}%`,
                      '--delay': `${lantern.delay}s`,
                      '--duration': `${lantern.duration}s`,
                      '--size': `${lantern.size}px`,
                      '--drift': `${lantern.drift}px`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
      <div
        ref={pagerRef}
        className={`relative z-[1] h-full w-full snap-x snap-mandatory overflow-y-hidden ${
          homeSwipeEnabled ? 'overflow-x-auto' : 'overflow-x-hidden'
        }`}
        style={{ scrollBehavior: 'smooth', touchAction: homeSwipeEnabled ? 'pan-x pan-y' : 'pan-y' }}
      >
        <div className="flex h-full w-full">
          {screens.map((screen) => (
            <section key={screen.id} className="h-full w-full shrink-0 snap-center">
              {screen.kind === 'main' ? (
                <div
                  className="flex min-h-full flex-col px-4 pb-8"
                  style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}
                >
                  {screen.showDashboard && (
                    <>
                      <div className="mb-6">
                        <div className="flex items-end justify-between gap-4">
                          <div
                            className="font-semibold leading-none tracking-tight text-stone-800"
                            style={{ fontSize: 'calc(var(--ui-header-title-size, 17px) * 3.9)' }}
                          >
                            {timeText}
                          </div>
                          <div className="pb-2 text-right">
                            <div
                              className="font-semibold tracking-[0.18em] text-stone-700"
                              style={{ fontSize: 'calc(var(--ui-header-title-size, 17px) + 7px)' }}
                            >
                              {weekdayText}
                            </div>
                            <div
                              className="mt-1 tracking-[0.2em] text-stone-600"
                              style={{ fontSize: 'calc(var(--ui-hint-text-size, 10px) + 3px)' }}
                            >
                              {monthDayText}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div
                        className="mb-6 cursor-pointer rounded-[2.25rem] border border-white/55 bg-white/25 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur transition active:scale-[0.995]"
                        role="button"
                        tabIndex={0}
                        aria-label="開啟打卡簽到"
                        onClick={() => onOpenCheckin()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onOpenCheckin();
                          }
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            className="grid h-16 w-16 place-items-center rounded-2xl bg-white/40 shadow-sm transition active:scale-95"
                            onClick={(event) => {
                              event.stopPropagation();
                              widgetIconInputRef.current?.click();
                            }}
                            aria-label="更換小圖"
                            title="點一下更換小圖"
                          >
                            <input
                              ref={widgetIconInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => {
                                event.stopPropagation();
                                const file = event.target.files?.[0];
                                event.currentTarget.value = '';
                                handleWidgetIconFilePick(file ?? null);
                              }}
                              onClick={(event) => event.stopPropagation()}
                            />
                            {widgetIconDataUrl.trim() ? (
                              <img
                                src={widgetIconDataUrl}
                                alt=""
                                className="h-12 w-12 rounded-xl object-cover"
                                loading="lazy"
                                draggable={false}
                              />
                            ) : (
                              <span className="text-3xl" aria-hidden="true">
                                ♡
                              </span>
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <p
                                className="truncate font-semibold tracking-wide text-stone-800"
                                style={{ fontSize: 'calc(var(--ui-header-title-size, 17px) + 7px)' }}
                              >
                                {headerTitle}
                              </p>
                              {badgeText && (
                                <span
                                  className="rounded-full border border-white/60 bg-white/35 px-2 py-0.5 tracking-[0.14em] text-stone-700"
                                  style={{ fontSize: 'calc(var(--ui-hint-text-size, 10px) + 1px)' }}
                                >
                                  {badgeText}
                                </span>
                              )}
                            </div>
                            {headerSubtitle && (
                              <p
                                className="mt-1 truncate text-stone-600"
                                style={{ fontSize: 'calc(var(--ui-hint-text-size, 10px) + 4px)' }}
                              >
                                {headerSubtitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className={`grid grid-cols-4 gap-x-4 gap-y-6 px-1 ${screen.showDashboard ? '' : 'pt-2'}`}>
                    {screen.slots.map((slot) =>
                      slot.label ? (
                        <HomeAppButton
                          key={slot.id}
                          slot={slot}
                          iconDisplayMode={tabIconDisplayMode}
                          onLaunch={onLaunchApp}
                        />
                      ) : (
                        <HomePlaceholderTile key={slot.id} />
                      ),
                    )}
                  </div>
                </div>
              ) : screen.kind === 'counter' ? (
                <div className="flex h-full items-center px-4 pb-10">
                  <div
                    className="w-full rounded-[2.4rem] border border-white/55 bg-white/25 px-6 py-8 shadow-[0_26px_60px_rgba(0,0,0,0.14)] backdrop-blur"
                    style={{ boxShadow: '0 26px 60px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.62)' }}
                  >
                    <input
                      ref={counterWidgetIconInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = '';
                        handleCounterVinylCoverFilePick(file ?? null);
                      }}
                    />
                    <div className="home-counter-vinyl-wrap">
                      <div
                        className={`home-counter-vinyl-stage ${isCounterVinylPlaying ? 'home-counter-vinyl-playing' : ''}`}
                        style={{ '--home-counter-vinyl-speed': `${(4 / counterVinylSpeed).toFixed(2)}s` } as CSSProperties}
                      >
                        <div className="home-counter-vinyl-console">
                          <span
                            className={`home-counter-vinyl-led ${isCounterVinylPlaying ? 'is-on' : ''}`}
                            aria-label={isCounterVinylPlaying ? '播放中' : '已暫停'}
                            title={isCounterVinylPlaying ? '播放中' : '已暫停'}
                          />
                          <button
                            type="button"
                            className={`home-counter-vinyl-power ${isCounterVinylPlaying ? 'is-on' : ''}`}
                            onClick={() => setIsCounterVinylPlaying((prev) => !prev)}
                            aria-label={isCounterVinylPlaying ? '暫停唱片' : '播放唱片'}
                            title={isCounterVinylPlaying ? '暫停唱片' : '播放唱片'}
                          >
                            <span
                              className={`home-counter-vinyl-power-icon ${
                                isCounterVinylPlaying ? 'is-playing' : 'is-paused'
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                          <div className="home-counter-vinyl-speed-control" ref={counterSpeedMenuRef}>
                            <button
                              ref={counterSpeedToggleRef}
                              type="button"
                              className="home-counter-vinyl-speed-knob"
                              onClick={() => setIsCounterSpeedMenuOpen((prev) => !prev)}
                              aria-label="調整唱片轉速"
                              title={`轉速：${currentCounterSpeedOption.label}`}
                            >
                              <span className="home-counter-vinyl-speed-knob-dot" />
                            </button>
                            {isCounterSpeedMenuOpen && (
                              <div className="home-counter-vinyl-speed-menu">
                                {COUNTER_VINYL_SPEED_OPTIONS.map((option) => (
                                  <button
                                    key={option.label}
                                    type="button"
                                    className={`home-counter-vinyl-speed-item ${
                                      counterVinylSpeed === option.value ? 'is-active' : ''
                                    }`}
                                    onClick={() => {
                                      setCounterVinylSpeed(option.value);
                                      setIsCounterSpeedMenuOpen(false);
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                                <div className="home-counter-vinyl-cover-adjust">
                                  <button
                                    type="button"
                                    className="home-counter-vinyl-cover-adjust-btn"
                                    onClick={() =>
                                      setCounterVinylCoverOffsetY((prev) =>
                                        Math.max(COUNTER_VINYL_COVER_OFFSET_MIN, prev - COUNTER_VINYL_COVER_OFFSET_STEP),
                                      )
                                    }
                                    title="照片上移"
                                    aria-label="照片上移"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="home-counter-vinyl-cover-adjust-btn"
                                    onClick={() =>
                                      setCounterVinylCoverOffsetY((prev) =>
                                        Math.min(COUNTER_VINYL_COVER_OFFSET_MAX, prev + COUNTER_VINYL_COVER_OFFSET_STEP),
                                      )
                                    }
                                    title="照片下移"
                                    aria-label="照片下移"
                                  >
                                    ↓
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="home-counter-vinyl-shadow" />
                        <div className="home-counter-vinyl-platter">
                          <div className="home-counter-vinyl-grooves" />
                          <div className="home-counter-vinyl-highlight" />
                          <button
                            type="button"
                            className={`home-counter-vinyl-label ${counterVinylCoverDataUrl.trim() ? 'has-cover' : ''}`}
                            onClick={() => counterWidgetIconInputRef.current?.click()}
                            aria-label={counterVinylCoverDataUrl.trim() ? '更換圓盤中心圖片' : '上傳圓盤中心圖片'}
                            title={counterVinylCoverDataUrl.trim() ? '更換圓盤中心圖片' : '上傳圓盤中心圖片'}
                          >
                            {counterVinylCoverDataUrl.trim() ? (
                              <span
                                className="home-counter-vinyl-label-image-wrap"
                                style={{ transform: `translateY(${counterVinylCoverOffsetY}px)` }}
                              >
                                <img src={counterVinylCoverDataUrl} alt="" loading="lazy" draggable={false} />
                              </span>
                            ) : (
                              <span>♡</span>
                            )}
                          </button>
                        </div>
                        <div className="home-counter-vinyl-base" />
                        <div
                          className={`home-counter-vinyl-arm ${
                            isCounterVinylPlaying ? 'home-counter-vinyl-arm-playing' : 'home-counter-vinyl-arm-paused'
                          }`}
                        >
                          <div className="home-counter-vinyl-arm-bar" />
                          <div className="home-counter-vinyl-arm-head" />
                        </div>
                      </div>
                    </div>
                    <p className="text-center text-lg font-semibold tracking-[0.04em] text-stone-700">
                      想你的第
                      <span className="mx-2 inline-block text-[5.2rem] leading-none text-stone-800">{memorialDayCount}</span>
                      天
                    </p>
                    <p className="mt-5 text-center text-xs text-stone-500">
                      {memorialStartDisplay ? `起始日：${memorialStartDisplay}` : '起始日：未設定'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-full w-full" aria-hidden="true" />
              )}
            </section>
          ))}
        </div>
      </div>

      {screens.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 z-[1] flex items-center justify-center gap-2">
          {screens.map((screen, idx) => (
            <span
              key={screen.id}
              className={`h-1.5 w-1.5 rounded-full transition ${idx === screenIndex ? 'bg-stone-700/60' : 'bg-stone-500/20'}`}
            />
          ))}
        </div>
      )}

      <button
        ref={cornerChibiRef}
        type="button"
        aria-label="點一下開大設定，可拖曳小人"
        title="點一下開大設定，可拖曳移動"
        onPointerDown={handleChibiPointerDown}
        onPointerMove={handleChibiPointerMove}
        onPointerUp={handleChibiPointerUp}
        onPointerCancel={handleChibiPointerUp}
        className={`absolute z-20 h-[11.25rem] w-[11.25rem] select-none touch-none ${
          isDraggingChibi ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          left: `${chibiAnchor.x * 100}%`,
          top: `${chibiAnchor.y * 100}%`,
          transform: 'translate(-50%, -50%)',
          transition: isDraggingChibi ? 'none' : 'left 180ms ease, top 180ms ease',
        }}
      >
        <img
          src={cornerChibiUrl}
          alt=""
          draggable={false}
          className={`h-full w-full object-contain opacity-95 drop-shadow-[0_10px_18px_rgba(0,0,0,0.24)] ${
            isDraggingChibi ? '' : 'home-corner-chibi-float'
          }`}
          loading="lazy"
        />
      </button>
    </div>
  );
}
