# Chrome拡張機能 パフォーマンス 推奨パターン集

アンチパターンに対応する、MV3特有の制約を踏まえた正しい実装パターン。

---

## P-01: メッセージのバッチ化（AP-01の解決）

```javascript
// ✅ GOOD: 全タブ分のデータを1メッセージで要求する設計に変える

// Content Script側: 一括レスポンス
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_ALL_DATA') {
    // ページ内で必要な全データをまとめて返す
    sendResponse({
      title: document.title,
      links: [...document.querySelectorAll('a')].map(a => a.href),
      meta: getMeta(),
    });
  }
  return true; // async response
});

// Service Worker側: タブをまとめて処理
async function collectFromAllTabs() {
  const tabs = await chrome.tabs.query({ active: false });
  const results = await Promise.all(
    tabs.map(tab =>
      chrome.tabs.sendMessage(tab.id, { type: 'GET_ALL_DATA' })
        .catch(() => null) // タブが応答しない場合を握りつぶす
    )
  );
  return results.filter(Boolean);
}
```

**ポイント**: 1タブ1メッセージではなく、1タブから全データを取得する設計にする。

---

## P-02: chrome.storage の永続化（AP-02の解決）

```javascript
// ✅ GOOD: SWのグローバル変数ではなくchrome.storageを使う

// 読み込み: SW起動のたびに取得
async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return settings ?? DEFAULT_SETTINGS;
}

// 書き込み: 変更時に保存
async function saveSettings(patch) {
  const current = await getSettings();
  await chrome.storage.local.set({ settings: { ...current, ...patch } });
}

// メッセージハンドラ内でも都度取得する
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }
});
```

---

## P-03: MutationObserverの最小化（AP-03の解決）

```javascript
// ✅ GOOD: 監視対象を絞り、不要なオプションを外す

// 監視対象を最小限に絞る
const targetNode = document.getElementById('specific-container') ?? document.body;

const observer = new MutationObserver((mutations) => {
  // 関係ないmutationを早期リターンでスキップ
  const relevant = mutations.filter(m => m.target.matches?.('.target-class'));
  if (relevant.length === 0) return;

  // コールバックを debounce で間引く
  scheduleUpdate();
});

observer.observe(targetNode, {
  childList: true,
  subtree: false,      // ✅ subtreeは必要な時だけtrue
  characterData: false, // ✅ テキスト監視が不要なら外す
  attributes: false,
});

// ページ離脱時に必ず解除
window.addEventListener('beforeunload', () => observer.disconnect());

// debounce ユーティリティ
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
const scheduleUpdate = debounce(processChanges, 100);
```

---

## P-04: イベントリスナーのクリーンアップ（AP-04の解決）

```javascript
// ✅ GOOD: AbortController でリスナーをまとめて解除

class ContentScriptManager {
  #controller = new AbortController();

  setup() {
    const { signal } = this.#controller;

    document.addEventListener('click', this.#handleClick, { signal });
    window.addEventListener('scroll', this.#handleScroll, { signal });

    // MutationObserver も管理する
    this.#observer = new MutationObserver(this.#handleMutation);
    this.#observer.observe(document.body, { childList: true });
  }

  teardown() {
    this.#controller.abort(); // addEventListener のリスナーを一括解除
    this.#observer?.disconnect();
  }

  #handleClick = (e) => { /* ... */ };
  #handleScroll = (e) => { /* ... */ };
  #handleMutation = (mutations) => { /* ... */ };
}

const manager = new ContentScriptManager();
manager.setup();

// SPA対応: URLが変わったら再セットアップ
let lastHref = location.href;
new MutationObserver(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    manager.teardown();
    manager.setup();
  }
}).observe(document, { subtree: true, childList: true });
```

---

## P-05: chrome.storage のバッチread/write（AP-05の解決）

