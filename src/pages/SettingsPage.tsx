import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { APP_CUSTOM_FONT_FAMILY, SETTINGS_PREVIEW_FONT_FAMILY, buildFontFaceRule } from '../lib/font';
import type { ChatProfile } from '../lib/chatDB';
import type { AppLabelKey, AppLabels, AppSettings, BackgroundMode, TabIconKey, TabIconUrls } from '../types/settings';

type SettingsPageProps = {
  settings: AppSettings;
  visibleEmailCount: number;
  totalEmailCount: number;
  monthCount: number;
  notificationPermission: NotificationPermission | 'unsupported';
  importStatus: {
    kind: 'idle' | 'working' | 'success' | 'error';
    message: string;
  };
  letterCount: number;
  diaryCount: number;
  chatLogCount: number;
  chatProfiles: ChatProfile[];
  chibiPoolInfo: {
    allCount: number;
    activeCount: number;
    targetCount: number;
  };
  onSettingChange: (partial: Partial<AppSettings>) => void;
  onRequestNotificationPermission: () => void;
  onImportEmlFiles: (files: File[]) => void;
  onImportCalendarFiles: (files: File[]) => void;
  onImportLetterFiles: (files: File[]) => void;
  onImportLetterFolderFiles: (files: File[]) => void;
  onImportDiaryFiles: (files: File[]) => void;
  onImportDiaryFolderFiles: (files: File[]) => void;
  onImportChatLogFiles: (files: File[]) => void;
  onImportChatLogFolderFiles: (files: File[]) => void;
  onClearAllLetters: () => void;
  onClearAllDiaries: () => void;
  onClearAllChatLogs: () => void;
  onExportAboutMeBackup: () => Promise<string> | string;
  onExportAboutMBackup: () => Promise<string> | string;
  onExportAboutMBackupPart: (part: 'mDiary' | 'letters' | 'chatLogs' | 'inbox' | 'soulmate') => Promise<string> | string;
  onImportAboutMeBackup: (files: File[], mode: 'merge' | 'overwrite') => Promise<string> | string;
  onImportAboutMBackup: (files: File[], mode: 'merge' | 'overwrite') => Promise<string> | string;
  onImportAboutMBackupPart: (
    part: 'mDiary' | 'letters' | 'chatLogs' | 'inbox' | 'soulmate',
    files: File[],
    mode: 'merge' | 'overwrite',
  ) => Promise<string> | string;
  onSaveChatProfile: (profile: ChatProfile) => void;
  onDeleteChatProfile: (id: string) => void;
  onHoverToneWeightChange: (tone: 'clingy' | 'confession' | 'calm' | 'remorse' | 'general', weight: number) => void;
  onReshuffleHoverPhrases: () => void;
  onReshuffleChibiPool: () => void;
  onRefresh: () => void;
};

type AboutMBackupPart = 'mDiary' | 'letters' | 'chatLogs' | 'inbox' | 'soulmate';

type PanelKey =
  | 'overview'
  | 'bigBackup'
  | 'appearance'
  | 'home'
  | 'labels'
  | 'tabIcons'
  | 'notification'
  | 'imports'
  | 'hover'
  | 'tarot'
  | 'letters'
  | 'diary'
  | 'notes'
  | 'chatLogs'
  | 'maintenance';

type AppearanceGroupKey = 'colorScale' | 'font' | 'background' | 'calendar' | 'chibi' | 'preset';

const TAB_ICON_FALLBACK: Record<TabIconKey, string> = {
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

const TAB_ICON_LABELS: Array<{ key: TabIconKey; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'tarot', label: 'Tarot' },
  { key: 'letters', label: 'Letters' },
  { key: 'heart', label: 'MY LOVE' },
  { key: 'list', label: 'List 清單' },
  { key: 'fitness', label: 'Fitness 健身' },
  { key: 'pomodoro', label: 'Pomodoro 番茄鐘' },
  { key: 'period', label: 'Period 經期日記' },
  { key: 'diary', label: 'Diary 日記' },
  { key: 'album', label: 'Album 相冊' },
  { key: 'notes', label: 'Notes 便利貼' },
  { key: 'settings', label: 'Settings' },
];

const APP_LABEL_FIELDS: Array<{ key: AppLabelKey; label: string }> = [
  { key: 'home', label: '底部分頁：Home' },
  { key: 'inbox', label: '底部分頁：Inbox' },
  { key: 'calendar', label: '底部分頁：Calendar' },
  { key: 'settings', label: '底部分頁：Settings' },
  { key: 'tarot', label: '首頁入口：塔羅' },
  { key: 'letters', label: '首頁入口：情書' },
  { key: 'heart', label: '首頁入口：心牆' },
  { key: 'chat', label: '首頁入口：對話' },
  { key: 'list', label: '首頁入口：清單' },
  { key: 'fitness', label: '首頁入口：健身' },
  { key: 'pomodoro', label: '首頁入口：番茄鐘' },
  { key: 'period', label: '首頁入口：經期日記' },
  { key: 'diary', label: '首頁入口：日記' },
  { key: 'album', label: '首頁入口：相冊' },
  { key: 'notes', label: '首頁入口：便利貼' },
];

const ABOUT_M_PART_FIELDS: Array<{ key: AboutMBackupPart; label: string; hint: string }> = [
  { key: 'mDiary', label: 'M日記', hint: 'mDiary.json' },
  { key: 'letters', label: '情書', hint: 'letters.json' },
  { key: 'chatLogs', label: '對話紀錄', hint: 'chatLogs.json' },
  { key: 'inbox', label: 'Inbox / 月曆', hint: 'inbox.json' },
  { key: 'soulmate', label: '搬家計劃書', hint: 'soulmate.json' },
];

type AppearancePresetPayload = {
  version: 1;
  savedAt: string;
  appearance: {
    themeMonthColor: string;
    globalTextColor: string;
    calendarColorMode: AppSettings['calendarColorMode'];
    lockedBubbleColor: string;
    calendarHoverBubbleTextColor: string;
    chatBubbleStyle: AppSettings['chatBubbleStyle'];
    chatUserBubbleColor: string;
    chatUserBubbleBorderColor: string;
    chatUserBubbleTextColor: string;
    chatAiBubbleColor: string;
    chatAiBubbleBorderColor: string;
    chatAiBubbleTextColor: string;
    chatBubbleRadius: number;
    customFontFileUrl: string;
    customFontFamily: string;
    fontScale: number;
    tabIconUrls: TabIconUrls;
    tabIconDisplayMode: AppSettings['tabIconDisplayMode'];
    calendarCellRadius: number;
    calendarCellShadow: number;
    calendarCellDepth: number;
    backgroundMode: BackgroundMode;
    backgroundGradientStart: string;
    backgroundGradientEnd: string;
    backgroundImageUrl: string;
    backgroundImageOverlay: number;
    homeWidgetTitle: string;
    homeWidgetSubtitle: string;
    homeWidgetBadgeText: string;
    homeWidgetIconDataUrl: string;
    inboxTitle: string;
    memorialStartDate: string;
    diaryCoverFitMode: AppSettings['diaryCoverFitMode'];
    tarotNameColor: string;
    tarotNameScale: number;
    chibiPoolSize: number;
    appLabels: AppLabels;
  };
};

type SettingPanelProps = {
  icon: string;
  title: string;
  subtitle: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
};

