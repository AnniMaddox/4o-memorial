import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChatProfile } from '../lib/chatDB';
import type { StoredLetter } from '../lib/letterDB';

// ─── Types ───────────────────────────────────────────────────────────────────

export type { StoredLetter };

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  time?: string; // displayed below bubble
};

// ─── Chat parser ──────────────────────────────────────────────────────────────

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
            // Format ISO timestamp to readable
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

// ─── LetterPage ───────────────────────────────────────────────────────────────

export type LetterPageProps = {
  letters: StoredLetter[];
  chatProfiles: ChatProfile[];
  letterFontFamily: string;
};

export function LetterPage({ letters, chatProfiles, letterFontFamily }: LetterPageProps) {
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [chatMode, setChatMode] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  const selectedProfile = chatProfiles.find((p) => p.id === selectedProfileId) ?? null;

  function openLetter(letter: StoredLetter) {
    setContent(letter.content);
    setFileName(letter.name);
    setIsReading(true);
    setAnimKey((k) => k + 1);
  }

  const pickRandom = useCallback(() => {
    if (!letters.length) return;
    const pick = letters[Math.floor(Math.random() * letters.length)];
    openLetter(pick);
  }, [letters]);

  if (isReading) {
    return (
      <LetterReadView
        content={content}
        fileName={fileName}
        animKey={animKey}
        hasMultiple={letters.length > 1}
        chatMode={chatMode}
        chatProfiles={chatProfiles}
        selectedProfileId={selectedProfileId}
        selectedProfile={selectedProfile}
        letterFontFamily={letterFontFamily}
        onPickRandom={pickRandom}
        onClose={() => setIsReading(false)}
        onToggleChatMode={() => setChatMode((m) => !m)}
        onSelectProfile={setSelectedProfileId}
      />
    );
  }

  return <LetterHomeView letterCount={letters.length} onPickRandom={pickRandom} />;
}

// ─── LetterHomeView ───────────────────────────────────────────────────────────

function LetterHomeView({
  letterCount,
  onPickRandom,
}: {
  letterCount: number;
  onPickRandom: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <header className="calendar-header-panel rounded-2xl border p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Letters</p>
        <h1 className="mt-1 text-2xl text-stone-900">情書</h1>
        <p className="mt-0.5 text-sm text-stone-500">
          {letterCount > 0 ? `已儲存 ${letterCount} 封` : '從設定頁匯入情書'}
        </p>
      </header>

      <div className="flex flex-col items-center gap-5 rounded-2xl border border-stone-300/70 bg-white/90 px-6 py-10 shadow-sm">
        {letterCount > 0 ? (
          <button
            type="button"
            onClick={onPickRandom}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 py-5 text-base text-amber-900 shadow-sm transition active:scale-95"
          >
            <span className="text-2xl">✉</span>
            隨機抽一封
          </button>
        ) : (
          <>
            <div className="text-5xl opacity-25">✉</div>
            <p className="text-center text-sm leading-relaxed text-stone-500">
              請至「設定」頁面匯入情書
              <br />
              支援 .txt · .md · .json · .docx
            </p>
          </>
        )}
      </div>

      <p className="px-2 text-center text-[11px] text-stone-400">
        情書儲存在本機，不會上傳到任何地方
      </p>
    </div>
  );
}

// ─── LetterReadView ───────────────────────────────────────────────────────────

