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
import { CheckinPage } from './pages/CheckinPage';
import { ChatLogPage } from './pages/ChatLogPage';
import { MDiaryPage } from './pages/MDiaryPage';
import { DiaryBPage } from './pages/DiaryBPage';
import { HomePage } from './pages/HomePage';
import { InboxPage } from './pages/InboxPage';
import { LetterPage } from './pages/LetterPage';
import { PomodoroPage } from './pages/PomodoroPage';
import { PeriodPage } from './pages/PeriodPage';
import { clearAllChatLogs, loadChatLogs, saveChatLogs } from './lib/chatLogDB';
import type { StoredChatLog } from './lib/chatLogDB';
import { clearAllDiaries, loadDiaries, parseDiaryFile, saveDiaries } from './lib/diaryDB';
import type { StoredDiary } from './lib/diaryDB';
import { clearAllLetters, loadLetters, saveLetters } from './lib/letterDB';
import type { StoredLetter } from './lib/letterDB';
import { readLetterContent } from './lib/letterReader';
import { detectBestChatProfileId } from './lib/chatProfileMatcher';
import { APP_CUSTOM_FONT_FAMILY, DIARY_CUSTOM_FONT_FAMILY, LETTER_CUSTOM_FONT_FAMILY, buildFontFaceRule } from './lib/font';
import { deleteChatProfile, loadChatProfiles, saveChatProfile } from './lib/chatDB';
import { getBaseChibiPoolInfo, refreshActiveBaseChibiPool, syncActiveBaseChibiPool } from './lib/chibiPool';
import type { ChatProfile } from './lib/chatDB';
import { AlbumPage } from './pages/AlbumPage';
import { NotesPage } from './pages/NotesPage';
import SoulmateHousePage from './pages/SoulmateHousePage';
import { HeartWallPage } from './pages/HeartWallPage';
import { ListPage } from './pages/ListPage';
import { FitnessPage } from './pages/FitnessPage';
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
type LauncherAppId =
  | 'checkin'
  | 'tarot'
  | 'letters'
  | 'heart'
  | 'chat'
  | 'list'
  | 'fitness'
  | 'pomodoro'
  | 'period'
  | 'diary'
  | 'diaryB'
  | 'album'
  | 'notes'
  | 'soulmate';

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
  home: '🏠',
  inbox: '📮',
  calendar: '📅',
  tarot: '🔮',
  letters: '💌',
  heart: '💗',
  list: '🎴',
  fitness: '🏋️',
  pomodoro: '🍅',
  period: '🩸',
  diary: '📓',
  album: '📷',
  notes: '📝',
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

