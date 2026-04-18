import { storage } from "wxt/utils/storage";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, type Settings } from "@/utils/settings";

export const settingsStorage = storage.defineItem<Settings>(SETTINGS_STORAGE_KEY, {
  defaultValue: DEFAULT_SETTINGS,
});
