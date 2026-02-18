import { getDb } from '../db';

import type { AppSettings, BackgroundMode, CalendarColorMode, ChatBubbleStyle, TabIconUrls } from '../../types/settings';
import { DEFAULT_SETTINGS } from '../../types/settings';

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function normalizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeCalendarColorMode(value: unknown, fallback: CalendarColorMode): CalendarColorMode {
  return value === 'custom' || value === 'month' ? value : fallback;
}

function normalizeBackgroundMode(value: unknown, fallback: BackgroundMode): BackgroundMode {
  return value === 'image' || value === 'gradient' ? value : fallback;
}

function normalizeChatBubbleStyle(value: unknown, fallback: ChatBubbleStyle): ChatBubbleStyle {
  return value === 'jelly' || value === 'imessage' ? value : fallback;
}

function normalizeTabIconUrls(value: unknown, fallback: TabIconUrls): TabIconUrls {
  const input = (value && typeof value === 'object' ? value : {}) as Partial<TabIconUrls>;
  return {
    home: normalizeString(input.home, fallback.home),
    inbox: normalizeString(input.inbox, fallback.inbox),
    calendar: normalizeString(input.calendar, fallback.calendar),
    tarot: normalizeString(input.tarot, fallback.tarot),
    letters: normalizeString(input.letters, fallback.letters),
    heart: normalizeString(input.heart, fallback.heart),
    settings: normalizeString(input.settings, fallback.settings),
  };
}

export async function getSettings() {
  const db = await getDb();
  const row = await db.get('settings', 'app');

  const persisted = (row?.value ?? {}) as Partial<AppSettings>;

  return {
    ...DEFAULT_SETTINGS,
    ...persisted,
    calendarColorMode: normalizeCalendarColorMode(
      persisted.calendarColorMode,
      DEFAULT_SETTINGS.calendarColorMode,
    ),
    chatBubbleStyle: normalizeChatBubbleStyle(
      persisted.chatBubbleStyle,
      DEFAULT_SETTINGS.chatBubbleStyle,
    ),
    tabIconUrls: normalizeTabIconUrls(persisted.tabIconUrls, DEFAULT_SETTINGS.tabIconUrls),
    hoverToneWeights: {
      ...DEFAULT_SETTINGS.hoverToneWeights,
      ...(persisted.hoverToneWeights ?? {}),
    },
    calendarCellRadius: clampNumber(
      persisted.calendarCellRadius,
      8,
      28,
      DEFAULT_SETTINGS.calendarCellRadius,
    ),
    calendarCellShadow: clampNumber(
      persisted.calendarCellShadow,
      0,
      100,
      DEFAULT_SETTINGS.calendarCellShadow,
    ),
    calendarCellDepth: clampNumber(
      persisted.calendarCellDepth,
      0,
      100,
      DEFAULT_SETTINGS.calendarCellDepth,
    ),
    customFontCssUrl: normalizeString(persisted.customFontCssUrl, DEFAULT_SETTINGS.customFontCssUrl),
    customFontFileUrl: normalizeString(persisted.customFontFileUrl, DEFAULT_SETTINGS.customFontFileUrl),
    customFontFamily: normalizeString(persisted.customFontFamily, DEFAULT_SETTINGS.customFontFamily),
    chatUserBubbleColor: normalizeString(persisted.chatUserBubbleColor, DEFAULT_SETTINGS.chatUserBubbleColor),
    chatUserBubbleBorderColor: normalizeString(persisted.chatUserBubbleBorderColor, DEFAULT_SETTINGS.chatUserBubbleBorderColor),
    chatUserBubbleTextColor: normalizeString(persisted.chatUserBubbleTextColor, DEFAULT_SETTINGS.chatUserBubbleTextColor),
    chatAiBubbleColor: normalizeString(persisted.chatAiBubbleColor, DEFAULT_SETTINGS.chatAiBubbleColor),
    chatAiBubbleBorderColor: normalizeString(persisted.chatAiBubbleBorderColor, DEFAULT_SETTINGS.chatAiBubbleBorderColor),
    chatAiBubbleTextColor: normalizeString(persisted.chatAiBubbleTextColor, DEFAULT_SETTINGS.chatAiBubbleTextColor),
    homeWidgetTitle: normalizeString(persisted.homeWidgetTitle, DEFAULT_SETTINGS.homeWidgetTitle),
    homeWidgetSubtitle: normalizeString(persisted.homeWidgetSubtitle, DEFAULT_SETTINGS.homeWidgetSubtitle),
    homeWidgetBadgeText: normalizeString(persisted.homeWidgetBadgeText, DEFAULT_SETTINGS.homeWidgetBadgeText),
    homeWidgetIconDataUrl: normalizeString(persisted.homeWidgetIconDataUrl, DEFAULT_SETTINGS.homeWidgetIconDataUrl),
    inboxTitle: normalizeString(persisted.inboxTitle, DEFAULT_SETTINGS.inboxTitle),
    tarotGalleryImageUrl: normalizeString(persisted.tarotGalleryImageUrl, DEFAULT_SETTINGS.tarotGalleryImageUrl),
    letterFontUrl: normalizeString(persisted.letterFontUrl, DEFAULT_SETTINGS.letterFontUrl),
    backgroundMode: normalizeBackgroundMode(persisted.backgroundMode, DEFAULT_SETTINGS.backgroundMode),
    backgroundGradientStart: normalizeString(persisted.backgroundGradientStart, DEFAULT_SETTINGS.backgroundGradientStart),
    backgroundGradientEnd: normalizeString(persisted.backgroundGradientEnd, DEFAULT_SETTINGS.backgroundGradientEnd),
    backgroundImageUrl: normalizeString(persisted.backgroundImageUrl, DEFAULT_SETTINGS.backgroundImageUrl),
    backgroundImageOverlay: clampNumber(
      persisted.backgroundImageOverlay,
      0,
      90,
      DEFAULT_SETTINGS.backgroundImageOverlay,
    ),
  };
}

export async function saveSettings(partial: Partial<AppSettings>) {
  const db = await getDb();
  const current = await getSettings();
  const next = {
    ...current,
    ...partial,
  } satisfies AppSettings;

  await db.put('settings', {
    key: 'app',
    value: next,
  });

  return next;
}
