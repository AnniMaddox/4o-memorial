import { useCallback, useEffect, useRef, useState } from 'react';

import { readLetterFile } from '../lib/letterReader';

// ─── Types ───────────────────────────────────────────────────────────────────

type LetterFile = {
  name: string;
  handle: FileSystemFileHandle;
};

type PageState = 'home' | 'reading';

export type SingleFile = { name: string; content: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function enumerateLetterFiles(
  handle: FileSystemDirectoryHandle,
): Promise<LetterFile[]> {
  const found: LetterFile[] = [];
  const directoryHandle = handle as FileSystemDirectoryHandle & {
    entries?: () => AsyncIterable<[string, FileSystemHandle]>;
    values?: () => AsyncIterable<FileSystemHandle>;
  };

  if (directoryHandle.entries) {
    for await (const [name, entry] of directoryHandle.entries()) {
      if (entry.kind === 'file') {
        const lower = name.toLowerCase();
        if (lower.endsWith('.txt') || lower.endsWith('.docx')) {
          found.push({ name, handle: entry as FileSystemFileHandle });
        }
      }
    }
  } else if (directoryHandle.values) {
    for await (const entry of directoryHandle.values()) {
      if (entry.kind === 'file') {
        const fileHandle = entry as FileSystemFileHandle;
        const lower = fileHandle.name.toLowerCase();
        if (lower.endsWith('.txt') || lower.endsWith('.docx')) {
          found.push({ name: fileHandle.name, handle: fileHandle });
        }
      }
    }
  }
  found.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
  return found;
}

// ─── LetterPage ───────────────────────────────────────────────────────────────

export type LetterPageProps = {
  folderHandle: FileSystemDirectoryHandle | null;
  singleFile: SingleFile | null;
  onFolderChange: (handle: FileSystemDirectoryHandle | null) => void;
  onClearSingleFile: () => void;
};

export function LetterPage({
  folderHandle,
  singleFile,
  onClearSingleFile,
}: LetterPageProps) {
  const [files, setFiles] = useState<LetterFile[]>([]);
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [pageState, setPageState] = useState<PageState>('home');
  const [loading, setLoading] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [isSingleFileView, setIsSingleFileView] = useState(false);

  // Enumerate files whenever folder changes
  useEffect(() => {
    if (!folderHandle) {
      setFiles([]);
      return;
    }
    enumerateLetterFiles(folderHandle)
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [folderHandle]);

  // Auto-open single file when it arrives
  useEffect(() => {
    if (!singleFile) return;
    setContent(singleFile.content);
    setFileName(singleFile.name);
    setIsSingleFileView(true);
    setPageState('reading');
    setAnimKey((k) => k + 1);
  }, [singleFile]);

  async function openLetter(handle: FileSystemFileHandle) {
    setLoading(true);
    try {
      const text = await readLetterFile(handle);
      setContent(text);
      setFileName(handle.name);
      setIsSingleFileView(false);
      setPageState('reading');
      setAnimKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  const pickRandom = useCallback(async () => {
    if (!files.length) return;
    const pick = files[Math.floor(Math.random() * files.length)];
    await openLetter(pick.handle);
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    if (isSingleFileView) {
      onClearSingleFile();
      setIsSingleFileView(false);
    }
    setPageState('home');
  }

  if (pageState === 'reading') {
    return (
      <LetterReadView
        content={content}
        fileName={fileName}
        animKey={animKey}
        loading={loading}
        hasMultiple={files.length > 1 && !isSingleFileView}
        onPickRandom={pickRandom}
        onClose={handleClose}
      />
    );
  }

  return (
    <LetterHomeView
      folderName={folderHandle?.name ?? ''}
      fileCount={files.length}
      loading={loading}
      onPickRandom={pickRandom}
    />
  );
}

// ─── LetterHomeView ───────────────────────────────────────────────────────────

function LetterHomeView({
  folderName,
  fileCount,
  loading,
  onPickRandom,
}: {
  folderName: string;
  fileCount: number;
  loading: boolean;
  onPickRandom: () => void;
}) {
  const hasFolder = !!folderName;

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      {/* Header */}
      <header className="rounded-2xl border border-stone-300/70 bg-stone-50/90 p-4 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Letters</p>
        <h1 className="mt-1 text-2xl text-stone-900">情書</h1>
        {hasFolder ? (
          <p className="mt-0.5 text-sm text-stone-500">
            📁 {folderName}
            <span className="ml-2 text-stone-400">· {fileCount} 封</span>
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-stone-500">從設定頁選擇資料夾或匯入單封</p>
        )}
      </header>

      {/* Main action */}
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-stone-300/70 bg-white/90 px-6 py-10 shadow-sm">
        {hasFolder && fileCount > 0 ? (
          <button
            type="button"
            onClick={onPickRandom}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 py-5 text-base text-amber-900 shadow-sm transition active:scale-95 disabled:opacity-50"
          >
            <span className="text-2xl">✉</span>
            {loading ? '閱讀中…' : '隨機抽一封'}
          </button>
        ) : hasFolder && fileCount === 0 ? (
          <p className="text-center text-sm text-stone-500">
            資料夾裡沒有找到 .txt 或 .docx 檔案
          </p>
        ) : (
          <>
            <div className="text-5xl opacity-25">✉</div>
            <p className="text-center text-sm leading-relaxed text-stone-500">
              請至「設定」頁面選擇資料夾
              <br />
              或直接匯入單封情書
            </p>
          </>
        )}
      </div>

      <p className="px-2 text-center text-[11px] text-stone-400">
        支援 .txt 與 .docx 格式 · 資料夾跨 session 自動記憶
      </p>
    </div>
  );
}

// ─── LetterReadView ───────────────────────────────────────────────────────────

function LetterReadView({
  content,
  fileName,
  animKey,
  loading,
  hasMultiple,
  onPickRandom,
  onClose,
}: {
  content: string;
  fileName: string;
  animKey: number;
  loading: boolean;
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
        style={{
          background: 'linear-gradient(175deg, #fefcf7 0%, #fdf8ee 40%, #faf4e4 100%)',
        }}
      >
        {/* Paper header */}
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200/60 px-5 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400">Letter</p>
            <p
              className="text-sm text-stone-700"
              style={{ fontFamily: "'Ma Shan Zheng', cursive" }}
            >
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

        {/* Scrollable content */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <p className="text-center text-sm text-stone-400">閱讀中…</p>
          ) : (
            <p
              className="letter-content-fade whitespace-pre-wrap text-stone-800"
              style={{
                fontFamily: "'Ma Shan Zheng', cursive",
                fontSize: '1.05rem',
                lineHeight: '2.2',
              }}
            >
              {content}
            </p>
          )}
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
            disabled={loading}
            className="flex-1 rounded-xl border border-amber-300 bg-amber-50 py-3 text-sm text-amber-900 transition active:scale-95 disabled:opacity-50"
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

// ─── init helper (used by App) ────────────────────────────────────────────────

export { enumerateLetterFiles };
export type { LetterFile };
