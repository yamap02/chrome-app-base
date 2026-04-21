# background.ts セキュリティレビュー

レビュー日: 2026-04-22  
対象コード: background.ts (Chrome Extension Service Worker)

---

## 対象コード

```typescript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'fetchData') {
    fetch(msg.url)
      .then(res => res.json())
      .then(data => sendResponse({ data }))
      .catch(err => sendResponse({ error: err.message, stack: err.stack }));
    return true;
  }
  if (msg.action === 'saveApiKey') {
    chrome.storage.local.set({ apiKey: msg.key });
    sendResponse({ ok: true });
  }
});
```

---

## 検出された脆弱性

### [CRITICAL] 1. 送信元 (sender) の検証なし

**箇所**: `onMessage.addListener` のコールバック冒頭  
**問題**: `sender` の検証を一切行っていない。任意のコンテントスクリプト・外部ページ・悪意ある拡張機能からのメッセージを無条件に処理する。

**影響**:
- 悪意ある Web ページや拡張機能が `fetchData` / `saveApiKey` を自由に呼び出せる
- Background Service Worker を任意 URL へのプロキシとして悪用可能

**修正方針**:
```typescript
// 自拡張機能のコンテントスクリプトからのメッセージのみ受け付ける例
if (sender.id !== chrome.runtime.id) return;
// または特定オリジンのみ許可
if (!sender.tab || !sender.url?.startsWith('https://expected-origin.example.com')) return;
```

---

### [CRITICAL] 2. SSRF (Server-Side Request Forgery) — URL 無検証での fetch

**箇所**: `fetch(msg.url)`  
**問題**: `msg.url` を一切検証せずに fetch する。

**影響**:
- 拡張機能が持つ `host_permissions` の範囲内であれば、攻撃者が指定した任意 URL にリクエストを送信できる
- `host_permissions` に `<all_urls>` が含まれる場合、イントラネット・ローカルホスト等への SSRF が成立する
- 認証トークンを含んだリクエストが意図しない外部サーバーへ送信されるリスク

**修正方針**:
```typescript
const ALLOWED_ORIGINS = ['https://api.example.com'];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_ORIGINS.some(origin => parsed.origin === origin);
  } catch {
    return false;
  }
}

if (!isAllowedUrl(msg.url)) {
  sendResponse({ error: 'URL not allowed' });
  return true;
}
```

---

### [HIGH] 3. エラー情報の過剰露出 (スタックトレース漏洩)

**箇所**: `.catch(err => sendResponse({ error: err.message, stack: err.stack }))`  
**問題**: `err.stack` をそのままレスポンスに含めている。

**影響**:
- スタックトレースにはファイルパス・内部実装の詳細が含まれる場合があり、攻撃者の情報収集に利用される
- 意図しない内部情報の漏洩

**修正方針**:
```typescript
.catch(err => sendResponse({ error: 'Fetch failed' }));
// デバッグ用途は console.error のみに限定
```

---

### [HIGH] 4. API キーの平文保存と入力検証なし

**箇所**: `chrome.storage.local.set({ apiKey: msg.key })`  
**問題**:
1. `msg.key` の型・長さ・形式を一切検証しない
2. `chrome.storage.local` は拡張機能内から平文でアクセス可能であり、他の脆弱性（XSS 等）と組み合わせると窃取リスクがある

**影響**:
- 不正な値（null, オブジェクト, 過大な文字列）で上書きされる可能性
- コンテントスクリプトに XSS が存在する場合、API キー窃取の起点になる

**修正方針**:
```typescript
if (typeof msg.key !== 'string' || msg.key.length === 0 || msg.key.length > 512) {
  sendResponse({ ok: false, error: 'Invalid key' });
  return;
}
// chrome.storage.local はそれ自体が最善策だが、
// 必要に応じて保存前にキーのフォーマット検証を追加する
```

---

### [MEDIUM] 5. メッセージスキーマの型検証なし

**箇所**: `msg.action === 'fetchData'` / `msg.action === 'saveApiKey'`  
**問題**: `msg` は `any` 型であり、`action` 以外のフィールド (`url`, `key`) の存在・型を検証しない。

**影響**:
- `msg.url` が `undefined` や `object` の場合、`fetch()` が予期しない動作をする可能性
- プロトタイプ汚染攻撃の起点になり得る

**修正方針**:
```typescript
// Zod や手動バリデーションでスキーマを強制する
if (typeof msg.url !== 'string') {
  sendResponse({ error: 'Invalid message' });
  return true;
}
```

---

### [MEDIUM] 6. `saveApiKey` の非同期エラーハンドリングなし

**箇所**: `chrome.storage.local.set({ apiKey: msg.key })`  
**問題**: `storage.set` は非同期だが結果を待たずに `sendResponse({ ok: true })` を返している。書き込み失敗時も `ok: true` を返す。

**修正方針**:
```typescript
chrome.storage.local.set({ apiKey: msg.key }, () => {
  if (chrome.runtime.lastError) {
    sendResponse({ ok: false, error: chrome.runtime.lastError.message });
  } else {
    sendResponse({ ok: true });
  }
});
return true; // 非同期レスポンスのために true を返す
```

---

### [LOW] 7. `fetchData` のレスポンスに対する検証なし

**箇所**: `.then(res => res.json())`  
**問題**: `res.json()` の結果をそのまま `sendResponse({ data })` で返している。レスポンスのサイズやスキーマを検証しない。

**影響**:
- 巨大なレスポンスがメモリを圧迫する可能性
- 悪意あるサーバーからの想定外データ構造がコンテントスクリプト側に伝播する

---

## 重大度サマリ

| # | 脆弱性 | 重大度 |
|---|--------|--------|
| 1 | sender 検証なし | CRITICAL |
| 2 | SSRF (URL 無検証 fetch) | CRITICAL |
| 3 | スタックトレース漏洩 | HIGH |
| 4 | API キー入力検証なし | HIGH |
| 5 | メッセージスキーマ型検証なし | MEDIUM |
| 6 | 非同期エラーハンドリングなし | MEDIUM |
| 7 | fetch レスポンス未検証 | LOW |

---

## 修正後のコード例

```typescript
const ALLOWED_ORIGINS = ['https://api.example.com'];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_ORIGINS.some(o => parsed.origin === o);
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 1. 送信元検証
  if (sender.id !== chrome.runtime.id) return;

  if (msg.action === 'fetchData') {
    // 2. 型検証
    if (typeof msg.url !== 'string') {
      sendResponse({ error: 'Invalid url' });
      return true;
    }
    // 3. URL 許可リスト
    if (!isAllowedUrl(msg.url)) {
      sendResponse({ error: 'URL not allowed' });
      return true;
    }
    fetch(msg.url)
      .then(res => res.json())
      .then(data => sendResponse({ data }))
      .catch(() => sendResponse({ error: 'Fetch failed' })); // スタックトレース非露出
    return true;
  }

  if (msg.action === 'saveApiKey') {
    // 4. 型・長さ検証
    if (typeof msg.key !== 'string' || msg.key.length === 0 || msg.key.length > 512) {
      sendResponse({ ok: false, error: 'Invalid key' });
      return;
    }
    // 5. 非同期エラーハンドリング
    chrome.storage.local.set({ apiKey: msg.key }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: 'Storage error' });
      } else {
        sendResponse({ ok: true });
      }
    });
    return true;
  }
});
```
