---
name: WXT Chrome Extension Development
description: WXT (Web Extension Toolbox) を使用して、React + TypeScript で Chrome 拡張機能を開発するためのスキル。
---

# WXT Chrome Extension Development

このスキルは、モダンなフレームワーク [WXT](https://wxt.dev/) を使用して Chrome 拡張機能を開発するためのベストプラクティスと手順を提供します。

## 1. プロジェクトのセットアップ

### 新規プロジェクトの作成

WXT のスターターを使用してプロジェクトを開始します。

```bash
npx wxt@latest init .
```

※ テンプレートには React + TypeScript を推奨します。

### 依存関係のインストール

```bash
npm install
```

## 2. ディレクトリ構成

WXT はディレクトリベースのルーティング/エントリーポイント管理を採用しています。

- `entrypoints/`: 拡張機能の各エントリーポイント。
  - `background.ts`: Service Worker。
  - `content.ts`: Content Script。
  - `popup/`: ポップアップUI (HTML, TSX, CSS)。
- `assets/`: 画像や共通スタイル。
- `public/`: アイコンなどの静的ファイル。
- `utils/`: 共通ロジック、ストレージ定義。

## 3. 主要な機能の実装

### Content Script

特定のサイトに注入されるスクリプト。

```typescript
// entrypoints/content.ts
export default defineContentScript({
  matches: ['https://chat.google.com/*'],
  main() {
    // 実行されるロジック
  },
});
```

### Popup (React)

アイコンクリック時に表示されるUI。

```tsx
// entrypoints/popup/App.tsx
export default function App() {
  return <div className="p-4">Settings</div>;
}
```

## 4. 設定 (wxt.config.ts)

マニフェスト権限やホスト許可、ビルドオプションを設定します。

```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Extension Name',
    permissions: ['storage'],
    host_permissions: ['https://*.google.com/*'],
  },
});
```

## 5. ストレージ管理

WXT 独自の `storage` API を利用して、ブラウザのストレージ操作を型安全に行います。

```typescript
// utils/storage.ts
import { storage } from 'wxt/storage';

export const mySettings = storage.defineItem<string>('local:my-key', {
  defaultValue: 'default',
});
```

## 6. 開発とデバッグ

- **開発モード**: `npm run dev`
  - ブラウザが自動起動し、コード変更が即座に反映されます。
- **デバッグ**: `chrome://extensions` で「デベロッパーモード」を有効にし、エラーやコンソール（サービスワーカー等）を確認します。

## 7. 検証 (Testing)

- **Unit Test**: ロジックの分離と Vitest によるテスト。
- **E2E Test**: Playwright を使用したブラウザ横断テスト。

## 8. 配布用ビルド

```bash
npm run build
# または ZIP化
npm run zip
```

`.output/` ディレクトリに生成されたファイルを Chrome に読み込ませるか、ストアにアップロードします。
