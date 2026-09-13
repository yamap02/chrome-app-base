import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  getSettingsStatus,
  normalizeSettings,
  toggleSettingsEnabled,
} from "./settings";

describe("normalizeSettings", () => {
  it("未定義入力時 デフォルト値返却", () => {
    expect(normalizeSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("部分入力から不足値補完", () => {
    expect(normalizeSettings({ enabled: false })).toEqual({ schemaVersion: 1, enabled: false });
  });

  it("壊れた入力を安全にデフォルトへ復旧", () => {
    expect(normalizeSettings({ enabled: "yes" })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("toggleSettingsEnabled", () => {
  it("enabled 反転", () => {
    expect(toggleSettingsEnabled({ schemaVersion: 1, enabled: true })).toEqual({
      schemaVersion: 1,
      enabled: false,
    });
    expect(toggleSettingsEnabled({ schemaVersion: 1, enabled: false })).toEqual({
      schemaVersion: 1,
      enabled: true,
    });
  });
});

describe("getSettingsStatus", () => {
  it("有効時表示文言返却", () => {
    expect(getSettingsStatus(true)).toEqual({
      actionLabel: "ON",
      description: "コンテンツスクリプト有効",
      title: "有効",
    });
  });

  it("無効時表示文言返却", () => {
    expect(getSettingsStatus(false)).toEqual({
      actionLabel: "OFF",
      description: "コンテンツスクリプト無効",
      title: "無効",
    });
  });
});
