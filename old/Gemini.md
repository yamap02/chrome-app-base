# Gemini.md

## 0. 前提（言語）

- 回答・作業記述は **日本語** で行うこと

---

## 1. プロジェクト概要

このプロジェクトは、WXT + React + TypeScript を使った **Chrome 拡張機能開発の汎用ベーステンプレート**です。
様々な Chrome 拡張機能を開発するための土台として使用します。

### 1.1 ポート・環境

- WXT 開発サーバー: デフォルト設定を使用。
- 外部 API サーバーは不要（拡張機能単体で動作）。
- **ログイン状態の維持**: `npm run dev` 実行時、`.wxt/user-data` にブラウザプロファイルが保存されます。

### 1.2 技術スタック

- **Framework**: [WXT](https://wxt.dev/)
- **Frontend**: React 19 + TypeScript
- **Testing**: Vitest (Unit), Playwright (E2E)
- **Storage**: WXT の `storage` モジュール

---

## 2. コンテキスト制御（AIルール）

### 2.1 `.geminiignore` の遵守

- `node_modules/`, `.wxt/`, `dist/` 等の自動生成物は AI コンテキストから除外します。
- 原則として除外対象は **list / read / search / attach** しないでください。

---

## 3. 開発・Git運用規約

### 3.1 ブランチ運用（必須）

- **mainブランチでの直接作業は禁止** です。
- 新機能や修正の際は必ず専用ブランチ (`feat-xxx`, `fix-xxx`) を作成してください。

### 3.2 終了時の手順

1. `git add -A`
2. コミット（変更内容のサマリを本文に記載）

### 3.3 コミットメッセージ

- 1行目に簡潔な要約。
- 本文に変更内容のサマリを箇条書きで記載する。

---

## 4. Chrome拡張機能開発のベストプラクティス

- **Content Scripts**: ターゲットサイトの DOM 干渉を最小限に抑える。
- **Permissions**: `manifest` (in `wxt.config.ts`) には最小限の権限のみを定義する。
- **Security**: `eval()` の使用禁止、信頼できないソースからのスクリプト読み込み禁止。
- **Performance**: 重い処理は Background (Service Worker) で行い、Content Script のイベントリスナーは効率的に実装する。

---

## 5. 検証・テスト手順

### 5.1 ユニットテスト

- 実行: `npm test`
- 監視モード: `npm run test:watch`
- `utils/*.test.ts` にロジックのテストを記述してください。

### 5.2 E2Eテスト

- 実行: `npm run test:e2e`
- Playwright を使用してブラウザ上での動作を検証します。
- テストファイルは `tests/e2e/` に配置してください。

### 5.3 動作確認

- `npm run dev` で拡張機能を起動し、対象サイトで動作を確認してください。

---

## TODO（作業時のチェックリスト）

- [ ] ブランチ作成 (`feat-` / `fix-`)
- [ ] 実装
- [ ] 実装内容のテスト / 動作確認
- [ ] `git add -A`
- [ ] コミット（本文に変更サマリを記載）
