# Chrome拡張機能 パフォーマンス チェックリスト

コードレビューや自己点検に使える項目リスト。重要度付き。

---

## 🔴 Critical（まず確認する）

### Content Script
- [ ] **MutationObserver 最小化**: `subtree: true` の監視対象が body 全体になっていない
- [ ] **リスナークリーンアップ**: `removeEventListener` または `AbortController.abort()` で解除している
- [ ] **MutationObserver 解除**: `observer.disconnect()` を `beforeunload` 等で呼んでいる

### Service Worker
- [ ] **状態の永続化**: グローバル変数でなく `chrome.storage` に保存している
- [ ] **alarms 使用**: 定期処理に `setInterval` でなく `chrome.alarms` を使っている
- [ ] **SW起動維持なし**: SW を無理に生かし続けようとしていない（設計を見直す）

### メッセージパッシング
- [ ] **N+1なし**: `sendMessage` / `tabs.sendMessage` をループ内で呼んでいない
- [ ] **エラーハンドリング**: 全 `sendMessage` に `.catch()` または `onDisconnect` がある

---

## 🟠 High（次に確認する）

### Content Script
- [ ] **初期化タイミング**: 重い処理を `document_idle` 以降 または `requestIdleCallback` で実行
- [ ] **DOM操作バッチ**: 大量DOM挿入は `DocumentFragment` を使って1回のappend
- [ ] **debounce/throttle**: scroll・input・mutationコールバックに間引きを入れている

### Service Worker
- [ ] **storage バッチ読み書き**: 複数キーを `get([...keys])` / `set({...})` でまとめている
- [ ] **Promise.all 活用**: 複数タブへの sendMessage を `Promise.all` で並列化
- [ ] **alarms 重複登録なし**: `onInstalled` / `onStartup` で存在チェックしてから登録

### Storage
- [ ] **storage.sync 軽量化**: sync には最小限のキーだけ保存（大きなデータは local）
- [ ] **書き込み debounce**: 高頻度トリガーからの storage.set に 500ms 以上の debounce

---

## 🟡 Medium（余裕があれば確認する）

### Content Script
- [ ] **SPA対応**: URL変化を検知してリスナー・Observerを再セットアップしている
- [ ] **イベント委譲**: 動的生成要素のイベントは親要素に1つバインド
- [ ] **XSS対策**: `innerHTML` に外部データを直接入れていない（`textContent` または `escapeHtml`）

### Service Worker
- [ ] **chrome.tabs.query 最小化**: クエリ条件を絞って必要なタブだけ取得
- [ ] **不要なwakeup なし**: alarm や message で SW を不必要に起動していない
- [ ] **メッセージ型定義**: message の type は文字列リテラルで型が明確

### Popup
- [ ] **必要キーのみ取得**: `chrome.storage.local.get(null)` で全件取得していない
- [ ] **スケルトン表示**: データ取得中に空白ではなくローディング状態を表示
- [ ] **Port 再接続**: SW再起動後の Port 切断に対する再接続処理がある

---

## 🟢 Low（スケールを見据えて）

- [ ] **storage TTL**: キャッシュデータに有効期限フィールドを持たせている
- [ ] **エラーリトライ**: 一時的な通信失敗に対するリトライロジック（exponential backoff）
- [ ] **storage 使用量監視**: `chrome.storage.local.getBytesInUse()` で上限に余裕があるか確認
- [ ] **不要なhost_permissions なし**: `matches` や `host_permissions` を最小限に絞っている
- [ ] **content_script の world**: `ISOLATED` / `MAIN` の選択が意図的である

---

## Service Worker ライフサイクル対策チェックリスト

SWが落ちても動作が壊れない設計になっているか確認する：

| 確認項目 | 対策 |
|---|---|
| グローバル変数に状態を置いていないか | `chrome.storage.local` に永続化 |
| タイマー処理はSW終了後も動くか | `chrome.alarms` に移行 |
| 長時間処理（>30秒）が必要か | Offscreen Document または分割処理を検討 |
| Port接続がSW再起動後に回復するか | `onDisconnect` で再接続ロジックを実装 |
| メッセージハンドラが `return true` しているか | 非同期 `sendResponse` には必須 |

---

## storage quota チェックリスト

| ストレージ | 上限 | 注意点 |
|---|---|---|
| `storage.local` | 10MB（unlimitedPermission で無制限） | 大容量データ向け |
| `storage.sync` | 100KB 合計 / アイテム8KB / 書き込み1,800ops/h | 軽量設定のみ |
| `storage.session` | 10MB / SW終了で消える | 一時キャッシュ向け |

- [ ] `storage.sync` に保存するオブジェクトが 8KB 以内
- [ ] 高頻度書き込み（秒単位）は `storage.sync` ではなく `storage.local` を使用
- [ ] 一時データ（セッションキャッシュ）は `storage.session` を活用

---

## スコアリング目安

| スコア | 状態 | アクション |
|---|---|---|
| Critical 全✅ | 最低限OK | Highの修正を進める |
| Critical に❌あり | 要緊急対応 | まずCriticalを全て修正 |
| High 全✅ | 良好 | Mediumを改善余地として記録 |
| Medium・Low | 任意 | スケールや要件に応じて対応 |
