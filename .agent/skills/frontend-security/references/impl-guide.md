# 実装ガイド

スタック別・テーマ別のセキュリティ実装例。

---

## A. CSP 設定ガイド（スタック別）

### Next.js App Router
```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
}
```

### Vite + React (vite.config.ts)
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",  // devは 'unsafe-eval' 必要な場合あり
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' ws://localhost:*",
      ].join('; '),
    },
  },
});
```

---

## B. 認証トークン管理のベストプラクティス

### パターン比較

| 方式 | XSS耐性 | CSRF耐性 | 推奨度 |
|---|---|---|---|
| localStorage + Bearer | ❌ 盗まれる | ✅ | ❌ 非推奨 |
| sessionStorage + Bearer | ❌ 盗まれる | ✅ | ❌ 非推奨 |
| HttpOnly Cookie | ✅ JSからアクセス不可 | ❌ 別途対策要 | ✅ 推奨 |
| HttpOnly Cookie + CSRF Token | ✅ | ✅ | ✅✅ 最推奨 |

### HttpOnly Cookie + CSRF Token の実装
```ts
// 1. ログイン時: サーバーが Set-Cookie: session=...; HttpOnly; Secure; SameSite=Strict
// 2. CSRF トークンは別途 non-HttpOnly Cookie か API レスポンスで取得
// 3. 状態変更リクエスト時に CSRF トークンをヘッダーに付与

// api/client.ts
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf-token='))
  ?.split('=')[1];

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

---

## C. XSSサニタイズ実装

### React での安全な HTML レンダリング
```ts
// npm install dompurify @types/dompurify
import DOMPurify from 'dompurify';

const DOMPURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  FORBID_SCRIPTS: true,
};

// aタグは必ず noopener noreferrer を強制
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function SafeHtml({ html }: { html: string }) {
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(html, DOMPURIFY_CONFIG),
      }}
    />
  );
}
```

### Marked (Markdown) + DOMPurify
```ts
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false });
  return DOMPurify.sanitize(html as string);
}
```

---

## D. セキュリティヘッダー一括設定

### Next.js next.config.ts
```ts
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

export default {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
```

---

## E. npm audit の CI 統合

### GitHub Actions
```yaml
# .github/workflows/security.yml
name: Security Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm audit --audit-level=high
      # または
      - name: Snyk Test
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

---

## F. 環境変数・秘密情報の管理

### Next.js
```bash
# .env.local （gitignore に含める）
DATABASE_URL=postgres://...           # サーバーのみ（NEXT_PUBLIC_なし）
NEXT_PUBLIC_API_BASE=https://api.ex   # クライアントに公開されるもの

# ❌ これをやらない
NEXT_PUBLIC_SECRET_KEY=sk-prod-xxx   # NEXT_PUBLIC_ は全ユーザーが見える
```

### Vite
```bash
# .env
VITE_API_BASE=https://api.example.com   # 公開OK（バンドルに含まれる）
SECRET=xxx                               # VITE_ なし → Viteはビルドに含めない
                                         # ただしサーバー環境でのみ使用
```

---

## G. Subresource Integrity (SRI) の生成

```bash
# ハッシュ生成コマンド
curl -s https://cdn.example.com/lib.js | \
  openssl dgst -sha384 -binary | \
  openssl base64 -A | \
  awk '{print "sha384-"$0}'
```

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-生成したハッシュ"
  crossorigin="anonymous"
></script>
```

### webpack/Vite でSRIを自動付与
```bash
npm install -D vite-plugin-subresource-integrity
```
```ts
// vite.config.ts
import { VitePluginSubresourceIntegrity } from 'vite-plugin-subresource-integrity';

export default defineConfig({
  plugins: [VitePluginSubresourceIntegrity({ hashAlgorithms: ['sha384'] })],
});
```
