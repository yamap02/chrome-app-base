---
name: wxt-chrome-extension
description: WXT フレームワークを使ったChrome拡張機能（およびクロスブラウザ拡張機能）の開発ベストプラクティス。プロジェクト作成・設定・エントリーポイント設計・メッセージング・ストレージ・コンテントスクリプト・ビルド・公開まで一貫してサポートする。「WXTで拡張機能を作りたい」「Chrome拡張のベストプラクティスを教えて」「content scriptを実装したい」「background service workerの書き方は？」「拡張機能のストレージを使いたい」「Manifest V3対応の拡張機能を作りたい」「WXTのpopupやoptions pageを作りたい」「拡張機能のメッセージングを型安全にしたい」などのケースで必ずこのスキルを参照すること。React / Vue / Svelte / バニラTSいずれにも対応。
---

# WXT Chrome Extension 開発ベストプラクティス

WXT（Web Extension Toolkit）はViteベースのChrome/クロスブラウザ拡張機能フレームワーク。  
Nuxt的なファイルベース規約・自動インポート・HMR・MV3対応・TypeScriptファーストが特徴。

---

## 1. プロジェクト初期化

```bash
# インタラクティブCLI（推奨）
npm create wxt@latest

# テンプレート直指定
npm create wxt@latest -- --template react-ts
npm create wxt@latest -- --template vue-ts
npm create wxt@latest -- --template svelte-ts
npm create wxt@latest -- --template vanilla-ts
```

### 推奨スタック（2025年）
- **React + Tailwind + shadcn/ui** — UIが複雑な拡張機能
- **Vue 3** — 軽量でリアクティブなUI
- **Svelte** — バンドルサイズを最小化したい場合
- **バニラTS** — シンプルな機能拡張

---

## 2. プロジェクト構造

```
my-extension/
├── entrypoints/          # WXTが自動検出するエントリーポイント
│   ├── background.ts     # Service Worker（MV3）
│   ├── content.ts        # コンテントスクリプト
│   ├── popup/            # ポップアップUI
│   │   ├── index.html
│   │   └── main.tsx
│   └── options/          # オプションページ（任意）
│       ├── index.html
│       └── main.tsx
├── components/           # 自動インポートされるUIコンポーネント
├── utils/                # 自動インポートされるユーティリティ
│   ├── storage.ts        # ストレージヘルパー
│   └── messaging.ts      # メッセージング型定義
├── public/               # そのままコピーされる静的ファイル
│   └── icon/
├── assets/               # Viteで処理される静的ファイル
└── wxt.config.ts         # WXT設定ファイル
```

**重要原則：** `entrypoints/` 内のファイル名がそのままエントリーポイントになる。`manifest.json` は手書きしない。

---

## 3. wxt.config.ts の設定

```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  // UIフレームワークモジュール
  modules: ['@wxt-dev/module-react'],  // or vue / svelte

  manifest: {
    name: 'My Extension',
    description: '説明文',
    version: '1.0.0',
    // 必要最小限のパーミッションだけ宣言する（審査・セキュリティ上重要）
    permissions: ['activeTab', 'storage'],
    host_permissions: ['https://example.com/*'],
  },

  // 開発時の設定
  dev: {
    server: {
      port: 3000,
    },
  },
});
```

### パーミッション最小化の原則
- `<all_urls>` や `*://*/*` は避け、必要なドメインのみ指定
- `tabs` パーミッションは `activeTab` で代替できることが多い
- `scripting` は `executeScript` を使う場合のみ

---

## 4. エントリーポイント別の実装パターン

### 4-1. Background Service Worker

```typescript
// entrypoints/background.ts
export default defineBackground({
  type: 'module',
  persistent: false, // MV3ではfalseが基本
  main() {
    // ✅ リスナーはトップレベルで同期的に登録（非同期にしない）
    browser.runtime.onInstalled.addListener(({ reason }) => {
      if (reason === 'install') {
        console.log('拡張機能がインストールされました');
      }
    });

    // メッセージハンドラ
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'FETCH_DATA') {
        // 非同期処理する場合は必ず true を返す
        handleFetchData(message.payload).then(sendResponse);
        return true;
      }
    });
  },
});

async function handleFetchData(payload: unknown) {
  // APIコールなど重い処理はここで
  return { result: 'ok' };
}
```

