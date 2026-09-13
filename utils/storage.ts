import { storage } from "wxt/utils/storage";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  normalizeSettings,
  type Settings,
} from "@/utils/settings";

export const settingsStorage = storage.defineItem<Settings>(SETTINGS_STORAGE_KEY, {
  fallback: DEFAULT_SETTINGS,
  version: 1,
  migrations: {
    1: (oldValue: unknown) => normalizeSettings(oldValue),
  },
});

export async function getSettings(): Promise<Settings> {
  return normalizeSettings(await settingsStorage.getValue());
}

export async function setSettings(value: unknown): Promise<void> {
  await settingsStorage.setValue(normalizeSettings(value));
}
