export type HoverToneWeights = {
  clingy: number;
  confession: number;
  calm: number;
  remorse: number;
  general: number;
};

export type CalendarColorMode = 'month' | 'custom';
export type BackgroundMode = 'gradient' | 'image';
export type ChatBubbleStyle = 'jelly' | 'imessage' | 'imessageClassic';
export type TabIconKey = 'home' | 'inbox' | 'calendar' | 'tarot' | 'letters' | 'heart' | 'list' | 'fitness' | 'diary' | 'settings';
export type TabIconUrls = Record<TabIconKey, string>;
export type AppLabelKey =
  | 'home'
  | 'inbox'
  | 'calendar'
  | 'settings'
  | 'tarot'
  | 'letters'
  | 'heart'
  | 'chat'
  | 'list'
  | 'fitness'
  | 'diary';
export type AppLabels = Record<AppLabelKey, string>;

export const DEFAULT_TAB_ICON_URLS: TabIconUrls = {
  home: '',
  inbox: '',
  calendar: '',
  tarot: '',
  letters: '',
  heart: '',
  list: '',
  fitness: '',
  diary: '',
  settings: '',
};

export const DEFAULT_APP_LABELS: AppLabels = {
  home: 'Home',
  inbox: 'Inbox',
  calendar: 'Calendar',
  settings: '設定',
  tarot: '塔羅',
  letters: '情書',
  heart: '心牆',
  chat: '對話',
  list: '清單',
  fitness: '健身',
  diary: '日記',
};

export type AppSettings = {
  themeMonthColor: string;
  globalTextColor: string;
  calendarColorMode: CalendarColorMode;
  lockedBubbleColor: string;
  chatBubbleStyle: ChatBubbleStyle;
  chatUserBubbleColor: string;
  chatUserBubbleBorderColor: string;
  chatUserBubbleTextColor: string;
  chatAiBubbleColor: string;
  chatAiBubbleBorderColor: string;
  chatAiBubbleTextColor: string;
  chatBubbleRadius: number;
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
  appLabels: AppLabels;
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
  diaryCoverImageUrl: string;
  diaryFontUrl: string;
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
  globalTextColor: '#1f2937',
  calendarColorMode: 'month',
  lockedBubbleColor: '#d2f0ff',
  chatBubbleStyle: 'jelly',
  chatUserBubbleColor: '#BAEF61',
  chatUserBubbleBorderColor: '#8CBE3C',
  chatUserBubbleTextColor: '#000000',
  chatAiBubbleColor: '#D2F0FF',
  chatAiBubbleBorderColor: '#A8C0CC',
  chatAiBubbleTextColor: '#000000',
  chatBubbleRadius: 24,
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
  appLabels: DEFAULT_APP_LABELS,
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
  diaryCoverImageUrl: '',
  diaryFontUrl: '',
};
