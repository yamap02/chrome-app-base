# フロントエンド セキュリティチェックリスト

重要度: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low

---

## XSS 対策

- 🔴 `innerHTML`, `document.write`, `eval` を使っていない
- 🔴 React の `dangerouslySetInnerHTML` を使う場合は DOMPurify でサニタイズ済み
- 🔴 URLパラメータを `location.href` などに直接セットしていない（javascript:スキーム防止）
- 🟠 Markdown レンダリング時に DOMPurify を通している
- 🟠 `<a target="_blank">` には `rel="noopener noreferrer"` が付いている
- 🟡 `postMessage` のリスナーで `event.origin` を検証している

## CSP (Content Security Policy)

- 🔴 CSP ヘッダーが全ページに設定されている
- 🔴 `unsafe-inline` を script-src に使っていない（nonce方式を採用）
- 🔴 `unsafe-eval` を本番環境で使っていない
- 🟠 `frame-ancestors 'none'` または `X-Frame-Options: DENY` が設定されている
- 🟠 `base-uri 'self'` が設定されている（base injection防止）
- 🟡 CSP レポートエンドポイント（`report-uri` / `report-to`）が設定されている

## CSRF 対策

- 🔴 Cookie認証を使う場合、状態変更リクエストにCSRFトークンを付与している
- 🟠 セッションCookieに `SameSite=Strict` または `SameSite=Lax` が設定されている
- 🟠 `SameSite=Strict` + カスタムリクエストヘッダー（X-Requested-Withなど）を組み合わせている

## 認証・セッション管理

- 🔴 JWTを localStorage に保存していない（HttpOnly Cookie を使用）
- 🔴 セッションCookieに `Secure` フラグが付いている（HTTPS強制）
- 🔴 セッションCookieに `HttpOnly` フラグが付いている（XSSで盗まれない）
- 🟠 ログアウト時にサーバー側でセッションを無効化している
- 🟠 JWTの有効期限が適切（`exp` クレームが設定されている）
- 🟡 refresh token のローテーション（使用済みトークンを無効化）を実装している

## 機密情報の管理

- 🔴 APIシークレット・秘密鍵がバンドル（クライアントJS）に含まれていない
- 🔴 `.env` ファイルが `.gitignore` に含まれている
- 🟠 本番ビルドでソースマップが公開されていない
- 🟠 エラーメッセージにスタックトレースや内部情報が含まれていない
- 🟡 `console.log` でセンシティブな情報を出力していない（本番）

## セキュリティHTTPヘッダー

- 🔴 `Strict-Transport-Security` (HSTS) が設定されている
- 🟠 `X-Content-Type-Options: nosniff` が設定されている
- 🟠 `X-Frame-Options: DENY` または CSP の `frame-ancestors 'none'`
- 🟠 `Referrer-Policy: strict-origin-when-cross-origin` が設定されている
- 🟡 `Permissions-Policy` で不要なブラウザAPIを無効化している

## CORS

- 🔴 `Access-Control-Allow-Origin: *` と `credentials: true` を同時に設定していない
- 🟠 CORS許可オリジンが必要最小限のドメインのみ
- 🟡 プリフライトリクエスト（OPTIONS）が適切に処理されている

## サードパーティリソース

- 🟠 CDN から読み込むスクリプト・スタイルに SRI ハッシュが付いている
- 🟠 CSP でサードパーティのドメインを明示的に許可している（ワイルドカード不使用）
- 🟡 不要なサードパーティスクリプトを削除・最小化している

## 入力バリデーション

- 🔴 すべてのフォーム入力をサーバー側でバリデーションしている
- 🟠 フロントでも Zod / Valibot などでスキーマバリデーションしている
- 🟠 ファイルアップロード時に MIMEタイプ・サイズ・拡張子を検証している
- 🟡 数値・日付など型のある入力に対して型強制（型変換後バリデーション）をしている

## Dependency 管理

- 🟠 CI で `npm audit --audit-level=high` を実行している
- 🟠 Dependabot / Renovate が有効になっている
- 🟡 `npm outdated` を定期的に確認している
- 🟡 不要な依存パッケージを削除している

## その他

- 🟠 `<a target="_blank" href="外部URL">` すべてに `rel="noopener noreferrer"` がある
- 🟡 Clickjacking に対して frame-busting スクリプトではなく HTTPヘッダーで対策している
- 🟡 WebSocket の接続先 URL を動的に組み立てていない（`wss://` 固定）
- 🟡 `localStorage` / `sessionStorage` に機密情報を保存していない

---

## チェックリスト利用時のガイド

**コードレビュー用途**: 各項目を一覧として提示し、該当するリスクの箇所をコード内でピンポイントに指摘する。

**プロジェクト初期セットアップ用途**: Critical → High の順に対応。Medium・Low は時間に余裕があるときに。

**フレームワーク別の注意点**:
- **Next.js**: ミドルウェアでのCSP設定、`NEXT_PUBLIC_` の使い分けに特に注意
- **Vite**: 本番ソースマップ設定、`VITE_` プレフィックスの扱い
- **Vue.js**: `v-html` ディレクティブが `dangerouslySetInnerHTML` と同等のリスク
- **Angular**: DomSanitizer を正しく使っているか、`bypassSecurityTrustHtml` の乱用に注意
