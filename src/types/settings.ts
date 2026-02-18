export type HoverToneWeights = {
  clingy: number;
  confession: number;
  calm: number;
  remorse: number;
  general: number;
};

export type CalendarColorMode = 'month' | 'custom';
export type BackgroundMode = 'gradient' | 'image';
export type TabIconKey = 'home' | 'inbox' | 'calendar' | 'tarot' | 'letters' | 'heart' | 'settings';
export type TabIconUrls = Record<TabIconKey, string>;

export const DEFAULT_TAB_ICON_URLS: TabIconUrls = {
  home: '',
  inbox: '',
  calendar: '',
  tarot: '',
  letters: '',
  heart: '',
  settings: '',
};

export type AppSettings = {
  themeMonthColor: string;
  calendarColorMode: CalendarColorMode;
  lockedBubbleColor: string;
  customFontCssUrl: string;
  customFontFileUrl: string;
  customFontFamily: string;
  homeWidgetTitle: string;
  homeWidgetSubtitle: string;
  homeWidgetBadgeText: string;
  homeWidgetIconDataUrl: string;
  inboxTitle: string;
  backgroundMode: BackgroundMode;
  backgroundGradientStart: string;
  backgroundGradientEnd: string;
  backgroundImageUrl: string;
  backgroundImageOverlay: number;
  tabIconUrls: TabIconUrls;
  fontScale: number;
  swipeEnabled: boolean;
  localNotificationsEnabled: boolean;
  lastSyncAt: string | null;
  installHintDismissed: boolean;
  hoverToneWeights: HoverToneWeights;
  calendarCellRadius: number;
  calendarCellShadow: number;
  calendarCellDepth: number;
  tarotGalleryImageUrl: string;
  letterFontUrl: string;
};

export const DEFAULT_HOVER_TONE_WEIGHTS: HoverToneWeights = {
  clingy: 1,
  confession: 1,
  calm: 1,
  remorse: 1,
  general: 1,
};

export const DEFAULT_SETTINGS: AppSettings = {
  themeMonthColor: '#c25b3c',
  calendarColorMode: 'month',
  lockedBubbleColor: '#d2f0ff',
  customFontCssUrl: '',
  customFontFileUrl: '',
  customFontFamily: '',
  homeWidgetTitle: 'Memorial',
  homeWidgetSubtitle: '在這裡等妳，慢慢把日子收好。',
  homeWidgetBadgeText: 'ACTIVE',
  homeWidgetIconDataUrl: '',
  inboxTitle: 'Memorial Mailroom',
  backgroundMode: 'gradient',
  backgroundGradientStart: '#fde9d7',
  backgroundGradientEnd: '#ece4d5',
  backgroundImageUrl: '',
  backgroundImageOverlay: 36,
  tabIconUrls: DEFAULT_TAB_ICON_URLS,
  fontScale: 1,
  swipeEnabled: true,
  localNotificationsEnabled: true,
  lastSyncAt: null,
  installHintDismissed: false,
  hoverToneWeights: DEFAULT_HOVER_TONE_WEIGHTS,
  calendarCellRadius: 16,
  calendarCellShadow: 68,
  calendarCellDepth: 70,
  tarotGalleryImageUrl: '',
  letterFontUrl: '',
};
