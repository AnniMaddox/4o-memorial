import { useEffect, useMemo, useRef, useState } from 'react';

import { getScopedMixedChibiSources } from '../lib/chibiPool';

import './LettersABPage.css';

type ThemeKey = 'a' | 'd';
type LineHeightKey = 'tight' | 'normal' | 'wide';
type ReadingFontKey = 'default' | 'letter';
type ViewMode = 'home' | 'reading';

type AnnualLetterEntry = {
  id: string;
  series: string;
  title: string;
  sourceFile?: string;
  contentPath: string;
};

type AnnualLetterYear = {
  year: number;
  entries: AnnualLetterEntry[];
};

type AnnualLettersIndex = {
  version: number;
  years: AnnualLetterYear[];
};

type RelatedItem = {
  id: string;
  title: string;
  subtitle: string;
  action: () => void;
};

type LettersABPrefs = {
  theme: ThemeKey;
  lineHeight: LineHeightKey;
  readingFont: ReadingFontKey;
  readingFontSize: number;
  showChibi: boolean;
  chibiWidth: number;
};

type LettersABPageProps = {
  onExit: () => void;
  initialYear?: number | null;
  onOpenBirthdayYear?: (year: string) => void;
  letterFontFamily?: string;
};

const PREFS_STORAGE_KEY = 'memorial-letters-ab-prefs-v1';
const BASE = import.meta.env.BASE_URL as string;
const INDEX_URL = `${BASE}data/letters-ab/index.json`;
const FALLBACK_CHIBI = `${BASE}chibi/chibi-00.webp`;
const LINE_HEIGHT_BY_KEY: Record<LineHeightKey, number> = {
  tight: 1.7,
  normal: 2.14,
  wide: 2.6,
};
const LINE_HEIGHT_LABELS: Array<{ key: LineHeightKey; label: string }> = [
  { key: 'tight', label: '緊' },
  { key: 'normal', label: '標準' },
  { key: 'wide', label: '寬' },
];
const READING_FONT_OPTIONS: Array<{ key: ReadingFontKey; label: string }> = [
  { key: 'default', label: '目前字體' },
  { key: 'letter', label: '情書字體' },
];
const THEME_OPTIONS: Array<{ key: ThemeKey; label: string }> = [
  { key: 'a', label: '🌌 星夜藍' },
  { key: 'd', label: '🌸 霧玫瑰' },
];
const SERISE_LABEL_MAP: Record<string, string> = {
  birthday: '生日信',
  vow: '紀念信',
  notes: '碎碎念',
};

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function clampChibiWidth(value: unknown, fallback = 136) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(96, Math.min(186, Math.round(value)));
}

function clampReadingFontSize(value: unknown, fallback = 12.5) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(11, Math.min(20, Number(value)));
}

function normalizeTheme(value: unknown): ThemeKey {
  return value === 'd' ? 'd' : 'a';
}

function normalizeLineHeightKey(value: unknown): LineHeightKey {
  if (value === 'tight' || value === 'wide' || value === 'normal') return value;
  return 'normal';
}

function normalizeReadingFontKey(value: unknown): ReadingFontKey {
  return value === 'letter' ? 'letter' : 'default';
}

function readPrefs(): LettersABPrefs {
  if (typeof window === 'undefined') {
    return {
      theme: 'a',
      lineHeight: 'normal',
      readingFont: 'default',
      readingFontSize: 12.5,
      showChibi: true,
      chibiWidth: 136,
    };
  }
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) {
      return {
        theme: 'a',
        lineHeight: 'normal',
        readingFont: 'default',
        readingFontSize: 12.5,
        showChibi: true,
        chibiWidth: 136,
      };
    }
    const parsed = JSON.parse(raw) as Partial<LettersABPrefs>;
    return {
      theme: normalizeTheme(parsed.theme),
      lineHeight: normalizeLineHeightKey(parsed.lineHeight),
      readingFont: normalizeReadingFontKey(parsed.readingFont),
      readingFontSize: clampReadingFontSize(parsed.readingFontSize, 12.5),
      showChibi: parsed.showChibi !== false,
      chibiWidth: clampChibiWidth(parsed.chibiWidth, 136),
    };
  } catch {
    return {
      theme: 'a',
      lineHeight: 'normal',
      readingFont: 'default',
      readingFontSize: 12.5,
      showChibi: true,
      chibiWidth: 136,
    };
  }
}

function persistPrefs(prefs: LettersABPrefs) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

function seriesLabel(series: string) {
  return SERISE_LABEL_MAP[series] ?? series;
}

