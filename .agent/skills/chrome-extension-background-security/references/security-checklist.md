# Chrome拡張機能 セキュリティチェックリスト

## 目次

1. 基本方針
2. Manifest・権限モデル
3. Service Worker（background.ts）セキュリティ
4. メッセージパッシングセキュリティ
5. Content Script セキュリティ
6. Storage セキュリティ
7. 外部通信・fetch セキュリティ
8. CSP・コード実行制約
9. 可観測性・運用統制
10. Chrome拡張機能固有の危険信号
11. 最終レビュー出力テンプレート

---

## 1. 基本方針

最初に次を固定する。

- **何を守るか**
  ユーザーのブラウジングデータ、認証トークン、入力値（フォーム・パスワード）、拡張機能の設定、バックエンド API キー
- **誰を防ぐか**
  悪意あるウェブページ、他の拡張機能、悪意あるネイティブアプリ、拡張機能を配布するサプライチェーン
- **どの経路で侵入されるか**
  Content Script 経由の XSS 注入、メッセージパッシングの偽装、host_permissions の乱用、web_accessible_resources のフィンガープリント、ストレージへの平文保存、npm 依存汚染

確認項目:

- 最小権限原則を採用しているか
- 信頼境界を「ウェブページ」「Content Script」「Service Worker」「Popup/Options」で明示しているか
- 各コンテキスト間の通信を認証・検証しているか
- セキュリティ要件を機能要件と別に列挙しているか

---

## 2. Manifest・権限モデル

### 2.1 permissions（API 権限）

確認項目:

- 使用していない API 権限が含まれていないか
- `tabs` パーミッションの代わりに `activeTab` で足りないか
- `cookies`・`history`・`bookmarks`・`downloads` などの強権限に正当理由があるか
- `background` パーミッション（MV2残滓）が混入していないか
- Optional permissions で遅延要求できるものを起動時から要求していないか

危険信号:

- `"permissions": ["<all_urls>"]`（API 権限で全 URL アクセス）
- `webRequest` + blocking（MV3 では `declarativeNetRequest` で代替）
- `nativeMessaging` の使用理由が不明確

### 2.2 host_permissions

確認項目:

- `<all_urls>` や `*://*/*` ではなく必要なオリジンのみ列挙しているか
- 開発・テスト用の `localhost` が本番 manifest に残っていないか
- `host_permissions` のスコープが Content Script の `matches` と一致しているか

危険信号:

- `"host_permissions": ["<all_urls>"]` — 全サイトのデータ取得が可能になる
- 動的にパターンを追加する `chrome.permissions.request` を検証なしで呼ぶ

### 2.3 web_accessible_resources

確認項目:

- `matches` を `["<all_urls>"]` にしていないか（任意サイトからリソース存在確認が可能）
- 公開が必要なリソースを最小限に絞っているか
- `extension_id` ベースのアクセス制限を使っているか（`use_dynamic_url: true`）

危険信号:

- すべてのリソースを `web_accessible_resources` に列挙し `<all_urls>` で公開
- JavaScript ファイルを web_accessible_resources に含める（外部サイトからスクリプトとして読み込み可能）

### 2.4 content_scripts

確認項目:

- `matches` が必要なサイトのみに絞られているか
- `run_at: "document_start"` の使用箇所は本当に必要か
- `all_frames: true` は意図したものか（iframe 内まで実行される）
- `world: "MAIN"` の使用は意図した目的があるか（ページの JS コンテキストで実行される）

### 2.5 externally_connectable

確認項目:

- 設定している場合、接続を許可するオリジンを必要最小限に絞っているか
- ワイルドカード（`*`）を使っていないか
- 受信側で `sender.origin` / `sender.id` を検証しているか

---

## 3. Service Worker（background.ts）セキュリティ

確認項目:

- 秘密情報（API キー・OAuth トークン）をメモリ変数に長期保持していないか
  （SW 終了で揮発するが、SW 動作中は DevTools で読める）
