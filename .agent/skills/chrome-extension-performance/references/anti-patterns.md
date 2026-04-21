# Chrome拡張機能 パフォーマンス アンチパターン集

Chrome拡張機能（MV3）でよく見られるパフォーマンスのアンチパターンと、その影響・診断方法。

---

## 🔴 Critical アンチパターン

### AP-01: N+1 メッセージパッシング（最頻出）

**症状**: ループごとに処理が止まる、タブ一覧操作が極端に遅い

```javascript
// ❌ NG: ループ内でsendMessageを呼ぶ
tabs.forEach(tab => {
  chrome.tabs.sendMessage(tab.id, { type: 'GET_DATA' }, response => {
    processResponse(response); // タブ数分のメッセージ往復
  });
});
```

**影響**: sendMessage 1回 ≈ 5〜20ms。100タブなら500ms〜2秒。

**診断**: Chrome DevTools → Service Worker → Network で複数の `chrome-extension://` リクエストが連続していないか確認。

---

### AP-02: Service Worker内でメモリに状態を保持

**症状**: 拡張機能を使っているとデータが消える、設定が保存されない

```javascript
// ❌ NG: SWのグローバル変数に状態を置く
let userSettings = {}; // SWが落ちると消える

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SAVE') {
    userSettings = msg.data; // 次回SW起動時にはundefined
  }
});
```

**影響**: MV3のService Workerは非アクティブ約30秒で終了する。グローバル変数は消える。

---

### AP-03: MutationObserverの過剰監視

**症状**: ページ全体がもっさりする、スクロールが重くなる

```javascript
// ❌ NG: body全体をsubtree+characterDataで監視
const observer = new MutationObserver(callback);
observer.observe(document.body, {
  subtree: true,       // 全子孫を監視
  childList: true,
  characterData: true, // テキストノード変更も全て検知
  attributes: true,
});
// callbackが毎秒数百回呼ばれる可能性がある
```

**影響**: Reactなどのフレームワークが多用するサイトでは1秒に数百回コールバックが走る。

---

### AP-04: イベントリスナーのクリーンアップ漏れ（メモリリーク）

**症状**: 長時間使用するとメモリが増え続ける、ページ再読み込みで重複動作する

```javascript
// ❌ NG: SPA遷移のたびにリスナーを追加し続ける
document.addEventListener('click', handleClick); // 解除なし
window.addEventListener('scroll', handleScroll); // 解除なし

// SPAのページ遷移フック（クリーンアップなし）
const observer = new MutationObserver(() => {
  document.addEventListener('click', handleClick); // 追加され続ける
});
```

---

## 🟠 High アンチパターン

### AP-05: chrome.storage を逐次個別read/write

**症状**: storage操作が複数発生するたびに遅延が重なる

```javascript
// ❌ NG: キーを1つずつ書き込む
chrome.storage.local.set({ key1: val1 });
chrome.storage.local.set({ key2: val2 });
chrome.storage.local.set({ key3: val3 }); // 3回の非同期書き込み
```

**影響**: 書き込みごとにディスクI/Oが発生。直列で呼ぶと数十ms×回数の遅延。

---

### AP-06: setInterval / setTimeout をService Worker内で使用

**症状**: タイマー処理がSW終了後に動かなくなる、定期処理が止まる

```javascript
// ❌ NG: SWでsetIntervalを使う
setInterval(() => {
  syncData(); // SW終了後は実行されない
}, 60000);
```

**影響**: SW終了後はタイマーが消える。再起動時に再登録されない限り動かない。

---

### AP-07: 高頻度通信にsendMessageを使用

**症状**: コンテンツ編集中やスクロール中に拡張機能が重くなる

```javascript
// ❌ NG: キー入力のたびにsendMessageを呼ぶ
document.addEventListener('keydown', (e) => {
  chrome.runtime.sendMessage({ type: 'KEY', key: e.key });
  // タイピング中は毎秒数回〜数十回のメッセージ
});
```

**影響**: sendMessage のオーバーヘッド × 高頻度 = 遅延累積。SWが連続起動しコストが高い。

---

### AP-08: document_start で重い処理を実行

**症状**: ページの初期表示が明らかに遅くなる

```javascript
// manifest.json
{
  "content_scripts": [{
    "run_at": "document_start", // ❌ DOMが構築される前から重い処理
    "js": ["content.js"]
  }]
}
```

```javascript
// content.js - 重い初期化処理
const config = await fetchRemoteConfig(); // ネットワーク待ち
setupComplexUI(config);                   // DOMが未完成な状態で実行
```

---

## 🟡 Medium アンチパターン

### AP-09: chrome.tabs.query をループ内で呼ぶ

**症状**: タブ操作系の処理が遅い

```javascript
// ❌ NG: 毎回chrome.tabs.queryを呼ぶ
async function processAllTabs() {
  for (const url of urlList) {
    const tabs = await chrome.tabs.query({ url }); // ループ内で毎回query
    tabs.forEach(tab => doSomething(tab));
  }
}
```

---

### AP-10: Popupで毎回重い初期化

**症状**: Popupを開くたびに数百ms待つ

```javascript
// ❌ NG: Popup起動のたびにストレージ + DOM構築 + ネットワーク
window.addEventListener('load', async () => {
  const data = await fetch('https://api.example.com/config'); // 毎回ネットワーク
  const storage = await chrome.storage.local.get(null);       // 全件取得
  renderComplexUI(data, storage);
});
```

---

### AP-11: storage.sync を高頻度で書き込み

**症状**: 設定保存がたまに失敗する（quota超過エラー）

```javascript
// ❌ NG: 入力のたびにsyncストレージに保存
inputEl.addEventListener('input', (e) => {
  chrome.storage.sync.set({ text: e.target.value }); // 1,800ops/hour制限
});
```

**影響**: `chrome.storage.sync` の書き込み上限は 1,800ops/hour。即時保存は制限に当たる。

---

## 診断フローまとめ

```
遅い症状
  ├── ページ全体が重くなった
  │     → AP-03（MutationObserver）、AP-04（リスナーリーク）、AP-08（document_start）を確認
  ├── 拡張機能の操作（ボタン・メッセージ）が遅い
  │     → AP-01（N+1メッセージ）、AP-07（高頻度sendMessage）を確認
  ├── データが消える・設定がリセットされる
  │     → AP-02（SWメモリ状態）、AP-06（setInterval）を確認
  ├── メモリが増え続ける
  │     → AP-04（リスナーリーク）、AP-03（MutationObserver未解除）を確認
  └── storage操作が失敗する・遅い
        → AP-05（逐次書き込み）、AP-11（sync高頻度）を確認
```
