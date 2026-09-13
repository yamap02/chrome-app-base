export interface Settings {
  schemaVersion: 1;
  enabled: boolean;
}

const CURRENT_SETTINGS_SCHEMA_VERSION = 1 as const;

export const SETTINGS_STORAGE_KEY = "local:settings";

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
  enabled: true,
};

export function normalizeSettings(value?: unknown): Settings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const candidate = value as Partial<Settings>;
  return {
    schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : DEFAULT_SETTINGS.enabled,
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
