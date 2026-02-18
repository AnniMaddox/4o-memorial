import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BottomTabs } from './components/BottomTabs';
import { SwipePager } from './components/SwipePager';
import { seedDatabaseIfNeeded } from './lib/bootstrapSeed';
import { importCalendarFiles, importEmlFiles } from './lib/importers';
import { buildContinuousMonthKeys, toMonthKey } from './lib/date';
import { getCalendarMonth, listCalendarMonths } from './lib/repositories/calendarRepo';
import { listEmails } from './lib/repositories/emailRepo';
import {
  addNotifiedEmailId,
  addReadEmailId,
  getNotifiedEmailIds,
  getReadEmailIds,
  getStarredEmailIds,
  setHoverPhraseMap,
  setStarredEmailIds as persistStarredEmailIds,
} from './lib/repositories/metaRepo';
import { getSettings, saveSettings } from './lib/repositories/settingsRepo';
import { CalendarPage } from './pages/CalendarPage';
import { InboxPage } from './pages/InboxPage';
import { LetterPage } from './pages/LetterPage';
import { clearAllLetters, loadLetters, saveLetters } from './lib/letterDB';
import type { StoredLetter } from './lib/letterDB';
import { readLetterContent } from './lib/letterReader';
import { APP_CUSTOM_FONT_FAMILY, LETTER_CUSTOM_FONT_FAMILY, buildFontFaceRule } from './lib/font';
import { deleteChatProfile, loadChatProfiles, saveChatProfile } from './lib/chatDB';
import type { ChatProfile } from './lib/chatDB';
import { HeartWallPage } from './pages/HeartWallPage';
import { SettingsPage } from './pages/SettingsPage';
import { TarotPage } from './pages/TarotPage';
import type { CalendarMonth, EmailViewRecord } from './types/content';
import type { AppSettings, CalendarColorMode, TabIconKey } from './types/settings';
import { DEFAULT_SETTINGS } from './types/settings';

type LoadState = 'loading' | 'ready' | 'error';
type BrowserNotificationPermission = NotificationPermission | 'unsupported';
type ImportStatus = {
  kind: 'idle' | 'working' | 'success' | 'error';
  message: string;
};

const UNLOCK_CHECK_INTERVAL_MS = 30_000;
const notificationIconUrl = `${import.meta.env.BASE_URL}icons/icon-192.png`;
const MONTH_THEME_COLORS: Record<number, string> = {
  1: '#2E294E',
  2: '#D7263D',
  3: '#F46036',
  4: '#FFE066',
  5: '#247BA0',
  6: '#70C1B3',
  7: '#FF6B6B',
  8: '#C44D58',
  9: '#6C5B7B',
  10: '#355C7D',
  11: '#A7226E',
  12: '#1B1B3A',
};
const DEFAULT_TAB_ICONS: Record<TabIconKey, string> = {
  inbox: '📮',
  calendar: '📅',
  tarot: '🔮',
  letters: '💌',
  heart: '💗',
  settings: '⚙️',
};

function toRgbTriplet(hex: string) {
  const matched = hex.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!matched) {
    return '194 91 60';
  }

  return `${Number.parseInt(matched[1], 16)} ${Number.parseInt(matched[2], 16)} ${Number.parseInt(matched[3], 16)}`;
}

function toSafeCssUrl(url: string) {
  return url.replaceAll('"', '%22').replaceAll('\n', '');
}

function getMonthAccentColor(monthKey: string) {
  const month = Number(monthKey.split('-')[1]);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return MONTH_THEME_COLORS[month] ?? null;
}

function getNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission;
}

function formatNotificationBody(email: EmailViewRecord) {
  const sender = email.fromName || email.fromAddress || '未知寄件人';
  const subject = email.subject || '（無主旨）';
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
        icon: notificationIconUrl,
        badge: notificationIconUrl,
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
      icon: notificationIconUrl,
    });
  }
}

