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
export type DiaryCoverFitMode = 'cover' | 'contain';
export type TabIconDisplayMode = 'framed' | 'full';
export type LetterUiMode = 'classic' | 'preview';
export type ChibiPoolMode = 'i' | 'ii' | 'all';
export type TabIconKey =
  | 'home'
  | 'inbox'
  | 'calendar'
  | 'tarot'
  | 'letters'
  | 'heart'
  | 'list'
  | 'fitness'
  | 'pomodoro'
  | 'period'
  | 'diary'
  | 'album'
  | 'notes'
  | 'settings';
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
  | 'pomodoro'
  | 'period'
  | 'diary'
  | 'album'
  | 'notes';
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
  pomodoro: '',
  period: '',
  diary: '',
  album: '',
  notes: '',
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
  pomodoro: '番茄鐘',
  period: '經期日記',
  diary: '日記',
  album: '相冊',
  notes: '便利貼',
};

export type AppSettings = {
  themeMonthColor: string;
  globalTextColor: string;
  calendarColorMode: CalendarColorMode;
  lockedBubbleColor: string;
  calendarHoverBubbleTextColor: string;
  chatBubbleStyle: ChatBubbleStyle;
  chatUserBubbleColor: string;
  chatUserBubbleBorderColor: string;
  chatUserBubbleTextColor: string;
  chatAiBubbleColor: string;
  chatAiBubbleBorderColor: string;
  chatAiBubbleTextColor: string;
  chatBubbleRadius: number;
  chatBackgroundColor: string;
  chatBackgroundImageUrl: string;
  chatBackgroundOverlay: number;
  chatAppMessagesIcon: string;
  chatAppDiscoverIcon: string;
  chatAppMeIcon: string;
  chatAppShowLabels: boolean;
  chatAppDefaultProfileId: string;
  customFontCssUrl: string;
  customFontFileUrl: string;
  customFontFamily: string;
  customFontUrlSlots: string[];
  customFontUrlSlotNames: string[];
  homeWidgetTitle: string;
  homeWidgetSubtitle: string;
  homeWidgetBadgeText: string;
  homeWidgetIconDataUrl: string;
  inboxTitle: string;
  memorialStartDate: string;
  backgroundMode: BackgroundMode;
  backgroundGradientStart: string;
  backgroundGradientEnd: string;
  backgroundImageUrl: string;
  backgroundImageOverlay: number;
  tabIconDisplayMode: TabIconDisplayMode;
  tabIconUrls: TabIconUrls;
  appLabels: AppLabels;
  fontScale: number;
  uiHeaderTitleSize: number;
  uiTabLabelSize: number;
  uiFilterPillSize: number;
  uiHintTextSize: number;
  chatContactNameSize: number;
  chatContactSubtitleSize: number;
  swipeEnabled: boolean;
  localNotificationsEnabled: boolean;
  lastSyncAt: string | null;
  installHintDismissed: boolean;
  hoverToneWeights: HoverToneWeights;
  calendarCellRadius: number;
  calendarCellShadow: number;
  calendarCellDepth: number;
  tarotGalleryImageUrl: string;
  tarotNameColor: string;
  tarotNameScale: number;
  letterFontUrl: string;
  letterFontUrlSlots: string[];
  letterFontUrlSlotNames: string[];
  letterUiMode: LetterUiMode;
  diaryCoverImageUrl: string;
  diaryFontUrl: string;
  diaryFontUrlSlots: string[];
  diaryFontUrlSlotNames: string[];
  soulmateFontUrl: string;
  soulmateFontUrlSlots: string[];
  soulmateFontUrlSlotNames: string[];
  diaryCoverFitMode: DiaryCoverFitMode;
  mDiaryLineHeight: number;
  mDiaryContentFontSize: number;
  mDiaryShowCount: boolean;
  mDiaryRandomChibiWidth: number;
  mDiaryReadingChibiWidth: number;
  mDiaryShowReadingChibi: boolean;
  notesFontSize: number;
  notesTextColor: string;
  chibiPoolSize: number;
  chibiPoolMode: ChibiPoolMode;
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
  calendarHoverBubbleTextColor: '#1f2937',
  chatBubbleStyle: 'jelly',
  chatUserBubbleColor: '#BAEF61',
  chatUserBubbleBorderColor: '#8CBE3C',
  chatUserBubbleTextColor: '#000000',
  chatAiBubbleColor: '#D2F0FF',
  chatAiBubbleBorderColor: '#A8C0CC',
  chatAiBubbleTextColor: '#000000',
  chatBubbleRadius: 24,
  chatBackgroundColor: '#efeff4',
  chatBackgroundImageUrl: '',
  chatBackgroundOverlay: 0,
  chatAppMessagesIcon: '💬',
  chatAppDiscoverIcon: '✨',
  chatAppMeIcon: '👤',
  chatAppShowLabels: false,
  chatAppDefaultProfileId: '',
  customFontCssUrl: '',
  customFontFileUrl: '',
  customFontFamily: '',
  customFontUrlSlots: ['', '', '', '', '', '', '', '', '', ''],
  customFontUrlSlotNames: ['', '', '', '', '', '', '', '', '', ''],
  homeWidgetTitle: 'Memorial',
  homeWidgetSubtitle: '在這裡等妳，慢慢把日子收好。',
  homeWidgetBadgeText: 'ACTIVE',
  homeWidgetIconDataUrl: '',
  inboxTitle: 'Memorial Mailroom',
  memorialStartDate: '',
  backgroundMode: 'gradient',
  backgroundGradientStart: '#fde9d7',
  backgroundGradientEnd: '#ece4d5',
  backgroundImageUrl: '',
  backgroundImageOverlay: 36,
  tabIconDisplayMode: 'framed',
  tabIconUrls: DEFAULT_TAB_ICON_URLS,
  appLabels: DEFAULT_APP_LABELS,
  fontScale: 1,
  uiHeaderTitleSize: 17,
  uiTabLabelSize: 17,
  uiFilterPillSize: 10,
  uiHintTextSize: 9,
  chatContactNameSize: 30,
  chatContactSubtitleSize: 18,
  swipeEnabled: true,
  localNotificationsEnabled: true,
  lastSyncAt: null,
  installHintDismissed: false,
  hoverToneWeights: DEFAULT_HOVER_TONE_WEIGHTS,
  calendarCellRadius: 16,
  calendarCellShadow: 68,
  calendarCellDepth: 70,
  tarotGalleryImageUrl: '',
  tarotNameColor: '#374151',
  tarotNameScale: 1,
  letterFontUrl: '',
  letterFontUrlSlots: ['', '', '', '', '', '', '', '', '', ''],
  letterFontUrlSlotNames: ['', '', '', '', '', '', '', '', '', ''],
  letterUiMode: 'classic',
  diaryCoverImageUrl: '',
  diaryFontUrl: '',
  diaryFontUrlSlots: ['', '', '', '', '', '', '', '', '', ''],
  diaryFontUrlSlotNames: ['', '', '', '', '', '', '', '', '', ''],
  soulmateFontUrl: '',
  soulmateFontUrlSlots: ['', '', '', '', '', '', '', '', '', ''],
  soulmateFontUrlSlotNames: ['', '', '', '', '', '', '', '', '', ''],
  diaryCoverFitMode: 'cover',
  mDiaryLineHeight: 2.16,
  mDiaryContentFontSize: 14,
  mDiaryShowCount: true,
  mDiaryRandomChibiWidth: 144,
  mDiaryReadingChibiWidth: 144,
  mDiaryShowReadingChibi: true,
  notesFontSize: 13,
  notesTextColor: '#44403c',
  chibiPoolSize: 60,
  chibiPoolMode: 'i',
};
