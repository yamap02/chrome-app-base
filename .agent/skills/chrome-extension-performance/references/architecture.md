# Chrome拡張機能 パフォーマンス アーキテクチャガイド

設計段階から考慮すべき構成と、機能規模に応じたアーキテクチャ選択。

---

## MV3 拡張機能の通信モデル

```
[Webページ]
    │
    │ postMessage (window)        ← MAIN world限定
    ▼
[Content Script]  ←── chrome.runtime.sendMessage / Port ──→  [Service Worker]
    │                                                               │
    │ DOM操作                                              chrome.storage
    ▼                                                      chrome.alarms
[DOM]                                                      chrome.tabs
                                                           chrome.scripting
                                                                   │
                                                               [Popup]
                                                           (別ウィンドウ)
```

**MV3 の特性**:
- Service Worker はイベント駆動・短命（非アクティブ30秒で終了）
- Content Script と SW は直接変数を共有できない（メッセージ経由のみ）
- Popup は開閉のたびに再生成される（状態を持たない）

---

## 規模別アーキテクチャ推奨

### 小規模（シンプルなページ操作・1機能）

シンプル構成で十分。設計より実装速度を優先。

```
Content Script: 単一ファイル（content.ts）
Service Worker: 最小限（インストールハンドラのみ）
Storage       : chrome.storage.local（settings のみ）
Popup         : React or 素のHTML、ストレージ読み取りのみ
```

**最低限守るべきこと**: AP-02（SW状態消失）と AP-03（MutationObserver過剰）だけ避ける

---

### 中規模（複数ページ対応・設定多数・バックグラウンド同期）

**メッセージプロトコル設計**と**storage 分離**が重要になる。

```
Content Script : 機能別にファイル分割（feature/xxx.ts）
Service Worker : ルーティング層を設ける（onMessage でtype別dispatch）
Storage        : local（大容量データ・キャッシュ）+ sync（軽量設定のみ）
Popup          : React、storage を読んで表示
通信           : 頻繁な双方向通信はPortを使用
```

**メッセージ型定義の例（TypeScript）**:
```typescript
// types/messages.ts - 単一の型定義ファイルで全メッセージを管理
type Message =
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'COLLECT_PAGE_DATA' }
  | { type: 'SYNC_NOW' };

type MessageResponse<T extends Message> =
  T extends { type: 'GET_SETTINGS' } ? Settings :
  T extends { type: 'COLLECT_PAGE_DATA' } ? PageData :
  void;
```

**初回起動の設計**:
```typescript
// Service Worker: onInstalled でデフォルト値を設定
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    await chrome.storage.sync.set({ theme: 'system', language: 'ja' });
  }
  // alarms の登録
  chrome.alarms.create('periodic-sync', { periodInMinutes: 30 });
});
```

---

### 大規模（タブ横断・リアルタイム同期・複雑なUI）

Service Worker の限界に近づく。**Offscreen Document** や **設計の見直し**を検討。

```
Content Script : WXT の entrypoints/ で管理、per-site で分岐
Service Worker : メッセージルーター + ドメインロジック分離
Offscreen Doc  : 長時間音声・WebSocket・Canvas処理 (offscreen API)
Storage        : local (キャッシュ) + IndexedDB (大容量構造化データ)
Popup          : 軽量エントリーポイント、重い処理はSWに委譲
```

**MV3で対応しきれないサイン**:
- WebSocket の持続接続が必要（Offscreen Document で代替可）
- 30秒を超える連続処理が必要（chrome.alarms でチャンク分割）
- 1MB を超えるデータを storage.local に書き込む（IndexedDB を検討）
- 複数タブをリアルタイムで同期したい（`chrome.storage.onChanged` + Port）

---

## データフロー設計パターン

### パターンA: Content Script 主体（DOM操作特化）

```
Popup/SW → sendMessage → Content Script → DOM 操作 → sendResponse で結果返却
```

**向いているケース**: ページ内テキスト加工・UI注入・スクレイピング

```typescript
// Content Script: 単一の大きなメッセージで全処理
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PROCESS_PAGE') {
    const result = processEntirePage(msg.options);
    sendResponse(result);
  }
  return true;
});
```

---

### パターンB: Service Worker 主体（複数タブ・外部API）

```
Popup → sendMessage → SW → chrome.tabs.query → Promise.all(sendMessage) → 集約 → Popup
```

**向いているケース**: 全タブのデータ収集・外部API連携・バッジ更新

```typescript
// Service Worker: タブをまとめて並列処理
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'COLLECT_ALL') {
    collectFromAllTabs().then(sendResponse);
    return true;
  }
});

async function collectFromAllTabs() {
  const tabs = await chrome.tabs.query({ url: ['https://*/*'] });
  return Promise.all(
    tabs.map(tab =>
      chrome.tabs.sendMessage(tab.id!, { type: 'GET_DATA' }).catch(() => null)
    )
  );
}
```

---

### パターンC: ストリーミング（Port による双方向通信）

```
Content Script ←── Port ──→ Service Worker
       ↕ postMessage（高頻度）
```

**向いているケース**: リアルタイム入力監視・ライブプレビュー・進捗通知

```typescript
// Content Script: Port を確立して高頻度メッセージを送る
let port: chrome.runtime.Port | null = null;

function ensurePort() {
  if (port) return port;
  port = chrome.runtime.connect({ name: 'realtime' });
  port.onDisconnect.addListener(() => {
    port = null;
    // SW再起動後に再接続
    setTimeout(ensurePort, 1000);
  });
  return port;
}

document.addEventListener('input', (e) => {
  ensurePort().postMessage({ type: 'INPUT', value: (e.target as HTMLInputElement).value });
});
```

---

## storage 設計ガイド

```
chrome.storage.local   → 大容量データ・キャッシュ・一時状態（上限10MB）
chrome.storage.sync    → 軽量設定・ユーザー設定（端末間同期）（上限100KB）
chrome.storage.session → セッションキャッシュ（SW終了で消える）（上限10MB）
IndexedDB              → 構造化データ・大容量（制限なし、CSのみアクセス）
```

**推奨データ配置**:

| データ種類 | 推奨 storage |
|---|---|
| テーマ・言語設定 | `sync` |
| 機能 ON/OFF フラグ | `sync` |
| キャッシュ・スクレイピング結果 | `local` |
| SW 実行状態（チャンク処理のindex等） | `local` |
| 一時的な API レスポンス | `session` |
| 大量の構造化データ（履歴等） | `IndexedDB`（Content Script経由） |

**storage.onChanged で Popup と SW を同期**:
```typescript
// Popup: storage 変更を受け取って UI を更新
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) {
    renderSettings(changes.settings.newValue);
  }
});
```