**⚠️ Service Worker の注意点（MV3）：**
- Service Workerは非アクティブ時に終了する（persistent backgroundページは使えない）
- `chrome.alarms` API でキープアライブを実装する場合は `alarms` パーミッションが必要
- 長時間処理が必要な場合は Offscreen Document を検討

### 4-2. Content Script

```typescript
// entrypoints/content.ts
export default defineContentScript({
  matches: ['https://example.com/*'],
  // CSSをShadow DOMで分離する場合
  cssInjectionMode: 'ui',

  async main(ctx) {
    // ctx はコンテキスト無効化を検知するオブジェクト
    // 拡張機能がアップデート/無効化された際にリスナーを自動停止できる

    // UIをShadow DOMで作成（ページのCSSと干渉しない）
    const ui = await createShadowRootUi(ctx, {
      name: 'my-extension-ui',
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        const root = document.createElement('div');
        container.append(root);
        // ReactなどでマウントするならここでcreateRoot(root).render(...)
      },
    });

    ui.mount();

    // タイマーや非同期処理は ctx のラッパーを使う（コンテキスト無効化対応）
    ctx.setInterval(() => {
      // 定期処理
    }, 5000);
  },
});
```

**ShadowRoot UIを使う理由：**
- コンテントスクリプトのCSSがページに漏れない
- ページのCSSがUI側に影響しない
- `isolateEvents` オプションでイベント伝播も制御可能

### 4-3. Popup

```tsx
// entrypoints/popup/App.tsx (React例)
import { useState, useEffect } from 'react';
import { storage } from 'wxt/storage';

export default function App() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    storage.getItem<boolean>('local:enabled', { fallback: false })
      .then(setEnabled);
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    await storage.setItem('local:enabled', next);
  };

  return (
    <div className="p-4 w-64">
      <button onClick={toggle}>
        {enabled ? '無効にする' : '有効にする'}
      </button>
    </div>
  );
}
```

---

## 5. ストレージ

WXTのストレージAPIは `wxt/storage` からインポートする（`chrome.storage` を直接使わない）。

### 基本パターン

```typescript
import { storage } from 'wxt/storage';

// ストレージエリアをキーのプレフィックスで指定（必須）
// local: / session: / sync: / managed:
await storage.getItem<boolean>('local:enabled', { fallback: false });
await storage.setItem('local:enabled', true);
await storage.removeItem('local:enabled');

// 変更を監視
const unwatch = storage.watch<boolean>('local:enabled', (newVal, oldVal) => {
  console.log('変更:', newVal);
});
// クリーンアップ時に呼ぶ
unwatch();
```

### 推奨パターン：`defineItem` で型と初期値を一元管理

```typescript
// utils/storage.ts
import { storage } from 'wxt/storage';

// 型・デフォルト値・バージョンをまとめて定義
export const enabledItem = storage.defineItem<boolean>('local:enabled', {
  fallback: false,
});

export const settingsItem = storage.defineItem<{ theme: string; lang: string }>(
  'sync:settings',
  {
    fallback: { theme: 'light', lang: 'ja' },
    version: 1,
    // バージョンアップ時のマイグレーション
    migrations: {
      2: (old) => ({ ...old, lang: old.lang ?? 'ja' }),
    },
  }
);
```

```typescript
// 利用側
import { enabledItem, settingsItem } from '@/utils/storage';

const enabled = await enabledItem.getValue();
await enabledItem.setValue(true);
const unwatch = enabledItem.watch((val) => console.log(val));
```

---

## 6. メッセージング（型安全）

コンテキスト間通信（Popup ↔ Background ↔ Content Script）は型安全に実装する。

```typescript
// utils/messaging.ts

// メッセージの型定義を一元管理
export type ExtensionMessage =
  | { type: 'GET_TAB_INFO'; payload: { tabId: number } }
  | { type: 'SCRAPE_PAGE' }
  | { type: 'UPDATE_BADGE'; payload: { count: number } };

export type ExtensionResponse =
  | { type: 'GET_TAB_INFO'; data: { url: string; title: string } }
  | { type: 'SCRAPE_PAGE'; data: string[] }
  | { type: 'UPDATE_BADGE'; success: boolean };

// 型付き送信ヘルパー
export async function sendToBackground<T extends ExtensionMessage>(
  message: T
): Promise<Extract<ExtensionResponse, { type: T['type'] }>> {
  return browser.runtime.sendMessage(message);
}

// コンテントスクリプトへ送信
export async function sendToTab<T extends ExtensionMessage>(
  tabId: number,
  message: T
): Promise<Extract<ExtensionResponse, { type: T['type'] }>> {
  return browser.tabs.sendMessage(tabId, message);
}
```

