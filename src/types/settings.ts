export type HoverToneWeights = {
  clingy: number;
  confession: number;
  calm: number;
  remorse: number;
  general: number;
};

export type AppSettings = {
  themeMonthColor: string;
  fontScale: number;
  swipeEnabled: boolean;
  localNotificationsEnabled: boolean;
  lastSyncAt: string | null;
  installHintDismissed: boolean;
  hoverToneWeights: HoverToneWeights;
  calendarCellRadius: number;
  calendarCellShadow: number;
  calendarCellDepth: number;
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
  fontScale: 1,
  swipeEnabled: true,
  localNotificationsEnabled: true,
  lastSyncAt: null,
  installHintDismissed: false,
  hoverToneWeights: DEFAULT_HOVER_TONE_WEIGHTS,
  calendarCellRadius: 16,
  calendarCellShadow: 68,
  calendarCellDepth: 70,
};