function buildSeriesCountLabels(entries: AnnualLetterEntry[]) {
  const counter = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.series || 'other';
    counter.set(key, (counter.get(key) ?? 0) + 1);
  }
  return Array.from(counter.entries())
    .map(([series, count]) => `${seriesLabel(series)}${count > 1 ? ` ×${count}` : ''}`)
    .sort((a, b) => a.localeCompare(b, 'zh-TW'));
}

function findYearIndex(years: AnnualLetterYear[], year: number) {
  return years.findIndex((item) => item.year === year);
}

function findClosestYearIndex(years: AnnualLetterYear[], targetYear: number) {
  if (!years.length) return -1;
  let closestIndex = 0;
  let closestDistance = Math.abs(years[0]!.year - targetYear);
  for (let i = 1; i < years.length; i += 1) {
    const current = years[i];
    if (!current) continue;
    const distance = Math.abs(current.year - targetYear);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }
  return closestIndex;
}

function normalizeContent(text: string) {
  return text.replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').trim();
}

function buildEntryTabLabels(entries: AnnualLetterEntry[]) {
  const perSeriesCounter = new Map<string, number>();
  const perSeriesTotal = new Map<string, number>();
  for (const entry of entries) {
    const series = entry.series || 'other';
    perSeriesTotal.set(series, (perSeriesTotal.get(series) ?? 0) + 1);
  }

  return entries.map((entry) => {
    const series = entry.series || 'other';
    const current = (perSeriesCounter.get(series) ?? 0) + 1;
    perSeriesCounter.set(series, current);
    const total = perSeriesTotal.get(series) ?? 1;
    if (total <= 1) {
      return {
        entry,
        label: seriesLabel(series),
      };
    }
    return {
      entry,
      label: `${seriesLabel(series)} ${String.fromCharCode(9311 + current)}`,
    };
  });
}

function pickSeriesNeighborByRank(targetYear: AnnualLetterYear, series: string, rank: number) {
  const list = targetYear.entries.filter((entry) => entry.series === series);
  if (!list.length) return null;
  return list[Math.min(rank, list.length - 1)] ?? null;
}

