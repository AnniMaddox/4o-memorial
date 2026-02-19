import { useRef, useState } from 'react';
import albumsData from '../../public/data/albums.json';

// ─── Data ────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL as string;

// chibi-00 used as book-cover decoration on the shelf
const CHIBI_00_SRC = `${BASE}chibi/chibi-00.png`;

// Single catch-all glob — covers ALL albums under public/photos/
// Key format: '../../public/photos/[album-id]/001.webp'
const ALL_PHOTO_MODULES = import.meta.glob(
  '../../public/photos/**/*.webp',
  { eager: true, import: 'default' },
) as Record<string, string>;

type AlbumMeta = {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
};

type Album = AlbumMeta & {
  images: string[];
};

function buildAlbum(meta: AlbumMeta): Album {
  const images = Object.entries(ALL_PHOTO_MODULES)
    .filter(([path]) => path.includes(`/photos/${meta.id}/`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, url]) => url);
  return { ...meta, images };
}

const ALBUMS: Album[] = (albumsData as AlbumMeta[]).map(buildAlbum);

// ─── AlbumPage ────────────────────────────────────────────────────────────────

export function AlbumPage() {
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);

  if (openAlbum) {
    return <AlbumReader album={openAlbum} onClose={() => setOpenAlbum(null)} />;
  }

  return <AlbumShelf albums={ALBUMS} onOpen={setOpenAlbum} />;
}

// ─── AlbumShelf ───────────────────────────────────────────────────────────────

function AlbumShelf({
  albums,
  onOpen,
}: {
  albums: Album[];
  onOpen: (album: Album) => void;
}) {
  return (
    <div
      className="mx-auto w-full max-w-xl overflow-y-auto px-4 pb-6 pt-5"
      style={{ height: 'calc(100dvh - 72px)' }}
    >
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-stone-400">Album</p>
          <h1
            className="mt-0.5 text-2xl text-stone-800"
            style={{ fontFamily: 'var(--app-heading-family)' }}
          >
            相冊
          </h1>
        </div>
        <img
          src={CHIBI_00_SRC}
          alt=""
          draggable={false}
          className="calendar-chibi w-16 select-none"
        />
      </header>

      {/* Album books grid */}
      <div className="grid grid-cols-2 gap-4">
        {albums.map((album) => (
          <AlbumBookCard key={album.id} album={album} onOpen={() => onOpen(album)} />
        ))}
      </div>
    </div>
  );
}

// ─── AlbumBookCard ────────────────────────────────────────────────────────────

function AlbumBookCard({ album, onOpen }: { album: Album; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full overflow-hidden rounded-2xl shadow-md transition active:scale-95"
      style={{ aspectRatio: '3/4' }}
    >
      {/* Cover gradient background */}
      <div className="absolute inset-0" style={{ background: album.accent }} />

      {/* Chibi-00 as cover decoration */}
      <img
        src={CHIBI_00_SRC}
        alt=""
        draggable={false}
        className="absolute bottom-10 left-1/2 w-3/4 -translate-x-1/2 select-none object-contain drop-shadow-md transition group-active:scale-95"
      />

      {/* Bottom label */}
      <div
        className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-6"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)',
        }}
      >
        <p className="text-sm font-semibold leading-tight text-white">{album.title}</p>
        <p className="mt-0.5 text-[10px] text-white/65">{album.subtitle}</p>
        <p className="mt-1 text-[10px] text-white/50">{album.images.length} 張</p>
      </div>

      {/* Spine shadow on left */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-3"
        style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.15) 0%, transparent 100%)' }}
      />
    </button>
  );
}

// ─── AlbumReader ──────────────────────────────────────────────────────────────

function AlbumReader({ album, onClose }: { album: Album; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swiped = useRef(false);

  const total = album.images.length;
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

    // Only swipe if horizontal movement dominates
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
      className="relative mx-auto flex w-full max-w-xl flex-col overflow-hidden bg-black"
      style={{ height: 'calc(100dvh - 72px)' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pb-6 pt-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)' }}
      >
        <button
          type="button"
          className="pointer-events-auto rounded-full bg-black/35 px-3 py-1.5 text-sm text-white/80 backdrop-blur-sm transition active:scale-90"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
          ‹ {album.title}
        </button>
        <span className="text-xs text-white/55 tabular-nums">
          {index + 1} / {total}
        </span>
      </div>

      {/* ── Image ─────────────────────────────────────────────────── */}
      <img
        key={index}
        src={album.images[index]}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-contain"
      />

      {/* ── Tap-zone chevrons ─────────────────────────────────────── */}
      {hasPrev && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-12 items-center justify-start pl-2">
          <span className="text-2xl text-white/25">‹</span>
        </div>
      )}
      {hasNext && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-12 items-center justify-end pr-2">
          <span className="text-2xl text-white/25">›</span>
        </div>
      )}

      {/* ── Progress bar ──────────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/10">
        <div
          className="h-full bg-white/40 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
