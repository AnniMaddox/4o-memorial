import { useRef, useState } from 'react';
import bookshelfData from '../../public/data/bookshelf.json';

// ─── Data ─────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL as string;
const CHIBI_00_SRC = `${BASE}chibi/chibi-00.webp`;

const ALL_BOOK_MODULES = import.meta.glob(
  '../../public/books/**/*.{png,webp,jpg,jpeg}',
  { eager: true, import: 'default' },
) as Record<string, string>;

type BookMeta = {
  id: string;
  title: string;
  subtitle?: string;
  spineColor?: string;
  textColor?: string;
  height?: 'short' | 'medium' | 'tall';
  coverImage?: string;
};

type Book = BookMeta & {
  pages: string[];
  coverImageUrl: string;
};

const HEIGHT_PX: Record<'short' | 'medium' | 'tall', number> = {
  short: 118,
  medium: 152,
  tall: 188,
};

// Auto-assign heights for natural uneven look
const AUTO_HEIGHTS: Array<'short' | 'medium' | 'tall'> = [
  'tall', 'medium', 'tall', 'short', 'medium', 'tall', 'short', 'medium', 'tall', 'medium',
];

// Rich library colors for auto-assignment
const AUTO_SPINE_COLORS = [
  '#7a2828', // deep crimson
  '#1e3a5f', // midnight blue
  '#2d5016', // forest green
  '#4a2060', // dark purple
  '#8b5a14', // warm amber
  '#1a4a4a', // teal
  '#5c1a1a', // burgundy
  '#1a3a5c', // navy
  '#3d5c1a', // olive
  '#5c3a1a', // chestnut
];

function buildBook(meta: BookMeta, index: number): Book {
  const allEntries = Object.entries(ALL_BOOK_MODULES).filter(([path]) =>
    path.includes(`/books/${meta.id}/`),
  );

  const coverEntry = allEntries.find(([path]) =>
    (path.split('/').pop()?.toLowerCase() ?? '').startsWith('cover'),
  );

  const pages = allEntries
    .filter(
      ([path]) => !(path.split('/').pop()?.toLowerCase() ?? '').startsWith('cover'),
    )
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(([, url]) => url);

  const rawCover = meta.coverImage?.trim() ?? '';
  let coverImageUrl = '';
  if (rawCover) {
    coverImageUrl =
      rawCover.startsWith('http') || rawCover.startsWith('data:')
        ? rawCover
        : `${BASE}${rawCover.startsWith('/') ? rawCover.slice(1) : rawCover}`;
  } else if (coverEntry) {
    coverImageUrl = coverEntry[1];
  }

  return {
    ...meta,
    spineColor: meta.spineColor ?? AUTO_SPINE_COLORS[index % AUTO_SPINE_COLORS.length]!,
    textColor: meta.textColor ?? '#f8f0e4',
    height: meta.height ?? AUTO_HEIGHTS[index % AUTO_HEIGHTS.length]!,
    pages,
    coverImageUrl,
  };
}

const BOOKS: Book[] = (bookshelfData as BookMeta[]).map(buildBook);
const BOOKS_PER_ROW = 5;

// ─── BookshelfPage ────────────────────────────────────────────────────────────

export function BookshelfPage({ onExit }: { onExit: () => void }) {
  const [openBookId, setOpenBookId] = useState<string | null>(null);
  const openedBook = openBookId ? (BOOKS.find((b) => b.id === openBookId) ?? null) : null;

  if (openedBook) {
    return <BookReader book={openedBook} onClose={() => setOpenBookId(null)} />;
  }

  return <BookShelf books={BOOKS} onOpen={setOpenBookId} onExit={onExit} />;
}

// ─── BookShelf ────────────────────────────────────────────────────────────────

