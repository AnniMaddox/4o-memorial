import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ChatProfile } from '../lib/chatDB';
import type { StoredChatLog } from '../lib/chatLogDB';
import { splitNickAliases } from '../lib/chatProfileMatcher';

type ChatLogPageProps = {
  logs: StoredChatLog[];
  chatProfiles: ChatProfile[];
  onBindLogProfile?: (logName: string, profileId: string) => void;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  time?: string; // displayed below bubble
};

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

  // Try JSON array format first
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
      // not valid JSON, fall through
    }
  }

  // TXT line-by-line format
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

    // Timestamp patterns: [YYYY-MM-DD HH:MM:SS] or inline after role marker
    const stampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}(?::\d{2})?)\]/);
    if (stampMatch) {
      currentTime = stampMatch[1].replace('T', ' ').slice(0, 16);
      continue;
    }

    // 【user】 or 【assistant】 markers (possibly followed by [timestamp])
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

    // "你：" / "M：" / alias list (profile nicks can be "你/Anni")
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

    // Bracket name markers: 【Anni】message / 【Michael】message
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

    // Continuation line
    if (currentContent) currentContent += '\n';
    currentContent += line;
  }
  flush();

  return msgs;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

export function ChatLogPage({ logs, chatProfiles, onBindLogProfile }: ChatLogPageProps) {
  const [selectedLogName, setSelectedLogName] = useState<string>('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');

  const selectedLog = useMemo(
    () => logs.find((log) => log.name === selectedLogName) ?? null,
    [logs, selectedLogName],
  );

  const selectedProfile = useMemo(
    () => chatProfiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [chatProfiles, selectedProfileId],
  );

  useEffect(() => {
    if (!selectedLog) return;
    setSelectedProfileId(selectedLog.profileId ?? '');
  }, [selectedLog?.name, selectedLog?.profileId]);

  useEffect(() => {
    if (!selectedProfileId) return;
    if (!chatProfiles.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId('');
    }
  }, [chatProfiles, selectedProfileId]);

  const filteredLogs = useMemo(() => {
    const keyword = normalizeSearchText(searchInput);
    if (!keyword) return logs;
    return logs.filter((log) => normalizeSearchText(log.name).includes(keyword));
  }, [logs, searchInput]);

  const openRandomLog = useCallback(() => {
    if (!logs.length) return;
    const pick = logs[Math.floor(Math.random() * logs.length)];
    setSelectedLogName(pick.name);
  }, [logs]);

  if (!selectedLog) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        <header className="calendar-header-panel rounded-2xl border p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Chats</p>
          <h1 className="mt-1 text-2xl text-stone-900">對話紀錄</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {logs.length ? `已匯入 ${logs.length} 份` : '從設定頁匯入對話紀錄'}
          </p>
        </header>

        {!logs.length ? (
          <div className="rounded-2xl border border-stone-300/70 bg-white/90 px-6 py-10 text-center shadow-sm">
            <div className="text-5xl opacity-25">💬</div>
            <p className="mt-3 text-sm text-stone-500">請至「設定」頁面匯入對話紀錄檔案</p>
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-stone-300/70 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openRandomLog}
                className="shrink-0 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 transition active:scale-95"
              >
                隨機打開
              </button>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="搜尋檔名"
                className="w-full rounded-xl border border-stone-300 bg-white/85 px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-500"
              />
            </div>

            <div className="max-h-[55dvh] overflow-y-auto rounded-xl border border-stone-200 bg-white">
              <ul className="divide-y divide-stone-100">
                {filteredLogs.map((log) => (
                  <li key={log.name}>
                    <button
                      type="button"
                      onClick={() => setSelectedLogName(log.name)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-stone-50 active:bg-stone-100"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-stone-800">
                        {log.name.replace(/\.(txt|md|docx|json)$/i, '')}
                      </span>
                      <span className="text-xs text-stone-400">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <p className="px-2 text-center text-[11px] text-stone-400">
          對話紀錄儲存在本機，不會上傳到任何地方
        </p>
      </div>
    );
  }

  return (
    <ChatReadView
      log={selectedLog}
      chatProfiles={chatProfiles}
      selectedProfileId={selectedProfileId}
      selectedProfile={selectedProfile}
      onSelectProfile={setSelectedProfileId}
      onBindLogProfile={onBindLogProfile}
      onBack={() => setSelectedLogName('')}
    />
  );
}

function ChatReadView({
  log,
  chatProfiles,
  selectedProfileId,
  selectedProfile,
  onSelectProfile,
  onBindLogProfile,
  onBack,
}: {
  log: StoredChatLog;
  chatProfiles: ChatProfile[];
  selectedProfileId: string;
  selectedProfile: ChatProfile | null;
  onSelectProfile: (id: string) => void;
  onBindLogProfile?: (logName: string, profileId: string) => void;
  onBack: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayName = log.name.replace(/\.(txt|md|docx|json)$/i, '');
  const messages = useMemo(() => parseChatContent(log.content, selectedProfile), [log.content, selectedProfile]);

  useEffect(() => {
    // Chat view usually opens at the bottom.
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight });
  }, [log.name, selectedProfileId]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col" style={{ height: 'calc(100dvh - 72px)' }}>
      <div className="shrink-0 space-y-2 rounded-2xl border border-stone-200 bg-white/90 p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-stone-300 bg-white/85 px-3 py-2 text-sm text-stone-700 transition active:scale-95"
          >
            ← 清單
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm text-stone-700">{displayName}</p>
          <span className="w-16" />
        </div>

        {chatProfiles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500">角色</span>
            <select
              value={selectedProfileId}
              onChange={(e) => {
                const nextProfileId = e.target.value;
                onSelectProfile(nextProfileId);
                onBindLogProfile?.(log.name, nextProfileId);
              }}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
            >
              <option value="">預設（你 / M）</option>
              {chatProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.rightNick} / {p.leftNick}）
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        id="chat-messages"
        className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-stone-200 bg-white/82 p-3 shadow-sm"
      >
        {messages.length > 0 ? (
          <ChatBubbles messages={messages} profile={selectedProfile} />
        ) : (
          <p className="px-2 py-8 text-center text-sm text-stone-400">
            無法解析為聊天格式，將以純文字顯示。
            <br />
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

        // Date divider
        const dateDivider =
          msg.time && (i === 0 || messages[i - 1]?.time?.slice(0, 10) !== msg.time.slice(0, 10))
            ? msg.time.slice(0, 10)
            : null;

        return (
          <div key={`${i}-${msg.time ?? ''}`}>
            {dateDivider && (
              <div className="my-3 text-center text-[11px] text-stone-400">{dateDivider}</div>
            )}

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