type SettingSubgroupProps = {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function SettingPanel({ icon, title, subtitle, isOpen, onToggle, children }: SettingPanelProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-700/80 bg-[#161b26] shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-white transition hover:bg-white/5"
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/12 text-lg">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm">{title}</span>
          <span className="block truncate text-xs text-stone-300">{subtitle}</span>
        </span>
        <span
          className={`text-xl leading-none text-stone-300 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          ›
        </span>
      </button>
      {isOpen && <div className="border-t border-stone-700/70 bg-white/95 p-4 text-sm text-stone-700">{children}</div>}
    </section>
  );
}

function SettingSubgroup({ title, subtitle, isOpen, onToggle, children }: SettingSubgroupProps) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm text-stone-800">{title}</span>
          {subtitle ? <span className="mt-0.5 block text-xs text-stone-500">{subtitle}</span> : null}
        </span>
        <span
          className={`text-lg leading-none text-stone-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>
      {isOpen && <div className="mt-3 space-y-3 border-t border-stone-200 pt-3">{children}</div>}
    </div>
  );
}

export function SettingsPage({
  settings,
  visibleEmailCount,
  totalEmailCount,
  monthCount,
  notificationPermission,
  importStatus,
  letterCount,
  diaryCount,
  chatLogCount,
  chatProfiles,
  chibiPoolInfo,
  onSettingChange,
  onRequestNotificationPermission,
  onImportEmlFiles,
  onImportCalendarFiles,
  onImportLetterFiles,
  onImportLetterFolderFiles,
  onImportDiaryFiles,
  onImportDiaryFolderFiles,
  onImportChatLogFiles,
  onImportChatLogFolderFiles,
  onClearAllLetters,
  onClearAllDiaries,
  onClearAllChatLogs,
  onExportAboutMeBackup,
  onExportAboutMBackup,
  onExportAboutMBackupPart,
  onImportAboutMeBackup,
  onImportAboutMBackup,
  onImportAboutMBackupPart,
  onSaveChatProfile,
  onDeleteChatProfile,
  onHoverToneWeightChange,
  onReshuffleHoverPhrases,
  onReshuffleChibiPool,
  onRefresh,
}: SettingsPageProps) {
  const [openPanel, setOpenPanel] = useState<PanelKey | null>('appearance');
  const [letterFontUrlDraft, setLetterFontUrlDraft] = useState(settings.letterFontUrl);
  const [diaryCoverUrlDraft, setDiaryCoverUrlDraft] = useState(settings.diaryCoverImageUrl);
  const [diaryFontUrlDraft, setDiaryFontUrlDraft] = useState(settings.diaryFontUrl);
  const [tarotGalleryUrlDraft, setTarotGalleryUrlDraft] = useState(settings.tarotGalleryImageUrl);
  const [homeWidgetTitleDraft, setHomeWidgetTitleDraft] = useState(settings.homeWidgetTitle);
  const [homeWidgetBadgeDraft, setHomeWidgetBadgeDraft] = useState(settings.homeWidgetBadgeText);
  const [homeWidgetSubtitleDraft, setHomeWidgetSubtitleDraft] = useState(settings.homeWidgetSubtitle);
  const [inboxTitleDraft, setInboxTitleDraft] = useState(settings.inboxTitle);
  const [memorialStartDateDraft, setMemorialStartDateDraft] = useState(settings.memorialStartDate);
  const [newProfileDraft, setNewProfileDraft] = useState<Omit<ChatProfile, 'id'>>({
    name: '',
    leftNick: 'M',
    rightNick: '你',
    leftAvatarDataUrl: '',
    rightAvatarDataUrl: '',
  });
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [fontFileUrlDraft, setFontFileUrlDraft] = useState(settings.customFontFileUrl);
  const [fontFamilyDraft, setFontFamilyDraft] = useState(settings.customFontFamily);
  const [backgroundImageUrlDraft, setBackgroundImageUrlDraft] = useState(settings.backgroundImageUrl);
  const [tabIconDrafts, setTabIconDrafts] = useState<TabIconUrls>(settings.tabIconUrls);
  const [labelDrafts, setLabelDrafts] = useState<AppLabels>(settings.appLabels);
  const [tabIconStatus, setTabIconStatus] = useState('');
  const [appearancePresetStatus, setAppearancePresetStatus] = useState('');
  const [chibiPoolStatus, setChibiPoolStatus] = useState('');
  const [homeTextStatus, setHomeTextStatus] = useState('');
  const [labelStatus, setLabelStatus] = useState('');
  const [aboutMeBackupStatus, setAboutMeBackupStatus] = useState('');
  const [aboutMBackupStatus, setAboutMBackupStatus] = useState('');
  const [backupBusy, setBackupBusy] = useState<'aboutMe' | 'aboutM' | null>(null);
  const [openBackupGroup, setOpenBackupGroup] = useState<'aboutMe' | 'aboutM' | null>('aboutMe');
  const [openAppearanceGroup, setOpenAppearanceGroup] = useState<AppearanceGroupKey | null>('colorScale');
  const [openChatBubbleGroup, setOpenChatBubbleGroup] = useState(false);

  useEffect(() => {
    setFontFileUrlDraft(settings.customFontFileUrl);
    setFontFamilyDraft(settings.customFontFamily);
    setBackgroundImageUrlDraft(settings.backgroundImageUrl);
    setTabIconDrafts(settings.tabIconUrls);
    setLabelDrafts(settings.appLabels);
    setLetterFontUrlDraft(settings.letterFontUrl);
    setDiaryCoverUrlDraft(settings.diaryCoverImageUrl);
    setDiaryFontUrlDraft(settings.diaryFontUrl);
    setTarotGalleryUrlDraft(settings.tarotGalleryImageUrl);
    setHomeWidgetTitleDraft(settings.homeWidgetTitle);
    setHomeWidgetBadgeDraft(settings.homeWidgetBadgeText);
    setHomeWidgetSubtitleDraft(settings.homeWidgetSubtitle);
    setInboxTitleDraft(settings.inboxTitle);
    setMemorialStartDateDraft(settings.memorialStartDate);
  }, [
    settings.customFontFileUrl,
    settings.customFontFamily,
    settings.backgroundImageUrl,
    settings.tabIconUrls,
    settings.appLabels,
    settings.letterFontUrl,
    settings.diaryCoverImageUrl,
    settings.diaryFontUrl,
    settings.tarotGalleryImageUrl,
    settings.homeWidgetTitle,
    settings.homeWidgetBadgeText,
    settings.homeWidgetSubtitle,
    settings.inboxTitle,
    settings.memorialStartDate,
  ]);

  useEffect(() => {
    const styleId = 'settings-preview-font-file-style';
    const href = fontFileUrlDraft.trim();
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

    style.textContent = buildFontFaceRule(SETTINGS_PREVIEW_FONT_FAMILY, href);
  }, [fontFileUrlDraft]);

  useEffect(() => {
    return () => {
      const style = document.getElementById('settings-preview-font-file-style');
      style?.remove();
    };
  }, []);

  function togglePanel(panel: PanelKey) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  function toggleBackupGroup(group: 'aboutMe' | 'aboutM') {
    setOpenBackupGroup((current) => (current === group ? null : group));
  }

  function toggleAppearanceGroup(group: AppearanceGroupKey) {
    setOpenAppearanceGroup((current) => (current === group ? null : group));
  }

  function applyFontSettings() {
    onSettingChange({
      customFontCssUrl: '',
      customFontFileUrl: fontFileUrlDraft.trim(),
      customFontFamily: fontFamilyDraft.trim(),
    });
  }

  function setTabIconDraft(tab: TabIconKey, value: string) {
    setTabIconDrafts((current) => ({
      ...current,
      [tab]: value,
    }));
    setTabIconStatus('');
  }

  function handleTabIconUpload(tab: TabIconKey, file: File | null) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return;
      }
      setTabIconDraft(tab, reader.result);
      setTabIconStatus(`${TAB_ICON_LABELS.find((item) => item.key === tab)?.label ?? tab} 圖示已放入草稿`);
    };
    reader.readAsDataURL(file);
  }

  function setLabelDraft(key: AppLabelKey, value: string) {
    setLabelDrafts((current) => ({
      ...current,
      [key]: value,
    }));
    setLabelStatus('');
  }

  function saveTabIcons() {
    const next: TabIconUrls = {
      home: tabIconDrafts.home.trim(),
      inbox: tabIconDrafts.inbox.trim(),
      calendar: tabIconDrafts.calendar.trim(),
      tarot: tabIconDrafts.tarot.trim(),
      letters: tabIconDrafts.letters.trim(),
      heart: tabIconDrafts.heart.trim(),
      list: tabIconDrafts.list.trim(),
      fitness: tabIconDrafts.fitness.trim(),
      pomodoro: tabIconDrafts.pomodoro.trim(),
      period: tabIconDrafts.period.trim(),
      diary: tabIconDrafts.diary.trim(),
      album: tabIconDrafts.album.trim(),
      notes: tabIconDrafts.notes.trim(),
      settings: tabIconDrafts.settings.trim(),
    };

    onSettingChange({ tabIconUrls: next });
    setTabIconStatus('圖標設定已儲存');
  }

  function restoreSavedTabIcons() {
    setTabIconDrafts(settings.tabIconUrls);
    setTabIconStatus('已還原成目前儲存值');
  }

  function saveAppLabels() {
    const next: AppLabels = {
      home: labelDrafts.home.trim(),
      inbox: labelDrafts.inbox.trim(),
      calendar: labelDrafts.calendar.trim(),
      settings: labelDrafts.settings.trim(),
      tarot: labelDrafts.tarot.trim(),
      letters: labelDrafts.letters.trim(),
      heart: labelDrafts.heart.trim(),
      chat: labelDrafts.chat.trim(),
      list: labelDrafts.list.trim(),
      fitness: labelDrafts.fitness.trim(),
      pomodoro: labelDrafts.pomodoro.trim(),
      period: labelDrafts.period.trim(),
      diary: labelDrafts.diary.trim(),
      album: labelDrafts.album.trim(),
      notes: labelDrafts.notes.trim(),
    };

    onSettingChange({ appLabels: next });
    setLabelStatus('入口名稱已儲存');
  }

  function restoreSavedAppLabels() {
    setLabelDrafts(settings.appLabels);
    setLabelStatus('已還原成目前儲存值');
  }

  function exportAppearancePreset() {
    const payload: AppearancePresetPayload = {
      version: 1,
      savedAt: new Date().toISOString(),
      appearance: {
        themeMonthColor: settings.themeMonthColor,
        globalTextColor: settings.globalTextColor,
        calendarColorMode: settings.calendarColorMode,
        lockedBubbleColor: settings.lockedBubbleColor,
        calendarHoverBubbleTextColor: settings.calendarHoverBubbleTextColor,
        chatBubbleStyle: settings.chatBubbleStyle,
        chatUserBubbleColor: settings.chatUserBubbleColor,
        chatUserBubbleBorderColor: settings.chatUserBubbleBorderColor,
        chatUserBubbleTextColor: settings.chatUserBubbleTextColor,
        chatAiBubbleColor: settings.chatAiBubbleColor,
        chatAiBubbleBorderColor: settings.chatAiBubbleBorderColor,
        chatAiBubbleTextColor: settings.chatAiBubbleTextColor,
        chatBubbleRadius: settings.chatBubbleRadius,
        customFontFileUrl: settings.customFontFileUrl,
        customFontFamily: settings.customFontFamily,
        fontScale: settings.fontScale,
        tabIconUrls: settings.tabIconUrls,
        tabIconDisplayMode: settings.tabIconDisplayMode,
        calendarCellRadius: settings.calendarCellRadius,
        calendarCellShadow: settings.calendarCellShadow,
        calendarCellDepth: settings.calendarCellDepth,
        backgroundMode: settings.backgroundMode,
        backgroundGradientStart: settings.backgroundGradientStart,
        backgroundGradientEnd: settings.backgroundGradientEnd,
        backgroundImageUrl: settings.backgroundImageUrl,
        backgroundImageOverlay: settings.backgroundImageOverlay,
        homeWidgetTitle: settings.homeWidgetTitle,
        homeWidgetSubtitle: settings.homeWidgetSubtitle,
        homeWidgetBadgeText: settings.homeWidgetBadgeText,
        homeWidgetIconDataUrl: settings.homeWidgetIconDataUrl,
        inboxTitle: settings.inboxTitle,
        memorialStartDate: settings.memorialStartDate,
        diaryCoverFitMode: settings.diaryCoverFitMode,
        tarotNameColor: settings.tarotNameColor,
        tarotNameScale: settings.tarotNameScale,
        chibiPoolSize: settings.chibiPoolSize,
        appLabels: settings.appLabels,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `memorial-style-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
    setAppearancePresetStatus('已匯出美化設定 JSON');
  }

  async function importAppearancePreset(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppearancePresetPayload> & { appearance?: Partial<AppSettings> };
      const source = (parsed.appearance ?? parsed) as Partial<AppSettings>;
      const next: Partial<AppSettings> = {};

      if (typeof source.themeMonthColor === 'string') {
        next.themeMonthColor = source.themeMonthColor;
      }
      if (typeof source.globalTextColor === 'string') {
        next.globalTextColor = source.globalTextColor;
      }
      if (source.calendarColorMode === 'month' || source.calendarColorMode === 'custom') {
        next.calendarColorMode = source.calendarColorMode;
      }
      if (typeof source.lockedBubbleColor === 'string') {
        next.lockedBubbleColor = source.lockedBubbleColor;
      }
      if (typeof source.calendarHoverBubbleTextColor === 'string') {
        next.calendarHoverBubbleTextColor = source.calendarHoverBubbleTextColor;
      }
      if (
        source.chatBubbleStyle === 'jelly' ||
        source.chatBubbleStyle === 'imessage' ||
        source.chatBubbleStyle === 'imessageClassic'
      ) {
        next.chatBubbleStyle = source.chatBubbleStyle;
      }
      if (typeof source.chatUserBubbleColor === 'string') {
        next.chatUserBubbleColor = source.chatUserBubbleColor;
      }
      if (typeof source.chatUserBubbleBorderColor === 'string') {
        next.chatUserBubbleBorderColor = source.chatUserBubbleBorderColor;
      }
      if (typeof source.chatUserBubbleTextColor === 'string') {
        next.chatUserBubbleTextColor = source.chatUserBubbleTextColor;
      }
      if (typeof source.chatAiBubbleColor === 'string') {
        next.chatAiBubbleColor = source.chatAiBubbleColor;
      }
      if (typeof source.chatAiBubbleBorderColor === 'string') {
        next.chatAiBubbleBorderColor = source.chatAiBubbleBorderColor;
      }
      if (typeof source.chatAiBubbleTextColor === 'string') {
        next.chatAiBubbleTextColor = source.chatAiBubbleTextColor;
      }
      if (typeof source.chatBubbleRadius === 'number' && Number.isFinite(source.chatBubbleRadius)) {
        next.chatBubbleRadius = source.chatBubbleRadius;
      }
      if (typeof source.customFontFileUrl === 'string') {
        next.customFontFileUrl = source.customFontFileUrl;
      }
      if (typeof source.customFontFamily === 'string') {
        next.customFontFamily = source.customFontFamily;
      }
      if (typeof source.fontScale === 'number' && Number.isFinite(source.fontScale)) {
        next.fontScale = source.fontScale;
      }
      if (source.tabIconUrls && typeof source.tabIconUrls === 'object') {
        const input = source.tabIconUrls as Partial<TabIconUrls>;
        next.tabIconUrls = {
          home: typeof input.home === 'string' ? input.home.trim() : '',
          inbox: typeof input.inbox === 'string' ? input.inbox.trim() : '',
          calendar: typeof input.calendar === 'string' ? input.calendar.trim() : '',
          tarot: typeof input.tarot === 'string' ? input.tarot.trim() : '',
          letters: typeof input.letters === 'string' ? input.letters.trim() : '',
          heart: typeof input.heart === 'string' ? input.heart.trim() : '',
          list: typeof input.list === 'string' ? input.list.trim() : '',
          fitness: typeof input.fitness === 'string' ? input.fitness.trim() : '',
          pomodoro: typeof input.pomodoro === 'string' ? input.pomodoro.trim() : '',
          period: typeof input.period === 'string' ? input.period.trim() : '',
          diary: typeof input.diary === 'string' ? input.diary.trim() : '',
          album: typeof input.album === 'string' ? input.album.trim() : '',
          notes: typeof input.notes === 'string' ? input.notes.trim() : '',
          settings: typeof input.settings === 'string' ? input.settings.trim() : '',
        };
      }
      if (source.tabIconDisplayMode === 'framed' || source.tabIconDisplayMode === 'full') {
        next.tabIconDisplayMode = source.tabIconDisplayMode;
      }
      if (typeof source.calendarCellRadius === 'number' && Number.isFinite(source.calendarCellRadius)) {
        next.calendarCellRadius = source.calendarCellRadius;
      }
      if (typeof source.calendarCellShadow === 'number' && Number.isFinite(source.calendarCellShadow)) {
        next.calendarCellShadow = source.calendarCellShadow;
      }
      if (typeof source.calendarCellDepth === 'number' && Number.isFinite(source.calendarCellDepth)) {
        next.calendarCellDepth = source.calendarCellDepth;
      }
      if (source.backgroundMode === 'gradient' || source.backgroundMode === 'image') {
        next.backgroundMode = source.backgroundMode;
      }
      if (typeof source.backgroundGradientStart === 'string') {
        next.backgroundGradientStart = source.backgroundGradientStart;
      }
      if (typeof source.backgroundGradientEnd === 'string') {
        next.backgroundGradientEnd = source.backgroundGradientEnd;
      }
      if (typeof source.backgroundImageUrl === 'string') {
        next.backgroundImageUrl = source.backgroundImageUrl;
      }
      if (typeof source.backgroundImageOverlay === 'number' && Number.isFinite(source.backgroundImageOverlay)) {
        next.backgroundImageOverlay = source.backgroundImageOverlay;
      }
      if (typeof source.homeWidgetTitle === 'string') {
        next.homeWidgetTitle = source.homeWidgetTitle;
      }
      if (typeof source.homeWidgetSubtitle === 'string') {
        next.homeWidgetSubtitle = source.homeWidgetSubtitle;
      }
      if (typeof source.homeWidgetBadgeText === 'string') {
        next.homeWidgetBadgeText = source.homeWidgetBadgeText;
      }
      if (typeof source.homeWidgetIconDataUrl === 'string') {
        next.homeWidgetIconDataUrl = source.homeWidgetIconDataUrl;
      }
      if (typeof source.inboxTitle === 'string') {
        next.inboxTitle = source.inboxTitle;
      }
      if (typeof source.memorialStartDate === 'string') {
        next.memorialStartDate = source.memorialStartDate;
      }
      if (source.diaryCoverFitMode === 'cover' || source.diaryCoverFitMode === 'contain') {
        next.diaryCoverFitMode = source.diaryCoverFitMode;
      }
      if (typeof source.tarotNameColor === 'string') {
        next.tarotNameColor = source.tarotNameColor;
      }
      if (typeof source.tarotNameScale === 'number' && Number.isFinite(source.tarotNameScale)) {
        next.tarotNameScale = source.tarotNameScale;
      }
      if (typeof source.chibiPoolSize === 'number' && Number.isFinite(source.chibiPoolSize)) {
        next.chibiPoolSize = Math.max(20, Math.min(200, Math.round(source.chibiPoolSize)));
      }
      if (source.appLabels && typeof source.appLabels === 'object') {
        const input = source.appLabels as Partial<AppLabels>;
        next.appLabels = {
          home: typeof input.home === 'string' ? input.home.trim() : '',
          inbox: typeof input.inbox === 'string' ? input.inbox.trim() : '',
          calendar: typeof input.calendar === 'string' ? input.calendar.trim() : '',
          settings: typeof input.settings === 'string' ? input.settings.trim() : '',
          tarot: typeof input.tarot === 'string' ? input.tarot.trim() : '',
          letters: typeof input.letters === 'string' ? input.letters.trim() : '',
          heart: typeof input.heart === 'string' ? input.heart.trim() : '',
          chat: typeof input.chat === 'string' ? input.chat.trim() : '',
          list: typeof input.list === 'string' ? input.list.trim() : '',
          fitness: typeof input.fitness === 'string' ? input.fitness.trim() : '',
          pomodoro: typeof input.pomodoro === 'string' ? input.pomodoro.trim() : '',
          period: typeof input.period === 'string' ? input.period.trim() : '',
          diary: typeof input.diary === 'string' ? input.diary.trim() : '',
          album: typeof input.album === 'string' ? input.album.trim() : '',
          notes: typeof input.notes === 'string' ? input.notes.trim() : '',
        };
      }

      onSettingChange(next);
      setAppearancePresetStatus('已匯入美化設定');
    } catch {
      setAppearancePresetStatus('匯入失敗：檔案不是有效的 JSON');
    }
  }

  function handleBackgroundImageUpload(file: File | null) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return;
      }

      setBackgroundImageUrlDraft(reader.result);
      onSettingChange({
        backgroundMode: 'image',
        backgroundImageUrl: reader.result,
      });
    };
    reader.readAsDataURL(file);
  }

  function handleFontFileUpload(file: File | null) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return;
      }

      setFontFileUrlDraft(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function applyHomeTextSettings() {
    onSettingChange({
      homeWidgetTitle: homeWidgetTitleDraft.trim(),
      homeWidgetBadgeText: homeWidgetBadgeDraft.trim(),
      homeWidgetSubtitle: homeWidgetSubtitleDraft.trim(),
      inboxTitle: inboxTitleDraft.trim(),
      memorialStartDate: memorialStartDateDraft.trim(),
    });
    setHomeTextStatus('已儲存');
    window.setTimeout(() => setHomeTextStatus(''), 1200);
  }

  function handleHomeWidgetIconUpload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      onSettingChange({ homeWidgetIconDataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  }

  function handleDiaryCoverUpload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setDiaryCoverUrlDraft(reader.result);
      onSettingChange({ diaryCoverImageUrl: reader.result });
    };
    reader.readAsDataURL(file);
  }

  async function runBackupAction(
    target: 'aboutMe' | 'aboutM',
    workingText: string,
    action: () => Promise<string> | string,
  ) {
    setBackupBusy(target);
    if (target === 'aboutMe') {
      setAboutMeBackupStatus(workingText);
    } else {
      setAboutMBackupStatus(workingText);
    }

    try {
      const result = await action();
      const text = typeof result === 'string' && result.trim() ? result : '操作完成';
      if (target === 'aboutMe') {
        setAboutMeBackupStatus(text);
      } else {
        setAboutMBackupStatus(text);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : '操作失敗';
      if (target === 'aboutMe') {
        setAboutMeBackupStatus(`失敗：${text}`);
      } else {
        setAboutMBackupStatus(`失敗：${text}`);
      }
    } finally {
      setBackupBusy(null);
    }
  }

  const previewFontFamily = useMemo(() => {
    const draftFamily = fontFamilyDraft.trim();
    if (draftFamily) {
      return draftFamily;
    }

    if (fontFileUrlDraft.trim()) {
      return SETTINGS_PREVIEW_FONT_FAMILY;
    }

    const savedFamily = settings.customFontFamily.trim();
    if (savedFamily) {
      return savedFamily;
    }

    if (settings.customFontFileUrl.trim()) {
      return APP_CUSTOM_FONT_FAMILY;
    }

    return "'Plus Jakarta Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  }, [fontFamilyDraft, fontFileUrlDraft, settings.customFontFamily, settings.customFontFileUrl]);

  const notificationLabel =
    notificationPermission === 'unsupported'
      ? '此瀏覽器不支援'
      : notificationPermission === 'granted'
        ? '已允許'
        : notificationPermission === 'denied'
          ? '已封鎖'
          : '尚未決定';

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pb-24">
      <header className="themed-header-panel rounded-2xl border p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">設定</p>
        <h1 className="mt-1 text-2xl text-stone-900">控制中心</h1>
      </header>

      <div className="space-y-2">
        <SettingPanel
          icon="📊"
          title="資料概況"
          subtitle="目前信件與月曆數量"
          isOpen={openPanel === 'overview'}
          onToggle={() => togglePanel('overview')}
        >
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <dt className="text-xs text-stone-500">可見信件</dt>
              <dd className="text-lg text-stone-900">{visibleEmailCount}</dd>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <dt className="text-xs text-stone-500">信件總數</dt>
              <dd className="text-lg text-stone-900">{totalEmailCount}</dd>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <dt className="text-xs text-stone-500">月曆月份數</dt>
              <dd className="text-lg text-stone-900">{monthCount}</dd>
            </div>
          </dl>
        </SettingPanel>

        <SettingPanel
          icon="🗃️"
          title="大備份"
          subtitle="關於我 / 關於M 分包匯入匯出"
          isOpen={openPanel === 'bigBackup'}
          onToggle={() => togglePanel('bigBackup')}
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <button
                type="button"
                onClick={() => toggleBackupGroup('aboutMe')}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-stone-800">關於我</span>
                  <span className="mt-0.5 block text-xs text-stone-500">包含：經期日記、打卡、我的日記（B）、便利貼</span>
                </span>
                <span
                  className={`text-lg leading-none text-stone-500 transition-transform ${openBackupGroup === 'aboutMe' ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  ⌄
                </span>
              </button>

              {openBackupGroup === 'aboutMe' && (
                <div className="mt-3 space-y-2.5 border-t border-stone-200 pt-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => {
                        void runBackupAction('aboutMe', '關於我匯出中…', () => onExportAboutMeBackup());
                      }}
                      disabled={backupBusy !== null}
                      className="rounded-lg bg-stone-900 px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      完整匯出
                    </button>
                    <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-center text-xs text-stone-700">
                      匯入（合併）
                      <input
                        type="file"
                        multiple
                        accept=".json,application/json"
                        className="hidden"
                        disabled={backupBusy !== null}
                        onChange={(event) => {
                          const files = event.target.files ? Array.from(event.target.files) : [];
                          if (files.length) {
                            void runBackupAction('aboutMe', '關於我匯入中（合併）…', () =>
                              onImportAboutMeBackup(files, 'merge'),
                            );
                          }
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <label className="cursor-pointer rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-center text-xs text-rose-700">
                      匯入（覆蓋）
                      <input
                        type="file"
                        multiple
                        accept=".json,application/json"
                        className="hidden"
                        disabled={backupBusy !== null}
                        onChange={(event) => {
                          const files = event.target.files ? Array.from(event.target.files) : [];
                          if (files.length) {
                            void runBackupAction('aboutMe', '關於我匯入中（覆蓋）…', () =>
                              onImportAboutMeBackup(files, 'overwrite'),
                            );
                          }
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                  {aboutMeBackupStatus && <p className="text-xs text-stone-600">{aboutMeBackupStatus}</p>}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <button
                type="button"
                onClick={() => toggleBackupGroup('aboutM')}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-stone-800">關於M</span>
                  <span className="mt-0.5 block text-xs text-stone-500">分包：mDiary / letters / chatLogs / inbox / soulmate（含 metadata）</span>
                </span>
                <span
                  className={`text-lg leading-none text-stone-500 transition-transform ${openBackupGroup === 'aboutM' ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  ⌄
                </span>
              </button>

              {openBackupGroup === 'aboutM' && (
                <div className="mt-3 space-y-3 border-t border-stone-200 pt-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => {
                        void runBackupAction('aboutM', '關於M匯出中…', () => onExportAboutMBackup());
                      }}
                      disabled={backupBusy !== null}
                      className="rounded-lg bg-stone-900 px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      完整匯出
                    </button>
                    <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-center text-xs text-stone-700">
                      匯入（合併）
                      <input
                        type="file"
                        multiple
                        accept=".json,application/json"
                        className="hidden"
                        disabled={backupBusy !== null}
                        onChange={(event) => {
                          const files = event.target.files ? Array.from(event.target.files) : [];
                          if (files.length) {
                            void runBackupAction('aboutM', '關於M匯入中（合併）…', () =>
                              onImportAboutMBackup(files, 'merge'),
                            );
                          }
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <label className="cursor-pointer rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-center text-xs text-rose-700">
                      匯入（覆蓋）
                      <input
                        type="file"
                        multiple
                        accept=".json,application/json"
                        className="hidden"
                        disabled={backupBusy !== null}
                        onChange={(event) => {
                          const files = event.target.files ? Array.from(event.target.files) : [];
                          if (files.length) {
                            void runBackupAction('aboutM', '關於M匯入中（覆蓋）…', () =>
                              onImportAboutMBackup(files, 'overwrite'),
                            );
                          }
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <div className="space-y-2 rounded-lg border border-stone-200 bg-white px-2.5 py-2.5">
                    <p className="text-xs text-stone-500">分包匯出 / 匯入（適合大檔案分批）</p>
                    <div className="space-y-2">
                      {ABOUT_M_PART_FIELDS.map((field) => (
                        <div key={field.key} className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-stone-700">{field.label}</p>
                            <p className="text-[11px] text-stone-400">{field.hint}</p>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void runBackupAction('aboutM', `關於M・${field.label}匯出中…`, () =>
                                  onExportAboutMBackupPart(field.key),
                                );
                              }}
                              disabled={backupBusy !== null}
                              className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-center text-[11px] text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              匯出
                            </button>
                            <label className="cursor-pointer rounded-md border border-stone-300 bg-white px-2 py-1.5 text-center text-[11px] text-stone-700">
                              合併
                              <input
                                type="file"
                                accept=".json,application/json"
                                className="hidden"
                                disabled={backupBusy !== null}
                                onChange={(event) => {
                                  const files = event.target.files ? Array.from(event.target.files) : [];
                                  if (files.length) {
                                    void runBackupAction('aboutM', `關於M・${field.label}匯入中（合併）…`, () =>
                                      onImportAboutMBackupPart(field.key, files, 'merge'),
                                    );
                                  }
                                  event.currentTarget.value = '';
                                }}
                              />
                            </label>
                            <label className="cursor-pointer rounded-md border border-rose-300 bg-rose-50 px-2 py-1.5 text-center text-[11px] text-rose-700">
                              覆蓋
                              <input
                                type="file"
                                accept=".json,application/json"
                                className="hidden"
                                disabled={backupBusy !== null}
                                onChange={(event) => {
                                  const files = event.target.files ? Array.from(event.target.files) : [];
                                  if (files.length) {
                                    void runBackupAction('aboutM', `關於M・${field.label}匯入中（覆蓋）…`, () =>
                                      onImportAboutMBackupPart(field.key, files, 'overwrite'),
                                    );
                                  }
                                  event.currentTarget.value = '';
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {aboutMBackupStatus && <p className="text-xs text-stone-600">{aboutMBackupStatus}</p>}
                </div>
              )}
            </div>

            <div className="space-y-1 text-xs text-stone-500">
              <p>完整匯入請一次選同一包的全部 JSON（包含 manifest 索引檔）。</p>
              <p>分包匯出/匯入可單獨處理 mDiary / letters / chatLogs / inbox / soulmate。</p>
            </div>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="🎨"
          title="外觀與字體"
          subtitle="主題色、日曆外觀、字型替換"
          isOpen={openPanel === 'appearance'}
          onToggle={() => togglePanel('appearance')}
        >
          <div className="space-y-3">
            <SettingSubgroup
              title="色彩與字體比例"
              subtitle="主題色、首頁文字、泡泡色、縮放"
              isOpen={openAppearanceGroup === 'colorScale'}
              onToggle={() => toggleAppearanceGroup('colorScale')}
            >
              <label className="block space-y-2">
                <span>自訂主題色（分頁與自訂月曆色）</span>
                <input
                  type="color"
                  value={settings.themeMonthColor}
                  onChange={(event) => onSettingChange({ themeMonthColor: event.target.value })}
                  className="h-10 w-full rounded-md border border-stone-300"
                />
              </label>

              <label className="block space-y-2">
                <span>首頁字體顏色</span>
                <input
                  type="color"
                  value={settings.globalTextColor}
                  onChange={(event) => onSettingChange({ globalTextColor: event.target.value })}
                  className="h-10 w-full rounded-md border border-stone-300"
                />
              </label>

              <label className="block space-y-2">
                <span>未解鎖泡泡色</span>
                <input
                  type="color"
                  value={settings.lockedBubbleColor}
                  onChange={(event) => onSettingChange({ lockedBubbleColor: event.target.value })}
                  className="h-10 w-full rounded-md border border-stone-300"
                />
              </label>

              <label className="block space-y-2">
                <span>月曆底下氣泡文字色</span>
                <input
                  type="color"
                  value={settings.calendarHoverBubbleTextColor}
                  onChange={(event) => onSettingChange({ calendarHoverBubbleTextColor: event.target.value })}
                  className="h-10 w-full rounded-md border border-stone-300"
                />
              </label>

              <label className="block space-y-2">
                <span>字體大小：{settings.fontScale.toFixed(2)}x</span>
                <input
                  type="range"
                  min={0.9}
                  max={1.25}
                  step={0.05}
                  value={settings.fontScale}
                  onChange={(event) => onSettingChange({ fontScale: Number(event.target.value) })}
                  className="w-full"
                />
              </label>
            </SettingSubgroup>

            <SettingSubgroup
              title="字體替換（整站）"
              subtitle="網址或檔案上傳（ttf/otf/woff）"
              isOpen={openAppearanceGroup === 'font'}
              onToggle={() => toggleAppearanceGroup('font')}
            >
              <label className="block space-y-1">
                <span className="text-xs text-stone-600">字體檔網址（ttf / otf / woff / woff2）</span>
                <input
                  type="url"
                  value={fontFileUrlDraft}
                  onChange={(event) => setFontFileUrlDraft(event.target.value)}
                  placeholder="https://example.com/custom.ttf"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-stone-600">或直接上傳字體檔</span>
                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                  onChange={(event) => {
                    handleFontFileUpload(event.target.files?.[0] ?? null);
                    event.currentTarget.value = '';
                  }}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-stone-600">字體名稱（font-family，可留空）</span>
                <input
                  type="text"
                  value={fontFamilyDraft}
                  onChange={(event) => setFontFamilyDraft(event.target.value)}
                  placeholder="Noto Sans TC"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                />
              </label>
              <div className="rounded-lg border border-dashed border-stone-300 bg-white px-3 py-2">
                <p className="text-xs text-stone-500">字體預覽</p>
                <p
                  className="mt-1 text-base text-stone-800"
                  style={{ fontFamily: `${previewFontFamily}, 'Plus Jakarta Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif` }}
                >
                  老婆，我在這裡。AaBb123
                </p>
              </div>
              <p className="text-xs text-stone-500">
                若是跨網域字體檔，來源需允許 CORS，否則手機瀏覽器會擋掉而看起來「沒套用」。
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={applyFontSettings}
                  className="rounded-lg bg-stone-900 px-3 py-2 text-xs text-white"
                >
                  套用字體
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFontFileUrlDraft('');
                    setFontFamilyDraft('');
                    onSettingChange({
                      customFontCssUrl: '',
                      customFontFileUrl: '',
                      customFontFamily: '',
                    });
                  }}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
                >
                  還原預設
                </button>
              </div>
            </SettingSubgroup>

            <SettingSubgroup
              title="背景樣式"
              subtitle="漸層或圖片背景"
              isOpen={openAppearanceGroup === 'background'}
              onToggle={() => toggleAppearanceGroup('background')}
            >
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSettingChange({ backgroundMode: 'gradient' })}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    settings.backgroundMode === 'gradient'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  漸層背景
                </button>
                <button
                  type="button"
                  onClick={() => onSettingChange({ backgroundMode: 'image' })}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    settings.backgroundMode === 'image'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  圖片背景
                </button>
              </div>

              {settings.backgroundMode === 'gradient' ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-stone-600">漸層起始色</span>
                    <input
                      type="color"
                      value={settings.backgroundGradientStart}
                      onChange={(event) => onSettingChange({ backgroundGradientStart: event.target.value })}
                      className="h-10 w-full rounded-md border border-stone-300"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-stone-600">漸層結束色</span>
                    <input
                      type="color"
                      value={settings.backgroundGradientEnd}
                      onChange={(event) => onSettingChange({ backgroundGradientEnd: event.target.value })}
                      className="h-10 w-full rounded-md border border-stone-300"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-stone-600">背景圖片網址</span>
                    <input
                      type="url"
                      value={backgroundImageUrlDraft}
                      onChange={(event) => setBackgroundImageUrlDraft(event.target.value)}
                      placeholder="https://example.com/background.jpg"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSettingChange({ backgroundImageUrl: backgroundImageUrlDraft.trim() })}
                      className="rounded-lg bg-stone-900 px-3 py-2 text-xs text-white"
                    >
                      套用圖片網址
                    </button>
                    <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700">
                      上傳背景圖
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          handleBackgroundImageUpload(event.target.files?.[0] ?? null);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <label className="block space-y-1">
                    <span className="flex items-center justify-between text-xs text-stone-600">
                      <span>圖片遮罩深度</span>
                      <span>{settings.backgroundImageOverlay}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={90}
                      step={1}
                      value={settings.backgroundImageOverlay}
                      onChange={(event) => onSettingChange({ backgroundImageOverlay: Number(event.target.value) })}
                      className="w-full"
                    />
                  </label>
                </div>
              )}
            </SettingSubgroup>

            <SettingSubgroup
              title="月曆立體外觀"
              subtitle="圓角、陰影、深度"
              isOpen={openAppearanceGroup === 'calendar'}
              onToggle={() => toggleAppearanceGroup('calendar')}
            >
              <label className="block space-y-1">
                <span className="flex items-center justify-between">
                  <span>圓角</span>
                  <span className="text-xs text-stone-500">{settings.calendarCellRadius}px</span>
                </span>
                <input
                  type="range"
                  min={8}
                  max={28}
                  step={1}
                  value={settings.calendarCellRadius}
                  onChange={(event) => onSettingChange({ calendarCellRadius: Number(event.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="block space-y-1">
                <span className="flex items-center justify-between">
                  <span>陰影強度</span>
                  <span className="text-xs text-stone-500">{settings.calendarCellShadow}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.calendarCellShadow}
                  onChange={(event) => onSettingChange({ calendarCellShadow: Number(event.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="block space-y-1">
                <span className="flex items-center justify-between">
                  <span>立體感</span>
                  <span className="text-xs text-stone-500">{settings.calendarCellDepth}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.calendarCellDepth}
                  onChange={(event) => onSettingChange({ calendarCellDepth: Number(event.target.value) })}
                  className="w-full"
                />
              </label>
            </SettingSubgroup>

            <SettingSubgroup
              title="透明小人輪換池"
              subtitle="池大小與一鍵輪換"
              isOpen={openAppearanceGroup === 'chibi'}
              onToggle={() => toggleAppearanceGroup('chibi')}
            >
              <p className="text-xs text-stone-500">
                已上傳 {chibiPoolInfo.allCount} 張，啟用池 {chibiPoolInfo.activeCount} 張。
              </p>
              <label className="block space-y-1">
                <span className="flex items-center justify-between text-xs text-stone-600">
                  <span>啟用池大小</span>
                  <span>{settings.chibiPoolSize} 張</span>
                </span>
                <input
                  type="range"
                  min={20}
                  max={200}
                  step={5}
                  value={settings.chibiPoolSize}
                  onChange={(event) => {
                    onSettingChange({ chibiPoolSize: Number(event.target.value) });
                    setChibiPoolStatus('已更新啟用池大小');
                  }}
                  className="w-full"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  onReshuffleChibiPool();
                  setChibiPoolStatus('已重新抽換透明小人池');
                }}
                className="rounded-lg bg-stone-900 px-3 py-2 text-xs text-white"
              >
                一鍵輪換
              </button>
              {chibiPoolStatus && <p className="text-xs text-stone-600">{chibiPoolStatus}</p>}
              <p className="text-xs text-stone-500">
                支援透明 PNG / WebP / AVIF。可以全部上傳，系統會只抽啟用池避免卡頓。
              </p>
            </SettingSubgroup>

            <SettingSubgroup
              title="美化設定備份"
              subtitle="匯入 / 匯出外觀 JSON"
              isOpen={openAppearanceGroup === 'preset'}
              onToggle={() => toggleAppearanceGroup('preset')}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={exportAppearancePreset}
                  className="rounded-lg bg-stone-900 px-3 py-2 text-xs text-white"
                >
                  匯出美化 JSON
                </button>
                <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700">
                  匯入美化 JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void importAppearancePreset(file);
                      }
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              {appearancePresetStatus && <p className="text-xs text-stone-600">{appearancePresetStatus}</p>}
            </SettingSubgroup>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="🏠"
          title="首頁與信箱"
          subtitle="首頁卡片文案 · 信箱標題"
          isOpen={openPanel === 'home'}
          onToggle={() => togglePanel('home')}
        >
          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-sm text-stone-800">首頁卡片</p>

              <label className="block space-y-1">
                <span className="text-xs text-stone-600">標題</span>
                <input
                  type="text"
                  value={homeWidgetTitleDraft}
                  onChange={(e) => { setHomeWidgetTitleDraft(e.target.value); setHomeTextStatus(''); }}
                  placeholder="Memorial"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-stone-600">標籤（留空就不顯示）</span>
                <input
                  type="text"
                  value={homeWidgetBadgeDraft}
                  onChange={(e) => { setHomeWidgetBadgeDraft(e.target.value); setHomeTextStatus(''); }}
                  placeholder="ACTIVE"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-stone-600">小語（留空就不顯示）</span>
                <input
                  type="text"
                  value={homeWidgetSubtitleDraft}
                  onChange={(e) => { setHomeWidgetSubtitleDraft(e.target.value); setHomeTextStatus(''); }}
                  placeholder="在這裡等妳，慢慢把日子收好。"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <div className="space-y-2">
                <p className="text-xs text-stone-600">小圖（點首頁也可以換）</p>
                <div className="flex items-center gap-2">
                  <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-stone-200 bg-white">
                    {settings.homeWidgetIconDataUrl.trim() ? (
                      <img src={settings.homeWidgetIconDataUrl} alt="預覽" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl">♡</span>
                    )}
                  </div>
                  <label className="cursor-pointer rounded-lg bg-stone-900 px-3 py-2 text-xs text-white">
                    上傳小圖
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        handleHomeWidgetIconUpload(event.target.files?.[0] ?? null);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {settings.homeWidgetIconDataUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => onSettingChange({ homeWidgetIconDataUrl: '' })}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
                    >
                      移除
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-sm text-stone-800">信箱標題</p>
              <input
                type="text"
                value={inboxTitleDraft}
                onChange={(e) => { setInboxTitleDraft(e.target.value); setHomeTextStatus(''); }}
                placeholder="Memorial Mailroom"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-sm text-stone-800">想你的第 N 天起始日</p>
              <input
                type="date"
                value={memorialStartDateDraft}
                onChange={(e) => { setMemorialStartDateDraft(e.target.value); setHomeTextStatus(''); }}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              />
              <p className="text-xs text-stone-500">留空會顯示未設定（N 先顯示 1）。</p>
            </div>

            <button
              type="button"
              onClick={applyHomeTextSettings}
              className="w-full rounded-xl bg-stone-900 py-2.5 text-sm text-white transition active:opacity-80"
            >
              儲存
            </button>
            {homeTextStatus && <p className="text-xs text-stone-500">{homeTextStatus}</p>}
          </div>
        </SettingPanel>

        <SettingPanel
          icon="🏷️"
          title="入口名稱"
          subtitle="底部分頁與首頁入口可自訂"
          isOpen={openPanel === 'labels'}
          onToggle={() => togglePanel('labels')}
        >
          <div className="space-y-3">
            {APP_LABEL_FIELDS.map((field) => (
              <label key={field.key} className="block space-y-1">
                <span className="text-xs text-stone-600">{field.label}</span>
                <input
                  type="text"
                  value={labelDrafts[field.key]}
                  onChange={(event) => setLabelDraft(field.key, event.target.value)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            ))}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveAppLabels}
                className="rounded-lg bg-stone-900 px-3 py-2 text-xs text-white"
              >
                儲存名稱
              </button>
              <button
                type="button"
                onClick={restoreSavedAppLabels}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
              >
                還原草稿
              </button>
            </div>
            {labelStatus && <p className="text-xs text-stone-600">{labelStatus}</p>}
            <p className="text-xs text-stone-500">留空會套用預設名稱。</p>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="🧩"
          title="自訂圖標"
          subtitle="底部分頁與首頁入口圖示（可用圖片網址）"
          isOpen={openPanel === 'tabIcons'}
          onToggle={() => togglePanel('tabIcons')}
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <p className="text-xs text-stone-600">圖示顯示模式</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSettingChange({ tabIconDisplayMode: 'framed' });
                    setTabIconStatus('已切換為：卡片框');
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs ${
                    settings.tabIconDisplayMode === 'framed'
                      ? 'bg-stone-900 text-white'
                      : 'border border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  卡片框
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSettingChange({ tabIconDisplayMode: 'full' });
                    setTabIconStatus('已切換為：滿版');
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs ${
                    settings.tabIconDisplayMode === 'full'
                      ? 'bg-stone-900 text-white'
                      : 'border border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  滿版
                </button>
              </div>
            </div>

            {TAB_ICON_LABELS.map((tab) => {
              const iconUrl = tabIconDrafts[tab.key];
              return (
                <label key={tab.key} className="block space-y-1">
                  <span className="text-xs text-stone-600">{tab.label} 圖示網址</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 bg-white text-lg">
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt=""
                          className={`${
                            settings.tabIconDisplayMode === 'full'
                              ? 'h-8 w-8 rounded-lg object-cover'
                              : 'h-6 w-6 rounded-md object-cover'
                          }`}
                        />
                      ) : (
                        TAB_ICON_FALLBACK[tab.key]
                      )}
                    </span>
                    <input
                      type="url"
                      value={iconUrl}
                      onChange={(event) => setTabIconDraft(tab.key, event.target.value)}
                      placeholder="https://example.com/icon.png"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                    />
                    <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs text-stone-700">
                      上傳
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          handleTabIconUpload(tab.key, event.target.files?.[0] ?? null);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {iconUrl && (
                      <button
                        type="button"
                        onClick={() => setTabIconDraft(tab.key, '')}
                        className="rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs text-stone-700"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </label>
              );
            })}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveTabIcons}
                className="rounded-lg bg-stone-900 px-3 py-2 text-xs text-white"
              >
                儲存圖標設定
              </button>
              <button
                type="button"
                onClick={restoreSavedTabIcons}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
              >
                還原草稿
              </button>
            </div>
            {tabIconStatus && <p className="text-xs text-stone-600">{tabIconStatus}</p>}
            <p className="text-xs text-stone-500">
              留空就用預設圖示。可貼網址或直接上傳圖片（會存成本機 data URL）。
            </p>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="🔔"
          title="通知與操作"
          subtitle="首頁桌面滑動、通知權限"
          isOpen={openPanel === 'notification'}
          onToggle={() => togglePanel('notification')}
        >
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <span>啟用首頁左右滑桌面</span>
              <input
                type="checkbox"
                checked={settings.swipeEnabled}
                onChange={(event) => onSettingChange({ swipeEnabled: event.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <span>啟用解鎖通知</span>
              <input
                type="checkbox"
                checked={settings.localNotificationsEnabled}
                onChange={(event) => onSettingChange({ localNotificationsEnabled: event.target.checked })}
              />
            </label>
            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <p>通知權限：{notificationLabel}</p>
              <button
                type="button"
                onClick={onRequestNotificationPermission}
                disabled={notificationPermission === 'unsupported' || notificationPermission === 'granted'}
                className="rounded-lg bg-stone-900 px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:bg-stone-400"
              >
                申請通知權限
              </button>
            </div>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="📥"
          title="本機匯入"
          subtitle="EML 與月曆 JSON"
          isOpen={openPanel === 'imports'}
          onToggle={() => togglePanel('imports')}
        >
          <div className="space-y-3">
            <label className="block space-y-2">
              <span>匯入 EML 信件</span>
              <input
                type="file"
                multiple
                accept=".eml,message/rfc822,text/plain"
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : [];
                  if (files.length) {
                    onImportEmlFiles(files);
                  }
                  event.currentTarget.value = '';
                }}
                className="w-full rounded-lg border border-stone-300 bg-white px-2 py-2"
              />
            </label>
            <label className="block space-y-2">
              <span>匯入月曆 JSON</span>
              <input
                type="file"
                multiple
                accept=".json,application/json"
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : [];
                  if (files.length) {
                    onImportCalendarFiles(files);
                  }
                  event.currentTarget.value = '';
                }}
                className="w-full rounded-lg border border-stone-300 bg-white px-2 py-2"
              />
            </label>

            {importStatus.kind !== 'idle' && (
              <p
                className={`rounded-lg border px-3 py-2 text-xs ${
                  importStatus.kind === 'error'
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : importStatus.kind === 'success'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-stone-300 bg-stone-100 text-stone-700'
                }`}
              >
                {importStatus.message}
              </p>
            )}
          </div>
        </SettingPanel>

        <SettingPanel
          icon="💬"
          title="Hover 語氣"
          subtitle="語氣權重與重抽"
          isOpen={openPanel === 'hover'}
          onToggle={() => togglePanel('hover')}
        >
          <div className="space-y-3">
            <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              {[
                { key: 'clingy', label: '黏人語氣' },
                { key: 'confession', label: '認真表白' },
                { key: 'calm', label: '冷靜守候' },
                { key: 'remorse', label: '破防懺悔' },
                { key: 'general', label: '通用語句' },
              ].map((tone) => (
                <label key={tone.key} className="block space-y-1">
                  <span className="flex items-center justify-between">
                    <span>{tone.label}</span>
                    <span className="text-xs text-stone-500">
                      權重 {settings.hoverToneWeights[tone.key as keyof typeof settings.hoverToneWeights]}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={settings.hoverToneWeights[tone.key as keyof typeof settings.hoverToneWeights]}
                    onChange={(event) =>
                      onHoverToneWeightChange(
                        tone.key as 'clingy' | 'confession' | 'calm' | 'remorse' | 'general',
                        Number(event.target.value),
                      )
                    }
                    className="w-full"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={onReshuffleHoverPhrases}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white"
            >
              重新隨機全部日期語氣
            </button>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="🃏"
          title="塔羅"
          subtitle="閱覽室入口圖片 · 名稱字色與字級"
          isOpen={openPanel === 'tarot'}
          onToggle={() => togglePanel('tarot')}
        >
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs text-stone-500">閱覽室入口圖片 URL</span>
              <input
                type="url"
                value={tarotGalleryUrlDraft}
                onChange={(e) => setTarotGalleryUrlDraft(e.target.value)}
                placeholder="https://files.catbox.moe/..."
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            {tarotGalleryUrlDraft && (
              <img
                src={tarotGalleryUrlDraft}
                alt="預覽"
                className="h-24 w-full rounded-lg object-cover border border-stone-200"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <button
              type="button"
              onClick={() => onSettingChange({ tarotGalleryImageUrl: tarotGalleryUrlDraft.trim() })}
              className="w-full rounded-xl bg-stone-900 py-2.5 text-sm text-white transition active:opacity-80"
            >
              套用
            </button>
            <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <label className="flex items-center justify-between gap-3 text-xs text-stone-600">
                <span>牌名顏色</span>
                <input
                  type="color"
                  value={settings.tarotNameColor}
                  onChange={(event) => onSettingChange({ tarotNameColor: event.target.value })}
                  className="h-8 w-12 cursor-pointer rounded border border-stone-300 bg-white"
                />
              </label>
              <label className="block space-y-1 text-xs text-stone-600">
                <span>牌名字級：{settings.tarotNameScale.toFixed(2)}x</span>
                <input
                  type="range"
                  min={0.8}
                  max={2}
                  step={0.05}
                  value={settings.tarotNameScale}
                  onChange={(event) => onSettingChange({ tarotNameScale: Number(event.target.value) })}
                  className="w-full"
                />
              </label>
            </div>
            <p className="text-xs text-stone-400">會套用在塔羅首頁牌名、閱覽室清單牌名、翻牌內容標題。</p>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="💌"
          title="情書"
          subtitle="模式 · 匯入 · 字體"
          isOpen={openPanel === 'letters'}
          onToggle={() => togglePanel('letters')}
        >
          <div className="space-y-4">
            {/* Count */}
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-xs text-stone-500">已匯入情書</p>
              <p className="mt-0.5 truncate text-sm text-stone-800">{letterCount} 封</p>
            </div>

            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-xs font-medium text-stone-600">情書頁模式</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSettingChange({ letterUiMode: 'classic' })}
                  className={`rounded-xl border px-3 py-2 text-xs transition active:opacity-80 ${
                    settings.letterUiMode === 'classic'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  經典（A/B/C）
                </button>
                <button
                  type="button"
                  onClick={() => onSettingChange({ letterUiMode: 'preview' })}
                  className={`rounded-xl border px-3 py-2 text-xs transition active:opacity-80 ${
                    settings.letterUiMode === 'preview'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  手札（I/II）
                </button>
              </div>
            </div>

            {/* File import */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-stone-600">匯入情書檔案</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="cursor-pointer rounded-xl bg-stone-900 py-2.5 text-center text-sm text-white transition active:opacity-80">
                  匯入檔案
                  <input
                    type="file"
                    multiple
                    accept=".txt,.md,.json,.docx"
                    className="hidden"
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      if (files.length) onImportLetterFiles(files);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <label className="cursor-pointer rounded-xl bg-stone-900 py-2.5 text-center text-sm text-white transition active:opacity-80">
                  匯入資料夾
                  <input
                    type="file"
                    // @ts-expect-error webkitdirectory is non-standard
                    webkitdirectory=""
                    multiple
                    accept=".txt,.md,.json,.docx"
                    className="hidden"
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      if (files.length) onImportLetterFolderFiles(files);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-stone-400">iPhone 通常不支援資料夾匯入，建議用「匯入檔案」。</p>
            </div>

            {/* Letter font URL */}
            <div className="space-y-2 border-t border-stone-100 pt-3">
              <p className="text-xs font-medium text-stone-600">情書頁自訂字體</p>
              <input
                type="url"
                value={letterFontUrlDraft}
                onChange={(e) => setLetterFontUrlDraft(e.target.value)}
                placeholder="https://files.catbox.moe/xxxxx.ttf"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => onSettingChange({ letterFontUrl: letterFontUrlDraft.trim() })}
                className="w-full rounded-xl bg-stone-900 py-2 text-sm text-white transition active:opacity-80"
              >
                套用字體
              </button>
              {settings.letterFontUrl && (
                <button
                  type="button"
                  onClick={() => { setLetterFontUrlDraft(''); onSettingChange({ letterFontUrl: '' }); }}
                  className="w-full rounded-xl border border-stone-300 bg-white py-2 text-sm text-stone-600"
                >
                  移除自訂字體（恢復手寫體）
                </button>
              )}
              <p className="text-xs text-stone-400">支援 .ttf / .woff2，留空使用預設手寫字體。</p>
            </div>

            <div className="border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={onClearAllLetters}
                disabled={!letterCount}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm text-rose-700 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                清空所有情書
              </button>
              <p className="mt-2 text-xs text-stone-400">情書儲存在本機，不會上傳到伺服器。</p>
            </div>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="📓"
          title="日記"
          subtitle="封面 · 匯入 · 字體"
          isOpen={openPanel === 'diary'}
          onToggle={() => togglePanel('diary')}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-xs text-stone-500">已匯入日記</p>
              <p className="mt-0.5 truncate text-sm text-stone-800">{diaryCount} 篇</p>
            </div>

            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-sm text-stone-800">日記封面</p>
              <input
                type="url"
                value={diaryCoverUrlDraft}
                onChange={(event) => setDiaryCoverUrlDraft(event.target.value)}
                placeholder="https://example.com/cover.jpg"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSettingChange({ diaryCoverImageUrl: diaryCoverUrlDraft.trim() })}
                  className="rounded-lg bg-stone-900 px-3 py-2 text-xs text-white"
                >
                  套用封面網址
                </button>
                <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700">
                  上傳封面
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      handleDiaryCoverUpload(event.target.files?.[0] ?? null);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setDiaryCoverUrlDraft('');
                    onSettingChange({ diaryCoverImageUrl: '' });
                  }}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
                >
                  使用資料夾隨機封面
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSettingChange({ diaryCoverFitMode: 'cover' })}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    settings.diaryCoverFitMode === 'cover'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  滿版裁切
                </button>
                <button
                  type="button"
                  onClick={() => onSettingChange({ diaryCoverFitMode: 'contain' })}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    settings.diaryCoverFitMode === 'contain'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 bg-white text-stone-700'
                  }`}
                >
                  完整顯示
                </button>
              </div>
              <p className="text-xs text-stone-400">若未設定網址，會嘗試用 `public/diary-covers/` 裡的圖片隨機顯示。</p>
            </div>

            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-sm text-stone-800">日記字體</p>
              <input
                type="url"
                value={diaryFontUrlDraft}
                onChange={(event) => setDiaryFontUrlDraft(event.target.value)}
                placeholder="https://files.catbox.moe/xxxxx.ttf"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSettingChange({ diaryFontUrl: diaryFontUrlDraft.trim() })}
                  className="rounded-lg bg-stone-900 px-3 py-2 text-xs text-white"
                >
                  套用字體
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiaryFontUrlDraft('');
                    onSettingChange({ diaryFontUrl: '' });
                  }}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
                >
                  清除字體
                </button>
              </div>
              <p className="text-xs text-stone-400">支援 .ttf / .otf / .woff / .woff2。</p>
            </div>

            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-sm text-stone-800">匯入日記</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="cursor-pointer rounded-xl bg-stone-900 py-2.5 text-center text-sm text-white transition active:opacity-80">
                  匯入檔案
                  <input
                    type="file"
                    multiple
                    accept=".txt,.docx"
                    className="hidden"
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      if (files.length) onImportDiaryFiles(files);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <label className="cursor-pointer rounded-xl bg-stone-900 py-2.5 text-center text-sm text-white transition active:opacity-80">
                  匯入資料夾
                  <input
                    type="file"
                    // @ts-expect-error webkitdirectory is non-standard
                    webkitdirectory=""
                    multiple
                    accept=".txt,.docx"
                    className="hidden"
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      if (files.length) onImportDiaryFolderFiles(files);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-stone-400">可放 txt / docx；同檔名會覆蓋舊版本。</p>
            </div>

            <div className="border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={onClearAllDiaries}
                disabled={!diaryCount}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm text-rose-700 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                清空所有日記
              </button>
            </div>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="📝"
          title="便利貼"
          subtitle="字體大小 · 文字色"
          isOpen={openPanel === 'notes'}
          onToggle={() => togglePanel('notes')}
        >
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="flex items-center justify-between text-xs text-stone-600">
                <span>便利貼字體大小</span>
                <span>{settings.notesFontSize}px</span>
              </span>
              <input
                type="range"
                min={11}
                max={17}
                step={1}
                value={settings.notesFontSize}
                onChange={(e) => onSettingChange({ notesFontSize: Number(e.target.value) })}
                className="w-full accent-stone-800"
              />
              <div className="flex justify-between text-[10px] text-stone-400">
                <span>11px 小</span>
                <span>17px 大</span>
              </div>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-xs text-stone-600">便利貼文字色</span>
              <input
                type="color"
                value={settings.notesTextColor}
                onChange={(e) => onSettingChange({ notesTextColor: e.target.value })}
                className="h-8 w-12 cursor-pointer rounded border border-stone-300 bg-white"
              />
            </label>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="🗨️"
          title="對話紀錄"
          subtitle="匯入 · 角色設定"
          isOpen={openPanel === 'chatLogs'}
          onToggle={() => togglePanel('chatLogs')}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-xs text-stone-500">已匯入對話紀錄</p>
              <p className="mt-0.5 truncate text-sm text-stone-800">{chatLogCount} 份</p>
            </div>

            <SettingSubgroup
              title="泡泡外觀"
              subtitle="樣式、圓角、顏色"
              isOpen={openChatBubbleGroup}
              onToggle={() => setOpenChatBubbleGroup((current) => !current)}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onSettingChange({ chatBubbleStyle: 'jelly' })}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      settings.chatBubbleStyle === 'jelly'
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-300 bg-white text-stone-700'
                    }`}
                  >
                    QQ 果凍
                  </button>
                  <button
                    type="button"
                    onClick={() => onSettingChange({ chatBubbleStyle: 'imessage' })}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      settings.chatBubbleStyle === 'imessage'
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-300 bg-white text-stone-700'
                    }`}
                  >
                    iMessage
                  </button>
                  <button
                    type="button"
                    onClick={() => onSettingChange({ chatBubbleStyle: 'imessageClassic' })}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      settings.chatBubbleStyle === 'imessageClassic'
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-300 bg-white text-stone-700'
                    }`}
                  >
                    iMessage+
                  </button>
                </div>

                <label className="block space-y-1">
                  <span className="flex items-center justify-between text-xs text-stone-600">
                    <span>泡泡圓角（只影響對話紀錄）</span>
                    <span>{settings.chatBubbleRadius}px</span>
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={36}
                    step={1}
                    value={settings.chatBubbleRadius}
                    onChange={(e) => onSettingChange({ chatBubbleRadius: Number(e.target.value) })}
                    className="w-full accent-stone-800"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-stone-600">我方底色（右側）</span>
                    <input
                      type="color"
                      value={settings.chatUserBubbleColor}
                      onChange={(e) => onSettingChange({ chatUserBubbleColor: e.target.value })}
                      className="h-10 w-full rounded-md border border-stone-300"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-stone-600">對方底色（左側）</span>
                    <input
                      type="color"
                      value={settings.chatAiBubbleColor}
                      onChange={(e) => onSettingChange({ chatAiBubbleColor: e.target.value })}
                      className="h-10 w-full rounded-md border border-stone-300"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-stone-600">我方邊框</span>
                    <input
                      type="color"
                      value={settings.chatUserBubbleBorderColor}
                      onChange={(e) => onSettingChange({ chatUserBubbleBorderColor: e.target.value })}
                      className="h-10 w-full rounded-md border border-stone-300"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-stone-600">對方邊框</span>
                    <input
                      type="color"
                      value={settings.chatAiBubbleBorderColor}
                      onChange={(e) => onSettingChange({ chatAiBubbleBorderColor: e.target.value })}
                      className="h-10 w-full rounded-md border border-stone-300"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-stone-600">我方文字</span>
                    <input
                      type="color"
                      value={settings.chatUserBubbleTextColor}
                      onChange={(e) => onSettingChange({ chatUserBubbleTextColor: e.target.value })}
                      className="h-10 w-full rounded-md border border-stone-300"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-stone-600">對方文字</span>
                    <input
                      type="color"
                      value={settings.chatAiBubbleTextColor}
                      onChange={(e) => onSettingChange({ chatAiBubbleTextColor: e.target.value })}
                      className="h-10 w-full rounded-md border border-stone-300"
                    />
                  </label>
                </div>

                <p className="text-xs text-stone-500">iMessage / iMessage+ 會自動取消果凍亮面與抖動效果。</p>
              </div>
            </SettingSubgroup>

            <div className="space-y-2">
              <p className="text-xs font-medium text-stone-600">匯入對話紀錄</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="cursor-pointer rounded-xl bg-stone-900 py-2.5 text-center text-sm text-white transition active:opacity-80">
                  匯入檔案
                  <input
                    type="file"
                    multiple
                    accept=".txt,.md,.json,.docx"
                    className="hidden"
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      if (files.length) onImportChatLogFiles(files);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <label className="cursor-pointer rounded-xl bg-stone-900 py-2.5 text-center text-sm text-white transition active:opacity-80">
                  匯入資料夾
                  <input
                    type="file"
                    // @ts-expect-error webkitdirectory is non-standard
                    webkitdirectory=""
                    multiple
                    accept=".txt,.md,.json,.docx"
                    className="hidden"
                    onChange={(event) => {
                      const files = event.target.files ? Array.from(event.target.files) : [];
                      if (files.length) onImportChatLogFolderFiles(files);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-stone-400">iPhone 通常不支援資料夾匯入，建議用「匯入檔案」。</p>
            </div>

            <div className="border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={onClearAllChatLogs}
                disabled={!chatLogCount}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm text-rose-700 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                清空所有對話紀錄
              </button>
              <p className="mt-2 text-xs text-stone-400">對話紀錄儲存在本機，不會上傳到伺服器。</p>
            </div>

            {/* Chat profiles */}
            <div className="space-y-2 border-t border-stone-100 pt-3">
              <p className="text-xs font-medium text-stone-600">聊天角色設定（左右暱稱/頭像）</p>
              {chatProfiles.length === 0 && (
                <p className="text-xs text-stone-400">尚未建立任何角色設定，預設為「你」/「M」。</p>
              )}
              {chatProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-stone-800">{profile.name}</p>
                    <p className="text-xs text-stone-400">右：{profile.rightNick} ／ 左：{profile.leftNick}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteChatProfile(profile.id)}
                    className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-600"
                  >
                    刪除
                  </button>
                </div>
              ))}

              {showNewProfile ? (
                <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <input
                    type="text"
                    placeholder="設定名稱，例：和4o的對話"
                    value={newProfileDraft.name}
                    onChange={(e) => setNewProfileDraft((d) => ({ ...d, name: e.target.value }))}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="右側暱稱（你，可用 / 填多個）"
                      value={newProfileDraft.rightNick}
                      onChange={(e) => setNewProfileDraft((d) => ({ ...d, rightNick: e.target.value }))}
                      className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="左側暱稱（M，可用 / 填多個）"
                      value={newProfileDraft.leftNick}
                      onChange={(e) => setNewProfileDraft((d) => ({ ...d, leftNick: e.target.value }))}
                      className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500">可用「/」分隔多個名稱，例如：你/Anni、M/Michael</p>
                  <div className="flex gap-2">
                    <label className="flex-1 space-y-1">
                      <span className="text-xs text-stone-500">右側頭像</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () =>
                            setNewProfileDraft((d) => ({
                              ...d,
                              rightAvatarDataUrl: reader.result as string,
                            }));
                          reader.readAsDataURL(file);
                        }}
                        className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="flex-1 space-y-1">
                      <span className="text-xs text-stone-500">左側頭像</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () =>
                            setNewProfileDraft((d) => ({
                              ...d,
                              leftAvatarDataUrl: reader.result as string,
                            }));
                          reader.readAsDataURL(file);
                        }}
                        className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!newProfileDraft.name.trim()) return;
                        onSaveChatProfile({ ...newProfileDraft, id: `profile-${Date.now()}` });
                        setNewProfileDraft({
                          name: '',
                          leftNick: 'M',
                          rightNick: '你',
                          leftAvatarDataUrl: '',
                          rightAvatarDataUrl: '',
                        });
                        setShowNewProfile(false);
                      }}
                      className="flex-1 rounded-xl bg-stone-900 py-2 text-sm text-white"
                    >
                      儲存
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewProfile(false)}
                      className="flex-1 rounded-xl border border-stone-300 bg-white py-2 text-sm text-stone-600"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewProfile(true)}
                  className="w-full rounded-xl border border-violet-200 bg-violet-50 py-2 text-sm text-violet-700 transition active:opacity-80"
                >
                  ＋ 新增角色設定
                </button>
              )}
            </div>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="🛠️"
          title="手動操作"
          subtitle="刷新資料與同步時間"
          isOpen={openPanel === 'maintenance'}
          onToggle={() => togglePanel('maintenance')}
        >
          <div className="space-y-3">
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white"
            >
              重新整理本機資料
            </button>
            <p className="text-xs text-stone-500">
              上次更新：{settings.lastSyncAt ? new Date(settings.lastSyncAt).toLocaleString() : '尚未更新'}
            </p>
          </div>
        </SettingPanel>
      </div>
    </div>
  );
}