function BookShelf({
  books,
  onOpen,
  onExit,
}: {
  books: Book[];
  onOpen: (id: string) => void;
  onExit: () => void;
}) {
  // Group books into shelf rows
  const rows: Book[][] = [];
  if (books.length === 0) {
    rows.push([]);
  } else {
    for (let i = 0; i < books.length; i += BOOKS_PER_ROW) {
      rows.push(books.slice(i, i + BOOKS_PER_ROW));
    }
  }

  return (
    <div
      className="flex flex-col overflow-y-auto"
      style={{
        height: 'calc(100dvh - 72px)',
        background: 'linear-gradient(180deg, #f5ece0 0%, #ede3d2 60%, #e6dac8 100%)',
      }}
    >
      {/* Header */}
      <header className="flex flex-shrink-0 items-center justify-between px-5 pb-2 pt-5">
        <div>
          <p
            className="text-[10px] uppercase tracking-[0.28em]"
            style={{ color: '#b5916a' }}
          >
            Bookshelf
          </p>
          <h1
            className="mt-0.5 text-[22px] leading-tight"
            style={{ fontFamily: 'var(--app-heading-family)', color: '#4a2e14' }}
          >
            書架
          </h1>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-full p-1 transition active:scale-95"
          aria-label="關閉書架"
        >
          <img
            src={CHIBI_00_SRC}
            alt=""
            draggable={false}
            className="calendar-chibi w-14 select-none"
          />
        </button>
      </header>

      {/* Shelves */}
      <div className="flex flex-1 flex-col justify-end pb-4 pt-2">
        {rows.map((rowBooks, rowIndex) => (
          <ShelfRow
            key={rowIndex}
            books={rowBooks}
            onOpen={onOpen}
            isEmpty={rowBooks.length === 0}
          />
        ))}
      </div>
    </div>
  );
}

// ─── ShelfRow ─────────────────────────────────────────────────────────────────

function ShelfRow({
  books,
  onOpen,
  isEmpty,
}: {
  books: Book[];
  onOpen: (id: string) => void;
  isEmpty: boolean;
}) {
  const maxHeight = isEmpty
    ? HEIGHT_PX.medium
    : Math.max(...books.map((b) => HEIGHT_PX[b.height ?? 'medium']));

  return (
    <div className="mt-6 px-3">
      {/* Books sitting on the shelf */}
      <div
        className="flex items-end gap-[6px] px-3"
        style={{ minHeight: maxHeight + 4 }}
      >
        {isEmpty ? (
          <div
            className="flex w-full items-end justify-center pb-3"
            style={{ height: HEIGHT_PX.medium }}
          >
            <p className="text-sm" style={{ color: '#c4a47a', fontFamily: 'var(--app-heading-family)' }}>
              書架還是空的，等你把書放進來
            </p>
          </div>
        ) : (
          <>
            {books.map((book) => (
              <BookSpine key={book.id} book={book} onOpen={() => onOpen(book.id)} />
            ))}
            {/* Decorative bookend spacer if row not full */}
            {books.length < BOOKS_PER_ROW && (
              <div className="flex-1" />
            )}
          </>
        )}
      </div>

      {/* Wooden shelf plank */}
      <div className="mx-1">
        {/* Top highlight line */}
        <div
          style={{
            height: 2,
            borderRadius: '2px 2px 0 0',
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.42) 40%, rgba(255,255,255,0.25) 100%)',
          }}
        />
        {/* Main plank surface */}
        <div
          style={{
            height: 20,
            background:
              'linear-gradient(180deg, #d6a96a 0%, #c99858 25%, #c49255 50%, #ba8848 75%, #ae7c3a 100%)',
            boxShadow: '0 2px 0 #9a6c2a',
          }}
        />
        {/* Plank front edge */}
        <div
          style={{
            height: 8,
            background:
              'linear-gradient(180deg, #9a6c2a 0%, #875e22 50%, #7a5418 100%)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.38), 0 2px 5px rgba(0,0,0,0.22)',
            borderRadius: '0 0 2px 2px',
          }}
        />
      </div>
    </div>
  );
}

// ─── BookSpine ────────────────────────────────────────────────────────────────

