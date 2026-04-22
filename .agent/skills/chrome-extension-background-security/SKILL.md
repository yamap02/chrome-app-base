---
name: chrome-extension-background-security
description: >
  Chrome拡張機能のセキュリティレビュー・設計支援を行うスキル。
  Manifest V3 のセキュリティモデル（CSP・host_permissions・web_accessible_resources）、
  Service Worker / background.ts のセキュリティ、メッセージパッシングの検証不足、
  Content Script の XSS・DOM injection リスク、storage の情報漏洩、
  外部fetch の SSRF 的悪用、パーミッション過剰付与、
  externally_connectable・native messaging の攻撃面など
  Chrome拡張機能固有の脅威を体系的に洗い出す。
  「background.tsを見てほしい」「パーミッションの設計を確認して」
  「メッセージパッシングは安全か」「manifest.jsonをレビューして」
  「コンテントスクリプトに脆弱性がないか」「セキュリティチェックをして」
  「拡張機能のセキュリティを強化したい」「脆弱性を探して」
  などの要求に対して必ずこのスキルを使うこと。
---

# Chrome拡張機能 Background Security スキル

Chrome拡張機能（Manifest V3）特有のセキュリティ観点を漏れなく洗い出す。
設計・実装・レビューのいずれでも、実行コンテキスト境界、権限モデル、通信経路、データ境界、外部連携、運用統制を同じ順序で確認する。

## Quick Start

- 依頼が `background.ts` / Service Worker 単体レビューなら、まず次だけを inline で確認する。
  - 受信面: `runtime.onMessage` / `onConnect` の `sender.id` `sender.origin` `sender.url` 検証
  - 入力面: `msg.type` `action` `payload` の schema 検証
  - 外部通信: `fetch` 先 allowlist、`https` 強制、利用者入力 URL の直渡し有無
  - データ保存: `chrome.storage` への秘密情報平文保存有無
  - 実行面: `eval` `new Function` `executeScript` への動的コード投入有無
  - 応答面: stack trace や内部状態の返却有無
- 依頼が `manifest.json` / 権限設計レビューなら、まず次だけを inline で確認する。
  - `permissions` / `host_permissions` の最小権限
  - `web_accessible_resources` の公開面
  - `content_security_policy` の緩和
  - `content_scripts.matches` `run_at` `world`
- 依頼が Content Script / message bridge レビューなら、まず次だけを inline で確認する。
  - `window.postMessage` の `origin` `source` 検証
  - ウェブページ → Content Script → Service Worker の橋渡し有無
  - DOM 注入 API と動的コード実行
- 入力が一部断片だけでも停止しない。見えているコードだけでレビューし、足りない artifact は `前提` に退避する。

## Workflow

1. **実行面を特定する。**
   `background.ts`（Service Worker）、Content Script、Popup、Options Page、`offscreen document`、`side panel` のどれかを先に明示する。

2. **権限境界と攻撃面を確定する。**
   - `manifest.json` の `permissions`・`host_permissions`・`web_accessible_resources` を確認
   - `externally_connectable` の有無と対象 URL パターン
   - `content_scripts` の `matches` 範囲と `run_at` タイミング

3. **最小レビューか包括監査かを判定する。**
   - 単一ファイル / 単一 snippet の軽量レビュー:
     `Quick Start` の inline 観点で先にレビューし、必要なときだけ reference を追加で読む。
   - repo 全体 / 包括監査:
     [references/security-checklist.md](references/security-checklist.md) を読み、該当節に加えて `1. 基本方針` と `9. 可観測性・運用統制` まで通す。
   - 対応節の目安:
     - `background.ts` / Service Worker → `3. Service Worker` `4. メッセージパッシング` `6. Storage` `7. 外部通信`
     - `manifest.json` → `2. Manifest・権限モデル` `8. CSP`
     - Content Script / bridge → `4. メッセージパッシング` `5. Content Script` `8. CSP`

4. **指摘を `事実` `前提` `推定` に分離する。**
   実コードや `manifest.json` から読める内容だけを事実へ置く。

5. **結果を `重大度` `悪用経路` `影響` `推奨対策` 付きで返す。**
   単なるベストプラクティス列挙で終えない。

6. **artifact 不足時の扱いを固定する。**
   - `manifest.json` が無い → 権限境界の未確認事項として `前提` に置く
   - 実装断片しか無い → 断片から確定できる攻撃面だけを `事実` に置く
   - 機能要件不明 → 「不要と断定」ではなく「必要性未確認のため最小権限観点で要再確認」と書く

## Output Contract

- **返答順序固定:**
  1. `実行面`
  2. `事実`
  3. `前提`
  4. `推定`
  5. `指摘一覧`
  6. `最低限やること`
  7. `リリース前にやること`
  8. `運用で補うこと`
- **指摘一覧の各項目に必須:**
  `重大度` `悪用経路` `影響` `推奨対策` `根拠コード/設定`
- **設計レビュー時:**
  権限モデルの問題、通信経路ごとの脅威、欠落制御、追加すべき manifest 設定を列挙する。
- **実装レビュー時:**
  コード上の根拠と不足制御を対応付ける。
- **対策提案時:**
  `最低限やること` `リリース前にやること` `運用で補うこと` に分ける。
- **単一 snippet レビュー時:**
  artifact 不足で未確認の論点は `前提` へ逃がし、見えている範囲の危険信号は必ず列挙する。

## MV3 セキュリティ固有ルール

- `host_permissions` は実際に必要なオリジンのみに絞る。`<all_urls>` や `*://*/*` の正当性を必ず問う。
- `web_accessible_resources` に `matches: ["<all_urls>"]` を使うと任意サイトからリソース存在確認が可能 → フィンガープリント攻撃面になる。
- Service Worker は `fetch` イベントをインターセプトできないが、`chrome.webRequest` の代替として `declarativeNetRequest` を使う設計を確認する。
- `eval()`・`new Function()` はデフォルト CSP で禁止。回避のために `content_security_policy` を緩めていないか確認する。
- `runtime.sendMessage` / `tabs.sendMessage` の送信元検証（`sender.origin` / `sender.id`）を省略しない。
- `externally_connectable` を設定していない場合でも、`window.postMessage` 経由の間接注入に注意する。
- `chrome.storage` はユーザーが DevTools で読み書きできる前提で扱う。秘密情報を平文保存しない。
- Content Script の `innerHTML`・`document.write` 使用は XSS の起点になる。DOM 操作は安全な API（`textContent`・`createElement`）を優先する。

## Reference

網羅チェック本体:
[references/security-checklist.md](references/security-checklist.md)
