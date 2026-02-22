import { useEffect, useMemo, useRef, useState } from 'react';
import bookshelfData from '../../public/data/bookshelf.json';
import './BookshelfPage.css';

const BASE = import.meta.env.BASE_URL as string;
const CHIBI_00_SRC = `${BASE}chibi/chibi-00.webp`;
const THEME_STORAGE_KEY = 'memorial-bookshelf-live-theme';
const HORIZONTAL_SWIPE_THRESHOLD = 40;
const CLOSE_SWIPE_THRESHOLD = 72;
const PLACEHOLDER_SUBTITLE = '待替換';

const ALL_BOOK_MODULES = import.meta.glob('../../public/books/**/*.{png,webp,jpg,jpeg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

type ThemeMode = 'dark' | 'warm';
type ViewMode = 'shelf' | 'detail' | 'reader';

type BookMeta = {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  coverImage?: string;
};

type BookTone = {
  dark: [string, string];
  warm: [string, string];
};

type Book = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  coverImageUrl: string;
  pages: string[];
  tone: BookTone;
};

const BOOK_WIDTH_PATTERN = [44, 60, 36, 52, 40];
const BOOK_HEIGHT_RATIO_PATTERN = [0.85, 0.77, 0.91, 0.82, 0.87];
const BOOK_TONES: BookTone[] = [
  { dark: ['#7c5cbc', '#5040a0'], warm: ['#922828', '#6a1414'] },
  { dark: ['#3d8a78', '#285a50'], warm: ['#2a5a38', '#183828'] },
  { dark: ['#c47830', '#9a5218'], warm: ['#8a6820', '#6a4a0c'] },
  { dark: ['#8a3a52', '#5c1e38'], warm: ['#5a3068', '#3a1848'] },
  { dark: ['#3a5a8c', '#1e3868'], warm: ['#8a3820', '#5c1e0e'] },
];

function normalizeSubtitle(value: string | undefined) {
  const normalized = (value ?? '').trim();
  if (!normalized || normalized === PLACEHOLDER_SUBTITLE) {
    return '';
  }
  return normalized;
}

function buildBook(meta: BookMeta, index: number): Book {
  const entries = Object.entries(ALL_BOOK_MODULES).filter(([path]) => path.includes(`/books/${meta.id}/`));

  const coverEntry = entries.find(([path]) => (path.split('/').pop()?.toLowerCase() ?? '').startsWith('cover'));

  const pages = entries
    .filter(([path]) => !(path.split('/').pop()?.toLowerCase() ?? '').startsWith('cover'))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map(([, url]) => url);

  const rawCover = (meta.coverImage ?? '').trim();
  const coverImageUrl = rawCover
    ? rawCover.startsWith('http') || rawCover.startsWith('data:')
      ? rawCover
      : `${BASE}${rawCover.startsWith('/') ? rawCover.slice(1) : rawCover}`
    : coverEntry?.[1] ?? '';

  return {
    id: meta.id,
    title: (meta.title ?? '').trim() || `書本 ${index + 1}`,
    subtitle: normalizeSubtitle(meta.subtitle),
    icon: (meta.icon ?? '').trim() || '📖',
    coverImageUrl,
    pages,
    tone: BOOK_TONES[index % BOOK_TONES.length]!,
  };
}

