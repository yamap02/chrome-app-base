export interface Settings {
  enabled: boolean;
}

export const SETTINGS_STORAGE_KEY = "local:settings";

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
};

export function normalizeSettings(value?: Partial<Settings> | null): Settings {
  return {
    enabled: value?.enabled ?? DEFAULT_SETTINGS.enabled,
  };
}

export function toggleSettingsEnabled(settings: Settings): Settings {
  return {
    ...settings,
    enabled: !settings.enabled,
  };
}

export function getSettingsStatus(enabled: boolean): {
  actionLabel: "ON" | "OFF";
  description: string;
  title: string;
} {
  if (enabled) {
    return {
      actionLabel: "ON",
      description: "コンテンツスクリプト有効",
      title: "有効",
    };
  }

  return {
    actionLabel: "OFF",
    description: "コンテンツスクリプト無効",
    title: "無効",
  };
}
