---
name: frontend-security
description: >
  フロントエンドのセキュリティレビュー・実装支援を行うスキル。XSS・CSP・CSRF・クリックジャッキング・
  CORS・認証トークン管理・サードパーティスクリプトリスク・セキュリティヘッダー・入力バリデーションなど、
  フロントエンド固有のセキュリティ対策を一通り網羅する。
  「セキュリティを強化したい」「XSSの対策を教えて」「コードに脆弱性がないか確認して」
  「CSPを設定したい」「セキュリティチェックリストが欲しい」「脆弱性レビューをして」
  などの要求に対して必ずこのスキルを使うこと。
  TypeScript/React/Next.js/Vue.js/Vite/Webpack など主要フロントエンドスタックに対応。
---

# Frontend Security Skill

フロントエンド固有のセキュリティ脅威を体系的に扱い、コードレビュー・実装ガイド・
チェックリスト生成・修正提案を行うスキル。

---

## 対応モード（ユーザーの意図を判断して選択）

| モード | トリガー例 | 参照ファイル |
|---|---|---|
| **チェックリスト生成** | 「セキュリティ一覧が欲しい」「チェックリストを作って」 | `references/checklist.md` |
| **コードレビュー** | 「このコードに脆弱性がないか」「レビューして」 | `references/vulnerabilities.md` |
| **実装ガイド** | 「XSSを防ぐには」「CSPの設定方法」「実装例を見せて」 | `references/impl-guide.md` |
| **脅威モデリング** | 「どんなリスクがあるか」「脅威を整理して」 | `references/threat-model.md` |

---

## スキル実行フロー

### Step 1: コンテキスト把握
以下をユーザーの入力から読み取る（なければ質問）:
- 使用スタック（React/Vue/Next.js/バニラなど）
- 対象コードまたは対象領域
- バックエンドとのAPI連携方式（REST/GraphQL/tRPC）
- 認証方式（JWT/セッション/OAuth）

### Step 2: 適切な参照ファイルを読み込む
上の表に従って `references/` 以下の必要なファイルを `view` ツールで読み込む。

### Step 3: アウトプット生成
モードに応じたアウトプットを生成する。詳細は各参照ファイルに記載。

---

## セキュリティカテゴリ早見表

以下の12カテゴリを本スキルはカバーする。
詳細は `references/vulnerabilities.md` と `references/impl-guide.md` を参照。

```
1.  XSS (Cross-Site Scripting)
2.  CSP (Content Security Policy)
3.  CSRF (Cross-Site Request Forgery)
4.  クリックジャッキング
5.  CORS 設定ミス
6.  認証・セッション管理（JWT/Cookie）
7.  機密情報の露出（env変数・ソースマップ）
8.  サードパーティスクリプト汚染
9.  入力バリデーション・サニタイズ
10. Dependency の脆弱性（npm audit）
11. セキュリティHTTPヘッダー
12. Subresource Integrity (SRI)
```

---

## 出力スタイルガイドライン

- **コードレビュー**: 問題箇所→リスク説明→修正コード の順で提示
- **実装ガイド**: TypeScript優先、フレームワーク固有の実装例を含める
- **チェックリスト**: 重要度（Critical/High/Medium/Low）を付与
- 日本語で回答、コードはそのまま英語
- OWASP Top 10 との対応を必要に応じて明示
