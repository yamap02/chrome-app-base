import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    // 拡張機能の名前を変更する
    name: "My Chrome Extension",
    permissions: ["storage"],
    // 必要に応じてホスト権限を追加する
    // host_permissions: ["https://example.com/*"],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  },
  webExt: {
    // 自動操作によるログインブロックを回避するためのフラグ
    chromiumArgs: ["--disable-blink-features=AutomationControlled"],
    // 起動時に自動で開くページ（開発対象サイトに変更する）
    startUrls: ["https://www.google.com"],
  },
});
