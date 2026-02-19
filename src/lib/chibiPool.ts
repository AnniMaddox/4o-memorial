const ACTIVE_BASE_CHIBI_POOL_STORAGE_KEY = 'memorial-active-base-chibi-pool-v1';
const DEFAULT_POOL_SIZE = 60;
const MIN_POOL_SIZE = 20;

export const CHIBI_POOL_UPDATED_EVENT = 'memorial:chibi-pool-updated';

const BASE_CHIBI_MODULES = import.meta.glob('../../public/chibi/*.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const BASE_CHIBI_SOURCES = Object.entries(BASE_CHIBI_MODULES)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, src]) => src);

type ChibiPoolInfo = {
  allCount: number;
  activeCount: number;
  targetCount: number;
};

function clampPoolSize(size: number) {
  if (!BASE_CHIBI_SOURCES.length) {
    return 0;
  }
  if (!Number.isFinite(size)) {
    return Math.min(DEFAULT_POOL_SIZE, BASE_CHIBI_SOURCES.length);
  }
  return Math.max(MIN_POOL_SIZE, Math.min(Math.floor(size), BASE_CHIBI_SOURCES.length));
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function shuffleCopy<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index]!;
    next[index] = next[randomIndex]!;
    next[randomIndex] = current;
  }
  return next;
}

function readStoredPool() {
  if (typeof window === 'undefined') {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(ACTIVE_BASE_CHIBI_POOL_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function writeStoredPool(pool: string[]) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(ACTIVE_BASE_CHIBI_POOL_STORAGE_KEY, JSON.stringify(pool));
}

function dispatchPoolUpdated(info: ChibiPoolInfo) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(CHIBI_POOL_UPDATED_EVENT, {
      detail: info,
    }),
  );
}

function normalizeStoredPool() {
  if (!BASE_CHIBI_SOURCES.length) {
    return [];
  }

  const allowed = new Set(BASE_CHIBI_SOURCES);
  const sanitized = uniqueStrings(readStoredPool().filter((item) => allowed.has(item)));
  return sanitized;
}

function samplePool(targetCount: number) {
  if (!BASE_CHIBI_SOURCES.length || targetCount <= 0) {
    return [];
  }

  if (BASE_CHIBI_SOURCES.length <= targetCount) {
    return [...BASE_CHIBI_SOURCES];
  }

  return shuffleCopy(BASE_CHIBI_SOURCES).slice(0, targetCount);
}

function syncPoolLength(pool: string[], targetCount: number) {
  if (targetCount <= 0) {
    return [];
  }

  if (pool.length === targetCount) {
    return pool;
  }

  if (pool.length > targetCount) {
    return pool.slice(0, targetCount);
  }

  const poolSet = new Set(pool);
  const remaining = BASE_CHIBI_SOURCES.filter((item) => !poolSet.has(item));
  return [...pool, ...shuffleCopy(remaining).slice(0, targetCount - pool.length)];
}

export function getAllBaseChibiSources() {
  return [...BASE_CHIBI_SOURCES];
}

export function getActiveBaseChibiSources(poolSize = DEFAULT_POOL_SIZE) {
  const targetCount = clampPoolSize(poolSize);
  if (targetCount <= 0) {
    return [];
  }

  const normalized = syncPoolLength(normalizeStoredPool(), targetCount);
  if (normalized.length) {
    if (normalized.length !== readStoredPool().length) {
      writeStoredPool(normalized);
    }
    return normalized;
  }

  const next = samplePool(targetCount);
  writeStoredPool(next);
  return next;
}

export function refreshActiveBaseChibiPool(poolSize = DEFAULT_POOL_SIZE) {
  const targetCount = clampPoolSize(poolSize);
  const next = samplePool(targetCount);
  writeStoredPool(next);
  const info = {
    allCount: BASE_CHIBI_SOURCES.length,
    activeCount: next.length,
    targetCount,
  };
  dispatchPoolUpdated(info);
  return next;
}

export function syncActiveBaseChibiPool(poolSize = DEFAULT_POOL_SIZE) {
  const targetCount = clampPoolSize(poolSize);
  const next = syncPoolLength(normalizeStoredPool(), targetCount);
  writeStoredPool(next);
  const info = {
    allCount: BASE_CHIBI_SOURCES.length,
    activeCount: next.length,
    targetCount,
  };
  dispatchPoolUpdated(info);
  return next;
}

export function getBaseChibiPoolInfo(poolSize = DEFAULT_POOL_SIZE): ChibiPoolInfo {
  const active = getActiveBaseChibiSources(poolSize);
  return {
    allCount: BASE_CHIBI_SOURCES.length,
    activeCount: active.length,
    targetCount: clampPoolSize(poolSize),
  };
}
