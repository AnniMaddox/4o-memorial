import { useEffect, useMemo, useRef, useState } from 'react';

import type { TabIconUrls } from '../types/settings';

type LauncherAppId = 'tarot' | 'letters' | 'heart';

type HomePageProps = {
  tabIconUrls: TabIconUrls;
  onLaunchApp: (appId: LauncherAppId) => void;
};

type HomeAppSlot = {
  id: string;
  label: string;
  icon: string;
  iconUrl?: string;
  launch?: LauncherAppId;
  disabled?: boolean;
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

export function HomePage({ tabIconUrls, onLaunchApp }: HomePageProps) {
  const [now, setNow] = useState(() => new Date());
  const [screenIndex, setScreenIndex] = useState(0);
  const pagerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const screens = useMemo(() => {
    const tarotSlot: HomeAppSlot = {
      id: 'tarot',
      label: '塔羅',
      icon: '🔮',
      iconUrl: tabIconUrls.tarot.trim() || undefined,
      launch: 'tarot',
    };
    const lettersSlot: HomeAppSlot = {
      id: 'letters',
      label: '情書',
      icon: '💌',
      iconUrl: tabIconUrls.letters.trim() || undefined,
      launch: 'letters',
    };
    const heartSlot: HomeAppSlot = {
      id: 'heart',
      label: '心牆',
      icon: '💗',
      iconUrl: tabIconUrls.heart.trim() || undefined,
      launch: 'heart',
    };

    const placeholder = (id: string): HomeAppSlot => ({
      id,
      label: '',
      icon: ' ',
      disabled: true,
    });

    // Screen 1: tarot / letters / heart, plus reserved empty slots.
    const screen1: HomeAppSlot[] = [
      tarotSlot,
      lettersSlot,
      heartSlot,
      placeholder('slot-1-4'),
      placeholder('slot-1-5'),
      placeholder('slot-1-6'),
      placeholder('slot-1-7'),
      placeholder('slot-1-8'),
    ];

    // Screen 2: reserved for future apps.
    const screen2: HomeAppSlot[] = [
      placeholder('slot-2-1'),
      placeholder('slot-2-2'),
      placeholder('slot-2-3'),
      placeholder('slot-2-4'),
      placeholder('slot-2-5'),
      placeholder('slot-2-6'),
      placeholder('slot-2-7'),
      placeholder('slot-2-8'),
    ];

    return [screen1, screen2];
  }, [tabIconUrls.heart, tabIconUrls.letters, tabIconUrls.tarot]);

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

  const timeText = formatTimeHHMM(now);
  const weekdayText = formatWeekday(now);
  const monthDayText = formatMonthDay(now);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
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
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/40 shadow-sm">
            <span className="text-3xl" aria-hidden="true">
              ♡
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <p className="truncate text-2xl font-semibold tracking-wide text-stone-800">Memorial</p>
              <span className="rounded-full border border-white/60 bg-white/35 px-2 py-0.5 text-[11px] tracking-[0.14em] text-stone-700">
                ACTIVE
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-stone-600">在這裡等妳，慢慢把日子收好。</p>
          </div>
        </div>
      </div>

      {/* App icons pager (home screens) */}
      <div className="space-y-3">
        <div
          ref={pagerRef}
          className="w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
          style={{ scrollBehavior: 'smooth', touchAction: 'pan-x pan-y' }}
        >
          <div className="flex w-full">
            {screens.map((slots, idx) => (
              <section key={`home-screen-${idx}`} className="w-full shrink-0 snap-center">
                <div className="grid grid-cols-4 gap-x-4 gap-y-6 px-1">
                  {slots.map((slot) =>
                    slot.label ? (
                      <HomeAppButton key={slot.id} slot={slot} onLaunch={onLaunchApp} />
                    ) : (
                      <HomePlaceholderTile key={slot.id} />
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          {screens.map((_, idx) => (
            <span
              key={`dot-${idx}`}
              className={`h-1.5 w-1.5 rounded-full transition ${idx === screenIndex ? 'bg-stone-700/60' : 'bg-stone-500/20'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