- `chrome.storage` へ平文で秘密情報を保存していないか
- `fetch` の送信先を利用者入力に委譲していないか（SSRF 的悪用）
- Service Worker のスコープ外 URL への `fetch` をログなしで実施していないか
- 外部レスポンスの内容を未検証のまま `chrome.tabs.executeScript` や `eval` へ渡していないか
- `importScripts()` を動的 URL で呼んでいないか（外部スクリプト実行）

危険信号:

- `chrome.storage.local.set({ apiKey: "sk-..." })` — 平文保存
- `fetch(userInputUrl)` — 任意 URL fetch
- レスポンス JSON をそのまま `eval()` や `new Function()` へ渡す

---

## 4. メッセージパッシングセキュリティ

### 4.1 runtime.onMessage / runtime.onMessageExternal

確認項目:

- `sender.id` を検証して自拡張機能からのメッセージのみ受け付けているか
- `sender.origin` / `sender.url` を検証して信頼するウェブページを絞っているか
- メッセージの `type` / `action` フィールドを厳密に検証しているか
- 受信した文字列データを未検証で DOM に挿入していないか
- `sendResponse` に内部状態・秘密情報を含めていないか

危険信号:

```ts
// 危険: sender 検証なし
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "fetchData") {
    fetch(msg.url).then(/* ... */);  // 任意 URL fetch
  }
});
```

### 4.2 Content Script ↔ ウェブページ間の postMessage

確認項目:

- `window.addEventListener("message", ...)` で `event.origin` を検証しているか
- `event.source` が `window` であることを確認しているか
- ウェブページからのメッセージに基づいて `chrome.runtime.sendMessage` を橋渡ししていないか（橋渡しは脆弱になりやすい）

危険信号:

```ts
// 危険: origin 検証なし + bridge pattern
window.addEventListener("message", (event) => {
  chrome.runtime.sendMessage(event.data); // 任意ページからのリクエストを SW へ橋渡し
});
```

### 4.3 Port 接続（chrome.runtime.connect）

確認項目:

- `port.onMessage` で `sender.id` を検証しているか
- 長期接続で蓄積するデータ量を制限しているか
- `port.disconnect` 後もリスナーが残っていないか（メモリリーク＋リスナー汚染）

---

## 5. Content Script セキュリティ

### 5.1 DOM 操作

確認項目:

- `innerHTML`・`outerHTML`・`document.write`・`insertAdjacentHTML` にユーザー入力や外部データを渡していないか
- `DOMParser`・`element.setAttribute` 経由で XSS が発生しないか
- `textContent`・`createElement`・`setAttribute` で安全な DOM 構築をしているか
- `chrome.storage` から読んだ値を DOM に直接挿入していないか

危険信号:

```ts
// 危険: storage の値を innerHTML へ
const { userHtml } = await chrome.storage.local.get("userHtml");
document.getElementById("container").innerHTML = userHtml;
```

### 5.2 ページへの影響

確認項目:

- ページの既存 JS 変数や関数を上書きしていないか（`window.onload` 再定義など）
- ページに注入する `<script>` タグに外部 URL を使っていないか
- `world: "MAIN"` で実行している場合、ページコンテキストの汚染を最小化しているか

### 5.3 クリーンアップ

確認項目:

- SPA のページ遷移時にリスナー・Observer を `disconnect()` / `removeEventListener()` で解除しているか
- `MutationObserver` コールバック内でさらに DOM 変更を引き起こすループがないか

---

## 6. Storage セキュリティ

確認項目:

- `chrome.storage.local` は DevTools → Application → Extension Storage で誰でも読める前提で設計しているか
- `chrome.storage.sync` に PII（メールアドレス・ユーザー ID）や秘密情報を保存していないか
- API キー・OAuth アクセストークンを storage へ平文保存していないか
  推奨: バックエンド Proxy を経由してトークンをブラウザに保存しない設計
