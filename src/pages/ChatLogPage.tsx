import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ChatProfile } from '../lib/chatDB';
import type { StoredChatLog } from '../lib/chatLogDB';

type ChatLogPageProps = {
  logs: StoredChatLog[];
  chatProfiles: ChatProfile[];
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  time?: string; // displayed below bubble
};

function parseChatContent(text: string, profile: ChatProfile | null): ChatMessage[] {
  // Try JSON array format first
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const msgs: ChatMessage[] = [];
      for (const item of arr) {
        if (
          item &&
          typeof item === 'object' &&
          'role' in item &&
          'content' in item &&
          (item.role === 'user' || item.role === 'assistant') &&
          typeof item.content === 'string' &&
          item.content.trim()
        ) {
          let time: string | undefined;
          if ('timestamp' in item && typeof item.timestamp === 'string') {
            try {
              const d = new Date(item.timestamp);
              if (!Number.isNaN(d.getTime())) {
                time = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              }
            } catch {
              // ignore
            }
          }
          msgs.push({ role: item.role as 'user' | 'assistant', content: item.content.trim(), time });
        }
      }
      if (msgs.length > 0) return msgs;
    } catch {
      // not valid JSON, fall through
    }
  }

  // TXT line-by-line format
  const leftNick = profile?.leftNick?.trim() || 'M';
  const rightNick = profile?.rightNick?.trim() || '你';

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

    // Custom nickname markers: "你：" / "M：" (using profile nicks)
    const rightPrefix = `${rightNick}：`;
    const rightPrefixAlt = `${rightNick}:`;
    const leftPrefix = `${leftNick}：`;
    const leftPrefixAlt = `${leftNick}:`;

    if (line.startsWith(rightPrefix) || line.startsWith(rightPrefixAlt)) {
      flush();
      currentRole = 'user';
      currentContent = line.substring(rightNick.length + 1).trim();
      continue;
    }
    if (line.startsWith(leftPrefix) || line.startsWith(leftPrefixAlt)) {
      flush();
      currentRole = 'assistant';
      currentContent = line.substring(leftNick.length + 1).trim();
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

export function ChatLogPage({ logs, chatProfiles }: ChatLogPageProps) {
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
  onBack,
}: {
  log: StoredChatLog;
  chatProfiles: ChatProfile[];
  selectedProfileId: string;
  selectedProfile: ChatProfile | null;
  onSelectProfile: (id: string) => void;
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
              onChange={(e) => onSelectProfile(e.target.value)}
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
  let lastDate = '';

  return (
    <div className="flex flex-col gap-1.5">
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        const avatarUrl = isUser ? profile?.rightAvatarDataUrl : profile?.leftAvatarDataUrl;

        // Date divider
        let dateDivider: string | null = null;
        if (msg.time) {
          const date = msg.time.slice(0, 10);
          if (date !== lastDate) {
            lastDate = date;
            dateDivider = date;
          }
        }

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