function summarizeImport(
  label: 'EML' | 'Calendar',
  result: { imported: number; failed: number; messages: string[] },
): ImportStatus {
  const labelText = label === 'EML' ? 'EML 信件' : '月曆';

  if (result.imported === 0 && result.failed > 0) {
    return {
      kind: 'error',
      message: `${labelText} 匯入失敗（失敗 ${result.failed} 個檔案）。${result.messages[0] ? ` ${result.messages[0]}` : ''}`,
    };
  }

  const kind: ImportStatus['kind'] = result.failed > 0 ? 'error' : 'success';
  const message = `${labelText} 匯入完成：成功 ${result.imported}、失敗 ${result.failed}${
    result.messages.length ? `（${result.messages[0]}）` : ''
  }`;

  return {
    kind,
    message,
  };
}

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [emails, setEmails] = useState<EmailViewRecord[]>([]);
  const [calendarMonthKey, setCalendarMonthKey] = useState<string>(toMonthKey());
  const [calendarMonthKeys, setCalendarMonthKeys] = useState<string[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarMonth>({});
  const [visibleEmailCount, setVisibleEmailCount] = useState(0);
  const [totalEmailCount, setTotalEmailCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [importStatus, setImportStatus] = useState<ImportStatus>({ kind: 'idle', message: '' });
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationPermission>(
    getNotificationPermission,
  );
  const monthAccentColor = useMemo(() => getMonthAccentColor(calendarMonthKey), [calendarMonthKey]);
  const appAccentColor = settings.themeMonthColor;
  const calendarHeaderColor = monthAccentColor ?? appAccentColor;
  const calendarAccentColor = settings.calendarColorMode === 'month' ? calendarHeaderColor : appAccentColor;
  const themeAccentRgb = useMemo(() => toRgbTriplet(appAccentColor), [appAccentColor]);
  const calendarAccentRgb = useMemo(() => toRgbTriplet(calendarAccentColor), [calendarAccentColor]);
  const calendarHeaderAccentRgb = useMemo(() => toRgbTriplet(calendarHeaderColor), [calendarHeaderColor]);
  const lockedBubbleRgb = useMemo(() => toRgbTriplet(settings.lockedBubbleColor), [settings.lockedBubbleColor]);
  const customFontFileUrl = settings.customFontFileUrl.trim();
  const customFontFamily = settings.customFontFamily.trim();
  const preferredCustomFontFamily = customFontFamily || (customFontFileUrl ? APP_CUSTOM_FONT_FAMILY : '');
  const appFontFamily =
    preferredCustomFontFamily || "'Plus Jakarta Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  const appHeadingFamily =
    preferredCustomFontFamily || "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
  const letterFontFamily = settings.letterFontUrl.trim() ? LETTER_CUSTOM_FONT_FAMILY : '';
  const [unreadEmailIds, setUnreadEmailIds] = useState<Set<string>>(new Set<string>());
  const [starredEmailIds, setStarredEmailIds] = useState<Set<string>>(new Set<string>());
  const [readIdsLoaded, setReadIdsLoaded] = useState(false);
  const [hoverResetSeed, setHoverResetSeed] = useState(0);
  const [letters, setLetters] = useState<StoredLetter[]>([]);
  const [chatProfiles, setChatProfiles] = useState<ChatProfile[]>([]);
  const backgroundImageUrl = settings.backgroundImageUrl.trim();
  const backgroundOverlay = Math.min(0.9, Math.max(0, settings.backgroundImageOverlay / 100));
  const appBackgroundImage =
    settings.backgroundMode === 'image' && backgroundImageUrl
      ? `linear-gradient(160deg, rgb(17 24 39 / ${backgroundOverlay}), rgb(17 24 39 / ${Math.max(
          0,
          backgroundOverlay - 0.12,
        )})), url("${toSafeCssUrl(backgroundImageUrl)}")`
      : `radial-gradient(circle at 20% 10%, ${settings.backgroundGradientStart} 0%, ${settings.backgroundGradientEnd} 72%), linear-gradient(160deg, ${settings.backgroundGradientStart} 0%, ${settings.backgroundGradientEnd} 100%)`;

  const notifiedIdsRef = useRef<Set<string>>(new Set<string>());
  const readEmailIdsRef = useRef<Set<string>>(new Set<string>());
  const [notifierLoaded, setNotifierLoaded] = useState(false);

  const refreshData = useCallback(async () => {
    const nowMs = Date.now();
    const [loadedSettings, visibleEmails, allEmails, months] = await Promise.all([
      getSettings(),
      listEmails({ includeLocked: false, nowMs }),
      listEmails({ includeLocked: true, nowMs }),
      listCalendarMonths(),
    ]);

    const storedMonthKeys = months.map((entry) => entry.monthKey);
    const monthKeys = buildContinuousMonthKeys(storedMonthKeys, toMonthKey());
    const preferredMonth = monthKeys.includes(calendarMonthKey) ? calendarMonthKey : null;
    const activeMonth = preferredMonth ?? toMonthKey();
    const activeCalendar = await getCalendarMonth(activeMonth);

    setSettings(loadedSettings);
    setEmails(visibleEmails);
    setCalendarMonthKeys(monthKeys);
    setCalendarMonthKey(activeMonth);
    setCalendarData(activeCalendar ?? {});
    setVisibleEmailCount(visibleEmails.length);
    setTotalEmailCount(allEmails.length);
    setMonthCount(monthKeys.length);
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

  // Load persisted letters from IndexedDB on startup
  useEffect(() => {
    loadLetters()
      .then(setLetters)
      .catch(() => {});
  }, []);

  // Load chat profiles
  useEffect(() => {
    loadChatProfiles()
      .then(setChatProfiles)
      .catch(() => {});
  }, []);

  // Load letter custom font
  useEffect(() => {
    const href = settings.letterFontUrl.trim();
    const styleId = 'letter-custom-font-style';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!href) {
      style?.remove();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = buildFontFaceRule(LETTER_CUSTOM_FONT_FAMILY, href);
  }, [settings.letterFontUrl]);

  const handleImportLetterFiles = useCallback(async (files: File[]) => {
    const now = Date.now();
    const imported: StoredLetter[] = [];
    for (const file of files) {
      try {
        const content = await readLetterContent(file);
        if (content.trim()) {
          imported.push({ name: file.name, content, importedAt: now });
        }
      } catch {
        // skip unreadable files
      }
    }
    if (!imported.length) return;
    await saveLetters(imported);
    const updated = await loadLetters();
    setLetters(updated);
  }, []);

  const handleClearAllLetters = useCallback(async () => {
    await clearAllLetters();
    setLetters([]);
  }, []);

  const handleImportLetterFolderFiles = useCallback(async (files: File[]) => {
    // Same logic as file import — folder just provides multiple files at once
    const now = Date.now();
    const imported: StoredLetter[] = [];
    for (const file of files) {
      try {
        const content = await readLetterContent(file);
        if (content.trim()) {
          imported.push({ name: file.name, content, importedAt: now });
        }
      } catch {
        // skip unreadable files
      }
    }
    if (!imported.length) return;
    await saveLetters(imported);
    const updated = await loadLetters();
    setLetters(updated);
  }, []);

  const handleSaveChatProfile = useCallback(async (profile: ChatProfile) => {
    await saveChatProfile(profile);
    const updated = await loadChatProfiles();
    setChatProfiles(updated);
  }, []);

  const handleDeleteChatProfile = useCallback(async (id: string) => {
    await deleteChatProfile(id);
    setChatProfiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

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
    const href = settings.customFontFileUrl.trim();
    const styleId = 'custom-font-file-style';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!href) {
      if (style) {
        style.remove();
      }
      return;
    }

    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }

    style.textContent = buildFontFaceRule(APP_CUSTOM_FONT_FAMILY, href);
  }, [settings.customFontFileUrl]);

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

  useEffect(() => {
    let active = true;

    void getStarredEmailIds()
      .then((ids) => {
        if (!active) {
          return;
        }

        setStarredEmailIds(ids);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setStarredEmailIds(new Set<string>());
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    void getReadEmailIds()
      .then((ids) => {
        if (!active) {
          return;
        }

        readEmailIdsRef.current = ids;
        setReadIdsLoaded(true);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        readEmailIdsRef.current = new Set<string>();
        setReadIdsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!readIdsLoaded) {
      return;
    }

    setUnreadEmailIds(new Set(emails.filter((email) => !readEmailIdsRef.current.has(email.id)).map((email) => email.id)));
  }, [emails, readIdsLoaded]);

  const checkForNewUnlocks = useCallback(async () => {
    if (loadState !== 'ready' || !notifierLoaded) {
      return;
    }

    const allEmails = await listEmails({ includeLocked: true, nowMs: Date.now() });
    const pending = allEmails.filter((email) => email.isUnlocked && !notifiedIdsRef.current.has(email.id));

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

  const onImportEmlFiles = useCallback(
    async (files: File[]) => {
      setImportStatus({ kind: 'working', message: `正在匯入 ${files.length} 個 EML 檔案...` });

      try {
        const result = await importEmlFiles(files);
        const syncAt = new Date().toISOString();
        const nextSettings = await saveSettings({ lastSyncAt: syncAt });
        setSettings(nextSettings);
        await refreshData();
        setImportStatus(summarizeImport('EML', result));
      } catch (error) {
        setImportStatus({
          kind: 'error',
          message: `EML 匯入失敗：${error instanceof Error ? error.message : '未知錯誤'}`,
        });
      }
    },
    [refreshData],
  );

  const onImportCalendarFiles = useCallback(
    async (files: File[]) => {
      setImportStatus({ kind: 'working', message: `正在匯入 ${files.length} 個月曆 JSON 檔案...` });

      try {
        const result = await importCalendarFiles(files);
        const syncAt = new Date().toISOString();
        const nextSettings = await saveSettings({ lastSyncAt: syncAt });
        setSettings(nextSettings);
        await refreshData();
        setImportStatus(summarizeImport('Calendar', result));
      } catch (error) {
        setImportStatus({
          kind: 'error',
          message: `月曆匯入失敗：${error instanceof Error ? error.message : '未知錯誤'}`,
        });
      }
    },
    [refreshData],
  );

  const onMonthChange = useCallback(async (nextMonthKey: string) => {
    setCalendarMonthKey(nextMonthKey);
    const nextData = await getCalendarMonth(nextMonthKey);
    setCalendarData(nextData ?? {});
  }, []);

  const onOpenEmail = useCallback(async (emailId: string) => {
    if (readEmailIdsRef.current.has(emailId)) {
      return;
    }

    readEmailIdsRef.current.add(emailId);
    setUnreadEmailIds((prev) => {
      const next = new Set(prev);
      next.delete(emailId);
      return next;
    });

    try {
      await addReadEmailId(emailId);
    } catch {
      // Keep local optimistic state even if persistence fails.
    }
  }, []);

  const onToggleEmailStar = useCallback((emailId: string) => {
    setStarredEmailIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }

      void persistStarredEmailIds(next);
      return next;
    });
  }, []);

  const onHoverToneWeightChange = useCallback(
    async (tone: 'clingy' | 'confession' | 'calm' | 'remorse' | 'general', weight: number) => {
      const nextWeights = {
        ...settings.hoverToneWeights,
        [tone]: weight,
      };

      const next = await saveSettings({ hoverToneWeights: nextWeights });
      setSettings(next);
    },
    [settings.hoverToneWeights],
  );

  const onReshuffleHoverPhrases = useCallback(async () => {
    try {
      await setHoverPhraseMap({});
      setHoverResetSeed((prev) => prev + 1);
      setImportStatus({
        kind: 'success',
        message: 'Hover 語句已重抽，回月曆點日期就會抽新語句。',
      });
    } catch (error) {
      setImportStatus({
        kind: 'error',
        message: `重抽 Hover 語句失敗：${error instanceof Error ? error.message : '未知錯誤'}`,
      });
    }
  }, []);

  const onCalendarColorModeChange = useCallback(
    (mode: CalendarColorMode) => {
      void onSettingChange({ calendarColorMode: mode });
    },
    [onSettingChange],
  );

  const pages = useMemo(
    () => [
      {
        id: 'inbox',
        label: 'Inbox',
        node: (
          <InboxPage
            emails={emails}
            unreadEmailIds={unreadEmailIds}
            starredEmailIds={starredEmailIds}
            onOpenEmail={onOpenEmail}
            onToggleEmailStar={onToggleEmailStar}
          />
        ),
      },
      {
        id: 'calendar',
        label: 'Calendar',
        node: (
          <CalendarPage
            monthKey={calendarMonthKey}
            monthKeys={calendarMonthKeys}
            data={calendarData}
            hoverToneWeights={settings.hoverToneWeights}
            hoverResetSeed={hoverResetSeed}
            calendarColorMode={settings.calendarColorMode}
            monthAccentColor={monthAccentColor}
            onMonthChange={onMonthChange}
            onCalendarColorModeChange={onCalendarColorModeChange}
          />
        ),
      },
      {
        id: 'tarot',
        label: '塔羅',
        node: <TarotPage tarotGalleryImageUrl={settings.tarotGalleryImageUrl} />,
      },
      {
        id: 'letters',
        label: '情書',
        node: (
          <LetterPage
            letters={letters}
            chatProfiles={chatProfiles}
            letterFontFamily={letterFontFamily}
          />
        ),
      },
      {
        id: 'heart',
        label: 'MY LOVE',
        node: <HeartWallPage />,
      },
      {
        id: 'settings',
        label: '設定',
        node: (
          <SettingsPage
            settings={settings}
            visibleEmailCount={visibleEmailCount}
            totalEmailCount={totalEmailCount}
            monthCount={monthCount}
            notificationPermission={notificationPermission}
            importStatus={importStatus}
            letterCount={letters.length}
            chatProfiles={chatProfiles}
            onSettingChange={onSettingChange}
            onRequestNotificationPermission={onRequestNotificationPermission}
            onImportEmlFiles={onImportEmlFiles}
            onImportCalendarFiles={onImportCalendarFiles}
            onImportLetterFiles={(files) => void handleImportLetterFiles(files)}
            onImportLetterFolderFiles={(files) => void handleImportLetterFolderFiles(files)}
            onClearAllLetters={() => void handleClearAllLetters()}
            onSaveChatProfile={(profile) => void handleSaveChatProfile(profile)}
            onDeleteChatProfile={(id) => void handleDeleteChatProfile(id)}
            onHoverToneWeightChange={onHoverToneWeightChange}
            onReshuffleHoverPhrases={onReshuffleHoverPhrases}
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
      calendarMonthKeys,
      emails,
      importStatus,
      monthCount,
      monthAccentColor,
      notificationPermission,
      onOpenEmail,
      onToggleEmailStar,
      onHoverToneWeightChange,
      onImportCalendarFiles,
      onImportEmlFiles,
      onMonthChange,
      onCalendarColorModeChange,
      onRequestNotificationPermission,
      onReshuffleHoverPhrases,
      onSettingChange,
      refreshData,
      settings,
      starredEmailIds,
      totalEmailCount,
      hoverResetSeed,
      unreadEmailIds,
      visibleEmailCount,
      letters,
      chatProfiles,
      letterFontFamily,
      handleImportLetterFiles,
      handleImportLetterFolderFiles,
      handleClearAllLetters,
      handleSaveChatProfile,
      handleDeleteChatProfile,
    ],
  );

  return (
    <div
      className="relative h-dvh w-full overflow-hidden"
      style={{
        backgroundImage: appBackgroundImage,
        backgroundSize: settings.backgroundMode === 'image' && backgroundImageUrl ? 'cover' : undefined,
        backgroundPosition: settings.backgroundMode === 'image' && backgroundImageUrl ? 'center' : undefined,
        backgroundRepeat: settings.backgroundMode === 'image' && backgroundImageUrl ? 'no-repeat' : undefined,
        fontSize: `${settings.fontScale}rem`,
        ['--theme-accent' as string]: appAccentColor,
        ['--theme-accent-rgb' as string]: themeAccentRgb,
        ['--tab-accent-rgb' as string]: themeAccentRgb,
        ['--calendar-accent-rgb' as string]: calendarAccentRgb,
        ['--calendar-header-accent-rgb' as string]: calendarHeaderAccentRgb,
        ['--locked-bubble-rgb' as string]: lockedBubbleRgb,
        ['--app-font-scale' as string]: settings.fontScale,
        ['--app-font-family' as string]: appFontFamily,
        ['--app-heading-family' as string]: appHeadingFamily,
        ['--calendar-cell-radius' as string]: `${settings.calendarCellRadius}px`,
        ['--calendar-cell-shadow' as string]: settings.calendarCellShadow,
        ['--calendar-cell-depth' as string]: settings.calendarCellDepth,
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
            tabs={pages.map((page) => {
              const tabId = page.id as TabIconKey;
              return {
                id: page.id,
                label: page.label,
                icon: DEFAULT_TAB_ICONS[tabId] ?? '•',
                iconUrl: settings.tabIconUrls[tabId] || undefined,
              };
            })}
          />
        </>
      )}
    </div>
  );
}

export default App;
