import { storage } from 'wxt/utils/storage';

export interface Settings {
  enabled: boolean;
  // 追加の設定項目をここに定義する
}

export const settingsStorage = storage.defineItem<Settings>('local:settings', {
  defaultValue: {
    enabled: true,
  },
});
