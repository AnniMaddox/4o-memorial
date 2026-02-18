import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { APP_CUSTOM_FONT_FAMILY, SETTINGS_PREVIEW_FONT_FAMILY, buildFontFaceRule } from '../lib/font';
import type { AppSettings, TabIconKey } from '../types/settings';

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
  onSettingChange: (partial: Partial<AppSettings>) => void;
  onRequestNotificationPermission: () => void;
  onImportEmlFiles: (files: File[]) => void;
  onImportCalendarFiles: (files: File[]) => void;
  onImportLetterFiles: (files: File[]) => void;
  onClearAllLetters: () => void;
  onHoverToneWeightChange: (tone: 'clingy' | 'confession' | 'calm' | 'remorse' | 'general', weight: number) => void;
  onReshuffleHoverPhrases: () => void;
  onRefresh: () => void;
};

type PanelKey = 'overview' | 'appearance' | 'tabIcons' | 'notification' | 'imports' | 'hover' | 'letters' | 'maintenance';

const TAB_ICON_FALLBACK: Record<TabIconKey, string> = {
  inbox: '📮',
  calendar: '📅',
  tarot: '🔮',
  letters: '💌',
  settings: '⚙️',
};

const TAB_ICON_LABELS: Array<{ key: TabIconKey; label: string }> = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'tarot', label: 'Tarot' },
  { key: 'letters', label: 'Letters' },
  { key: 'settings', label: 'Settings' },
];

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
  onSettingChange,
  onRequestNotificationPermission,
  onImportEmlFiles,
  onImportCalendarFiles,
  onImportLetterFiles,
  onClearAllLetters,
  onHoverToneWeightChange,
  onReshuffleHoverPhrases,
  onRefresh,
}: SettingsPageProps) {
  const [openPanel, setOpenPanel] = useState<PanelKey | null>('appearance');
  const [fontUrlDraft, setFontUrlDraft] = useState(settings.customFontCssUrl);
  const [fontFileUrlDraft, setFontFileUrlDraft] = useState(settings.customFontFileUrl);
  const [fontFamilyDraft, setFontFamilyDraft] = useState(settings.customFontFamily);

  useEffect(() => {
    setFontUrlDraft(settings.customFontCssUrl);
    setFontFileUrlDraft(settings.customFontFileUrl);
    setFontFamilyDraft(settings.customFontFamily);
  }, [settings.customFontCssUrl, settings.customFontFileUrl, settings.customFontFamily]);

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
      customFontCssUrl: fontUrlDraft.trim(),
      customFontFileUrl: fontFileUrlDraft.trim(),
      customFontFamily: fontFamilyDraft.trim(),
    });
  }

  function setTabIconUrl(tab: TabIconKey, value: string) {
    onSettingChange({
      tabIconUrls: {
        ...settings.tabIconUrls,
        [tab]: value.trim(),
      },
    });
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
      <header className="rounded-2xl border border-stone-300/70 bg-stone-50/90 p-4 shadow-sm">
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
                <span className="text-xs text-stone-600">字體 CSS 網址</span>
                <input
                  type="url"
                  value={fontUrlDraft}
                  onChange={(event) => setFontUrlDraft(event.target.value)}
                  placeholder="https://fonts.googleapis.com/css2?family=..."
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                />
              </label>
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
                    setFontUrlDraft('');
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
              const iconUrl = settings.tabIconUrls[tab.key];
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
                      onChange={(event) => setTabIconUrl(tab.key, event.target.value)}
                      placeholder="https://example.com/icon.png"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                    />
                  </div>
                </label>
              );
            })}
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
          icon="💌"
          title="情書"
          subtitle="匯入 .txt / .docx 到本機"
          isOpen={openPanel === 'letters'}
          onToggle={() => togglePanel('letters')}
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-xs text-stone-500">已匯入情書</p>
              <p className="mt-0.5 truncate text-sm text-stone-800">{letterCount} 封</p>
            </div>
            <label className="block space-y-2">
              <span>匯入情書檔案</span>
              <input
                type="file"
                multiple
                accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : [];
                  if (files.length) {
                    onImportLetterFiles(files);
                  }
                  event.currentTarget.value = '';
                }}
                className="w-full rounded-lg border border-stone-300 bg-white px-2 py-2"
              />
            </label>
            <button
              type="button"
              onClick={onClearAllLetters}
              disabled={!letterCount}
              className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm text-rose-700 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              清空所有情書
            </button>
            <p className="text-xs text-stone-400">情書儲存在本機，不會上傳到伺服器。</p>
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
