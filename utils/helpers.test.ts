import { describe, it, expect } from "vitest";
import { matchesPattern } from "./helpers";

describe("matchesPattern", () => {
  it("完全一致するURLにマッチする", () => {
    expect(matchesPattern("https://example.com/", "https://example.com/")).toBe(true);
  });

  it("ワイルドカードでパスにマッチする", () => {
    expect(matchesPattern("https://example.com/foo", "https://example.com/*")).toBe(true);
    expect(matchesPattern("https://example.com/foo/bar", "https://example.com/*")).toBe(true);
  });

  it("サブドメインのワイルドカードにマッチする", () => {
    expect(matchesPattern("https://sub.example.com/", "https://*.example.com/")).toBe(true);
    expect(matchesPattern("https://other.example.com/page", "https://*.example.com/*")).toBe(true);
  });

  it("異なるドメインにはマッチしない", () => {
    expect(matchesPattern("https://other.com/", "https://example.com/*")).toBe(false);
  });

  it("異なるスキームにはマッチしない", () => {
    expect(matchesPattern("http://example.com/", "https://example.com/*")).toBe(false);
  });

  it("正規表現の特殊文字をエスケープする", () => {
    expect(matchesPattern("https://example.com/path", "https://example.com/path")).toBe(true);
    // ドットがリテラルとして扱われる（任意文字にならない）
    expect(matchesPattern("https://exampleXcom/", "https://example.com/")).toBe(false);
  });
});
