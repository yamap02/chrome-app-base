# manifest.json セキュリティレビュー

## 対象

- 実行コンテキスト: Manifest のみ（background.ts / Content Script の実装は未提供）
- manifest バージョン: MV3
- 主な権限: `tabs`, `storage`, `cookies`, `history`, `nativeMessaging`
- host_permissions: `<all_urls>`
- web_accessible_resources: 全 JS / CSS / HTML を `<all_urls>` へ公開
- 外部通信先: 不明（実装未提供）

---

## 重大指摘

### [CRITICAL-1] host_permissions: `<all_urls>` — 全サイトへのアクセス権

- **事実**: `"host_permissions": ["<all_urls>"]` が設定されている。
- **影響**: 拡張機能がすべてのウェブサイトの HTTP レスポンス・Cookie・フォーム入力を読み取れる状態になる。XSS または悪意あるコード混入が発生した場合、全ブラウジングデータの窃取が可能。
- **悪用経路**:
  1. 攻撃者がサプライチェーン（npm 依存汚染）経由でコードを混入 → `<all_urls>` 権限を利用して全サイトの認証情報を収集。
  2. Content Script の XSS 脆弱性が悪用された場合、被害範囲が全サイトに及ぶ。
- **推奨対策**: 実際に Content Script を注入・アクセスするオリジンのみに絞る（例: `"https://example.com/*"`）。どうしても広範囲が必要な場合は `activeTab` パーミッションを代替として検討する。

---

### [CRITICAL-2] web_accessible_resources に `*.js` を `<all_urls>` で公開

- **事実**: `"resources": ["*.js", "*.css", "*.html"]` を `"matches": ["<all_urls>"]` で公開している。
- **影響**:
  1. **フィンガープリント攻撃**: 任意のウェブページが `chrome-extension://[id]/...` URL にリクエストを送ることで拡張機能のインストール有無・バージョンを検出できる。ユーザートラッキングに悪用される。
  2. **JS の外部読み込み**: 悪意あるサイトが `<script src="chrome-extension://[id]/content.js">` で拡張機能スクリプトをそのページのコンテキストで実行させる可能性がある（MV3 でも条件次第でリスクが残る）。
- **悪用経路**: 拡張機能 ID が既知の場合、任意サイトから `fetch("chrome-extension://[id]/background.js")` でソースコードを取得→ロジック解析→脆弱性探索。
- **推奨対策**:
  - `matches` を自拡張機能の `extension_id` ベースに限定するか、公開が本当に必要なリソースのみ列挙する。
  - `"use_dynamic_url": true` を指定してリソース URL をセッションごとにランダム化する。
  - `*.js` の一括公開は削除し、必要なファイルのみ明示する。

---

### [CRITICAL-3] CSP に `'unsafe-eval'` を追加

- **事実**: `"script-src 'self' 'unsafe-eval'"` が設定されている。
- **影響**: `eval()` / `new Function()` / `setTimeout("string")` が extension_pages（Popup・Options・Service Worker）で実行可能になる。外部 API レスポンスや Storage の値を誤って `eval` に渡すコードが混入した場合、任意コード実行に直結する。
- **悪用経路**: 攻撃者がメッセージパッシングや Storage 経由で `eval` される文字列を注入 → 拡張機能の全権限（cookies・history・nativeMessaging）を使った操作が可能。
- **推奨対策**: `'unsafe-eval'` を削除する。`eval` が必要な処理（テンプレートエンジン・動的 JSON パース等）はすべて安全な代替実装（`JSON.parse`・明示的な AST 処理）に置き換える。MV3 の既定 CSP（`script-src 'self'`）で動作するよう設計する。

---

## 中程度指摘

### [HIGH-1] `nativeMessaging` パーミッション

- **事実**: `permissions` に `nativeMessaging` が含まれている。
- **影響**: ネイティブアプリケーション（OS 上のバイナリ）と通信できる。拡張機能が侵害された場合、ローカルファイルシステムやプロセスへのアクセスが可能になる。
- **推奨対策**: ネイティブメッセージングを使用する具体的な要件がなければ削除する。使用する場合は、接続先ネイティブアプリのパスを `allowed_extensions` で厳密に制限し、送受信データのスキーマ検証を必須とする。

---

### [HIGH-2] `cookies` + `history` パーミッションの組み合わせ

- **事実**: `cookies` と `history` が同時に宣言されている。
- **影響**: ユーザーの全閲覧履歴と全ドメインの Cookie（セッショントークン含む）を読み取り・変更できる。どちらか一方でも高感度だが、組み合わせるとユーザーのオンラインアイデンティティをほぼ完全に把握できる。
- **推奨対策**: 機能要件を再精査し、不要なら削除する。`cookies` は特定ドメインのみに `host_permissions` で範囲制限できるため、`<all_urls>` を狭めることで被害範囲を縮小できる。

---

### [HIGH-3] `tabs` パーミッション（`activeTab` で代替可能か）

- **事実**: `tabs` パーミッションが宣言されている。
- **影響**: `tabs` は全タブの URL・タイトルを常時読み取れる。ユーザー操作なしにバックグラウンドで全タブ情報を収集できる。
- **推奨対策**: ユーザーの明示的な操作（クリック等）時のみ現在タブにアクセスするなら `activeTab` で十分。`tabs` が必要な正当理由がなければ `activeTab` に置き換える。

---

## 前提不足（実装確認が必要な項目）

- **未確認設定**:
  - `content_scripts` の `matches` 範囲と `run_at`（manifest に記載なし）
  - `externally_connectable` の設定有無
  - `background.ts` 内での `nativeMessaging` 使用箇所と入力検証の有無
  - `runtime.onMessage` での `sender.id` / `sender.origin` 検証の有無
  - `cookies` / `history` の実際の使用コードと目的

- **追加確認項目**:
  - `chrome.storage` に秘密情報（APIキー・トークン）を平文保存していないか
  - Content Script が `innerHTML` / `document.write` を使用していないか
  - `fetch` の送信先を allowlist で制限しているか
  - `nativeMessaging` で接続するネイティブアプリのパスと署名検証

---

## 最低限の是正順

1. **`'unsafe-eval'` を CSP から削除** — `eval` 系 API の使用箇所を全廃してからデフォルト CSP に戻す（最優先）
2. **`host_permissions` を必要オリジンのみに絞る** — `<all_urls>` を削除し、対象サイトを明示列挙する
3. **`web_accessible_resources` の `matches` を `<all_urls>` から変更** — `use_dynamic_url: true` を追加し、公開ファイルを最小限に絞る（`*.js` の一括公開を廃止）
4. **`nativeMessaging` の使用要否を判断** — 不要なら削除、必要なら接続先検証を実装する
5. **`cookies` / `history` / `tabs` の要否を再精査** — 使わないものを削除、`tabs` は `activeTab` への置き換えを検討する

---

## サマリー

| 指摘 | 重大度 | 対象 |
|---|---|---|
| host_permissions: `<all_urls>` | Critical | manifest.json |
| web_accessible_resources: `*.js` を `<all_urls>` 公開 | Critical | manifest.json |
| CSP: `'unsafe-eval'` | Critical | manifest.json |
| nativeMessaging の正当性不明 | High | manifest.json |
| cookies + history の組み合わせ | High | manifest.json |
| tabs → activeTab 代替検討 | Medium | manifest.json |

Critical が 3 件あり、このまま公開するとユーザーデータの完全な窃取・任意コード実行・フィンガープリント攻撃のリスクが現実的に存在する。リリース前に必ず是正すること。
