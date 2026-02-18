import type { AppSettings } from '../types/settings';

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
  onSettingChange: (partial: Partial<AppSettings>) => void;
  onRequestNotificationPermission: () => void;
  onImportEmlFiles: (files: File[]) => void;
  onImportCalendarFiles: (files: File[]) => void;
  onRefresh: () => void;
};

export function SettingsPage({
  settings,
  visibleEmailCount,
  totalEmailCount,
  monthCount,
  notificationPermission,
  importStatus,
  onSettingChange,
  onRequestNotificationPermission,
  onImportEmlFiles,
  onImportCalendarFiles,
  onRefresh,
}: SettingsPageProps) {
  const notificationLabel =
    notificationPermission === 'unsupported'
      ? '此瀏覽器不支援'
      : notificationPermission === 'granted'
        ? '已允許'
        : notificationPermission === 'denied'
          ? '已封鎖'
          : '尚未決定';

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <header className="rounded-2xl border border-stone-300/70 bg-stone-50/90 p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">設定</p>
        <h1 className="mt-1 text-2xl text-stone-900">控制中心</h1>
        <p className="mt-2 text-sm text-stone-600">這裡可調整閱讀樣式、通知與本機匯入設定。</p>
      </header>

      <section className="rounded-2xl border border-stone-300/70 bg-white/90 p-4 shadow-sm">
        <h2 className="text-sm uppercase tracking-[0.16em] text-stone-500">本機資料概況</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-stone-700">
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
      </section>

      <section className="space-y-3 rounded-2xl border border-stone-300/70 bg-white/90 p-4 shadow-sm">
        <h2 className="text-sm uppercase tracking-[0.16em] text-stone-500">顯示與操作</h2>

        <label className="block space-y-2 text-sm text-stone-700">
          <span>主題強調色</span>
          <input
            type="color"
            value={settings.themeMonthColor}
            onChange={(event) => onSettingChange({ themeMonthColor: event.target.value })}
            className="h-10 w-full rounded-md border border-stone-300"
          />
        </label>

        <label className="block space-y-2 text-sm text-stone-700">
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

        <label className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
          <span>啟用左右滑分頁</span>
          <input
            type="checkbox"
            checked={settings.swipeEnabled}
            onChange={(event) => onSettingChange({ swipeEnabled: event.target.checked })}
          />
        </label>

        <label className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
          <span>啟用解鎖通知</span>
          <input
            type="checkbox"
            checked={settings.localNotificationsEnabled}
            onChange={(event) => onSettingChange({ localNotificationsEnabled: event.target.checked })}
          />
        </label>

        <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
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
      </section>

      <section className="space-y-3 rounded-2xl border border-stone-300/70 bg-white/90 p-4 shadow-sm">
        <h2 className="text-sm uppercase tracking-[0.16em] text-stone-500">本機匯入</h2>

        <label className="block space-y-2 text-sm text-stone-700">
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

        <label className="block space-y-2 text-sm text-stone-700">
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
      </section>

      <section className="space-y-3 rounded-2xl border border-stone-300/70 bg-white/90 p-4 shadow-sm">
        <h2 className="text-sm uppercase tracking-[0.16em] text-stone-500">手動操作</h2>
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
      </section>
    </div>
  );
}
