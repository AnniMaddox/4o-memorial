import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { APP_CUSTOM_FONT_FAMILY, SETTINGS_PREVIEW_FONT_FAMILY, buildFontFaceRule } from '../lib/font';
import type { ChatProfile } from '../lib/chatDB';
import type { AppSettings, BackgroundMode, TabIconKey, TabIconUrls } from '../types/settings';

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
  chatProfiles: ChatProfile[];
  onSettingChange: (partial: Partial<AppSettings>) => void;
  onRequestNotificationPermission: () => void;
  onImportEmlFiles: (files: File[]) => void;
  onImportCalendarFiles: (files: File[]) => void;
  onImportLetterFiles: (files: File[]) => void;
  onImportLetterFolderFiles: (files: File[]) => void;
  onClearAllLetters: () => void;
  onSaveChatProfile: (profile: ChatProfile) => void;
  onDeleteChatProfile: (id: string) => void;
  onHoverToneWeightChange: (tone: 'clingy' | 'confession' | 'calm' | 'remorse' | 'general', weight: number) => void;
  onReshuffleHoverPhrases: () => void;
  onRefresh: () => void;
};

type PanelKey = 'overview' | 'appearance' | 'tabIcons' | 'notification' | 'imports' | 'hover' | 'letters' | 'tarot' | 'maintenance';

const TAB_ICON_FALLBACK: Record<TabIconKey, string> = {
  home: '🏠',
  inbox: '📮',
  calendar: '📅',
  tarot: '🔮',
  letters: '💌',
  heart: '💗',
  settings: '⚙️',
};

const TAB_ICON_LABELS: Array<{ key: TabIconKey; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'tarot', label: 'Tarot' },
  { key: 'letters', label: 'Letters' },
  { key: 'heart', label: 'MY LOVE' },
  { key: 'settings', label: 'Settings' },
];

