# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

WXT + React + TypeScript を使った **Chrome 拡張機能開発の汎用ベーステンプレート**。様々な Chrome 拡張機能を素早く開発するための土台として使用する。

## コマンド

```bash
npm run dev          # 開発サーバー起動（.wxt/user-dataにログイン情報保持）
npm run build        # プロダクションビルド → .output/chrome-mv3/
npm test             # Vitestユニットテスト
npm run test:watch   # テストをウォッチモードで実行
npm run test:e2e     # PlaywrightでE2Eテスト
npm run compile      # TypeScript型チェック（emit不要）
npm run zip          # 配布用ZIPを生成
```

## アーキテクチャ

### エントリーポイント (`entrypoints/`)

- **`content.ts`** — コンテントスクリプトのテンプレート。`matches` を対象サイトに変更して使う。
- **`background.ts`** — Service Worker。インストール時ハンドラのテンプレート。
- **`popup/`** — ReactポップアップUI。`App.tsx` でON/OFFトグルの基本UIを実装済み。

### ユーティリティ (`utils/`)

- **`storage.ts`** — 設定の型定義 (`Settings`) とWXT storage APIラッパー。`settingsStorage` で `local:settings` に永続化。デフォルト: `{ enabled: true }`。

### 新しい拡張機能への応用手順

1. `wxt.config.ts` — `manifest.name`、`host_permissions`、`startUrls` を変更
2. `entrypoints/content.ts` — `matches` と `main()` を実装
3. `utils/storage.ts` — `Settings` インターフェースに必要な設定項目を追加
4. `entrypoints/popup/App.tsx` — 設定UIを実装

## テスト

- **ユニットテスト**: `utils/*.test.ts`（Vitest、nodeenv）
- **E2Eテスト**: `tests/e2e/`（Playwright、Chromiumのみ、1280x720）

## 作業フロー

変更作業を行う際は、必ず以下の手順に従うこと：

1. **ブランチを新規作成**してから作業を開始する（例: `git checkout -b feature/xxx`）
2. 変更・実装を行う
3. 作業完了後、**変更をコミット**する

## ビルド設定

- **`wxt.config.ts`** — マニフェスト定義、ホスト権限、開発時の起動URLを一元管理
- **`tsconfig.json`** — `.wxt/tsconfig.json`を継承。`@/`パスエイリアスでルートを参照可能
- Manifest v3、permissions: `storage`のみ（デフォルト）
- 開発プロファイルは `.wxt/user-data` に保存（ログイン状態維持）
