# セキュリティレビュー: Content Script ↔ Service Worker メッセージパッシング

## 対象コード

```typescript
// content.ts
window.addEventListener('message', (event) => {
  chrome.runtime.sendMessage(event.data);
});

// background.ts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DOM_INJECT') {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      func: new Function(msg.code)
    });
  }
});
```

---

## 脆弱性一覧

### [CRITICAL] CVE相当: 任意コード実行 (RCE in extension context)

**箇所**: `background.ts` — `new Function(msg.code)`

**説明**:  
`new Function(string)` は `eval()` と等価の動的コード生成。`msg.code` が攻撃者制御下にある文字列であれば、拡張機能の権限（`chrome.scripting`, `chrome.storage`, `host_permissions` 全範囲）で任意のJavaScriptを実行できる。

**攻撃シナリオ**:  
後述のメッセージ偽装脆弱性と組み合わせることで、任意のWebページから拡張機能経由でコード実行が成立する。

**修正方針**:
- `new Function` / `eval` を一切使用しない
- 実行する処理は静的関数として事前定義し、`msg.action` などで分岐する
- CSP `script-src` に `'unsafe-eval'` を含めない（MV3デフォルトは禁止だが、コードレベルでも排除）

---

### [CRITICAL] メッセージ送信元の無検証 (Origin Spoofing)

**箇所**: `content.ts` — `window.addEventListener('message', (event) => { ... })`

**説明**:  
`event.origin` を検証せずに `event.data` をそのまま `chrome.runtime.sendMessage` へ転送している。  
同じタブで動作する任意のWebページ（広告iframe、XSSされたサブドメイン等）が `window.postMessage` で任意のデータを送信でき、Service Workerへ到達する。

**攻撃シナリオ**:
```javascript
// 悪意あるページまたはXSSペイロード
window.postMessage({ type: 'DOM_INJECT', code: 'chrome.tabs.query({}, t => ...)' }, '*');
```

**修正方針**:
```typescript
window.addEventListener('message', (event) => {
  // 送信元オリジンを厳格に検証
  if (event.origin !== window.location.origin) return;
  // さらに送信元がページ自身か拡張機能かを区別する仕組みを設ける
  chrome.runtime.sendMessage(event.data);
});
```

---

### [HIGH] メッセージ構造の無検証 (Lack of Input Validation)

**箇所**: `background.ts` — `chrome.runtime.onMessage.addListener`

**説明**:  
`msg.type` が `'DOM_INJECT'` であることのみチェックし、`msg.code` の型・長さ・内容を一切検証していない。  
`sender.tab` が `undefined` の場合（popup や options page からのメッセージ）に `sender.tab.id` で TypeError が発生し、予期しない動作を引き起こす可能性もある。

**修正方針**:
```typescript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender.tab?.id) return; // tab以外からのメッセージを拒否
  if (typeof msg !== 'object' || msg === null) return;
  if (msg.type === 'DOM_INJECT') {
    // msg.code は使用しない。静的関数のみ実行する。
  }
});
```

---

### [HIGH] chrome.runtime.sendMessage へのオブジェクト無制限転送

**箇所**: `content.ts` — `chrome.runtime.sendMessage(event.data)`

**説明**:  
`event.data` はWebページが自由に制御できる。オブジェクトの構造・サイズ・型に制約がなく、Service Worker側のロジックを想定外の入力で呼び出せる。  
Prototype Pollution攻撃用ペイロード (`{ "__proto__": { ... } }`) をそのまま転送する経路にもなりうる。

**修正方針**:  
Content Scriptは独自のメッセージ型を定義し、Webページからの入力を直接転送しない。必要な情報のみ抽出・再構築してから送信する。

```typescript
// 良い例: 必要な情報のみ取り出して再構築
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  if (typeof event.data?.action !== 'string') return;
  // allowlistで許可されたactionのみ転送
  const ALLOWED_ACTIONS = ['TOGGLE_FEATURE'] as const;
  if (!ALLOWED_ACTIONS.includes(event.data.action)) return;
  chrome.runtime.sendMessage({ action: event.data.action });
});
```

---

### [MEDIUM] sender.tab.id の未検証利用

**箇所**: `background.ts` — `target: { tabId: sender.tab.id }`

**説明**:  
`sender.tab` は chrome.runtime.sendMessage の送信元がContent Scriptの場合にのみ存在する。  
他のコンテキスト（popup, options等）から同一メッセージを送られた場合、`sender.tab` が `undefined` となり実行時エラー。

**修正方針**:  
`sender.tab?.id` を使いつつ、`undefined` の場合は早期リターン。

---

## 総合評価

| カテゴリ | 評価 |
|---------|------|
| 重大度 | Critical |
| 悪用難易度 | 低（同一タブのXSS or iframe で成立） |
| 影響範囲 | 全ホスト権限の濫用、任意コード実行 |

このコードは**本番利用不可**。`new Function(msg.code)` の使用と送信元無検証の組み合わせにより、拡張機能が任意のWebコンテンツから乗っ取られる経路が成立している。

---

## 修正済みコード例

```typescript
// content.ts (修正後)
const ALLOWED_ORIGINS = new Set([window.location.origin]);
const ALLOWED_MESSAGE_TYPES = new Set(['FEATURE_TOGGLE', 'STATUS_REQUEST']);

window.addEventListener('message', (event) => {
  if (!ALLOWED_ORIGINS.has(event.origin)) return;
  if (typeof event.data?.type !== 'string') return;
  if (!ALLOWED_MESSAGE_TYPES.has(event.data.type)) return;

  // 必要なフィールドのみ抽出して転送
  chrome.runtime.sendMessage({
    type: event.data.type,
    // 動的コードは絶対に含めない
  });
});
```

```typescript
// background.ts (修正後)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender.tab?.id) return;
  if (typeof msg !== 'object' || msg === null) return;

  switch (msg.type) {
    case 'FEATURE_TOGGLE':
      // 静的な処理のみ実行。動的コード生成禁止。
      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        func: toggleFeature, // 事前定義済み関数を参照
      });
      break;
    default:
      // 未知のメッセージタイプは無視
      break;
  }
});

function toggleFeature() {
  // 具体的な静的処理
}
```
