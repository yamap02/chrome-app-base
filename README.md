# Chrome Extension Base

WXT + React + TypeScript ベースの Chrome 拡張機能テンプレート。

Chrome 拡張で頻出する最低限の土台を同梱済み。

- Manifest v3 ベース設定
- React 製 popup UI
- background / content script エントリーポイント
- `storage` 権限を使う設定永続化
- Vitest によるユニットテスト
- Playwright による E2E テスト
- Oxlint / Oxfmt / Knip による保守支援

## 前提環境

- Node.js
- npm
- Google Chrome

## セットアップ

```bash
npm install
```

## 開発コマンド

```bash
npm run dev           # Chrome 向け開発サーバー起動
npm run dev:firefox   # Firefox 向け開発サーバー起動
npm run build         # Chrome 向け本番ビルド
npm run build:firefox # Firefox 向け本番ビルド
npm run zip           # Chrome 向け配布 ZIP 生成
npm run zip:firefox   # Firefox 向け配布 ZIP 生成
npm run compile       # TypeScript 型検査
npm test              # Vitest ユニットテスト
npm run test:watch    # ユニットテスト watch
npm run test:e2e      # Playwright E2E テスト
npm run lint          # Oxlint
npm run lint:fix      # Oxlint 自動修正
npm run format        # Oxfmt 整形
npm run format:check  # Oxfmt 整形チェック
npm run knip          # 未使用コード検出
```

`npm run dev` 実行時、WXT が開発用ブラウザを起動。`wxt.config.ts` では `.wxt/user-data` にログイン状態を保持しつつ、`https://www.google.com` を初期表示対象に設定済み。

## 現在の実装内容

### `wxt.config.ts`

- 拡張名 `My Chrome Extension`
- `storage` 権限のみ付与
- extension pages 用 CSP 設定
- React module 有効化
- Chrome 起動時 `--disable-blink-features=AutomationControlled` 付与
- `startUrls` に `https://www.google.com` 設定

### `entrypoints/background.ts`

- インストール時フックのテンプレート実装
- 開発時のみ install ログ出力

### `entrypoints/content.ts`

- `https://*.example.com/*` 向け content script テンプレート
- `main()` と cleanup 関数の雛形実装
- 開発時のみ実行 URL ログ出力

### `entrypoints/popup/`

- React popup UI
- `ErrorBoundary` で popup 内例外を捕捉
- `App.tsx` で拡張機能 ON/OFF トグル実装
- `settingsStorage` と連携して状態永続化

### `utils/storage.ts`

- `Settings` 型定義
- `local:settings` へ `{ enabled: true }` をデフォルト保存

### `utils/helpers.ts`

- URL パターン比較用 `matchesPattern()` 実装
- ワイルドカード `*` 対応

## ディレクトリ構成

```text
.
|-- entrypoints/
|   |-- background.ts
|   |-- content.ts
|   `-- popup/
|       |-- App.tsx
|       |-- ErrorBoundary.tsx
|       |-- App.css
|       |-- style.css
|       `-- main.tsx
|-- tests/e2e/
|   `-- basic.spec.ts
|-- utils/
|   |-- helpers.ts
|   |-- helpers.test.ts
|   `-- storage.ts
|-- public/icon/
|-- wxt.config.ts
|-- vitest.config.ts
|-- playwright.config.ts
`-- tsconfig.json
```

## 新しい拡張機能へ流用する手順

### 1. 拡張メタ情報変更

`wxt.config.ts` を変更。

- `manifest.name`
- 必要な `permissions`
- `host_permissions`
- `webExt.startUrls`

### 2. content script 実装

`entrypoints/content.ts` を変更。

- `matches`
- 対象サイト固有ロジック
- cleanup 処理

### 3. popup UI 実装

`entrypoints/popup/App.tsx` を変更。

- 表示テキスト
- 設定 UI
- 保存対象の状態

必要に応じて `App.css` / `style.css` も変更。

### 4. 設定スキーマ拡張

`utils/storage.ts` を変更。

- `Settings` 型へ項目追加
- `defaultValue` 更新

### 5. background 処理追加

常駐処理やイベント処理が必要なら `entrypoints/background.ts` を変更。

## テスト

### ユニットテスト

`utils/helpers.test.ts` で `matchesPattern()` を検証。

- 完全一致
- パス向けワイルドカード
- サブドメイン向けワイルドカード
- ドメイン不一致
- スキーム不一致
- 正規表現特殊文字のエスケープ

### E2E テスト

`tests/e2e/basic.spec.ts` で Chromium 起動と URL 遷移を検証。現状は Google への遷移確認のみ。

## 補足

- `tsconfig.json` は `.wxt/tsconfig.json` 継承
- `@/` エイリアスでルート参照可能
- `playwright-report/` は Playwright HTML レポート出力先
- `assets/package-lock.json` が別配置で存在

## このテンプレート使用開始時の最低変更点

- `wxt.config.ts` の拡張名と対象 URL
- `entrypoints/content.ts` の `matches` と本体処理
- `entrypoints/popup/App.tsx` の表示文言
- `utils/storage.ts` の設定項目
- `tests/e2e/basic.spec.ts` の遷移先
