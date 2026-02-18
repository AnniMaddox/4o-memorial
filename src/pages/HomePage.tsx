import { useEffect, useMemo, useRef, useState } from 'react';

import type { AppLabels, TabIconUrls } from '../types/settings';

type LauncherAppId = 'tarot' | 'letters' | 'heart' | 'chat' | 'list' | 'fitness';

type HomePageProps = {
  tabIconUrls: TabIconUrls;
  launcherLabels: AppLabels;
  homeSwipeEnabled: boolean;
  widgetTitle: string;
  widgetSubtitle: string;
  widgetBadgeText: string;
  widgetIconDataUrl: string;
  onLaunchApp: (appId: LauncherAppId) => void;
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
      slots: HomeAppSlot[];
    }
  | {
      id: string;
      kind: 'blank';
    };

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

function HomeAppButton({ slot, onLaunch }: { slot: HomeAppSlot; onLaunch: (appId: LauncherAppId) => void }) {
  const clickable = !!slot.launch && !slot.disabled;

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
        className="grid h-16 w-16 place-items-center rounded-2xl border border-white/45 bg-white/25 shadow-[0_18px_42px_rgba(0,0,0,0.14)] backdrop-blur"
        style={{ boxShadow: '0 18px 42px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.65)' }}
      >
        {slot.iconUrl ? (
          <img
            src={slot.iconUrl}
            alt=""
            className="h-10 w-10 rounded-xl object-cover"
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
  launcherLabels,
  homeSwipeEnabled,
  widgetTitle,
  widgetSubtitle,
  widgetBadgeText,
  widgetIconDataUrl,
  onLaunchApp,
  onWidgetIconChange,
}: HomePageProps) {
  const [now, setNow] = useState(() => new Date());
  const [screenIndex, setScreenIndex] = useState(0);
  const pagerRef = useRef<HTMLDivElement | null>(null);
  const widgetIconInputRef = useRef<HTMLInputElement | null>(null);
  const cornerChibiUrl = `${import.meta.env.BASE_URL}chibi/chibi-00.png`;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

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

    const placeholder = (id: string): HomeAppSlot => ({
      id,
      label: '',
      icon: ' ',
      disabled: true,
    });

    // Screen 1: main apps, plus reserved empty slots.
    const screen1: HomeAppSlot[] = [
      tarotSlot,
      lettersSlot,
      heartSlot,
      chatSlot,
      listSlot,
      fitnessSlot,
      placeholder('slot-1-5'),
      placeholder('slot-1-6'),
    ];

    const builtScreens: HomeScreen[] = [
      {
        id: 'main',
        kind: 'main',
        slots: screen1,
      },
    ];

    if (homeSwipeEnabled) {
      builtScreens.push(
        {
          id: 'blank-1',
          kind: 'blank',
        },
        {
          id: 'blank-2',
          kind: 'blank',
        },
      );
    }

    return builtScreens;
  }, [
    homeSwipeEnabled,
    launcherLabels.chat,
    launcherLabels.heart,
    launcherLabels.letters,
    launcherLabels.list,
    launcherLabels.fitness,
    launcherLabels.tarot,
    tabIconUrls.fitness,
    tabIconUrls.heart,
    tabIconUrls.letters,
    tabIconUrls.list,
    tabIconUrls.tarot,
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

  const headerTitle = widgetTitle.trim() || 'Memorial';
  const headerSubtitle = widgetSubtitle.trim();
  const badgeText = widgetBadgeText.trim();

  return (
    <div className="relative mx-auto h-full w-full max-w-xl">
      <div
        ref={pagerRef}
        className={`h-full w-full snap-x snap-mandatory overflow-y-hidden ${homeSwipeEnabled ? 'overflow-x-auto' : 'overflow-x-hidden'}`}
        style={{ scrollBehavior: 'smooth', touchAction: homeSwipeEnabled ? 'pan-x pan-y' : 'pan-y' }}
      >
        <div className="flex h-full w-full">
          {screens.map((screen) => (
            <section key={screen.id} className="h-full w-full shrink-0 snap-center">
              {screen.kind === 'main' ? (
                <div className="flex min-h-full flex-col gap-6 pb-8">
                  {/* Time header */}
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/25 px-3 py-1 text-[11px] tracking-[0.18em] text-stone-700 backdrop-blur">
                      <span className="font-semibold">SYSTEM READY</span>
                      <span className="opacity-70">{timeText}</span>
                    </div>

                    <div className="flex items-end justify-between gap-4">
                      <div className="text-[4.25rem] font-semibold leading-none tracking-tight text-stone-800">{timeText}</div>
                      <div className="pb-2 text-right">
                        <div className="text-2xl font-semibold tracking-[0.18em] text-stone-700">{weekdayText}</div>
                        <div className="mt-1 text-sm tracking-[0.2em] text-stone-600">{monthDayText}</div>
                      </div>
                    </div>
                  </div>

                  {/* Widget card */}
                  <div className="rounded-[2.25rem] border border-white/55 bg-white/25 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        className="grid h-16 w-16 place-items-center rounded-2xl bg-white/40 shadow-sm transition active:scale-95"
                        onClick={() => widgetIconInputRef.current?.click()}
                        aria-label="更換小圖"
                        title="點一下更換小圖"
                      >
                        <input
                          ref={widgetIconInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
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
                          <p className="truncate text-2xl font-semibold tracking-wide text-stone-800">{headerTitle}</p>
                          {badgeText && (
                            <span className="rounded-full border border-white/60 bg-white/35 px-2 py-0.5 text-[11px] tracking-[0.14em] text-stone-700">
                              {badgeText}
                            </span>
                          )}
                        </div>
                        {headerSubtitle && (
                          <p className="mt-1 truncate text-sm text-stone-600">{headerSubtitle}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-x-4 gap-y-6 px-1">
                    {screen.slots.map((slot) =>
                      slot.label ? (
                        <HomeAppButton key={slot.id} slot={slot} onLaunch={onLaunchApp} />
                      ) : (
                        <HomePlaceholderTile key={slot.id} />
                      ),
                    )}
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

      <img
        src={cornerChibiUrl}
        alt=""
        draggable={false}
        className="pointer-events-none absolute bottom-2 right-1 z-10 w-[7.25rem] select-none opacity-95"
        loading="lazy"
      />
    </div>
  );
}
