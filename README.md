# Chrome Extension Base

WXT + React + TypeScript を使った Chrome 拡張機能開発のベーステンプレートです。

## 技術スタック

- **Framework**: [WXT](https://wxt.dev/) (Web Extension Toolbox)
- **Frontend**: React 19 + TypeScript
- **Lint**: Oxlint
- **Format**: Oxfmt
- **Testing**: Vitest (Unit) + Playwright (E2E)
- **Storage**: WXT `storage` API

## セットアップ

```bash
npm install
npm run dev
```

`npm run dev` を実行すると、`.wxt/user-data` に保存された開発用プロファイルでブラウザが起動します。初回ログイン後はログイン状態が維持されます。

## 新しい拡張機能の作り方

### 1. 拡張機能名を変更する

`wxt.config.ts` の `manifest.name` を変更します。

### 2. 対象サイトを設定する

`wxt.config.ts` の `host_permissions` と `webExt.startUrls` に対象サイトを追加します。

`entrypoints/content.ts` の `matches` も同様に変更します。

### 3. ロジックを実装する

| ファイル                    | 役割                                   |
| --------------------------- | -------------------------------------- |
| `entrypoints/content.ts`    | 対象サイトに注入するスクリプト         |
| `entrypoints/background.ts` | Service Worker（バックグラウンド処理） |
| `entrypoints/popup/App.tsx` | ポップアップUI（React）                |
| `utils/storage.ts`          | 設定の型定義と永続化                   |

### 4. 設定項目を追加する

`utils/storage.ts` の `Settings` インターフェースに項目を追加し、`entrypoints/popup/App.tsx` にUIを追加します。

## コマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド → .output/chrome-mv3/
npm run lint         # Oxlint でLint
npm run lint:fix     # Oxlint で自動修正
npm run format       # Oxfmt で整形
npm run format:check # Oxfmt の整形チェック
npm test             # ユニットテスト
npm run test:watch   # テストをウォッチモードで実行
npm run test:e2e     # E2Eテスト（Playwright）
npm run compile      # TypeScript型チェック
npm run zip          # 配布用ZIPを生成
```

## ライセンス

MIT License