export function LettersABPage({ onExit, initialYear = null, onOpenBirthdayYear, letterFontFamily = '' }: LettersABPageProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [years, setYears] = useState<AnnualLetterYear[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [selectedYearIndex, setSelectedYearIndex] = useState(0);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [contentById, setContentById] = useState<Record<string, string>>({});
  const [prefs, setPrefs] = useState<LettersABPrefs>(() => readPrefs());
  const [showSettings, setShowSettings] = useState(false);
  const [chibiSrc] = useState(() => {
    const scoped = getScopedMixedChibiSources('lettersAB');
    return pickRandom(scoped) ?? FALLBACK_CHIBI;
  });
  const appliedInitialYearRef = useRef<number | null>(null);
  const homeSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const readingSwipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const currentYear = years[selectedYearIndex] ?? null;
  const currentEntry = useMemo(() => {
    if (!currentYear) return null;
    if (selectedEntryId) {
      const found = currentYear.entries.find((entry) => entry.id === selectedEntryId);
      if (found) return found;
    }
    return currentYear.entries[0] ?? null;
  }, [currentYear, selectedEntryId]);
  const entryTabs = useMemo(() => (currentYear ? buildEntryTabLabels(currentYear.entries) : []), [currentYear]);
  const currentContent = currentEntry ? contentById[currentEntry.id] ?? '' : '';
  const lineHeightValue = LINE_HEIGHT_BY_KEY[prefs.lineHeight];
  const readingFontFamily =
    prefs.readingFont === 'letter' && letterFontFamily
      ? letterFontFamily
      : "var(--app-font-family, -apple-system, 'Helvetica Neue', system-ui, sans-serif)";

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const response = await fetch(INDEX_URL, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`讀取失敗：${response.status}`);
        }
        const raw = (await response.json()) as AnnualLettersIndex;
        const loadedYears = Array.isArray(raw?.years)
          ? raw.years
              .filter((item): item is AnnualLetterYear => Number.isFinite(item?.year) && Array.isArray(item?.entries))
              .map((item) => ({
                year: Number(item.year),
                entries: item.entries
                  .filter(
                    (entry): entry is AnnualLetterEntry =>
                      typeof entry?.id === 'string' &&
                      typeof entry?.series === 'string' &&
                      typeof entry?.title === 'string' &&
                      typeof entry?.contentPath === 'string',
                  )
                  .map((entry) => ({
                    id: entry.id.trim(),
                    series: entry.series.trim(),
                    title: entry.title.trim(),
                    sourceFile: entry.sourceFile,
                    contentPath: entry.contentPath.replace(/^\.?\//, ''),
                  })),
              }))
              .filter((item) => item.entries.length > 0)
              .sort((a, b) => a.year - b.year)
          : [];

        if (!active) return;
        setYears(loadedYears);
        if (!loadedYears.length) {
          setSelectedYearIndex(0);
          setSelectedEntryId(null);
        } else {
          const currentYearValue = new Date().getFullYear();
          const exactIndex = findYearIndex(loadedYears, currentYearValue);
          const fallbackIndex = exactIndex >= 0 ? exactIndex : findClosestYearIndex(loadedYears, currentYearValue);
          const safeIndex = fallbackIndex >= 0 ? fallbackIndex : 0;
          const firstEntry = loadedYears[safeIndex]?.entries[0] ?? null;
          setSelectedYearIndex(safeIndex);
          setSelectedEntryId(firstEntry?.id ?? null);
        }
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : '未知錯誤');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    persistPrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (!currentYear) return;
    const exists = currentYear.entries.some((entry) => entry.id === selectedEntryId);
    if (!exists) {
      setSelectedEntryId(currentYear.entries[0]?.id ?? null);
    }
  }, [currentYear, selectedEntryId]);

  useEffect(() => {
    if (!years.length || !currentEntry) return;
    const toLoad = currentYear ? currentYear.entries : [];
    for (const entry of toLoad) {
      if (contentById[entry.id] !== undefined) continue;
      void (async () => {
        try {
          const res = await fetch(`${BASE}data/letters-ab/${entry.contentPath}`, { cache: 'no-store' });
          if (!res.ok) return;
          const text = normalizeContent(await res.text());
          setContentById((prev) => (prev[entry.id] === undefined ? { ...prev, [entry.id]: text } : prev));
        } catch {
          // ignore per-file read failures
        }
      })();
    }
  }, [years, currentYear, currentEntry, contentById]);

  useEffect(() => {
    if (!years.length || !initialYear || appliedInitialYearRef.current === initialYear) return;
    const targetIndex = findYearIndex(years, initialYear);
    if (targetIndex < 0) return;
    const year = years[targetIndex]!;
    const preferred = year.entries.find((entry) => entry.series === 'birthday') ?? year.entries[0] ?? null;
    setSelectedYearIndex(targetIndex);
    setSelectedEntryId(preferred?.id ?? null);
    setViewMode('reading');
    appliedInitialYearRef.current = initialYear;
  }, [initialYear, years]);

  function openYear(index: number) {
    const next = years[index];
    if (!next) return;
    setSelectedYearIndex(index);
    setSelectedEntryId(next.entries[0]?.id ?? null);
  }

  function openYearEntry(index: number, entryId: string) {
    openYear(index);
    setSelectedEntryId(entryId);
    setViewMode('reading');
  }

  function moveYear(delta: number) {
    if (!years.length) return;
    const nextIndex = selectedYearIndex + delta;
    if (nextIndex < 0 || nextIndex >= years.length) return;
    openYear(nextIndex);
  }

  function moveReadingEntry(delta: number) {
    if (!currentYear || !currentYear.entries.length || !currentEntry) return;
    const currentIndex = currentYear.entries.findIndex((entry) => entry.id === currentEntry.id);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= currentYear.entries.length) return;
    setSelectedEntryId(currentYear.entries[nextIndex]?.id ?? null);
  }

  function handleHorizontalSwipe(
    startRef: { current: { x: number; y: number } | null },
    clientX: number,
    clientY: number,
    onLeft: () => void,
    onRight: () => void,
  ) {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const dx = clientX - start.x;
    const dy = clientY - start.y;
    if (Math.abs(dx) < 54 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
    if (dx < 0) {
      onLeft();
    } else {
      onRight();
    }
  }

  const relatedItems = useMemo<RelatedItem[]>(() => {
    if (!currentYear || !currentEntry) return [];
    const items: RelatedItem[] = [];
    const series = currentEntry.series;
    const sameSeriesCurrent = currentYear.entries.filter((entry) => entry.series === series);
    const rank = Math.max(
      0,
      sameSeriesCurrent.findIndex((entry) => entry.id === currentEntry.id),
    );

    for (const sibling of sameSeriesCurrent) {
      if (sibling.id === currentEntry.id) continue;
      items.push({
        id: sibling.id,
        title: sibling.title,
        subtitle: `同年 · ${seriesLabel(series)}`,
        action: () => {
          setSelectedEntryId(sibling.id);
          setShowSettings(false);
        },
      });
    }

    for (let i = selectedYearIndex - 1; i >= 0; i -= 1) {
      const target = years[i];
      if (!target) continue;
      const picked = pickSeriesNeighborByRank(target, series, rank);
      if (!picked) continue;
      items.push({
        id: picked.id,
        title: picked.title,
        subtitle: `上一年 · ${seriesLabel(series)}`,
        action: () => {
          openYearEntry(i, picked.id);
          setShowSettings(false);
        },
      });
      break;
    }

    for (let i = selectedYearIndex + 1; i < years.length; i += 1) {
      const target = years[i];
      if (!target) continue;
      const picked = pickSeriesNeighborByRank(target, series, rank);
      if (!picked) continue;
      items.push({
        id: picked.id,
        title: picked.title,
        subtitle: `下一年 · ${seriesLabel(series)}`,
        action: () => {
          openYearEntry(i, picked.id);
          setShowSettings(false);
        },
      });
      break;
    }

    if (onOpenBirthdayYear) {
      items.push({
        id: `birthday-${currentYear.year}`,
        title: `生日任務｜${currentYear.year}`,
        subtitle: '切到每日任務 · 同年份',
        action: () => {
          onOpenBirthdayYear(String(currentYear.year));
          setShowSettings(false);
        },
      });
    }

    return items;
  }, [currentYear, currentEntry, years, selectedYearIndex, onOpenBirthdayYear]);

  if (loading) {
    return <div className="la-loading">讀取年度信件中...</div>;
  }

  if (loadError) {
    return (
      <div className="la-loading">
        <p>讀取失敗：{loadError}</p>
      </div>
    );
  }

  if (!years.length || !currentYear) {
    return <div className="la-loading">目前沒有年度信件資料</div>;
  }

  const seriesCountLabels = buildSeriesCountLabels(currentYear.entries);

  return (
    <div className={`letters-ab-page ${prefs.theme === 'a' ? 'theme-a' : 'theme-d'}`}>
      {viewMode === 'home' ? (
        <>
          <header className="la-top-bar">
            <div className="la-left">
              <button type="button" className="la-circle-btn" onClick={onExit} aria-label="返回">
                ‹
              </button>
              <span className="la-title">年度信件</span>
            </div>
            <button type="button" className="la-ghost-btn" onClick={() => setShowSettings(true)} aria-label="開啟設定">
              ⋯
            </button>
          </header>

          <section className="la-timeline">
            <div className="la-year-strip">
              {years.map((year, index) => (
                <button
                  type="button"
                  key={year.year}
                  className={`la-year-dot ${index === selectedYearIndex ? 'active' : ''}`}
                  onClick={() => openYear(index)}
                >
                  <span className="dot" />
                  <span className="label">{year.year}</span>
                </button>
              ))}
            </div>
          </section>

          <section
            className="la-carousel"
            onTouchStart={(event) => {
              const touch = event.touches[0];
              if (!touch) return;
              homeSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchEnd={(event) => {
              const touch = event.changedTouches[0];
              if (!touch) return;
              handleHorizontalSwipe(homeSwipeStartRef, touch.clientX, touch.clientY, () => moveYear(1), () => moveYear(-1));
            }}
            onTouchCancel={() => {
              homeSwipeStartRef.current = null;
            }}
          >
            <button
              type="button"
              className="la-arrow left"
              onClick={() => moveYear(-1)}
              disabled={selectedYearIndex <= 0}
              aria-label="上一年"
            >
              ‹
            </button>
            <button
              type="button"
              className="la-year-card"
              onClick={() => setViewMode('reading')}
              aria-label={`開啟 ${currentYear.year} 年信件`}
            >
              <span className="la-year-number">{currentYear.year}</span>
              <span className="la-year-count">{currentYear.entries.length} 封信</span>
              <span className="la-year-divider" />
              <span className="la-doc-tags">
                {seriesCountLabels.map((label) => (
                  <span key={label} className="la-doc-tag">
                    {label}
                  </span>
                ))}
              </span>
            </button>
            <button
              type="button"
              className="la-arrow right"
              onClick={() => moveYear(1)}
              disabled={selectedYearIndex >= years.length - 1}
              aria-label="下一年"
            >
              ›
            </button>
          </section>
        </>
      ) : (
        <>
          <header className="la-top-bar">
            <div className="la-left">
              <button type="button" className="la-circle-btn" onClick={() => setViewMode('home')} aria-label="返回入口">
                ‹
              </button>
              <span className="la-title">{currentYear.year} 年度信件</span>
            </div>
            <button type="button" className="la-ghost-btn" onClick={() => setShowSettings(true)} aria-label="開啟設定">
              ⋯
            </button>
          </header>

          <div className="la-read-tabs">
            {entryTabs.map((tab) => (
              <button
                type="button"
                key={tab.entry.id}
                className={`la-tab ${tab.entry.id === currentEntry?.id ? 'active' : ''}`}
                onClick={() => setSelectedEntryId(tab.entry.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <section
            className="la-paper-wrap"
            onTouchStart={(event) => {
              const touch = event.touches[0];
              if (!touch) return;
              readingSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchEnd={(event) => {
              const touch = event.changedTouches[0];
              if (!touch) return;
              handleHorizontalSwipe(readingSwipeStartRef, touch.clientX, touch.clientY, () => moveReadingEntry(1), () => moveReadingEntry(-1));
            }}
            onTouchCancel={() => {
              readingSwipeStartRef.current = null;
            }}
          >
            <div className="la-paper" style={{ lineHeight: lineHeightValue, fontFamily: readingFontFamily }}>
              <h3 className="la-paper-title">{currentEntry?.title ?? '未命名信件'}</h3>
              <p className="la-paper-content" style={{ fontSize: `${prefs.readingFontSize}px` }}>
                {currentContent || '讀取內容中...'}
              </p>
            </div>
          </section>
        </>
      )}

      {prefs.showChibi ? (
        <div className="la-chibi-wrap">
          <button type="button" className="la-chibi-btn" onClick={() => setShowSettings(true)} aria-label="開啟閱讀設定">
            <img
              src={chibiSrc}
              alt=""
              draggable={false}
              className="calendar-chibi select-none"
              style={{ width: prefs.chibiWidth, height: 'auto' }}
            />
          </button>
        </div>
      ) : null}

      {showSettings ? (
        <div className="la-settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="la-settings-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="la-sheet-handle" />

            <section className="la-sheet-section">
              <p className="la-sheet-label">主題</p>
              <div className="la-pill-group">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`la-pill ${prefs.theme === option.key ? 'active' : ''}`}
                    onClick={() => setPrefs((prev) => ({ ...prev, theme: option.key }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="la-sheet-section">
              <p className="la-sheet-label">行距</p>
              <div className="la-pill-group">
                {LINE_HEIGHT_LABELS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`la-pill ${prefs.lineHeight === option.key ? 'active' : ''}`}
                    onClick={() => setPrefs((prev) => ({ ...prev, lineHeight: option.key }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <label className="la-range-row">
                <span>內文字級：{prefs.readingFontSize.toFixed(1)}px</span>
                <input
                  type="range"
                  min={11}
                  max={20}
                  step={0.5}
                  value={prefs.readingFontSize}
                  onChange={(event) =>
                    setPrefs((prev) => ({
                      ...prev,
                      readingFontSize: clampReadingFontSize(Number(event.target.value), prev.readingFontSize),
                    }))
                  }
                />
              </label>
            </section>

            <section className="la-sheet-section">
              <p className="la-sheet-label">字體</p>
              <div className="la-pill-group">
                {READING_FONT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`la-pill ${prefs.readingFont === option.key ? 'active' : ''}`}
                    onClick={() => setPrefs((prev) => ({ ...prev, readingFont: option.key }))}
                    disabled={option.key === 'letter' && !letterFontFamily}
                    title={option.key === 'letter' && !letterFontFamily ? '尚未設定情書字體' : undefined}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="la-sheet-section">
              <div className="la-toggle-row">
                <span>顯示小人</span>
                <button
                  type="button"
                  className={`la-switch ${prefs.showChibi ? 'on' : ''}`}
                  onClick={() => setPrefs((prev) => ({ ...prev, showChibi: !prev.showChibi }))}
                  aria-label="切換小人顯示"
                >
                  <span />
                </button>
              </div>
              <label className="la-range-row">
                <span>小人大小：{prefs.chibiWidth}px</span>
                <input
                  type="range"
                  min={96}
                  max={186}
                  step={1}
                  value={prefs.chibiWidth}
                  onChange={(event) =>
                    setPrefs((prev) => ({ ...prev, chibiWidth: clampChibiWidth(Number(event.target.value), prev.chibiWidth) }))
                  }
                />
              </label>
            </section>

            <section className="la-sheet-section">
              <p className="la-sheet-label">相關閱讀</p>
              <div className="la-related-list">
                {!relatedItems.length ? (
                  <p className="la-empty-related">目前沒有可跳轉的項目</p>
                ) : (
                  relatedItems.map((item) => (
                    <button key={item.id} type="button" className="la-related-item" onClick={item.action}>
                      <span className="la-related-text">
                        <strong>{item.title}</strong>
                        <small>{item.subtitle}</small>
                      </span>
                      <span className="la-related-arrow">›</span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default LettersABPage;