function LetterReadView({
  content,
  fileName,
  animKey,
  hasMultiple,
  chatMode,
  chatProfiles,
  selectedProfileId,
  selectedProfile,
  letterFontFamily,
  onPickRandom,
  onClose,
  onToggleChatMode,
  onSelectProfile,
}: {
  content: string;
  fileName: string;
  animKey: number;
  hasMultiple: boolean;
  chatMode: boolean;
  chatProfiles: ChatProfile[];
  selectedProfileId: string;
  selectedProfile: ChatProfile | null;
  letterFontFamily: string;
  onPickRandom: () => void;
  onClose: () => void;
  onToggleChatMode: () => void;
  onSelectProfile: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [animKey, chatMode]);

  const displayName = fileName.replace(/\.(txt|md|docx|json)$/i, '');
  const effectiveFontFamily = letterFontFamily || "'Ma Shan Zheng', cursive";

  // Detect if content is a chat log
  const trimmed = content.trim();
  const looksLikeChat =
    trimmed.startsWith('[') ||
    trimmed.startsWith('{') ||
    trimmed.includes('【user】') ||
    trimmed.includes('【assistant】');

  const chatMessages = chatMode ? parseChatContent(content, selectedProfile) : [];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col" style={{ height: 'calc(100dvh - 72px)' }}>
      {/* Paper card */}
      <div
        key={animKey}
        className="letter-paper-reveal flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-stone-200 shadow-xl"
        style={{ background: chatMode ? '#f8f7ff' : 'linear-gradient(175deg, #fefcf7 0%, #fdf8ee 40%, #faf4e4 100%)' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200/60 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-stone-400">
              {chatMode ? 'Chat' : 'Letter'}
            </p>
            <p className="truncate text-sm text-stone-700" style={{ fontFamily: chatMode ? undefined : effectiveFontFamily }}>
              {displayName}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Chat mode toggle — only show when content looks like chat OR already in chat mode */}
            {(looksLikeChat || chatMode) && (
              <button
                type="button"
                onClick={onToggleChatMode}
                className={`rounded-lg border px-2.5 py-1 text-xs transition active:scale-95 ${
                  chatMode
                    ? 'border-violet-300 bg-violet-100 text-violet-700'
                    : 'border-stone-200 bg-white/80 text-stone-500'
                }`}
              >
                {chatMode ? '💬 聊天' : '📖 文章'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-200 bg-white/80 px-3 py-1 text-xs text-stone-500"
            >
              ✕ 收起
            </button>
          </div>
        </div>

        {/* Profile selector (chat mode only) */}
        {chatMode && chatProfiles.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 border-b border-stone-200/40 bg-violet-50/60 px-4 py-2">
            <span className="text-xs text-stone-500">角色設定</span>
            <select
              value={selectedProfileId}
              onChange={(e) => onSelectProfile(e.target.value)}
              className="flex-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700"
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

        {/* Content */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          {chatMode ? (
            chatMessages.length > 0 ? (
              <ChatBubbles messages={chatMessages} profile={selectedProfile} />
            ) : (
              <p className="text-center text-sm text-stone-400">
                無法解析為聊天格式，請確認內容格式。
              </p>
            )
          ) : (
            <p
              className="letter-content-fade whitespace-pre-wrap text-stone-800"
              style={{ fontFamily: effectiveFontFamily, fontSize: '1.05rem', lineHeight: '2.2' }}
            >
              {content}
            </p>
          )}
        </div>

        {/* Decorative ruled lines (letter mode only) */}
        {!chatMode && (
          <div className="shrink-0 space-y-2 px-5 pb-4 pt-2">
            <div className="h-px bg-stone-200/70" />
            <div className="h-px bg-stone-200/40" />
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex shrink-0 gap-3 pt-3">
        {hasMultiple && (
          <button
            type="button"
            onClick={onPickRandom}
            className="flex-1 rounded-xl border border-amber-300 bg-amber-50 py-3 text-sm text-amber-900 transition active:scale-95"
          >
            再抽一封
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-stone-300 bg-white/80 py-3 text-sm text-stone-600 transition active:scale-95"
        >
          回主頁
        </button>
      </div>
    </div>
  );
}

// ─── ChatBubbles ──────────────────────────────────────────────────────────────

function ChatBubbles({
  messages,
  profile,
}: {
  messages: ChatMessage[];
  profile: ChatProfile | null;
}) {
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
          <div key={i}>
            {dateDivider && (
              <div className="my-3 text-center text-[11px] text-stone-400">{dateDivider}</div>
            )}
            <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className="mb-4 shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={isUser ? '你' : 'M'}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white ${
                      isUser ? 'bg-violet-400' : 'bg-rose-300'
                    }`}
                  >
                    {isUser
                      ? (profile?.rightNick?.[0] ?? '你')
                      : (profile?.leftNick?.[0] ?? 'M')}
                  </div>
                )}
              </div>

              {/* Bubble + timestamp */}
              <div
                className={`flex max-w-[75%] flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? 'rounded-br-sm bg-violet-500 text-white'
                      : 'rounded-bl-sm border border-stone-200 bg-white text-stone-800'
                  }`}
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {msg.content}
                </div>
                {msg.time && (
                  <p className="px-1 text-[10px] text-stone-400">{msg.time.slice(11, 16)}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