function fallbackLabel(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed || fallback;
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
  const [launcherApp, setLauncherApp] = useState<LauncherAppId | null>(null);
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
  const [chibiPoolInfo, setChibiPoolInfo] = useState(() => getBaseChibiPoolInfo(DEFAULT_SETTINGS.chibiPoolSize));
  const monthAccentColor = useMemo(() => getMonthAccentColor(calendarMonthKey), [calendarMonthKey]);
  const appAccentColor = settings.themeMonthColor;
  const calendarHeaderColor = monthAccentColor ?? appAccentColor;
  const calendarAccentColor = settings.calendarColorMode === 'month' ? calendarHeaderColor : appAccentColor;
  const appLabels = useMemo(
    () => ({
      home: fallbackLabel(settings.appLabels.home, 'Home'),
      inbox: fallbackLabel(settings.appLabels.inbox, 'Inbox'),
      calendar: fallbackLabel(settings.appLabels.calendar, 'Calendar'),
      settings: fallbackLabel(settings.appLabels.settings, '設定'),
      tarot: fallbackLabel(settings.appLabels.tarot, '塔羅'),
      letters: fallbackLabel(settings.appLabels.letters, '情書'),
      heart: fallbackLabel(settings.appLabels.heart, '心牆'),
      chat: fallbackLabel(settings.appLabels.chat, '對話'),
      list: fallbackLabel(settings.appLabels.list, '清單'),
      fitness: fallbackLabel(settings.appLabels.fitness, '健身'),
      pomodoro: fallbackLabel(settings.appLabels.pomodoro, '番茄鐘'),
      period: fallbackLabel(settings.appLabels.period, '經期日記'),
      diary: fallbackLabel(settings.appLabels.diary, '日記'),
      album: fallbackLabel(settings.appLabels.album, '相冊'),
      notes: fallbackLabel(settings.appLabels.notes, '心情日記'),
    }),
    [settings.appLabels],
  );
  const themeAccentRgb = useMemo(() => toRgbTriplet(appAccentColor), [appAccentColor]);
  const globalTextRgb = useMemo(() => toRgbTriplet(settings.globalTextColor), [settings.globalTextColor]);
  const calendarAccentRgb = useMemo(() => toRgbTriplet(calendarAccentColor), [calendarAccentColor]);
  const calendarHeaderAccentRgb = useMemo(() => toRgbTriplet(calendarHeaderColor), [calendarHeaderColor]);
  const lockedBubbleRgb = useMemo(() => toRgbTriplet(settings.lockedBubbleColor), [settings.lockedBubbleColor]);
  const calendarHoverBubbleTextRgb = useMemo(
    () => toRgbTriplet(settings.calendarHoverBubbleTextColor),
    [settings.calendarHoverBubbleTextColor],
  );
  const chatUserBubbleRgb = useMemo(() => toRgbTriplet(settings.chatUserBubbleColor), [settings.chatUserBubbleColor]);
  const chatUserBorderRgb = useMemo(
    () => toRgbTriplet(settings.chatUserBubbleBorderColor),
    [settings.chatUserBubbleBorderColor],
  );
  const chatAiBubbleRgb = useMemo(() => toRgbTriplet(settings.chatAiBubbleColor), [settings.chatAiBubbleColor]);
  const chatAiBorderRgb = useMemo(
    () => toRgbTriplet(settings.chatAiBubbleBorderColor),
    [settings.chatAiBubbleBorderColor],
  );
  const customFontFileUrl = settings.customFontFileUrl.trim();
  const customFontFamily = settings.customFontFamily.trim();
  const preferredCustomFontFamily = customFontFamily || (customFontFileUrl ? APP_CUSTOM_FONT_FAMILY : '');
  const appFontFamily =
    preferredCustomFontFamily || "'Plus Jakarta Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  const appHeadingFamily =
    preferredCustomFontFamily || "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
  const letterFontFamily = settings.letterFontUrl.trim() ? LETTER_CUSTOM_FONT_FAMILY : '';
  const diaryFontFamily = settings.diaryFontUrl.trim() ? DIARY_CUSTOM_FONT_FAMILY : '';
  const [unreadEmailIds, setUnreadEmailIds] = useState<Set<string>>(new Set<string>());
  const [starredEmailIds, setStarredEmailIds] = useState<Set<string>>(new Set<string>());
  const [readIdsLoaded, setReadIdsLoaded] = useState(false);
  const [hoverResetSeed, setHoverResetSeed] = useState(0);
  const [letters, setLetters] = useState<StoredLetter[]>([]);
  const [chatLogs, setChatLogs] = useState<StoredChatLog[]>([]);
  const [chatProfiles, setChatProfiles] = useState<ChatProfile[]>([]);
  const [diaries, setDiaries] = useState<StoredDiary[]>([]);
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

  // Load persisted chat logs
  useEffect(() => {
    loadChatLogs()
      .then(setChatLogs)
      .catch(() => {});
  }, []);

  // Load chat profiles
  useEffect(() => {
    loadChatProfiles()
      .then(setChatProfiles)
      .catch(() => {});
  }, []);

  // Load persisted diaries
  useEffect(() => {
    loadDiaries()
      .then(setDiaries)
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

  // Load diary custom font
  useEffect(() => {
    const href = settings.diaryFontUrl.trim();
    const styleId = 'diary-custom-font-style';
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
    style.textContent = buildFontFaceRule(DIARY_CUSTOM_FONT_FAMILY, href);
  }, [settings.diaryFontUrl]);

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

  const handleImportChatLogFiles = useCallback(async (files: File[]) => {
    const now = Date.now();
    const imported: StoredChatLog[] = [];
    for (const file of files) {
      try {
        const content = await readLetterContent(file);
        if (content.trim()) {
          const detectedProfileId = detectBestChatProfileId(content, chatProfiles);
          imported.push({
            name: file.name,
            content,
            importedAt: now,
            profileId: detectedProfileId || undefined,
          });
        }
      } catch {
        // skip unreadable files
      }
    }
    if (!imported.length) return;
    await saveChatLogs(imported);
    const updated = await loadChatLogs();
    setChatLogs(updated);
  }, [chatProfiles]);

  const handleImportChatLogFolderFiles = useCallback(async (files: File[]) => {
    const now = Date.now();
    const imported: StoredChatLog[] = [];
    for (const file of files) {
      try {
        const content = await readLetterContent(file);
        if (content.trim()) {
          const detectedProfileId = detectBestChatProfileId(content, chatProfiles);
          imported.push({
            name: file.name,
            content,
            importedAt: now,
            profileId: detectedProfileId || undefined,
          });
        }
      } catch {
        // skip unreadable files
      }
    }
    if (!imported.length) return;
    await saveChatLogs(imported);
    const updated = await loadChatLogs();
    setChatLogs(updated);
  }, [chatProfiles]);

  const handleClearAllChatLogs = useCallback(async () => {
    await clearAllChatLogs();
    setChatLogs([]);
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

  const handleImportDiaryFiles = useCallback(async (files: File[]) => {
    const imported: StoredDiary[] = [];
    for (const file of files) {
      try {
        imported.push(await parseDiaryFile(file));
      } catch {
        // skip unreadable files
      }
    }
    if (!imported.length) return;
    await saveDiaries(imported);
    const updated = await loadDiaries();
    setDiaries(updated);
  }, []);

  const handleImportDiaryFolderFiles = useCallback(async (files: File[]) => {
    const imported: StoredDiary[] = [];
    for (const file of files) {
      try {
        imported.push(await parseDiaryFile(file));
      } catch {
        // skip unreadable files
      }
    }
    if (!imported.length) return;
    await saveDiaries(imported);
    const updated = await loadDiaries();
    setDiaries(updated);
  }, []);

  const handleClearAllDiaries = useCallback(async () => {
    await clearAllDiaries();
    setDiaries([]);
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

  const handleBindChatLogProfile = useCallback(
    async (logName: string, profileId: string) => {
      const currentLog = chatLogs.find((log) => log.name === logName);
      if (!currentLog) return;

      const normalizedProfileId = profileId || undefined;
      if (currentLog.profileId === normalizedProfileId) return;

      const updatedLog: StoredChatLog = {
        ...currentLog,
        profileId: normalizedProfileId,
      };

      await saveChatLogs([updatedLog]);
      setChatLogs((prev) => prev.map((log) => (log.name === logName ? updatedLog : log)));
    },
    [chatLogs],
  );

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

  const onReshuffleChibiPool = useCallback(() => {
    const active = refreshActiveBaseChibiPool(settings.chibiPoolSize);
    const info = getBaseChibiPoolInfo(settings.chibiPoolSize);
    setChibiPoolInfo({
      allCount: info.allCount,
      activeCount: active.length,
      targetCount: info.targetCount,
    });
    setImportStatus({
      kind: 'success',
      message: `透明小人已重抽：啟用 ${active.length} 張`,
    });
  }, [settings.chibiPoolSize]);

  useEffect(() => {
    const active = syncActiveBaseChibiPool(settings.chibiPoolSize);
    const info = getBaseChibiPoolInfo(settings.chibiPoolSize);
    setChibiPoolInfo({
      allCount: info.allCount,
      activeCount: active.length,
      targetCount: info.targetCount,
    });
  }, [settings.chibiPoolSize]);

  const onCalendarColorModeChange = useCallback(
    (mode: CalendarColorMode) => {
      void onSettingChange({ calendarColorMode: mode });
    },
    [onSettingChange],
  );

  const onLaunchApp = useCallback((appId: LauncherAppId) => {
    setLauncherApp(appId);
  }, []);

  const pages = useMemo(
    () => [
      {
        id: 'home',
        label: appLabels.home,
        node: (
          <HomePage
            tabIconUrls={settings.tabIconUrls}
            tabIconDisplayMode={settings.tabIconDisplayMode}
            launcherLabels={appLabels}
            homeSwipeEnabled={settings.swipeEnabled}
            widgetTitle={settings.homeWidgetTitle}
            widgetSubtitle={settings.homeWidgetSubtitle}
            widgetBadgeText={settings.homeWidgetBadgeText}
            widgetIconDataUrl={settings.homeWidgetIconDataUrl}
            memorialStartDate={settings.memorialStartDate}
            onLaunchApp={onLaunchApp}
            onOpenCheckin={() => onLaunchApp('checkin')}
            onWidgetIconChange={(dataUrl) => {
              void onSettingChange({ homeWidgetIconDataUrl: dataUrl });
            }}
          />
        ),
      },
      {
        id: 'inbox',
        label: appLabels.inbox,
        node: (
          <InboxPage
            emails={emails}
            unreadEmailIds={unreadEmailIds}
            starredEmailIds={starredEmailIds}
            inboxTitle={settings.inboxTitle}
            onOpenEmail={onOpenEmail}
            onToggleEmailStar={onToggleEmailStar}
          />
        ),
      },
      {
        id: 'calendar',
        label: appLabels.calendar,
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
        id: 'settings',
        label: appLabels.settings,
        node: (
          <SettingsPage
            settings={settings}
            visibleEmailCount={visibleEmailCount}
            totalEmailCount={totalEmailCount}
            monthCount={monthCount}
            notificationPermission={notificationPermission}
            importStatus={importStatus}
            letterCount={letters.length}
            diaryCount={diaries.length}
            chatLogCount={chatLogs.length}
            chatProfiles={chatProfiles}
            chibiPoolInfo={chibiPoolInfo}
            onSettingChange={onSettingChange}
            onRequestNotificationPermission={onRequestNotificationPermission}
            onImportEmlFiles={onImportEmlFiles}
            onImportCalendarFiles={onImportCalendarFiles}
            onImportLetterFiles={(files) => void handleImportLetterFiles(files)}
            onImportLetterFolderFiles={(files) => void handleImportLetterFolderFiles(files)}
            onClearAllLetters={() => void handleClearAllLetters()}
            onImportDiaryFiles={(files) => void handleImportDiaryFiles(files)}
            onImportDiaryFolderFiles={(files) => void handleImportDiaryFolderFiles(files)}
            onClearAllDiaries={() => void handleClearAllDiaries()}
            onImportChatLogFiles={(files) => void handleImportChatLogFiles(files)}
            onImportChatLogFolderFiles={(files) => void handleImportChatLogFolderFiles(files)}
            onClearAllChatLogs={() => void handleClearAllChatLogs()}
            onSaveChatProfile={(profile) => void handleSaveChatProfile(profile)}
            onDeleteChatProfile={(id) => void handleDeleteChatProfile(id)}
            onHoverToneWeightChange={onHoverToneWeightChange}
            onReshuffleHoverPhrases={onReshuffleHoverPhrases}
            onReshuffleChibiPool={onReshuffleChibiPool}
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
      appLabels,
      chibiPoolInfo,
      importStatus,
      monthCount,
      monthAccentColor,
      notificationPermission,
      onLaunchApp,
      onOpenEmail,
      onToggleEmailStar,
      onHoverToneWeightChange,
      onImportCalendarFiles,
      onImportEmlFiles,
      onMonthChange,
      onCalendarColorModeChange,
      onRequestNotificationPermission,
      onReshuffleHoverPhrases,
      onReshuffleChibiPool,
      onSettingChange,
      refreshData,
      settings,
      starredEmailIds,
      totalEmailCount,
      hoverResetSeed,
      unreadEmailIds,
      visibleEmailCount,
      letters,
      diaries,
      chatLogs,
      chatProfiles,
      handleImportLetterFiles,
      handleImportLetterFolderFiles,
      handleClearAllLetters,
      handleImportDiaryFiles,
      handleImportDiaryFolderFiles,
      handleClearAllDiaries,
      handleImportChatLogFiles,
      handleImportChatLogFolderFiles,
      handleClearAllChatLogs,
      handleSaveChatProfile,
      handleDeleteChatProfile,
    ],
  );

  return (
    <div
      className="app-shell relative h-dvh w-full overflow-hidden"
      data-chat-style={settings.chatBubbleStyle}
      style={{
        backgroundImage: appBackgroundImage,
        backgroundSize: settings.backgroundMode === 'image' && backgroundImageUrl ? 'cover' : undefined,
        backgroundPosition: settings.backgroundMode === 'image' && backgroundImageUrl ? 'center' : undefined,
        backgroundRepeat: settings.backgroundMode === 'image' && backgroundImageUrl ? 'no-repeat' : undefined,
        fontSize: `${settings.fontScale}rem`,
        ['--theme-accent' as string]: appAccentColor,
        ['--theme-accent-rgb' as string]: themeAccentRgb,
        ['--app-text-rgb' as string]: globalTextRgb,
        ['--tab-accent-rgb' as string]: themeAccentRgb,
        ['--calendar-accent-rgb' as string]: calendarAccentRgb,
        ['--calendar-header-accent-rgb' as string]: calendarHeaderAccentRgb,
        ['--locked-bubble-rgb' as string]: lockedBubbleRgb,
        ['--calendar-hover-text-rgb' as string]: calendarHoverBubbleTextRgb,
        ['--chat-user-bubble-rgb' as string]: chatUserBubbleRgb,
        ['--chat-user-border-rgb' as string]: chatUserBorderRgb,
        ['--chat-ai-bubble-rgb' as string]: chatAiBubbleRgb,
        ['--chat-ai-border-rgb' as string]: chatAiBorderRgb,
        ['--chat-user-text' as string]: settings.chatUserBubbleTextColor,
        ['--chat-ai-text' as string]: settings.chatAiBubbleTextColor,
        ['--chat-bubble-radius' as string]: `${settings.chatBubbleRadius}px`,
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
            swipeEnabled={false}
            pages={pages.map((page) => ({ id: page.id, node: page.node }))}
          />
          {!launcherApp && (
            <BottomTabs
              activeIndex={activeTab}
              onSelect={setActiveTab}
              iconDisplayMode={settings.tabIconDisplayMode}
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
          )}

          {launcherApp === 'tarot' && (
            <div className="fixed inset-0 z-30 bg-black/55 px-4 pb-4 pt-4 backdrop-blur-sm">
              <div className="mx-auto flex h-full w-full max-w-xl flex-col">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white transition active:scale-95"
                    onClick={() => setLauncherApp(null)}
                  >
                    ‹
                  </button>
                  <p className="text-sm text-white/85">{appLabels.tarot}</p>
                  <span className="w-16" />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                  <TarotPage
                    tarotGalleryImageUrl={settings.tarotGalleryImageUrl}
                    tarotNameColor={settings.tarotNameColor}
                    tarotNameScale={settings.tarotNameScale}
                  />
                </div>
              </div>
            </div>
          )}

          {launcherApp === 'checkin' && (
            <div className="fixed inset-0 z-30 bg-black/55 px-4 pb-4 pt-4 backdrop-blur-sm">
              <div className="mx-auto flex h-full w-full max-w-xl flex-col">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white transition active:scale-95"
                    onClick={() => setLauncherApp(null)}
                  >
                    ‹
                  </button>
                  <p className="text-sm text-white/85">打卡簽到</p>
                  <span className="w-16" />
                </div>
                <div className="min-h-0 flex-1 overflow-hidden pt-3">
                  <CheckinPage />
                </div>
              </div>
            </div>
          )}

          {launcherApp === 'letters' && (
            <div className="fixed inset-0 z-30 bg-[#2C1810]">
              <div className="mx-auto h-full w-full max-w-xl">
                <LetterPage
                  letters={letters}
                  letterFontFamily={letterFontFamily}
                  uiMode={settings.letterUiMode}
                  onExit={() => setLauncherApp(null)}
                />
              </div>
            </div>
          )}

          {launcherApp === 'chat' && (
            <div className="fixed inset-0 z-30 bg-[#efeff4]">
              <div className="mx-auto h-full w-full max-w-xl">
                <ChatLogPage
                  logs={chatLogs}
                  chatProfiles={chatProfiles}
                  settings={settings}
                  onSettingChange={(partial) => void onSettingChange(partial)}
                  onImportChatLogFiles={(files) => void handleImportChatLogFiles(files)}
                  onImportChatLogFolderFiles={(files) => void handleImportChatLogFolderFiles(files)}
                  onClearAllChatLogs={() => void handleClearAllChatLogs()}
                  onSaveChatProfile={(profile) => void handleSaveChatProfile(profile)}
                  onDeleteChatProfile={(id) => void handleDeleteChatProfile(id)}
                  onBindLogProfile={(logName, profileId) => void handleBindChatLogProfile(logName, profileId)}
                  onExit={() => setLauncherApp(null)}
                />
              </div>
            </div>
          )}

          {launcherApp === 'heart' && (
            <div className="fixed inset-0 z-30 bg-black/65 px-4 pb-4 pt-4 backdrop-blur-sm">
              <div className="mx-auto flex h-full w-full max-w-xl flex-col">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white transition active:scale-95"
                    onClick={() => setLauncherApp(null)}
                  >
                    ‹
                  </button>
                  <p className="text-sm text-white/85">{appLabels.heart}</p>
                  <span className="w-16" />
                </div>
                <div className="min-h-0 flex-1 overflow-hidden pt-3">
                  <HeartWallPage />
                </div>
              </div>
            </div>
          )}

          {launcherApp === 'list' && (
            <div className="fixed inset-0 z-30 bg-black/55 px-4 pb-4 pt-4 backdrop-blur-sm">
              <div className="mx-auto flex h-full w-full max-w-xl flex-col">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white transition active:scale-95"
                    onClick={() => setLauncherApp(null)}
                  >
                    ‹
                  </button>
                  <p className="text-sm text-white/85">{appLabels.list}</p>
                  <span className="w-16" />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                  <ListPage />
                </div>
              </div>
            </div>
          )}

          {launcherApp === 'fitness' && (
            <div className="fixed inset-0 z-30 bg-black/55 px-4 pb-4 pt-4 backdrop-blur-sm">
              <div className="mx-auto flex h-full w-full max-w-xl flex-col">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white transition active:scale-95"
                    onClick={() => setLauncherApp(null)}
                  >
                    ‹
                  </button>
                  <p className="text-sm text-white/85">{appLabels.fitness}</p>
                  <span className="w-16" />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                  <FitnessPage />
                </div>
              </div>
            </div>
          )}

          {launcherApp === 'pomodoro' && (
            <div className="fixed inset-0 z-30 bg-black/55 px-4 pb-4 pt-4 backdrop-blur-sm">
              <div className="mx-auto flex h-full w-full max-w-xl flex-col">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white transition active:scale-95"
                    onClick={() => setLauncherApp(null)}
                  >
                    ‹
                  </button>
                  <p className="text-sm text-white/85">{appLabels.pomodoro}</p>
                  <span className="w-16" />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                  <PomodoroPage />
                </div>
              </div>
            </div>
          )}

          {launcherApp === 'period' && (
            <div className="fixed inset-0 z-30" style={{ background: '#fdf7f4' }}>
              <div className="mx-auto h-full w-full max-w-xl">
                <PeriodPage onExit={() => setLauncherApp(null)} />
              </div>
            </div>
          )}

          {launcherApp === 'diary' && (
            <div className="fixed inset-0 z-30" style={{ background: '#f6f2ea' }}>
              <div className="mx-auto h-full w-full max-w-xl">
                <MDiaryPage
                  entries={diaries}
                  diaryCoverImageUrl={settings.diaryCoverImageUrl}
                  diaryFontFamily={diaryFontFamily}
                  diaryCoverFitMode={settings.diaryCoverFitMode}
                  mDiaryLineHeight={settings.mDiaryLineHeight}
                  mDiaryShowCount={settings.mDiaryShowCount}
                  onSettingChange={(partial) => void onSettingChange(partial)}
                  onExit={() => setLauncherApp(null)}
                />
              </div>
            </div>
          )}

          {launcherApp === 'diaryB' && (
            <div className="fixed inset-0 z-30" style={{ background: '#f8f4ed' }}>
              <div className="mx-auto h-full w-full max-w-xl">
                <DiaryBPage
                  diaryCoverImageUrl={settings.diaryCoverImageUrl}
                  diaryFontFamily={diaryFontFamily}
                  diaryCoverFitMode={settings.diaryCoverFitMode}
                  onExit={() => setLauncherApp(null)}
                />
              </div>
            </div>
          )}

          {launcherApp === 'album' && (
            <div className="fixed inset-0 z-30 bg-black/55 px-4 pb-4 pt-4 backdrop-blur-sm">
              <div className="mx-auto flex h-full w-full max-w-xl flex-col">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white transition active:scale-95"
                    onClick={() => setLauncherApp(null)}
                  >
                    ‹
                  </button>
                  <p className="text-sm text-white/85">{appLabels.album}</p>
                  <span className="w-16" />
                </div>
                <div className="min-h-0 flex-1 overflow-hidden pt-3">
                  <AlbumPage />
                </div>
              </div>
            </div>
          )}

          {launcherApp === 'notes' && (
            <div className="fixed inset-0 z-30" style={{ background: '#fdf6ee' }}>
              <div className="mx-auto h-full w-full max-w-xl">
                <NotesPage
                  onExit={() => setLauncherApp(null)}
                  notesFontSize={settings.notesFontSize}
                  notesTextColor={settings.notesTextColor}
                />
              </div>
            </div>
          )}

          {launcherApp === 'soulmate' && (
            <div className="fixed inset-0 z-30" style={{ background: '#fdf6ee' }}>
              <div className="mx-auto h-full w-full max-w-xl">
                <SoulmateHousePage onExit={() => setLauncherApp(null)} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