function BookSpine({ book, onOpen }: { book: Book; onOpen: () => void }) {
  const heightPx = HEIGHT_PX[book.height ?? 'medium'];
  const color = book.spineColor ?? '#8B4513';
  const textColor = book.textColor ?? '#f8f0e4';

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`打開：${book.title}`}
      className="group relative flex-shrink-0 transition-all duration-150 ease-out active:scale-y-95 hover:-translate-y-1"
      style={{ width: 50, height: heightPx }}
    >
      {/* Spine body — gradient simulates 3D depth */}
      <div
        className="absolute inset-0 rounded-t-[2px]"
        style={{
          background: `linear-gradient(90deg,
            rgba(0,0,0,0.55) 0%,
            rgba(0,0,0,0.15) 10%,
            ${color} 16%,
            ${color} 78%,
            rgba(255,255,255,0.18) 88%,
            rgba(0,0,0,0.25) 100%
          )`,
          boxShadow: '2px 0 8px rgba(0,0,0,0.4), -1px 0 2px rgba(0,0,0,0.2)',
        }}
      />

      {/* Subtle texture lines (horizontal bands) */}
      <div
        className="absolute inset-0 rounded-t-[2px]"
        style={{
          background:
            'repeating-linear-gradient(180deg, transparent 0px, transparent 18px, rgba(0,0,0,0.04) 18px, rgba(0,0,0,0.04) 19px)',
        }}
      />

      {/* Top edge highlight */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: 4,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 100%)',
          borderRadius: '2px 2px 0 0',
        }}
      />

      {/* Title — vertical Chinese text */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ padding: '12px 7px' }}
      >
        <span
          style={{
            writingMode: 'vertical-rl',
            fontSize: 11,
            lineHeight: 1.25,
            color: textColor,
            fontFamily: 'var(--app-heading-family)',
            letterSpacing: '0.08em',
            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            maxHeight: '100%',
            display: 'block',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {book.title}
        </span>
      </div>

      {/* Hover glow overlay */}
      <div
        className="absolute inset-0 rounded-t-[2px] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{
          background: 'rgba(255,255,255,0.1)',
          boxShadow: 'inset 0 0 8px rgba(255,255,255,0.1)',
        }}
      />
    </button>
  );
}

// ─── BookReader ───────────────────────────────────────────────────────────────

function BookReader({ book, onClose }: { book: Book; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swiped = useRef(false);

  const pages = book.pages;
  const total = pages.length;
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  function prev() {
    if (hasPrev) setIndex((i) => i - 1);
  }
  function next() {
    if (hasNext) setIndex((i) => i + 1);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]!.clientX;
    touchStartY.current = e.touches[0]!.clientY;
    swiped.current = false;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0]!.clientX - touchStartX.current;
    const dy = e.changedTouches[0]!.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      swiped.current = true;
      if (dx < 0) next();
      else prev();
    }
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    if (x < w * 0.35) prev();
    else if (x > w * 0.65) next();
  }

  const progress = total > 1 ? (index / (total - 1)) * 100 : 100;

  return (
    <div
      className="relative mx-auto flex w-full max-w-xl flex-col overflow-hidden"
      style={{ height: 'calc(100dvh - 72px)', background: '#1a1410' }}
    >
      {/* Top bar */}
      <div
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pb-5 pt-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }}
      >
        <button
          type="button"
          className="rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-sm text-white/80 backdrop-blur-sm transition active:scale-90"
          onClick={onClose}
        >
          ‹ {book.title}
        </button>
        <span className="text-xs tabular-nums text-white/45">
          {total > 0 ? `${index + 1} / ${total}` : ''}
        </span>
      </div>

      {total === 0 ? (
        <div className="grid flex-1 place-items-center px-6 text-center">
          <div>
            <p className="text-2xl opacity-20">📖</p>
            <p className="mt-3 text-sm text-stone-500">這本書還沒有頁面</p>
          </div>
        </div>
      ) : (
        <div
          className="relative flex-1"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          <img
            key={index}
            src={pages[index]}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-contain"
          />

          {hasPrev && (
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-12 items-center justify-start pl-2">
              <span className="text-2xl text-white/20">‹</span>
            </div>
          )}
          {hasNext && (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-12 items-center justify-end pr-2">
              <span className="text-2xl text-white/20">›</span>
            </div>
          )}

          {/* Progress bar */}
          <div className="absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/8">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: 'rgba(255,255,255,0.3)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
