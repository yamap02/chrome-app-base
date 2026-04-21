# background.ts セキュリティレビュー

## 対象

- **実行コンテキスト**: Service Worker（background.ts）
- **manifest バージョン**: MV3（想定）
- **主な権限**: 不明（manifest.json 未提示）— `storage` 権限は使用中
- **外部通信先**: `msg.url`（利用者任意指定）

---

## 重大指摘

### [CRIT-1] sender 未検証による任意メッセージ実行

**事実:**
```typescript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'fetchData') { ... }
  if (msg.action === 'saveApiKey') { ... }
});
```
`sender.id` / `sender.origin` の検証が一切ない。

**影響:**
悪意あるウェブページや他の拡張機能が `chrome.runtime.sendMessage` を送れる場合（`externally_connectable` の設定次第）、任意のアクションを Service Worker に実行させられる。Content Script が postMessage bridge を経由している場合は確実に外部から到達可能。

**悪用経路:**
1. Content Script に postMessage bridge が存在 → 悪意あるページが `{ action: 'saveApiKey', key: 'attacker-controlled' }` を送信 → API キーを上書き
2. `externally_connectable` 設定が存在する場合 → 外部サイトから直接 `fetchData` を起動

**推奨対策:**
```typescript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 自拡張機能のコンテキストからのみ受け付ける
  if (sender.id !== chrome.runtime.id) return;
  // Content Script からの場合は sender.url / sender.origin で送信元を限定
  // ...
});
```

---

### [CRIT-2] 利用者入力 URL の無検証 fetch（SSRF 的悪用）

**事実:**
```typescript
fetch(msg.url)
```
`msg.url` を allowlist 照合・スキーム検証なしでそのまま fetch している。

**影響:**
- `http://` → HTTPS 強制なし、中間者攻撃リスク
- `file:///` → ローカルファイル読み取りの試み（ブラウザの fetch が block するケースが多いが設計上の欠陥）
- `http://localhost:*` → ローカル開発サーバー・内部 API への横断アクセス
- 攻撃者が意図したエンドポイントへリクエストを誘導し、レスポンスをアプリに取り込ませる（SSRF 相当）

**悪用経路:**
Content Script がページからのデータを中継 → 悪意あるページが `msg.url = "http://internal-api/admin"` を指定 → Service Worker が社内 API にリクエスト

**推奨対策:**
```typescript
const ALLOWED_ORIGINS = new Set([
  'https://api.example.com',
  'https://cdn.example.com',
]);

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

if (msg.action === 'fetchData') {
  if (!isAllowedUrl(msg.url)) {
    sendResponse({ error: 'URL not allowed' });
    return true;
  }
  fetch(msg.url) // ...
}
```

---

### [CRIT-3] API キーの平文ストレージ保存

**事実:**
```typescript
chrome.storage.local.set({ apiKey: msg.key });
```
`chrome.storage.local` は DevTools → Application → Extension Storage で誰でも読み書き可能。

**影響:**
- ローカルマシンにアクセスできる人物が DevTools から API キーを即時取得可能
- キー名 `apiKey` が推測容易で、他の拡張機能の脆弱性を経由した読み取りリスクも発生

**悪用経路:**
DevTools 操作、または別の脆弱な拡張機能が `chrome.storage.local.get('apiKey')` を実行

**推奨対策:**
- バックエンド Proxy を設計し、API キーをブラウザに保存しない
- 保存が必須の場合は `chrome.storage.session`（MV3、SW 終了時消滅）を検討
- キー名を難読化してもセキュリティにはならない点に注意（根本対策はサーバーサイド Proxy）

---

## 中程度指摘

### [MED-1] エラーレスポンスにスタックトレースを含める

**事実:**
```typescript
.catch(err => sendResponse({ error: err.message, stack: err.stack }));
```

**影響:**
スタックトレースにはファイルパス・依存ライブラリ名・内部構造が露出する。Content Script 経由でウェブページにも渡る可能性があり、攻撃者の情報収集に使われる。