function computeBookHeights(bookCount: number, viewportHeight: number) {
  const available = Math.max(320, viewportHeight - 70 - 16 - 72);
  return Array.from({ length: bookCount }, (_, index) =>
    Math.round(available * BOOK_HEIGHT_RATIO_PATTERN[index % BOOK_HEIGHT_RATIO_PATTERN.length]!),
  );
}

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function BookshelfPage({ onExit }: { onExit: () => void }) {
  const books = useMemo(() => (bookshelfData as BookMeta[]).map(buildBook), []);

  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [mode, setMode] = useState<ViewMode>('shelf');
  const [selectedBookIndex, setSelectedBookIndex] = useState<number | null>(null);
  const [detailActive, setDetailActive] = useState(false);
  const [readerPageIndex, setReaderPageIndex] = useState(0);
  const [enteredCount, setEnteredCount] = useState(0);
  const [chibiShown, setChibiShown] = useState(false);
  const [bookHeights, setBookHeights] = useState<number[]>([]);

  const animatingRef = useRef(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'warm') {
        setTheme(saved);
      }
    } catch {
      // ignore storage error
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage error
    }
  }, [theme]);

  useEffect(() => {
    setEnteredCount(0);
    setChibiShown(false);

    const timers: number[] = [];
    books.forEach((_, index) => {
      timers.push(
        window.setTimeout(() => {
          setEnteredCount((current) => Math.max(current, index + 1));
        }, 320 + index * 90),
      );
    });

    timers.push(
      window.setTimeout(
        () => setChibiShown(true),
        320 + books.length * 90 + 220,
      ),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [books]);

  useEffect(() => {
    const updateHeights = () => {
      setBookHeights(computeBookHeights(books.length, window.innerHeight));
    };

    updateHeights();
    window.addEventListener('resize', updateHeights);
    return () => window.removeEventListener('resize', updateHeights);
  }, [books.length]);

  useEffect(() => {
    return () => {
      if (openTimerRef.current !== null) {
        window.clearTimeout(openTimerRef.current);
      }
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const selectedBook = selectedBookIndex !== null ? books[selectedBookIndex] ?? null : null;
  const hasSelection = selectedBookIndex !== null;

  const detailTopBackground = selectedBook
    ? `linear-gradient(145deg, ${theme === 'dark' ? selectedBook.tone.dark[0] : selectedBook.tone.warm[0]}, ${theme === 'dark' ? selectedBook.tone.dark[1] : selectedBook.tone.warm[1]})`
    : undefined;

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'warm' : 'dark'));
  }

  function openBook(index: number) {
    if (animatingRef.current || mode !== 'shelf') {
      return;
    }

    animatingRef.current = true;
    setSelectedBookIndex(index);

    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
    }

    openTimerRef.current = window.setTimeout(() => {
      setMode('detail');
      setDetailActive(true);
      animatingRef.current = false;
      openTimerRef.current = null;
    }, 160);
  }

  function closeDetail() {
    if (animatingRef.current || mode !== 'detail') {
      return;
    }

    animatingRef.current = true;
    setDetailActive(false);

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setMode('shelf');
      setSelectedBookIndex(null);
      animatingRef.current = false;
      closeTimerRef.current = null;
    }, 420);
  }

  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeDetail();
    }
  }

  function startReader() {
    if (!selectedBook) {
      return;
    }
    setMode('reader');
    setDetailActive(false);
    setReaderPageIndex(0);
  }

  function closeReaderToShelf() {
    setMode('shelf');
    setSelectedBookIndex(null);
    setReaderPageIndex(0);
  }

  if (mode === 'reader' && selectedBook) {
    return (
      <BookReaderView
        theme={theme}
        pages={selectedBook.pages}
        pageIndex={readerPageIndex}
        onPageIndexChange={setReaderPageIndex}
        onClose={closeReaderToShelf}
      />
    );
  }

  return (
    <div className={classNames('bsl-root', theme === 'dark' ? 'bsl-theme-dark' : 'bsl-theme-warm')}>
      <div className="bsl-app">
        <header className="bsl-top-bar">
          <h1 className="bsl-title">書架</h1>
          <button
            type="button"
            className="bsl-theme-btn"
            onClick={toggleTheme}
            aria-label="切換主題"
          >
            {theme === 'dark' ? '🌙' : '🌿'}
          </button>
        </header>

        <div className="bsl-shelf-container">
          <div className="bsl-shelf-glow" />

          <div className="bsl-books-row">
            {books.length === 0 ? (
              <div className="bsl-empty">書架還是空的，等你把書放進來</div>
            ) : (
              books.map((book, index) => (
                <button
                  key={book.id}
                  type="button"
                  aria-label={`打開：${book.title}`}
                  className={classNames(
                    'bsl-book',
                    `bsl-bk-${index % 5}`,
                    index < enteredCount && 'entered',
                    hasSelection && selectedBookIndex === index && 'lifted',
                    hasSelection && selectedBookIndex !== index && 'dimmed',
                  )}
                  style={{
                    width: `${BOOK_WIDTH_PATTERN[index % BOOK_WIDTH_PATTERN.length]}px`,
                    height: `${bookHeights[index] ?? 360}px`,
                  }}
                  onClick={() => openBook(index)}
                >
                  <div className="bsl-pages-edge" />
                  <div className="bsl-spine-content">
                    <span className="bsl-spine-title">{book.title}</span>
                    <span className="bsl-spine-deco" />
                    <span className="bsl-spine-author">{book.subtitle || 'M'}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="bsl-shelf-plank" />
          <div className="bsl-shelf-floor" />

          <button
            type="button"
            className={classNames('bsl-shelf-chibi', chibiShown && 'shown')}
            onClick={onExit}
            aria-label="返回首頁"
            title="返回首頁"
          >
            <img
              src={CHIBI_00_SRC}
              alt=""
              draggable={false}
              className="bsl-chibi-img"
            />
          </button>
        </div>

        <div
          className={classNames('bsl-detail-overlay', mode === 'detail' && detailActive && 'active')}
          onClick={handleOverlayClick}
        >
          <button
            type="button"
            className="bsl-close-btn"
            onClick={closeDetail}
            aria-label="關閉封面"
          >
            ✕
          </button>

          <div className="bsl-detail-cover" onClick={(event) => event.stopPropagation()}>
            <div className="bsl-cover-top" style={{ background: detailTopBackground }}>
              <span className="bsl-cover-circle bsl-cover-circle-1" />
              <span className="bsl-cover-circle bsl-cover-circle-2" />
              <span className="bsl-cover-line" />
              <div className="bsl-cover-icon">{selectedBook?.icon ?? '📖'}</div>
              <div className="bsl-cover-title">{selectedBook?.title ?? ''}</div>
              <div className="bsl-cover-sub">{selectedBook?.subtitle || ' '}</div>
            </div>
            <div className="bsl-cover-bottom">
              <button
                type="button"
                className="bsl-cover-read-btn"
                onClick={startReader}
              >
                開始閱讀
              </button>
            </div>
          </div>

          <div className="bsl-detail-info">
            <div className="bsl-detail-title">{selectedBook?.title ?? ''}</div>
            {selectedBook?.subtitle ? <div className="bsl-detail-sub">{selectedBook.subtitle}</div> : null}
            <div className="bsl-detail-dots">
              {books.map((book, index) => (
                <span
                  key={book.id}
                  className={classNames('bsl-detail-dot', selectedBookIndex === index && 'active')}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bsl-desktop-bg" aria-hidden="true" />
    </div>
  );
}

function BookReaderView({
  theme,
  pages,
  pageIndex,
  onPageIndexChange,
  onClose,
}: {
  theme: ThemeMode;
  pages: string[];
  pageIndex: number;
  onPageIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

  const total = pages.length;
  const hasPrev = pageIndex > 0;
  const hasNext = pageIndex < total - 1;

  function goPrev() {
    if (!hasPrev) {
      return;
    }
    onPageIndexChange(pageIndex - 1);
  }

  function goNext() {
    if (!hasNext) {
      return;
    }
    onPageIndexChange(pageIndex + 1);
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartRef.current = {
      x: event.touches[0]!.clientX,
      y: event.touches[0]!.clientY,
    };
    swipedRef.current = false;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    if (!start) {
      return;
    }

    const dx = event.changedTouches[0]!.clientX - start.x;
    const dy = event.changedTouches[0]!.clientY - start.y;
    touchStartRef.current = null;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > HORIZONTAL_SWIPE_THRESHOLD) {
      swipedRef.current = true;
      if (dx < 0) {
        goNext();
      } else {
        goPrev();
      }
      return;
    }

    if (dy > CLOSE_SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
      swipedRef.current = true;
      onClose();
    }
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }

    if (total === 0) {
      onClose();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;

    if (x <= width * 0.35) {
      goPrev();
    } else if (x >= width * 0.65) {
      goNext();
    }
  }

  return (
    <div className={classNames('bsl-reader', theme === 'dark' ? 'bsl-theme-dark' : 'bsl-theme-warm')}>
      {total === 0 ? (
        <div
          className="bsl-reader-empty"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          <div className="bsl-reader-empty-icon">📖</div>
          <p>這本書還沒有頁面</p>
        </div>
      ) : (
        <div
          className="bsl-reader-surface"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          <img
            key={`${pages[pageIndex]}-${pageIndex}`}
            src={pages[pageIndex]}
            alt=""
            draggable={false}
            className="bsl-reader-image"
          />
        </div>
      )}
    </div>
  );
}
