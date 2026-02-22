import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import type { AppLabels, TabIconUrls } from '../types/settings';

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
  const cornerChibiUrl = `${import.meta.env.BASE_URL}chibi/chibi-00.webp`;

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
      <div
        ref={pagerRef}
        className={`h-full w-full snap-x snap-mandatory overflow-y-hidden ${homeSwipeEnabled ? 'overflow-x-auto' : 'overflow-x-hidden'}`}
        style={{ scrollBehavior: 'smooth', touchAction: homeSwipeEnabled ? 'pan-x pan-y' : 'pan-y' }}
      >
        <div className="flex h-full w-full">
          {screens.map((screen) => (
            <section key={screen.id} className="h-full w-full shrink-0 snap-center">
              {screen.kind === 'main' ? (
                <div className="flex min-h-full flex-col pb-8">
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
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const result = typeof reader.result === 'string' ? reader.result : '';
                                  if (result) onWidgetIconChange(result);
                                };
                                reader.readAsDataURL(file);
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
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex items-center justify-center gap-2">
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