**推奨対策:**
```typescript
.catch(err => {
  console.error('[bg] fetchData error:', err); // 内部ログのみ
  sendResponse({ error: 'fetch failed' });     // 外部へは汎用メッセージ
});
```

---

### [MED-2] `saveApiKey` が `sendResponse` を非同期で呼ばない

**事実:**
```typescript
if (msg.action === 'saveApiKey') {
  chrome.storage.local.set({ apiKey: msg.key });
  sendResponse({ ok: true });
}
```
`chrome.storage.local.set` は非同期 API。`set` の完了を待たずに `{ ok: true }` を返している。

**影響:**
呼び出し元が `ok: true` を「保存完了」として扱うと、直後の `get` で古い値が返る競合状態が発生する可能性がある。

**推奨対策:**
```typescript
if (msg.action === 'saveApiKey') {
  chrome.storage.local.set({ apiKey: msg.key }, () => {
    sendResponse({ ok: true });
  });
  return true; // sendResponse を非同期で呼ぶため true を返す
}
```

---

### [MED-3] fetch タイムアウト未設定

**事実:**
`fetch(msg.url)` に `AbortController` によるタイムアウトがない。

**影響:**
Service Worker の最大実行時間（約30秒）まで hung リクエストが残り、他のメッセージ処理に影響する可能性がある。DoS 的な遅延攻撃にも悪用可能。

**推奨対策:**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10_000);
fetch(msg.url, { signal: controller.signal })
  .finally(() => clearTimeout(timeoutId));
```

---

### [MED-4] レスポンスの Content-Type 未検証

**事実:**
```typescript
fetch(msg.url).then(res => res.json())
```
`res.ok` チェックおよび `Content-Type` 検証なしで `.json()` を呼んでいる。

**影響:**
エラーレスポンス（HTML ページ等）を JSON パースしようとして例外発生 → エラーハンドラが `err.message` / `err.stack` を呼び出し元に返す（MED-1 参照）。

**推奨対策:**
```typescript
.then(res => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) throw new Error('unexpected content-type');
  return res.json();
})
```

---

## 前提不足（manifest.json 未提示）

| 未確認設定 | 確認すべき内容 |
|---|---|
| `host_permissions` | `<all_urls>` / `*://*/*` を使っていないか。fetchData で必要なオリジンのみに限定しているか |
| `externally_connectable` | 設定の有無。設定ありの場合、許可オリジンが最小化されているか |
| `content_scripts.matches` | fetchData / saveApiKey を橋渡しする Content Script の注入範囲 |
| `web_accessible_resources` | `<all_urls>` 指定によるフィンガープリント攻撃面がないか |
| `content_security_policy` | `unsafe-eval` / `unsafe-inline` の追加がないか |

---

## 是正優先順（最低限やること → リリース前 → 運用）

### 最低限やること（マージ前必須）

1. **[CRIT-1]** `onMessage` に `sender.id !== chrome.runtime.id` ガードを追加
2. **[CRIT-2]** `msg.url` を allowlist 照合 + `https:` 強制 → 非準拠は即 reject
3. **[CRIT-3]** `apiKey` の平文 storage 保存を廃止 → バックエンド Proxy 設計に切り替え
4. **[MED-1]** `err.stack` を `sendResponse` から除去、内部ログのみに

### リリース前にやること

5. **[MED-2]** `saveApiKey` を storage.set コールバック後に `sendResponse` する実装に修正
6. **[MED-3]** `AbortController` タイムアウト（10秒以内）を追加
7. **[MED-4]** `res.ok` チェックと Content-Type 検証を追加
8. manifest.json の `host_permissions` を必要オリジンのみに絞る

### 運用で補うこと

9. Chrome Web Store 審査のたびに `storage` の保存内容を棚卸しする
10. npm 依存の定期的な `npm audit` 実施
11. 本番リリース前に `externally_connectable` の設定意図を必ず文書化する
