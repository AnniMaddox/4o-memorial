import { countCalendarMonths, putCalendarMonth } from './repositories/calendarRepo';
import { countEmails, putEmails } from './repositories/emailRepo';

import type { CalendarMonth, EmailRecord } from '../types/content';

const calendarModules = import.meta.glob('../../data/calendar/**/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, CalendarMonth>;

const emlModules = import.meta.glob('../../data/emails/**/*.eml', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

function cyrb53Hash(value: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}

function normalizeHeaderName(name: string) {
  return name.trim().toLowerCase();
}

function parseHeaders(headerText: string) {
  const headers: Record<string, string> = {};
  const lines = headerText.replace(/\r/g, '').split('\n');

  let currentKey = '';

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    if ((line.startsWith(' ') || line.startsWith('\t')) && currentKey) {
      headers[currentKey] = `${headers[currentKey]} ${line.trim()}`;
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) {
      continue;
    }

    currentKey = normalizeHeaderName(line.slice(0, separatorIndex));
    headers[currentKey] = line.slice(separatorIndex + 1).trim();
  }

  return headers;
}

function decodeMimeWord(input: string) {
  return input.replace(/=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g, (_match, charset, encoding, payload) => {
    const normalizedCharset = String(charset).toLowerCase();
    const normalizedEncoding = String(encoding).toLowerCase();

    if (normalizedEncoding !== 'b' || normalizedCharset !== 'utf-8') {
      return payload;
    }

    try {
      const bytes = Uint8Array.from(atob(payload), (ch) => ch.charCodeAt(0));
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return payload;
    }
  });
}

function decodeBody(payload: string, transferEncoding: string | undefined) {
  if (!transferEncoding) {
    return payload.trim();
  }

  if (transferEncoding.toLowerCase() === 'base64') {
    const compact = payload.replace(/\s+/g, '');

    try {
      const bytes = Uint8Array.from(atob(compact), (ch) => ch.charCodeAt(0));
      return new TextDecoder('utf-8').decode(bytes).trim();
    } catch {
      return payload.trim();
    }
  }

  return payload.trim();
}

function parseAddress(raw: string | undefined) {
  if (!raw) {
    return {
      name: null,
      address: null,
    };
  }

  const matched = raw.match(/^(.*)<([^>]+)>$/);
  if (!matched) {
    return {
      name: null,
      address: raw.trim(),
    };
  }

  return {
    name: decodeMimeWord(matched[1].trim().replace(/^"|"$/g, '')) || null,
    address: matched[2].trim() || null,
  };
}

function toMonthKeyFromDateKey(dateKey: string) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function parseEml(raw: string, sourcePath: string): EmailRecord {
  const splitIndex = raw.search(/\r?\n\r?\n/);
  const headerText = splitIndex >= 0 ? raw.slice(0, splitIndex) : raw;
  const bodyTextRaw = splitIndex >= 0 ? raw.slice(splitIndex).replace(/^\r?\n\r?\n/, '') : '';

  const headers = parseHeaders(headerText);

  const subjectRaw = headers.subject ?? null;
  const subject = subjectRaw ? decodeMimeWord(subjectRaw) : null;

  const from = parseAddress(headers.from);
  const to = parseAddress(headers.to);

  const dateHeaderRaw = headers.date ?? null;
  const unlockDate = dateHeaderRaw ? new Date(dateHeaderRaw) : new Date();
  const unlockAtUtc = Number.isNaN(unlockDate.getTime()) ? new Date().toISOString() : unlockDate.toISOString();

  const bodyText = decodeBody(bodyTextRaw, headers['content-transfer-encoding']);

  const idSeed = `${sourcePath}::${headers['message-id'] ?? ''}::${unlockAtUtc}::${subject ?? ''}`;

  return {
    id: `eml_${cyrb53Hash(idSeed)}`,
    sourcePath,
    unlockAtUtc,
    dateHeaderRaw,
    fromName: from.name,
    fromAddress: from.address,
    toName: to.name,
    toAddress: to.address,
    subject,
    bodyText,
    rawHeaders: headers,
  };
}

export async function seedDatabaseIfNeeded() {
  const [emailCount, calendarCount] = await Promise.all([countEmails(), countCalendarMonths()]);

  if (emailCount > 0 && calendarCount > 0) {
    return {
      seeded: false,
      emailCount,
      calendarCount,
    };
  }

  if (calendarCount === 0) {
    const grouped: Record<string, CalendarMonth> = {};

    for (const calendarData of Object.values(calendarModules)) {
      for (const [dateKey, message] of Object.entries(calendarData)) {
        const monthKey = toMonthKeyFromDateKey(dateKey);
        if (!monthKey) {
          continue;
        }

        if (!grouped[monthKey]) {
          grouped[monthKey] = {};
        }

        grouped[monthKey][dateKey] = String(message ?? '');
      }
    }

    await Promise.all(Object.entries(grouped).map(([monthKey, data]) => putCalendarMonth(monthKey, data)));
  }

  if (emailCount === 0) {
    const parsedEmails = Object.entries(emlModules)
      .map(([path, raw]) => parseEml(raw, path))
      .sort((a, b) => Date.parse(a.unlockAtUtc) - Date.parse(b.unlockAtUtc));

    if (parsedEmails.length > 0) {
      await putEmails(parsedEmails);
    }
  }

  const [nextEmailCount, nextCalendarCount] = await Promise.all([countEmails(), countCalendarMonths()]);

  return {
    seeded: true,
    emailCount: nextEmailCount,
    calendarCount: nextCalendarCount,
  };
}
