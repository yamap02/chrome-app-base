# 脆弱性カタログ

コードレビュー時に照合するパターン集。各カテゴリで「危険なコード」→「安全なコード」を示す。

---

## 1. XSS (Cross-Site Scripting)

### 1-1. DOM-based XSS

```ts
// ❌ 危険: 未サニタイズの文字列をDOMに挿入
element.innerHTML = userInput;
document.write(location.hash);
eval(userInput);

// ✅ 安全
element.textContent = userInput;          // テキストとして扱う
element.setAttribute('data-val', userInput); // 属性にはsetAttribute

// ✅ Reactは自動エスケープ（ただし dangerouslySetInnerHTML は危険）
// ❌
<div dangerouslySetInnerHTML={{ __html: userInput }} />
// ✅ HTMLを挿入する場合は DOMPurify でサニタイズ後に使う
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

### 1-2. Stored XSS
- サーバーから取得したデータをそのままDOMに流し込む場合も同様
- Markdown レンダラは `marked` + `DOMPurify` を組み合わせる

### 1-3. URL-based XSS
```ts
// ❌ 危険: location.href や URLSearchParams の値を直接使う
const redirect = new URLSearchParams(location.search).get('redirect');
location.href = redirect; // javascript: スキームで実行される可能性

// ✅ 安全: URLスキームを検証する
function safeRedirect(url: string): void {
  try {
    const parsed = new URL(url, location.origin);
    if (parsed.origin !== location.origin) return; // 外部ドメインは拒否
    location.href = parsed.href;
  } catch {
    // 無効なURL
  }
}
```

---

## 2. CSP (Content Security Policy)

### よくあるミス

```
# ❌ 危険なディレクティブ
Content-Security-Policy: script-src 'unsafe-inline' 'unsafe-eval' *

# ✅ 推奨ベースライン
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM}';
  style-src 'self' 'nonce-{RANDOM}';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

### nonce ベースの実装（Next.js）
```ts
// middleware.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export function middleware(request: Request) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const csp = `script-src 'self' 'nonce-${nonce}'; ...`;
  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce); // サーバーコンポーネントに渡す
  return response;
}
```

---

## 3. CSRF

### 脆弱なパターン
```ts
// ❌ クッキー認証のAPIにCSRF対策なし
fetch('/api/transfer', { method: 'POST', body: JSON.stringify({ amount: 1000 }) });
```

### 対策
```ts
// ✅ Double Submit Cookie パターン
const csrfToken = getCookie('csrf-token');
fetch('/api/transfer', {
  method: 'POST',
  headers: { 'X-CSRF-Token': csrfToken },
  body: JSON.stringify({ amount: 1000 }),
});

// ✅ SameSite Cookie (サーバー側設定) + フロントはカスタムヘッダー必須にする
// Set-Cookie: session=...; SameSite=Strict; Secure; HttpOnly
```

---

## 4. クリックジャッキング

```
# ❌ X-Frame-Options 未設定 → iframe に埋め込まれてクリックジャッキング可能

# ✅ HTTPヘッダーで設定
X-Frame-Options: DENY
# または CSP で
Content-Security-Policy: frame-ancestors 'none';
```

---

## 5. CORS 設定ミス

```ts
// ❌ ワイルドカードで認証情報も許可（実際にはブラウザが拒否するが設定ミスの典型）
// Access-Control-Allow-Origin: *
// Access-Control-Allow-Credentials: true  ← これは同時に使えない

// ✅ フロントからのリクエスト設定
fetch('https://api.example.com/data', {
  credentials: 'include', // Cookieを送る場合
});
// サーバー側: Access-Control-Allow-Origin: https://app.example.com (明示的に指定)
```

---

## 6. 認証・セッション管理

### JWT の危険な保存場所
```ts
// ❌ localStorage にJWTを保存 → XSSで盗まれる
localStorage.setItem('token', jwt);

// ✅ HttpOnly Cookie にサーバーが保存する（JSからアクセス不可）
// フロントは credentials: 'include' で送るだけ
```

### JWT 検証漏れ
```ts
// ❌ ペイロードをデコードするだけで署名検証していない
const payload = JSON.parse(atob(token.split('.')[1]));

// ✅ サーバーで必ず検証（フロントでは信頼しない）
// フロントでのデコードは表示目的のみ、権限チェックはサーバーに委ねる
```

---

## 7. 機密情報の露出

```ts
// ❌ クライアント側に秘密情報を埋め込む
const SECRET_KEY = 'sk-prod-xxxxx'; // ソースマップ・バンドルから丸見え

// ✅ Next.js の場合
// NEXT_PUBLIC_ のみがクライアントに公開される
// サーバーサイドのみで使う変数は NEXT_PUBLIC_ を付けない
```

### ソースマップ
```js
// ❌ 本番でソースマップを公開
// webpack.config.js
devtool: 'source-map' // 本番でこれは危険

// ✅
devtool: process.env.NODE_ENV === 'production' ? false : 'source-map'
```

---

## 8. サードパーティスクリプト

```html
<!-- ❌ SRI (Subresource Integrity) なし -->
<script src="https://cdn.example.com/lib.js"></script>

<!-- ✅ SRI ハッシュ付き -->
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-xxxx"
  crossorigin="anonymous"
></script>
```

```ts
// ❌ 動的にサードパーティスクリプトを追加（広告タグなど）
const s = document.createElement('script');
s.src = untrustedUrl; // CSPで制御されていなければ任意のコードが実行される
document.head.appendChild(s);

// ✅ CSP で許可ドメインを明示的にホワイトリスト化
```

---

## 9. 入力バリデーション

```ts
// ❌ フロントのみバリデーション（バイパス可能）
if (input.length < 100) submitForm();

// ✅ フロント + サーバー両方でバリデーション（フロントはUX目的）
// フロントはzodなどでスキーマ検証
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
});

const result = schema.safeParse(formData);
if (!result.success) showErrors(result.error);
```

---

## 10. Dependency の脆弱性

```bash
# 定期的に実施
npm audit
npm audit fix

# CI に組み込む（重大度 high 以上でビルド失敗）
npm audit --audit-level=high

# Dependabot や Renovate で自動PR
```

---

## 11. セキュリティHTTPヘッダー

| ヘッダー | 推奨値 | 効果 |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS強制 |
| `X-Content-Type-Options` | `nosniff` | MIMEスニッフィング防止 |
| `X-Frame-Options` | `DENY` | クリックジャッキング防止 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | リファラー漏洩防止 |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | 不要なAPI無効化 |
| `Content-Security-Policy` | *(別途設計)* | XSS・インジェクション全般 |

---

## 12. postMessage のセキュリティ

```ts
// ❌ origin を検証しない
window.addEventListener('message', (event) => {
  eval(event.data); // 任意のオリジンから実行可能
});

// ✅ origin を厳密に検証
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://trusted.example.com') return;
  // 安全な処理
});
```