type AppearancePresetPayload = {
  version: 1;
  savedAt: string;
  appearance: {
    themeMonthColor: string;
    calendarColorMode: AppSettings['calendarColorMode'];
    lockedBubbleColor: string;
    customFontFileUrl: string;
    customFontFamily: string;
    fontScale: number;
    tabIconUrls: TabIconUrls;
    calendarCellRadius: number;
    calendarCellShadow: number;
    calendarCellDepth: number;
    backgroundMode: BackgroundMode;
    backgroundGradientStart: string;
    backgroundGradientEnd: string;
    backgroundImageUrl: string;
    backgroundImageOverlay: number;
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

export function SettingsPage({
  settings,
  visibleEmailCount,
  totalEmailCount,
  monthCount,
  notificationPermission,
  importStatus,
  letterCount,
  chatProfiles,
  onSettingChange,
  onRequestNotificationPermission,
  onImportEmlFiles,
  onImportCalendarFiles,
  onImportLetterFiles,
  onImportLetterFolderFiles,
  onClearAllLetters,
  onSaveChatProfile,
  onDeleteChatProfile,
  onHoverToneWeightChange,
  onReshuffleHoverPhrases,
  onRefresh,
}: SettingsPageProps) {
  const [openPanel, setOpenPanel] = useState<PanelKey | null>('appearance');
  const [letterFontUrlDraft, setLetterFontUrlDraft] = useState(settings.letterFontUrl);
  const [tarotGalleryUrlDraft, setTarotGalleryUrlDraft] = useState(settings.tarotGalleryImageUrl);
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
  const [tabIconStatus, setTabIconStatus] = useState('');
  const [appearancePresetStatus, setAppearancePresetStatus] = useState('');

  useEffect(() => {
    setFontFileUrlDraft(settings.customFontFileUrl);
    setFontFamilyDraft(settings.customFontFamily);
    setBackgroundImageUrlDraft(settings.backgroundImageUrl);
    setTabIconDrafts(settings.tabIconUrls);
    setLetterFontUrlDraft(settings.letterFontUrl);
    setTarotGalleryUrlDraft(settings.tarotGalleryImageUrl);
  }, [settings.customFontFileUrl, settings.customFontFamily, settings.backgroundImageUrl, settings.tabIconUrls, settings.letterFontUrl, settings.tarotGalleryImageUrl]);

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

  function saveTabIcons() {
    const next: TabIconUrls = {
      home: tabIconDrafts.home.trim(),
      inbox: tabIconDrafts.inbox.trim(),
      calendar: tabIconDrafts.calendar.trim(),
      tarot: tabIconDrafts.tarot.trim(),
      letters: tabIconDrafts.letters.trim(),
      heart: tabIconDrafts.heart.trim(),
      settings: tabIconDrafts.settings.trim(),
    };

    onSettingChange({ tabIconUrls: next });
    setTabIconStatus('圖標設定已儲存');
  }

  function restoreSavedTabIcons() {
    setTabIconDrafts(settings.tabIconUrls);
    setTabIconStatus('已還原成目前儲存值');
  }

  function exportAppearancePreset() {
    const payload: AppearancePresetPayload = {
      version: 1,
      savedAt: new Date().toISOString(),
      appearance: {
        themeMonthColor: settings.themeMonthColor,
        calendarColorMode: settings.calendarColorMode,
        lockedBubbleColor: settings.lockedBubbleColor,
        customFontFileUrl: settings.customFontFileUrl,
        customFontFamily: settings.customFontFamily,
        fontScale: settings.fontScale,
        tabIconUrls: settings.tabIconUrls,
        calendarCellRadius: settings.calendarCellRadius,
        calendarCellShadow: settings.calendarCellShadow,
        calendarCellDepth: settings.calendarCellDepth,
        backgroundMode: settings.backgroundMode,
        backgroundGradientStart: settings.backgroundGradientStart,
        backgroundGradientEnd: settings.backgroundGradientEnd,
        backgroundImageUrl: settings.backgroundImageUrl,
        backgroundImageOverlay: settings.backgroundImageOverlay,
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
      if (source.calendarColorMode === 'month' || source.calendarColorMode === 'custom') {
        next.calendarColorMode = source.calendarColorMode;
      }
      if (typeof source.lockedBubbleColor === 'string') {
        next.lockedBubbleColor = source.lockedBubbleColor;
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
          settings: typeof input.settings === 'string' ? input.settings.trim() : '',
        };
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
          icon="🎨"
          title="外觀與字體"
          subtitle="主題色、日曆外觀、字型替換"
          isOpen={openPanel === 'appearance'}
          onToggle={() => togglePanel('appearance')}
        >
          <div className="space-y-3">
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
              <span>未解鎖泡泡色</span>
              <input
                type="color"
                value={settings.lockedBubbleColor}
                onChange={(event) => onSettingChange({ lockedBubbleColor: event.target.value })}
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

            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-sm text-stone-800">字體替換（整站）</p>
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
            </div>

            <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-sm text-stone-800">背景樣式</p>
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
            </div>

            <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-sm text-stone-800">月曆立體外觀</p>
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
            </div>

            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-sm text-stone-800">美化設定備份</p>
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
            </div>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="🧩"
          title="自訂圖標"
          subtitle="底部分頁改成圖示（可用圖片網址）"
          isOpen={openPanel === 'tabIcons'}
          onToggle={() => togglePanel('tabIcons')}
        >
          <div className="space-y-3">
            {TAB_ICON_LABELS.map((tab) => {
              const iconUrl = tabIconDrafts[tab.key];
              return (
                <label key={tab.key} className="block space-y-1">
                  <span className="text-xs text-stone-600">{tab.label} 圖示網址</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 bg-white text-lg">
                      {iconUrl ? (
                        <img src={iconUrl} alt="" className="h-6 w-6 rounded-md object-cover" />
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
              留空就用預設圖示。圖片建議正方形（PNG/JPG/WebP），網址需可直接存取。
            </p>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="🔔"
          title="通知與操作"
          subtitle="滑動分頁、通知權限"
          isOpen={openPanel === 'notification'}
          onToggle={() => togglePanel('notification')}
        >
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <span>啟用左右滑分頁</span>
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
          subtitle="閱覽室入口圖片"
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
            <p className="text-xs text-stone-400">圖片會顯示在塔羅頁底部，點擊進入全部 22 張牌的閱覽室。</p>
          </div>
        </SettingPanel>

        <SettingPanel
          icon="💌"
          title="情書"
          subtitle="匯入 · 字體 · 對話角色"
          isOpen={openPanel === 'letters'}
          onToggle={() => togglePanel('letters')}
        >
          <div className="space-y-4">
            {/* Count */}
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-xs text-stone-500">已匯入情書</p>
              <p className="mt-0.5 truncate text-sm text-stone-800">{letterCount} 封</p>
            </div>

            {/* File import */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-stone-600">匯入情書檔案</p>
              <label className="block">
                <span className="sr-only">選擇檔案</span>
                <input
                  type="file"
                  multiple
                  accept=".txt,.md,.json,.docx"
                  onChange={(event) => {
                    const files = event.target.files ? Array.from(event.target.files) : [];
                    if (files.length) onImportLetterFiles(files);
                    event.currentTarget.value = '';
                  }}
                  className="w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">或整個資料夾匯入</span>
                <input
                  type="file"
                  // @ts-expect-error webkitdirectory is non-standard
                  webkitdirectory=""
                  multiple
                  accept=".txt,.md,.json,.docx"
                  onChange={(event) => {
                    const files = event.target.files ? Array.from(event.target.files) : [];
                    if (files.length) onImportLetterFolderFiles(files);
                    event.currentTarget.value = '';
                  }}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm"
                />
              </label>
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

            {/* Chat profiles */}
            <div className="space-y-2 border-t border-stone-100 pt-3">
              <p className="text-xs font-medium text-stone-600">聊天模式角色設定</p>
              {chatProfiles.length === 0 && (
                <p className="text-xs text-stone-400">尚未建立任何角色設定，預設為「你」/「M」。</p>
              )}
              {chatProfiles.map((profile) => (
                <div key={profile.id} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
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

              {/* New profile form */}
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
                      placeholder="右側暱稱（你）"
                      value={newProfileDraft.rightNick}
                      onChange={(e) => setNewProfileDraft((d) => ({ ...d, rightNick: e.target.value }))}
                      className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="左側暱稱（M）"
                      value={newProfileDraft.leftNick}
                      onChange={(e) => setNewProfileDraft((d) => ({ ...d, leftNick: e.target.value }))}
                      className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
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
                          reader.onload = () => setNewProfileDraft((d) => ({ ...d, rightAvatarDataUrl: reader.result as string }));
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
                          reader.onload = () => setNewProfileDraft((d) => ({ ...d, leftAvatarDataUrl: reader.result as string }));
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
                        setNewProfileDraft({ name: '', leftNick: 'M', rightNick: '你', leftAvatarDataUrl: '', rightAvatarDataUrl: '' });
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
