import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ChatProfile } from '../lib/chatDB';
import type { StoredChatLog } from '../lib/chatLogDB';
import { splitNickAliases } from '../lib/chatProfileMatcher';
import type { AppSettings } from '../types/settings';

type ChatLogPageProps = {
  logs: StoredChatLog[];
  chatProfiles: ChatProfile[];
  settings: Pick<
    AppSettings,
    | 'chatBubbleStyle'
    | 'chatBubbleRadius'
    | 'chatUserBubbleColor'
    | 'chatUserBubbleBorderColor'
    | 'chatUserBubbleTextColor'
    | 'chatAiBubbleColor'
    | 'chatAiBubbleBorderColor'
    | 'chatAiBubbleTextColor'
    | 'chatAppMessagesIcon'
    | 'chatAppDiscoverIcon'
    | 'chatAppMeIcon'
    | 'chatAppShowLabels'
    | 'chatAppDefaultProfileId'
  >;
  onSettingChange: (partial: Partial<AppSettings>) => void;
  onImportChatLogFiles: (files: File[]) => void;
  onImportChatLogFolderFiles: (files: File[]) => void;
  onClearAllChatLogs: () => void;
  onSaveChatProfile: (profile: ChatProfile) => void;
  onDeleteChatProfile: (id: string) => void;
  onBindLogProfile?: (logName: string, profileId: string) => void;
  onExit?: () => void;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  time?: string;
};

type ChatHomeTab = 'messages' | 'discover' | 'me';

type ProfileDraft = Omit<ChatProfile, 'id'>;

function emptyProfileDraft(): ProfileDraft {
  return {
    name: '',
    leftNick: 'M',
    rightNick: '你',
    leftAvatarDataUrl: '',
    rightAvatarDataUrl: '',
  };
}

function normalizeSpeakerToken(value: string) {
  return value.trim().toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapSpeakerToRole(
  speaker: string | undefined,
  rightAliases: string[],
  leftAliases: string[],
): 'user' | 'assistant' | null {
  if (!speaker) return null;
  const normalized = normalizeSpeakerToken(speaker);
  if (!normalized) return null;
  if (rightAliases.some((alias) => normalizeSpeakerToken(alias) === normalized)) return 'user';
  if (leftAliases.some((alias) => normalizeSpeakerToken(alias) === normalized)) return 'assistant';
  return null;
}

function extractMessageText(item: Record<string, unknown>) {
  const contentKeys = ['content', 'message', 'text', 'body'] as const;
  for (const key of contentKeys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function extractMessageTime(item: Record<string, unknown>) {
  const timeKeys = ['timestamp', 'time', 'datetime', 'date'] as const;
  for (const key of timeKeys) {
    const value = item[key];
    if (typeof value !== 'string') continue;
    const raw = value.trim();
    if (!raw) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')} ${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
    }
    return raw.replace('T', ' ').slice(0, 16);
  }
  return undefined;
}

function stripAliasPrefix(line: string, aliases: string[]) {
  for (const alias of aliases) {
    const match = line.match(new RegExp(`^${escapeRegExp(alias)}\\s*[：:]\\s*(.*)$`, 'i'));
    if (match) return (match[1] ?? '').trim();
  }
  return null;
}

function parseChatContent(text: string, profile: ChatProfile | null): ChatMessage[] {
  const leftAliases = splitNickAliases(profile?.leftNick, 'M');
  const rightAliases = splitNickAliases(profile?.rightNick, '你');

  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const msgs: ChatMessage[] = [];
      for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        const content = extractMessageText(record);
        if (!content) continue;

        let role: 'user' | 'assistant' | null = null;
        const roleField = record.role;
        if (roleField === 'user' || roleField === 'assistant') {
          role = roleField;
        } else {
          const speaker =
            (typeof record.speaker === 'string' ? record.speaker : undefined) ??
            (typeof record.name === 'string' ? record.name : undefined) ??
            (typeof record.author === 'string' ? record.author : undefined) ??
            (typeof record.from === 'string' ? record.from : undefined);
          role = mapSpeakerToRole(speaker, rightAliases, leftAliases);
        }
        if (!role) continue;

        msgs.push({ role, content, time: extractMessageTime(record) });
      }
      if (msgs.length > 0) return msgs;
    } catch {
      // fall through to line mode
    }
  }

  const lines = text.split('\n');
  const msgs: ChatMessage[] = [];
  let currentRole: 'user' | 'assistant' | null = null;
  let currentContent = '';
  let currentTime: string | undefined;

  function flush() {
    if (currentRole && currentContent.trim()) {
      msgs.push({ role: currentRole, content: currentContent.trim(), time: currentTime });
    }
    currentContent = '';
    currentTime = undefined;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const stampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}(?::\d{2})?)\]/);
    if (stampMatch) {
      currentTime = stampMatch[1].replace('T', ' ').slice(0, 16);
      continue;
    }

    const roleTagMatch = line.match(/^【(user|assistant)】\s*(?:\[([^\]]+)\])?(.*)$/i);
    if (roleTagMatch) {
      flush();
      currentRole = roleTagMatch[1].toLowerCase() === 'user' ? 'user' : 'assistant';
      if (roleTagMatch[2]) {
        currentTime = roleTagMatch[2].replace('T', ' ').slice(0, 16);
      }
      const rest = (roleTagMatch[3] ?? '').trim();
      if (rest) currentContent = rest;
      continue;
    }

    const rightContent = stripAliasPrefix(line, rightAliases);
    if (rightContent !== null) {
      flush();
      currentRole = 'user';
      currentContent = rightContent;
      continue;
    }

    const leftContent = stripAliasPrefix(line, leftAliases);
    if (leftContent !== null) {
      flush();
      currentRole = 'assistant';
      currentContent = leftContent;
      continue;
    }

    const namedTagMatch = line.match(/^【([^】]+)】\s*(.*)$/);
    if (namedTagMatch) {
      const role = mapSpeakerToRole(namedTagMatch[1], rightAliases, leftAliases);
      if (role) {
        flush();
        currentRole = role;
        currentContent = (namedTagMatch[2] ?? '').trim();
      }
      continue;
    }

    if (currentContent) currentContent += '\n';
    currentContent += line;
  }

  flush();
  return msgs;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function displayLogName(fileName: string) {
  return fileName.replace(/\.(txt|md|docx|json)$/i, '');
}

