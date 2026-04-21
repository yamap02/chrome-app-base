---
name: chrome-extension-performance
description: >
  Chrome拡張機能のパフォーマンスをレビュー・リファクタリングするスキル。
  MV3特有の制約（Service Workerライフサイクル・メッセージパッシングコスト・storage quota・
  Content Scriptの分離コンテキスト）を熟知した上で、ボトルネックを特定し最適化案を提示する。
  「拡張機能が重い」「ページが遅くなった」「Service Workerが落ちる」「メッセージが届かない」
  「メモリが増え続ける」「storageの書き込みが遅い」「パフォーマンスを改善したい」
  などの要求に対して必ずこのスキルを使うこと。
  Content Script・Background Service Worker・Popup・storage の全レイヤーに対応する。
---

# Chrome拡張機能 パフォーマンスリファクタリングスキル

Chrome拡張機能（Manifest V3）特有の制約を踏まえ、
Content Script・Service Worker・Popup・storage の全レイヤーからボトルネックを特定・修正する。

---

## MV3特有の制約（必ず念頭に置くこと）

| 制約 | 内容 | 影響 |
|---|---|---|
| **Service Workerライフサイクル** | 非アクティブ約30秒でSWが終了する | メモリ上の状態は消える。永続化は `chrome.storage` 必須 |
| **メッセージパッシングコスト** | `sendMessage` は非同期でオーバーヘッドあり（数ms〜数十ms） | N+1メッセージは致命的。バッチ化が最重要 |
| **storage.sync の制限** | 容量: 100KB合計 / 1アイテム8KB、書き込み: 1,800ops/hour | 高頻度書き込みはquota超過でエラー |
| **Content Scriptの分離** | ページのJSとは別の実行コンテキスト | DOM操作は可能だがwindow変数は共有不可。通信コスト発生 |
| **setInterval / setTimeout** | Service Worker内では動作が不安定・起動中しか動かない | タイマーは `chrome.alarms` で代替する |
| **DOM操作コスト** | Content ScriptでのDOM操作はページのレンダリングをブロックしうる | 大量・高頻度操作でページ全体が重くなる |
| **MutationObserverのコスト** | 監視対象が広すぎると全DOM変更でコールバックが走る | subtree:true + characterData:true の組み合わせは重い |

---

## 対応モード（ユーザーの意図を判断して選択）

| モード | トリガー例 | 参照ファイル |
|---|---|---|
| **コードレビュー** | 「このコードを見て」「どこが遅いか教えて」 | `references/anti-patterns.md` |
| **リファクタリング提案** | 「書き換えて」「最適化して」「バッチ化して」 | `references/patterns.md` |
| **チェックリスト生成** | 「チェックリストが欲しい」「パフォーマンス一覧を出して」 | `references/checklist.md` |
| **アーキテクチャ相談** | 「設計から見直したい」「構成を教えて」 | `references/architecture.md` |

---

## スキル実行フロー

### Step 1: コンテキスト把握

以下をユーザーの入力から読み取る（不明な場合は質問する）：

- **問題のレイヤー**: Content Script / Service Worker / Popup / storage / メッセージパッシング
- **症状**: ページが重い / メモリ増加 / SWが落ちる / メッセージ遅延 / storage quota超過
- **データ規模**: 監視DOM数・メッセージ頻度・storage書き込み頻度の目安
- **MV3対応済みか**: background service workerを使っているか（MV2との混在確認）
- **コードの提供**: あればレビューモードへ、なければ質問で絞り込む

### Step 2: 適切な参照ファイルを読み込む

モードに応じて `references/` 以下を読み込む。
複数モードにまたがる場合は複数ファイルを読む。

### Step 3: ボトルネック特定 → 修正案提示

以下の優先順位で問題を整理して提示する：

```
🔴 Critical  - ページのフリーズ・SW即時クラッシュ・メモリリーク・quota超過
🟠 High      - 体感できる遅延（>500ms）・N+1メッセージ・状態消失バグ
🟡 Medium    - 改善余地あり（100ms〜500ms）・コード可読性リスク
🟢 Low       - 軽微な最適化・将来的なスケール懸念
```

---

## クイック診断チェック

コードを見たらまずこれを確認する：

### Content Script
- [ ] `MutationObserver` を `subtree: true` かつ広い範囲で監視していないか → **DOM監視過多**
- [ ] DOM操作をループで逐次実行していないか → **DocumentFragment未使用**
- [ ] イベントリスナーを `disconnect()` / `removeEventListener()` でクリーンアップしているか → **メモリリーク**
- [ ] ページ読み込みをブロックする重い初期化を `document_start` でやっていないか → **初期化タイミング**

### Service Worker (background)
- [ ] メモリ上に状態を保持していないか → **SW終了で消える**
- [ ] `setInterval` / `setTimeout` を使っていないか → **`chrome.alarms` を使う**
- [ ] SW起動を維持しようとしていないか → **アンチパターン（設計見直し）**
- [ ] `chrome.storage` の読み書きをループ内でやっていないか → **バッチ化必須**

### メッセージパッシング
- [ ] `sendMessage` をループ内で呼んでいないか → **N+1問題**
- [ ] 頻繁なメッセージ（>10回/秒）に `sendMessage` を使っていないか → **Port接続に切り替え**
- [ ] `chrome.tabs.query` をループ内で呼んでいないか → **バッチ化**

### Storage
- [ ] `storage.sync` に大きなオブジェクトを頻繁に書き込んでいないか → **quota超過**
- [ ] 読み書きを都度単一キーでやっていないか → **バッチ化**
- [ ] 変更のない値を毎回 `set()` していないか → **差分チェック**

---

## 出力スタイルガイドライン

- **コードレビュー**: 問題箇所（Before） → 問題の説明 → 修正コード（After） の順で提示
- **重要度**: 🔴/🟠/🟡/🟢 で明示
- **数値根拠**: 「sendMessage 1回 ≈ 5〜20ms」など具体的なコスト感を添える
- **レイヤー明示**: Content Script / Service Worker / Popup のどこの問題かを必ず明示する
- 日本語で回答、コードはそのまま英語（コメントも英語OK）
- Chrome拡張関連のMDNやChrome Developers URLは必要に応じて末尾に添付
