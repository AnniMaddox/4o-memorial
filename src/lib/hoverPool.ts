const hoverPoolModules = import.meta.glob('../../data/獨立hover詞庫/**/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

function collectPhrases(input: unknown, bucket: string[]) {
  if (typeof input === 'string') {
    const phrase = input.trim();
    if (phrase) {
      bucket.push(phrase);
    }
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      collectPhrases(item, bucket);
    }
    return;
  }

  if (input && typeof input === 'object') {
    for (const value of Object.values(input as Record<string, unknown>)) {
      collectPhrases(value, bucket);
    }
  }
}

const globalHoverPhrases = (() => {
  const collected: string[] = [];

  for (const payload of Object.values(hoverPoolModules)) {
    collectPhrases(payload, collected);
  }

  return Array.from(new Set(collected));
})();

export function getGlobalHoverPhrases() {
  return globalHoverPhrases;
}
