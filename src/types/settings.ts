export type AppSettings = {
  themeMonthColor: string;
  fontScale: number;
  swipeEnabled: boolean;
  localNotificationsEnabled: boolean;
  lastSyncAt: string | null;
  installHintDismissed: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  themeMonthColor: '#c25b3c',
  fontScale: 1,
  swipeEnabled: true,
  localNotificationsEnabled: true,
  lastSyncAt: null,
  installHintDismissed: false,
};
