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

## Workflow

1. **実行面を特定する。**
   `background.ts`（Service Worker）、Content Script、Popup、Options Page、`offscreen document`、`side panel` のどれかを先に明示する。

2. **権限境界と攻撃面を確定する。**
   - `manifest.json` の `permissions`・`host_permissions`・`web_accessible_resources` を確認
   - `externally_connectable` の有無と対象 URL パターン
   - `content_scripts` の `matches` 範囲と `run_at` タイミング

3. [references/security-checklist.md](references/security-checklist.md) を読み、該当節だけでなく `1. 基本方針` と `9. 可観測性・運用統制` まで通す。

4. **指摘を `事実` `前提` `推定` に分離する。**
   実コードや `manifest.json` から読める内容だけを事実へ置く。

5. **結果を `重大度` `悪用経路` `影響` `推奨対策` 付きで返す。**
   単なるベストプラクティス列挙で終えない。

## Output Contract

- **設計レビュー時:**
  権限モデルの問題、通信経路ごとの脅威、欠落制御、追加すべき manifest 設定を列挙する。
- **実装レビュー時:**
  コード上の根拠と不足制御を対応付ける。
- **対策提案時:**
  `最低限やること` `リリース前にやること` `運用で補うこと` に分ける。

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
