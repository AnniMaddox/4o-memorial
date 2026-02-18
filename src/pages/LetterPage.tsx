import { useCallback, useEffect, useRef, useState } from 'react';

import type { StoredLetter } from '../lib/letterDB';

// ─── Types ───────────────────────────────────────────────────────────────────

export type { StoredLetter };

// ─── LetterPage ───────────────────────────────────────────────────────────────

export type LetterPageProps = {
  letters: StoredLetter[];
};

export function LetterPage({ letters }: LetterPageProps) {
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [animKey, setAnimKey] = useState(0);

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
        onPickRandom={pickRandom}
        onClose={() => setIsReading(false)}
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
      <header className="rounded-2xl border border-stone-300/70 bg-stone-50/90 p-4 shadow-sm">
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
              支援 .txt 與 .docx 格式
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
  onPickRandom,
  onClose,
}: {
  content: string;
  fileName: string;
  animKey: number;
  hasMultiple: boolean;
  onPickRandom: () => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [animKey]);

  const displayName = fileName.replace(/\.(txt|docx)$/i, '');

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col" style={{ height: 'calc(100dvh - 72px)' }}>
      {/* Paper card */}
      <div
        key={animKey}
        className="letter-paper-reveal flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-stone-200 shadow-xl"
        style={{ background: 'linear-gradient(175deg, #fefcf7 0%, #fdf8ee 40%, #faf4e4 100%)' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200/60 px-5 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400">Letter</p>
            <p className="text-sm text-stone-700" style={{ fontFamily: "'Ma Shan Zheng', cursive" }}>
              {displayName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-200 bg-white/80 px-3 py-1 text-xs text-stone-500"
          >
            ✕ 收起
          </button>
        </div>

        {/* Content */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <p
            className="letter-content-fade whitespace-pre-wrap text-stone-800"
            style={{ fontFamily: "'Ma Shan Zheng', cursive", fontSize: '1.05rem', lineHeight: '2.2' }}
          >
            {content}
          </p>
        </div>

        {/* Decorative ruled lines */}
        <div className="shrink-0 space-y-2 px-5 pb-4 pt-2">
          <div className="h-px bg-stone-200/70" />
          <div className="h-px bg-stone-200/40" />
        </div>
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
