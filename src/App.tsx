import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BottomTabs } from './components/BottomTabs';
import { SwipePager } from './components/SwipePager';
import { seedDatabaseIfNeeded } from './lib/bootstrapSeed';
import { toMonthKey } from './lib/date';
import { getCalendarMonth, listCalendarMonths } from './lib/repositories/calendarRepo';
import { listEmails } from './lib/repositories/emailRepo';
import { addNotifiedEmailId, getNotifiedEmailIds } from './lib/repositories/metaRepo';
import { getSettings, saveSettings } from './lib/repositories/settingsRepo';
import { CalendarPage } from './pages/CalendarPage';
import { InboxPage } from './pages/InboxPage';
import { SettingsPage } from './pages/SettingsPage';
import type { CalendarMonth, EmailViewRecord } from './types/content';
import type { AppSettings } from './types/settings';
import { DEFAULT_SETTINGS } from './types/settings';

type LoadState = 'loading' | 'ready' | 'error';
type BrowserNotificationPermission = NotificationPermission | 'unsupported';

const UNLOCK_CHECK_INTERVAL_MS = 30_000;

function getNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission;
}

function formatNotificationBody(email: EmailViewRecord) {
  const sender = email.fromName || email.fromAddress || 'Unknown sender';
  const subject = email.subject || '(No subject)';
  return `${sender}\n${subject}`;
}

async function notifyUnlockedEmail(email: EmailViewRecord) {
  const title = 'M LOVE Memorial';
  const body = formatNotificationBody(email);

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.showNotification(title, {
        body,
        tag: email.id,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: {
          emailId: email.id,
        },
      });
      return;
    }
  }

  if ('Notification' in window) {
    new Notification(title, {
      body,
      tag: email.id,
      icon: '/icons/icon-192.png',
    });
  }
}

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [emails, setEmails] = useState<EmailViewRecord[]>([]);
  const [calendarMonthKey, setCalendarMonthKey] = useState<string>(toMonthKey());
  const [calendarData, setCalendarData] = useState<CalendarMonth>({});
  const [visibleEmailCount, setVisibleEmailCount] = useState(0);
  const [totalEmailCount, setTotalEmailCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationPermission>(
    getNotificationPermission,
  );

  const notifiedIdsRef = useRef<Set<string>>(new Set<string>());
  const [notifierLoaded, setNotifierLoaded] = useState(false);

  const refreshData = useCallback(async () => {
    const nowMs = Date.now();
    const [loadedSettings, visibleEmails, allEmails, months] = await Promise.all([
      getSettings(),
      listEmails({ includeLocked: false, nowMs }),
      listEmails({ includeLocked: true, nowMs }),
      listCalendarMonths(),
    ]);

    const preferredMonth = months.find((entry) => entry.monthKey === calendarMonthKey)?.monthKey;
    const activeMonth = preferredMonth ?? months.at(-1)?.monthKey ?? calendarMonthKey;
    const activeCalendar = await getCalendarMonth(activeMonth);

    setSettings(loadedSettings);
    setEmails(visibleEmails);
    setCalendarMonthKey(activeMonth);
    setCalendarData(activeCalendar ?? {});
    setVisibleEmailCount(visibleEmails.length);
    setTotalEmailCount(allEmails.length);
    setMonthCount(months.length);
  }, [calendarMonthKey]);

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

  const refreshNotificationPermission = useCallback(() => {
    setNotificationPermission(getNotificationPermission());
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const onVisibilityOrFocus = () => refreshNotificationPermission();

    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, [refreshNotificationPermission]);

  useEffect(() => {
    let active = true;

    void getNotifiedEmailIds()
      .then((ids) => {
        if (!active) {
          return;
        }

        notifiedIdsRef.current = ids;
        setNotifierLoaded(true);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setNotifierLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const checkForNewUnlocks = useCallback(async () => {
    if (loadState !== 'ready' || !notifierLoaded) {
      return;
    }

    const unlockedEmails = await listEmails({ includeLocked: true, nowMs: Date.now() });
    const pending = unlockedEmails.filter((email) => !notifiedIdsRef.current.has(email.id));

    if (!pending.length) {
      return;
    }

    for (const email of pending) {
      if (settings.localNotificationsEnabled && notificationPermission === 'granted') {
        await notifyUnlockedEmail(email);
      }

      notifiedIdsRef.current.add(email.id);
      await addNotifiedEmailId(email.id);
    }

    await refreshData();
  }, [loadState, notifierLoaded, notificationPermission, refreshData, settings.localNotificationsEnabled]);

  useEffect(() => {
    if (loadState !== 'ready' || !notifierLoaded) {
      return;
    }

    void checkForNewUnlocks();

    const timer = window.setInterval(() => {
      void checkForNewUnlocks();
    }, UNLOCK_CHECK_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [checkForNewUnlocks, loadState, notifierLoaded]);

  const onSettingChange = useCallback(async (partial: Partial<AppSettings>) => {
    const next = await saveSettings(partial);
    setSettings(next);
  }, []);

  const onRequestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }

    const result = await Notification.requestPermission();
    setNotificationPermission(result);
  }, []);

  const pages = useMemo(
    () => [
      {
        id: 'inbox',
        label: 'Inbox',
        node: <InboxPage emails={emails} />,
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
            visibleEmailCount={visibleEmailCount}
            totalEmailCount={totalEmailCount}
            monthCount={monthCount}
            notificationPermission={notificationPermission}
            onSettingChange={onSettingChange}
            onRequestNotificationPermission={onRequestNotificationPermission}
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
    [
      calendarData,
      calendarMonthKey,
      emails,
      monthCount,
      notificationPermission,
      onRequestNotificationPermission,
      onSettingChange,
      refreshData,
      settings,
      totalEmailCount,
      visibleEmailCount,
    ],
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
            <button
              type="button"
              onClick={() => void initialize()}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white"
            >
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