```javascript
// ✅ GOOD: 必要なキーをまとめて取得・保存

// 複数キーを1回で取得
async function loadState() {
  const { settings, cache, lastSync } = await chrome.storage.local.get([
    'settings', 'cache', 'lastSync',
  ]);
  return { settings, cache, lastSync };
}

// 複数キーを1回で保存
async function saveState({ settings, cache, lastSync }) {
  await chrome.storage.local.set({ settings, cache, lastSync });
}

// 書き込みを debounce で間引く
const debouncedSave = debounce(saveState, 500);

function onSettingsChange(patch) {
  currentSettings = { ...currentSettings, ...patch };
  debouncedSave({ settings: currentSettings }); // 500ms後にまとめて保存
}
```

---

## P-06: chrome.alarms で定期処理（AP-06の解決）

```javascript
// ✅ GOOD: chrome.alarms で定期実行を登録

// Service Worker起動時に登録（重複登録を防ぐ）
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('sync', { periodInMinutes: 1 });
});

// アラームのハンドラ
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sync') {
    syncData();
  }
});

// SW起動時に既存アラームの存在を確認して再登録
chrome.runtime.onStartup.addListener(async () => {
  const existing = await chrome.alarms.get('sync');
  if (!existing) {
    chrome.alarms.create('sync', { periodInMinutes: 1 });
  }
});
```

**ポイント**: `chrome.alarms` はSWが落ちていても次回起動時にアラームが発火する。

---

## P-07: 高頻度通信に Port を使用（AP-07の解決）

```javascript
// ✅ GOOD: chrome.runtime.connect() で持続的な接続を確立

// Content Script側
const port = chrome.runtime.connect({ name: 'keystream' });

document.addEventListener('keydown', (e) => {
  port.postMessage({ type: 'KEY', key: e.key }); // sendMessageより低コスト
});

port.onDisconnect.addListener(() => {
  // SW再起動時など切断時の再接続処理
  reconnect();
});

// Service Worker側
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'keystream') return;

  port.onMessage.addListener((msg) => {
    if (msg.type === 'KEY') handleKey(msg.key);
  });

  port.onDisconnect.addListener(() => {
    // クリーンアップ
  });
});
```

---

## P-08: document_idle での初期化（AP-08の解決）

```javascript
// manifest.json
{
  "content_scripts": [{
    "run_at": "document_idle", // ✅ DOMが準備できてから実行
    "js": ["content.js"]
  }]
}
```

```javascript
// content.js: 重い処理は非同期・遅延実行
async function init() {
  // 必要最小限の初期化だけ同期で行う
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.enabled) return; // 無効なら即終了

  // 重い処理は requestIdleCallback で遅延
  requestIdleCallback(() => {
    setupComplexFeatures(settings);
  }, { timeout: 2000 });
}

init();
```

---

## P-09: Popup の高速起動（AP-10の解決）

```javascript
// ✅ GOOD: 必要なデータだけ取得 + キャッシュ活用

// popup.ts
async function initPopup() {
  // storage から必要キーだけ取得（全件取得しない）
  const { settings, badgeCount } = await chrome.storage.local.get([
    'settings', 'badgeCount',
  ]);

  // 最初にスケルトンUIを表示してから非同期でデータを埋める
  renderSkeleton();
  render({ settings, badgeCount });

  // 重いデータは後から取得
  const stats = await fetchStats();
  renderStats(stats);
}

document.addEventListener('DOMContentLoaded', initPopup);
```

---

## P-10: storage.sync の書き込み制限対策（AP-11の解決）

```javascript
// ✅ GOOD: debounce + 差分チェックで書き込みを最小化

let lastSaved = {};

const debouncedSync = debounce(async (data) => {
  // 変更がなければ書き込まない
  if (JSON.stringify(data) === JSON.stringify(lastSaved)) return;

  await chrome.storage.sync.set(data);
  lastSaved = { ...data };
}, 1000); // 1秒に1回まで

// 設定変更時
function onConfigChange(newConfig) {
  // 重いフィールドはsyncではなくlocalに保存
  chrome.storage.local.set({ largeData: newConfig.largeData });

  // syncには軽量な設定だけ
  debouncedSync({
    theme: newConfig.theme,
    language: newConfig.language,
  });
}
```

**コスト比較**:
- debounceなし(毎keystroke): 最大 ~3,600ops/hour → quota超過
- debounce 1秒: 最大 3,600ops/hour 以内に収まる