function primaryAlias(value: string | undefined, fallback: string) {
  const aliases = splitNickAliases(value, fallback);
  return aliases[0] ?? fallback;
}

function resolveIcon(value: string, fallback: string) {
  const icon = value.trim();
  return icon || fallback;
}

export function ChatLogPage({
  logs,
  chatProfiles,
  settings,
  onSettingChange,
  onImportChatLogFiles,
  onImportChatLogFolderFiles,
  onClearAllChatLogs,
  onSaveChatProfile,
  onDeleteChatProfile,
  onBindLogProfile,
  onExit,
}: ChatLogPageProps) {
  const [selectedLogName, setSelectedLogName] = useState<string>('');
  const [selectedLogProfileId, setSelectedLogProfileId] = useState<string>('');
  const [defaultProfileId, setDefaultProfileId] = useState<string>(settings.chatAppDefaultProfileId);
  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState<ChatHomeTab>('messages');

  const [showNewProfileEditor, setShowNewProfileEditor] = useState(false);
  const [newProfileDraft, setNewProfileDraft] = useState<ProfileDraft>(emptyProfileDraft);
  const [editingProfileId, setEditingProfileId] = useState('');
  const [editingProfileDraft, setEditingProfileDraft] = useState<ProfileDraft | null>(null);

  const selectedLog = useMemo(
    () => logs.find((log) => log.name === selectedLogName) ?? null,
    [logs, selectedLogName],
  );

  const filteredLogs = useMemo(() => {
    const keyword = normalizeSearchText(searchInput);
    if (!keyword) return logs;
    return logs.filter((log) => normalizeSearchText(log.name).includes(keyword));
  }, [logs, searchInput]);

  const defaultProfile = useMemo(
    () => chatProfiles.find((profile) => profile.id === defaultProfileId) ?? chatProfiles[0] ?? null,
    [chatProfiles, defaultProfileId],
  );

  const selectedLogProfile = useMemo(
    () => chatProfiles.find((profile) => profile.id === selectedLogProfileId) ?? defaultProfile,
    [chatProfiles, selectedLogProfileId, defaultProfile],
  );

  useEffect(() => {
    setDefaultProfileId(settings.chatAppDefaultProfileId);
  }, [settings.chatAppDefaultProfileId]);

  useEffect(() => {
    if (selectedLog) {
      setSelectedLogProfileId(selectedLog.profileId ?? defaultProfileId);
      return;
    }
    setSelectedLogProfileId('');
  }, [selectedLog?.name, selectedLog?.profileId, defaultProfileId]);

  useEffect(() => {
    if (!defaultProfileId) {
      return;
    }
    const exists = chatProfiles.some((profile) => profile.id === defaultProfileId);
    if (exists) {
      return;
    }
    setDefaultProfileId('');
    onSettingChange({ chatAppDefaultProfileId: '' });
  }, [chatProfiles, defaultProfileId, onSettingChange]);

  useEffect(() => {
    if (!editingProfileId) {
      return;
    }
    const nextProfile = chatProfiles.find((profile) => profile.id === editingProfileId);
    if (!nextProfile) {
      setEditingProfileId('');
      setEditingProfileDraft(null);
      return;
    }
    setEditingProfileDraft({
      name: nextProfile.name,
      leftNick: nextProfile.leftNick,
      rightNick: nextProfile.rightNick,
      leftAvatarDataUrl: nextProfile.leftAvatarDataUrl,
      rightAvatarDataUrl: nextProfile.rightAvatarDataUrl,
    });
  }, [chatProfiles, editingProfileId]);

  const openLog = useCallback((logName: string) => {
    setSelectedLogName(logName);
  }, []);

  const openRandomLog = useCallback(() => {
    if (!logs.length) return;
    const pick = logs[Math.floor(Math.random() * logs.length)];
    setSelectedLogName(pick.name);
  }, [logs]);

  const navMessagesIcon = resolveIcon(settings.chatAppMessagesIcon, '◉');
  const navDiscoverIcon = resolveIcon(settings.chatAppDiscoverIcon, '◎');
  const navMeIcon = resolveIcon(settings.chatAppMeIcon, '◯');
  const showNavLabels = settings.chatAppShowLabels;

  const contactName = primaryAlias(defaultProfile?.leftNick, 'Michael');
  const contactSubtitle = defaultProfile ? `${primaryAlias(defaultProfile.rightNick, '你')} ♡` : '🥺 ❤️';
  const contactAvatar = defaultProfile?.leftAvatarDataUrl || defaultProfile?.rightAvatarDataUrl;

  function updateDefaultProfile(profileId: string) {
    setDefaultProfileId(profileId);
    onSettingChange({ chatAppDefaultProfileId: profileId });
  }

  function applyImageToDraft(
    target: 'leftAvatarDataUrl' | 'rightAvatarDataUrl',
    file: File | null | undefined,
    setDraft: (updater: (prev: ProfileDraft) => ProfileDraft) => void,
  ) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setDraft((prev) => ({
        ...prev,
        [target]: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
  }

  function saveNewProfile() {
    if (!newProfileDraft.name.trim()) return;
    onSaveChatProfile({
      ...newProfileDraft,
      id: `profile-${Date.now()}`,
    });
    setShowNewProfileEditor(false);
    setNewProfileDraft(emptyProfileDraft());
  }

  function saveEditingProfile() {
    if (!editingProfileId || !editingProfileDraft || !editingProfileDraft.name.trim()) return;
    onSaveChatProfile({
      ...editingProfileDraft,
      id: editingProfileId,
    });
    setEditingProfileId('');
    setEditingProfileDraft(null);
  }

  if (selectedLog) {
    return (
      <ChatReadView
        log={selectedLog}
        chatProfiles={chatProfiles}
        selectedProfileId={selectedLogProfileId}
        selectedProfile={selectedLogProfile}
        onSelectProfile={(profileId) => {
          setSelectedLogProfileId(profileId);
          onBindLogProfile?.(selectedLog.name, profileId);
        }}
        onBack={() => setSelectedLogName('')}
        onExit={onExit}
      />
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-xl flex-col overflow-hidden bg-[#efeff4]">
      <header className="shrink-0 border-b border-stone-200/70 bg-white/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              className="h-9 w-9 rounded-full border border-stone-300 bg-white text-xl leading-none text-stone-700 transition active:scale-95"
              aria-label="返回"
              title="返回"
            >
              ‹
            </button>
          ) : (
            <span className="h-9 w-9" />
          )}
          <h1 className="text-2xl font-semibold tracking-wide text-stone-900">
            {activeTab === 'messages' ? '消息' : activeTab === 'discover' ? '發現' : '我'}
          </h1>
          <button
            type="button"
            onClick={openRandomLog}
            disabled={!logs.length}
            className="h-9 w-9 rounded-full border border-stone-300 bg-white text-xl leading-none text-stone-700 transition active:scale-95 disabled:opacity-40"
            aria-label="隨機打開"
            title="隨機打開"
          >
            ＋
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'messages' && (
          <div className="space-y-3 px-3 py-3">
            <button
              type="button"
              onClick={openRandomLog}
              disabled={!logs.length}
              className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-3 text-left shadow-sm transition active:scale-[0.99] disabled:opacity-40"
            >
              {contactAvatar ? (
                <img
                  src={contactAvatar}
                  alt=""
                  className="h-16 w-16 rounded-2xl border border-stone-200 object-cover"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-stone-200 bg-stone-100 text-2xl text-stone-500">
                  💬
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-3xl font-medium text-stone-900">{contactName}</p>
                <p className="mt-1 text-lg text-stone-500">{contactSubtitle}</p>
              </div>
              <span className="text-2xl text-stone-400">›</span>
            </button>

            {!logs.length && (
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-500 shadow-sm">
                請先到「我」分頁匯入對話紀錄
              </div>
            )}
          </div>
        )}

        {activeTab === 'discover' && (
          <div className="space-y-3 px-3 py-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="搜尋檔名"
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-500"
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <ul className="divide-y divide-stone-100">
                {filteredLogs.map((log) => (
                  <li key={log.name}>
                    <button
                      type="button"
                      onClick={() => openLog(log.name)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition active:bg-stone-100"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-stone-800">{displayLogName(log.name)}</span>
                      <span className="text-xs text-stone-400">›</span>
                    </button>
                  </li>
                ))}
              </ul>
              {!filteredLogs.length && (
                <p className="px-4 py-6 text-center text-sm text-stone-400">沒有符合的紀錄</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'me' && (
          <div className="space-y-3 px-3 py-3">
            <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-stone-700">底部分頁圖示</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-xs text-stone-500">消息</span>
                  <input
                    type="text"
                    value={settings.chatAppMessagesIcon}
                    onChange={(e) => onSettingChange({ chatAppMessagesIcon: e.target.value })}
                    className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-center text-sm"
                    placeholder="◉"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-stone-500">發現</span>
                  <input
                    type="text"
                    value={settings.chatAppDiscoverIcon}
                    onChange={(e) => onSettingChange({ chatAppDiscoverIcon: e.target.value })}
                    className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-center text-sm"
                    placeholder="◎"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-stone-500">我</span>
                  <input
                    type="text"
                    value={settings.chatAppMeIcon}
                    onChange={(e) => onSettingChange({ chatAppMeIcon: e.target.value })}
                    className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-center text-sm"
                    placeholder="◯"
                  />
                </label>
              </div>
              <label className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                <span>顯示文字</span>
                <input
                  type="checkbox"
                  checked={settings.chatAppShowLabels}
                  onChange={(e) => onSettingChange({ chatAppShowLabels: e.target.checked })}
                  className="h-4 w-4 accent-stone-900"
                />
              </label>
            </section>

            <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-700">對話資料</p>
                  <p className="text-xs text-stone-500">目前 {logs.length} 份</p>
                </div>
                <button
                  type="button"
                  onClick={onClearAllChatLogs}
                  disabled={!logs.length}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 disabled:opacity-50"
                >
                  清空
                </button>
              </div>

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
            </section>

            <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-stone-700">預設角色（消息頁頭像/名稱）</p>
              <select
                value={defaultProfileId}
                onChange={(e) => updateDefaultProfile(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
              >
                <option value="">預設（你 / M）</option>
                {chatProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{p.rightNick} / {p.leftNick}）
                  </option>
                ))}
              </select>
              <p className="text-xs text-stone-400">消息頁會跟隨這組角色的左側頭像與名稱。</p>
            </section>

            <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-stone-700">泡泡外觀</p>
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
                  <span>泡泡圓角</span>
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
                  <span className="text-xs text-stone-600">我方底色</span>
                  <input
                    type="color"
                    value={settings.chatUserBubbleColor}
                    onChange={(e) => onSettingChange({ chatUserBubbleColor: e.target.value })}
                    className="h-10 w-full rounded-md border border-stone-300"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-stone-600">對方底色</span>
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
            </section>

            <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-stone-700">聊天角色設定（洗角色名稱）</p>

              {chatProfiles.length === 0 && (
                <p className="text-xs text-stone-400">尚未建立角色設定，預設為「你」/「M」。</p>
              )}

              <div className="space-y-2">
                {chatProfiles.map((profile) => {
                  const isEditing = editingProfileId === profile.id && !!editingProfileDraft;
                  return (
                    <div key={profile.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                      {!isEditing ? (
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-stone-800">{profile.name}</p>
                            <p className="text-xs text-stone-400">右：{profile.rightNick} ／ 左：{profile.leftNick}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProfileId(profile.id);
                              setEditingProfileDraft({
                                name: profile.name,
                                leftNick: profile.leftNick,
                                rightNick: profile.rightNick,
                                leftAvatarDataUrl: profile.leftAvatarDataUrl,
                                rightAvatarDataUrl: profile.rightAvatarDataUrl,
                              });
                            }}
                            className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteChatProfile(profile.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-600"
                          >
                            刪除
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingProfileDraft.name}
                            onChange={(e) =>
                              setEditingProfileDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                            }
                            placeholder="設定名稱"
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editingProfileDraft.rightNick}
                              onChange={(e) =>
                                setEditingProfileDraft((prev) => (prev ? { ...prev, rightNick: e.target.value } : prev))
                              }
                              placeholder="右側暱稱（可 / 分隔）"
                              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              value={editingProfileDraft.leftNick}
                              onChange={(e) =>
                                setEditingProfileDraft((prev) => (prev ? { ...prev, leftNick: e.target.value } : prev))
                              }
                              placeholder="左側暱稱（可 / 分隔）"
                              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="space-y-1">
                              <span className="text-xs text-stone-500">右側頭像</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  applyImageToDraft('rightAvatarDataUrl', e.target.files?.[0], (updater) =>
                                    setEditingProfileDraft((prev) => (prev ? updater(prev) : prev)),
                                  )
                                }
                                className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-xs text-stone-500">左側頭像</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  applyImageToDraft('leftAvatarDataUrl', e.target.files?.[0], (updater) =>
                                    setEditingProfileDraft((prev) => (prev ? updater(prev) : prev)),
                                  )
                                }
                                className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                              />
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveEditingProfile}
                              className="flex-1 rounded-xl bg-stone-900 py-2 text-sm text-white"
                            >
                              儲存
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProfileId('');
                                setEditingProfileDraft(null);
                              }}
                              className="flex-1 rounded-xl border border-stone-300 bg-white py-2 text-sm text-stone-600"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {showNewProfileEditor ? (
                <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <input
                    type="text"
                    placeholder="設定名稱，例：和4o的對話"
                    value={newProfileDraft.name}
                    onChange={(e) => setNewProfileDraft((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="右側暱稱（可 / 分隔）"
                      value={newProfileDraft.rightNick}
                      onChange={(e) => setNewProfileDraft((prev) => ({ ...prev, rightNick: e.target.value }))}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="左側暱稱（可 / 分隔）"
                      value={newProfileDraft.leftNick}
                      onChange={(e) => setNewProfileDraft((prev) => ({ ...prev, leftNick: e.target.value }))}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-xs text-stone-500">右側頭像</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => applyImageToDraft('rightAvatarDataUrl', e.target.files?.[0], setNewProfileDraft)}
                        className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-stone-500">左側頭像</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => applyImageToDraft('leftAvatarDataUrl', e.target.files?.[0], setNewProfileDraft)}
                        className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveNewProfile}
                      className="flex-1 rounded-xl bg-stone-900 py-2 text-sm text-white"
                    >
                      儲存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewProfileEditor(false);
                        setNewProfileDraft(emptyProfileDraft());
                      }}
                      className="flex-1 rounded-xl border border-stone-300 bg-white py-2 text-sm text-stone-600"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewProfileEditor(true)}
                  className="w-full rounded-xl border border-violet-200 bg-violet-50 py-2 text-sm text-violet-700"
                >
                  ＋ 新增角色設定
                </button>
              )}
            </section>
          </div>
        )}
      </main>

      <nav className="shrink-0 border-t border-stone-200 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`flex flex-col items-center rounded-xl px-2 py-1.5 transition ${
              activeTab === 'messages' ? 'text-black' : 'text-stone-400'
            } ${showNavLabels ? 'gap-1 text-xs' : 'gap-0 text-base'}`}
            aria-label="消息"
          >
            <span className="text-2xl leading-none">{navMessagesIcon}</span>
            {showNavLabels && <span>消息</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('discover')}
            className={`flex flex-col items-center rounded-xl px-2 py-1.5 transition ${
              activeTab === 'discover' ? 'text-black' : 'text-stone-400'
            } ${showNavLabels ? 'gap-1 text-xs' : 'gap-0 text-base'}`}
            aria-label="發現"
          >
            <span className="text-2xl leading-none">{navDiscoverIcon}</span>
            {showNavLabels && <span>發現</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('me')}
            className={`flex flex-col items-center rounded-xl px-2 py-1.5 transition ${
              activeTab === 'me' ? 'text-black' : 'text-stone-400'
            } ${showNavLabels ? 'gap-1 text-xs' : 'gap-0 text-base'}`}
            aria-label="我"
          >
            <span className="text-2xl leading-none">{navMeIcon}</span>
            {showNavLabels && <span>我</span>}
          </button>
        </div>
      </nav>
    </div>
  );
}

function ChatReadView({
  log,
  chatProfiles,
  selectedProfileId,
  selectedProfile,
  onSelectProfile,
  onBack,
  onExit,
}: {
  log: StoredChatLog;
  chatProfiles: ChatProfile[];
  selectedProfileId: string;
  selectedProfile: ChatProfile | null;
  onSelectProfile: (id: string) => void;
  onBack: () => void;
  onExit?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayName = displayLogName(log.name);
  const messages = useMemo(() => parseChatContent(log.content, selectedProfile), [log.content, selectedProfile]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight });
  }, [log.name, selectedProfileId]);

  return (
    <div className="mx-auto flex h-full w-full max-w-xl flex-col overflow-hidden bg-[#efeff4]">
      <div className="shrink-0 space-y-2 border-b border-stone-200 bg-white px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="h-9 w-9 rounded-full border border-stone-300 bg-white text-xl leading-none text-stone-700 transition active:scale-95"
            aria-label="返回"
            title="返回"
          >
            ‹
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm text-stone-700">{displayName}</p>
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              className="h-9 w-9 rounded-full border border-stone-300 bg-white text-xl leading-none text-stone-700 transition active:scale-95"
              aria-label="離開"
              title="離開"
            >
              ×
            </button>
          ) : (
            <span className="h-9 w-9" />
          )}
        </div>

        {chatProfiles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500">角色</span>
            <select
              value={selectedProfileId}
              onChange={(e) => onSelectProfile(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
            >
              <option value="">預設（跟隨「我」設定）</option>
              {chatProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.rightNick} / {p.leftNick}）
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div ref={scrollRef} id="chat-messages" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length > 0 ? (
          <ChatBubbles messages={messages} profile={selectedProfile} />
        ) : (
          <p className="rounded-2xl border border-stone-200 bg-white px-3 py-4 text-sm text-stone-500">
            無法解析為聊天格式，以下是原文：
            <span className="mt-2 block whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-3 text-left text-xs text-stone-700">
              {log.content}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function ChatBubbles({ messages, profile }: { messages: ChatMessage[]; profile: ChatProfile | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        const avatarUrl = isUser ? profile?.rightAvatarDataUrl : profile?.leftAvatarDataUrl;

        const dateDivider =
          msg.time && (i === 0 || messages[i - 1]?.time?.slice(0, 10) !== msg.time.slice(0, 10))
            ? msg.time.slice(0, 10)
            : null;

        return (
          <div key={`${i}-${msg.time ?? ''}`}>
            {dateDivider && <div className="my-3 text-center text-[11px] text-stone-400">{dateDivider}</div>}

            <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="mb-4 shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div
                    className={`grid h-8 w-8 place-items-center rounded-full text-xs font-medium text-white ${
                      isUser ? 'bg-emerald-400' : 'bg-sky-300'
                    }`}
                  >
                    {isUser ? (profile?.rightNick?.[0] ?? '你') : (profile?.leftNick?.[0] ?? 'M')}
                  </div>
                )}
              </div>

              <div className={`flex max-w-[75%] flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`message-bubble ${isUser ? 'user' : 'ai'}`}>
                  <div className="content" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {msg.content}
                  </div>
                </div>
                {msg.time && <p className="px-1 text-[10px] text-stone-400">{msg.time.slice(11, 16)}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