- `storage.session`（MV3 追加）の使用可否と SW 終了時消滅の前提を確認しているか
- ストレージのキー名に推測しやすい名前（`password`・`token`・`apiKey`）を使っていないか
- 他の拡張機能や悪意あるページが同一ストレージへアクセスできるリスクを考慮しているか

危険信号:

- `chrome.storage.sync.set({ password: "..." })`
- ストレージ読み出し値を検証なしに使用

---

## 7. 外部通信・fetch セキュリティ

確認項目:

- `fetch` の送信先ホストを allowlist 化しているか
- `http://` を拒否し `https://` を強制しているか
- 利用者入力から完全な URL を受けてそのまま `fetch` していないか
- バックエンド API レスポンスを未検証のまま DOM 挿入・eval していないか
- `fetch` タイムアウト（`AbortController`）を設定しているか
- Webhook や外部 API の署名検証を行っているか
- `XMLHttpRequest` の代わりに `fetch` + 明示的エラーハンドリングを使っているか

危険信号:

- `fetch(message.url)` — メッセージ経由の任意 URL fetch（SSRF 的悪用）
- レスポンスの `Content-Type` を検証せずに `.json()` を呼ぶ

---

## 8. CSP・コード実行制約

確認項目:

- `manifest.json` の `content_security_policy` を不必要に緩めていないか
  - `script-src 'unsafe-inline'` の追加は禁止（MV3 ではエラー）
  - `script-src 'unsafe-eval'` の追加はセキュリティリスク
- `eval()`・`new Function(str)`・`setTimeout("string")`・`setInterval("string")` を使っていないか
- `chrome.scripting.executeScript` に動的に構築した文字列を渡していないか
- サードパーティスクリプトを `<script src="外部URL">` で読み込んでいないか（CSP 違反かつリスク）
- `importScripts()` の引数を固定パスにしているか

---

## 9. 可観測性・運用統制

確認項目:

- エラーログに API キー・ユーザーデータ・スタックトレースを含めていないか
- 拡張機能更新時に既存 storage の構造変更を migration なしに行っていないか
  （旧バージョンのデータが残るユーザーへの影響を考慮）
- `chrome.storage.onChanged` で意図しないデータ変更を検知・記録できるか
- Chrome Web Store の自動更新で悪意あるコードを混入させるサプライチェーンリスク（npm 依存含む）を評価しているか
- コードレビューなしで本番公開できる権限者を最小化しているか

---

## 10. Chrome拡張機能固有の危険信号

- `"host_permissions": ["<all_urls>"]` を深く考えずに設定
- Content Script から `window.postMessage` を受信して bridge として SW へ中継（任意メッセージ注入）
- `runtime.onMessage` で `sender` を検証せずメッセージ内容をそのまま実行
- `chrome.storage.local` を秘密情報の安全な保管場所と誤認
- `web_accessible_resources` に `<all_urls>` を指定（フィンガープリント攻撃）
- `innerHTML` にストレージ・外部 API・メッセージ由来の値を代入
- `eval()` や `new Function()` を CSP 緩和で回避
- `fetch(userInput.url)` — 任意 URL へのリクエスト
- `externally_connectable` の origin に `*` を使用
- npm 依存への悪意あるコード混入（`postinstall` スクリプト等）を確認しない

---

## 11. 最終レビュー出力テンプレート

次の形で返す。

### 対象

- 実行コンテキスト:（Service Worker / Content Script / Popup / Options / その他）
- manifest バージョン:（MV3 / MV2）
- 主な権限:
- 外部通信先:

### 重大指摘

- 事実:
- 影響:
- 悪用経路:
- 推奨対策:

### 中程度指摘

- 事実:
- 影響:
- 推奨対策:

### 前提不足

- 未確認設定:
- 追加確認項目:

### 最低限の是正順

1. 権限・host_permissions の最小化
2. メッセージパッシングの sender 検証追加
3. DOM 操作の安全 API への置き換え
4. ストレージから秘密情報を除去 / Proxy 化
5. CSP の確認と eval 系 API の排除
