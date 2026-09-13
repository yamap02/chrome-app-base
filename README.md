# Chrome Extension Base

WXT + React + TypeScript で Chrome 拡張機能を作り始めるためのベーステンプレートです。Manifest V3 を使い、popup、background、content script、設定永続化、品質検証の最小構成を含みます。

## 前提環境

- Node.js と npm
- Google Chrome（開発・E2E smoke test 用）

依存関係をインストールします。

```bash
npm install
```

## 開発とビルド

| コマンド                | 用途                                           |
| ----------------------- | ---------------------------------------------- |
| `npm run dev`           | Chrome 向け開発サーバーを起動                  |
| `npm run dev:firefox`   | Firefox 向け開発サーバーを起動                 |
| `npm run build`         | Chrome 向け本番ビルド（`.output/chrome-mv3/`） |
| `npm run build:firefox` | Firefox 向け本番ビルド                         |
| `npm run zip`           | Chrome 向け配布 ZIP を生成                     |
| `npm run zip:firefox`   | Firefox 向け配布 ZIP を生成                    |

`npm run dev` は WXT の開発用ブラウザを起動します。開発プロファイルは `.wxt/user-data` に保存されます。

## 実装されている機能

- Manifest V3、React module、extension pages 用 CSP
- `storage` 権限による `local:settings` の設定保存
- popup からの拡張機能 ON/OFF 切り替え
- 設定のデフォルト値・型の正規化・version 1 migration
- 設定変更を監視して content script の処理を開始・停止する仕組み
- install 時と content script attach/detach の開発用ログ
- popup の Error Boundary と保存失敗時の復旧表示
- Oxlint、Oxfmt、Knip、TypeScript、Vitest、Node test、Playwright による検証

### 設定の動作

`utils/settings.ts` が設定モデルの SSOT です。初期値は `{ schemaVersion: 1, enabled: true }` です。popup は `utils/storage.ts` を介して設定を読み書きし、content script は初期値を読み込んだ後 `settingsStorage.watch()` で変更を受け取ります。`enabled` が `true` のときだけ対象ページの処理を実行します。現在の対象 URL はテンプレート用の `https://*.example.com/*` です。

## ディレクトリ構成

```text
.
├── entrypoints/
│   ├── background.ts                 # Service Worker
│   ├── content.ts                    # Content script
│   └── popup/
│       ├── App.tsx                   # Popup の画面
│       ├── App.css / style.css       # Popup のスタイル
│       ├── ErrorBoundary.tsx         # Popup の例外境界
│       ├── components/SettingsToggle.tsx
│       ├── hooks/useSettings.ts
│       ├── index.html / main.tsx
├── utils/
│   ├── metadata.ts                   # メタ情報と対象 URL
│   ├── logger.ts                     # 開発時ログ
│   ├── settings.ts / settings.test.ts # 設定モデルとテスト
│   └── storage.ts                    # WXT storage ラッパー
├── tests/e2e/                        # Playwright smoke test
├── tests/scripts/                    # Manifest・ZIP・公開前契約テスト
├── public/icon/                      # 拡張機能アイコン
├── wxt.config.ts                     # WXT / manifest 設定
├── vitest.config.ts / tsconfig.json
├── knip.json                         # 未使用コード検出設定
└── Makefile                          # CI 相当の検証タスク
```

## テストと品質検証

```bash
npm test                  # Vitest ユニットテスト
npm run test:watch        # ユニットテストを watch
npm run compile           # TypeScript 型検査
npm run lint              # Oxlint
npm run lint:fix          # Oxlint 自動修正
npm run format            # Oxfmt 整形
npm run format:check      # Oxfmt 整形チェック
npm run knip              # 未使用コード検出
npm run release:preflight # 雛形名・example.com・version の公開前検査
```

ビルド後の manifest、配布 ZIP、E2E まで含めた一括検証は次で実行します。

```bash
make ci
```

`make ci` は format check、lint、型検査、ユニットテスト、manifest/ZIP 契約テスト、Knip、Playwright smoke test を実行します。E2E には実行可能な Chrome が必要です。場所を指定する場合は `CHROME_BIN=/path/to/chrome make test-e2e-headless` を使います。CI では `CI=1` で xvfb を利用します。

## 新しい拡張機能へ流用する手順

1. `utils/metadata.ts` の `name`、`shortName`、`description`、`popupTitle`、`contentMatches`、`startUrls` を変更する。
2. `wxt.config.ts` の `permissions` と必要な `host_permissions` を追加する。
3. `entrypoints/content.ts` の対象サイト固有ロジックと cleanup 処理を実装する。
4. `entrypoints/popup/App.tsx` と関連 CSS を製品向け UI に変更する。
5. `utils/settings.ts` の `Settings`、デフォルト値、正規化処理を拡張し、必要なら `utils/storage.ts` の version/migrations を更新する。
6. 常駐処理やイベント処理が必要なら `entrypoints/background.ts` に追加する。
7. `npm run compile`、`npm test`、`make ci` を実行する。

公開前には、`package.json` の version を `0.0.0` 以外にし、`utils/metadata.ts` に残る `Chrome Extension Base` と `example.com` の placeholder を製品固有の値へ置換してください。`npm run release:preflight` が置換漏れを検出します。

## TypeScript パスエイリアス

`tsconfig.json` は WXT が生成する `.wxt/tsconfig.json` を継承し、`@/` でリポジトリルートを参照できます。
