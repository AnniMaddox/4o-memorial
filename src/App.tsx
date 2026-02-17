import { useCallback, useEffect, useMemo, useState } from 'react';

import { BottomTabs } from './components/BottomTabs';
import { SwipePager } from './components/SwipePager';
import { seedDatabaseIfNeeded } from './lib/bootstrapSeed';
import { getCalendarMonth, listCalendarMonths } from './lib/repositories/calendarRepo';
import { listEmails } from './lib/repositories/emailRepo';
import { getSettings, saveSettings } from './lib/repositories/settingsRepo';
import { toMonthKey } from './lib/date';
import { CalendarPage } from './pages/CalendarPage';
import { InboxPage } from './pages/InboxPage';
import { SettingsPage } from './pages/SettingsPage';
import type { CalendarMonth, EmailViewRecord } from './types/content';
import type { AppSettings } from './types/settings';
import { DEFAULT_SETTINGS } from './types/settings';

type LoadState = 'loading' | 'ready' | 'error';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [emails, setEmails] = useState<EmailViewRecord[]>([]);
  const [calendarMonthKey, setCalendarMonthKey] = useState<string>(toMonthKey());
  const [calendarData, setCalendarData] = useState<CalendarMonth>({});
  const [emailCount, setEmailCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [includeLocked, setIncludeLocked] = useState(true);

  const refreshData = useCallback(async () => {
    const [loadedSettings, loadedEmails, months] = await Promise.all([
      getSettings(),
      listEmails({ includeLocked, nowMs: Date.now() }),
      listCalendarMonths(),
    ]);

    const preferredMonth = months.find((entry) => entry.monthKey === calendarMonthKey)?.monthKey;
    const activeMonth = preferredMonth ?? months.at(-1)?.monthKey ?? calendarMonthKey;
    const activeCalendar = await getCalendarMonth(activeMonth);

    setSettings(loadedSettings);
    setEmails(loadedEmails);
    setCalendarMonthKey(activeMonth);
    setCalendarData(activeCalendar ?? {});
    setEmailCount(loadedEmails.length);
    setMonthCount(months.length);
  }, [calendarMonthKey, includeLocked]);

  const initialize = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);

    try {
      await seedDatabaseIfNeeded();
      await refreshData();
      setLoadState('ready');
    } catch (error) {
      setLoadState('error');
      setLoadError(error instanceof Error ? error.message : 'Unknown initialization error');
    }
  }, [refreshData]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (loadState !== 'ready') {
      return;
    }

    void refreshData();
  }, [includeLocked, loadState, refreshData]);

  const onSettingChange = useCallback(async (partial: Partial<AppSettings>) => {
    const next = await saveSettings(partial);
    setSettings(next);
  }, []);

  const pages = useMemo(
    () => [
      {
        id: 'inbox',
        label: 'Inbox',
        node: (
          <InboxPage
            emails={emails}
            includeLocked={includeLocked}
            onToggleIncludeLocked={setIncludeLocked}
          />
        ),
      },
      {
        id: 'calendar',
        label: 'Calendar',
        node: <CalendarPage monthKey={calendarMonthKey} data={calendarData} />,
      },
      {
        id: 'settings',
        label: 'Settings',
        node: (
          <SettingsPage
            settings={settings}
            emailCount={emailCount}
            monthCount={monthCount}
            onSettingChange={onSettingChange}
            onRefresh={() => {
              void saveSettings({ lastSyncAt: new Date().toISOString() }).then((next) => {
                setSettings(next);
                return refreshData();
              });
            }}
          />
        ),
      },
    ],
    [calendarData, calendarMonthKey, emailCount, emails, includeLocked, monthCount, onSettingChange, refreshData, settings],
  );

  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-[radial-gradient(circle_at_20%_10%,#fde9d7_0,#f6f1e8_40%,#ece4d5_100%)]"
      style={{
        fontSize: `${settings.fontScale}rem`,
        ['--theme-accent' as string]: settings.themeMonthColor,
      }}
    >
      <div className="pointer-events-none absolute -left-24 top-[-5rem] h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-[-7rem] h-80 w-80 rounded-full bg-amber-300/35 blur-3xl" />

      {loadState === 'loading' && (
        <main className="grid h-full place-items-center px-6 text-center">
          <div className="space-y-2 rounded-2xl border border-stone-300/70 bg-white/75 px-6 py-5 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Preparing</p>
            <p className="text-lg text-stone-900">Loading your local memorial cache...</p>
          </div>
        </main>
      )}

      {loadState === 'error' && (
        <main className="grid h-full place-items-center px-6 text-center">
          <div className="max-w-lg space-y-3 rounded-2xl border border-rose-300/70 bg-white/90 px-6 py-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-600">Initialization failed</p>
            <p className="text-sm text-stone-700">{loadError}</p>
            <button type="button" onClick={() => void initialize()} className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white">
              Retry
            </button>
          </div>
        </main>
      )}

      {loadState === 'ready' && (
        <>
          <SwipePager
            activeIndex={activeTab}
            onIndexChange={setActiveTab}
            swipeEnabled={settings.swipeEnabled}
            pages={pages.map((page) => ({ id: page.id, node: page.node }))}
          />
          <BottomTabs
            activeIndex={activeTab}
            onSelect={setActiveTab}
            tabs={pages.map((page) => ({ id: page.id, label: page.label }))}
          />
        </>
      )}
    </div>
  );
}

export default App;