```typescript
// entrypoints/background.ts 内のハンドラ
browser.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_TAB_INFO':
      getTabInfo(message.payload.tabId).then(sendResponse);
      return true; // 非同期応答のためtrueを返す

    case 'UPDATE_BADGE':
      browser.action.setBadgeText({ text: String(message.payload.count) });
      sendResponse({ type: 'UPDATE_BADGE', success: true });
      break;
  }
});
```

---

## 7. Main World へのスクリプト注入

ページのJSコンテキスト（window, document変数など）にアクセスしたい場合：

```typescript
// entrypoints/injected-script.ts（アンリストエントリーポイント）
export default defineUnlistedScript(() => {
  // ページのwindowにアクセス可能
  console.log(window.__SOME_GLOBAL__);

  // Content Scriptへの返信はCustomEventで
  document.currentScript?.dispatchEvent(
    new CustomEvent('injected-response', { detail: { data: 'ok' } })
  );
});
```

```typescript
// entrypoints/content.ts 内
const { script } = await injectScript('/injected-script.js', {
  keepInDom: true,
  modifyScript(el) {
    el.addEventListener('injected-response', (e) => {
      if (e instanceof CustomEvent) console.log(e.detail);
    });
  },
});

// wxt.config.ts で web_accessible_resources に追加が必要
```

---

## 8. 開発・ビルド・公開

```bash
# 開発（Chrome、HMRあり）
npm run dev

# Firefox向け開発
npm run dev:firefox

# 本番ビルド
npm run build

# ビルド + ZIP（ストア提出用）
npm run zip

# Firefox向けZIP
npm run zip:firefox
```

### バンドルサイズの最適化
- `wxt analyze` でバンドル内容を可視化
- コンテントスクリプトは軽量に保つ（重い処理はBackground Workerへ委譲）
- 動的インポート `import()` でコード分割を活用
- 画像は `public/` に置いてBase64埋め込みを避ける

### Chrome Web Store 提出チェックリスト
- [ ] `wxt.config.ts` の `manifest.version` を更新
- [ ] パーミッションが最小化されている
- [ ] `npm run zip` でZIPを生成
- [ ] アイコン：16×16、48×48、128×128px（PNG）
- [ ] スクリーンショット：1280×800 または 640×400px

---

## 9. よくある落とし穴とTIPS

| 問題 | 解決策 |
|------|--------|
| Service Workerが突然終了する | `alarms` APIでキープアライブ、または処理をイベント駆動に設計し直す |
| Content ScriptのCSSがページに干渉 | `createShadowRootUi` を使ってShadow DOMで分離 |
| `Extension context invalidated` エラー | `ctx.setTimeout` / `ctx.setInterval` を使い、コンテキスト無効化を検知 |
| `storage.getItem` でキーが見つからない | キーには必ず `local:` などのプレフィックスをつける |
| 非同期メッセージへの返信が届かない | リスナーで `return true` を返す（チャネルを開いたままにする） |
| popup閉じるとstateが消える | 永続データはStorage、セッションデータはBackground Worker経由で管理 |
| Docker内でdevサーバーが即終了 | `wxt.config.ts` に `dev: { server: { open: false } }` を設定 |

---

## 10. アーキテクチャ早見図

```
┌────────────┐  runtime.sendMessage  ┌──────────────────┐
│   Popup    │ ───────────────────►  │   Background     │
│ (React UI) │ ◄───────────────────  │ (Service Worker) │
└────────────┘       response        │  - ストレージ管理  │
                                     │  - API通信        │
┌──────────────────┐  tabs.send      │  - 認証トークン   │
│ Content Script   │ ◄────────────── └──────────────────┘
│ (ページ内UI/DOM) │ ──────────────►
└──────────────────┘  runtime.send
      ↑
  injectScript
      ↓
┌──────────────────┐
│ Injected Script  │  (Main World: windowアクセス可)
└──────────────────┘
```
