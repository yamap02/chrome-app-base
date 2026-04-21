# manifest.json セキュリティレビュー

## 対象

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",
  "permissions": ["tabs", "storage", "cookies", "history", "nativeMessaging"],
  "host_permissions": ["<all_urls>"],
  "web_accessible_resources": [
    {
      "resources": ["*.js", "*.css", "*.html"],
      "matches": ["<all_urls>"]
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'unsafe-eval'; object-src 'self'"
  }
}
```

---

## 指摘事項

### [CRITICAL] `'unsafe-eval'` の使用

**箇所:** `content_security_policy.extension_pages`

`script-src` に `'unsafe-eval'` を許可している。これにより `eval()`、`new Function()`、`setTimeout(string)` 等の動的コード実行が可能になる。

- XSS や prototype pollution が発生した場合、任意コード実行に直結する
- Chrome Web Store では `'unsafe-eval'` を含む拡張機能は審査拒否または削除対象になる（[Chrome Web Store policy](https://developer.chrome.com/docs/webstore/program-policies/)) 
- MV3 では `'unsafe-eval'` はデフォルトで禁止されており、意図的に緩めている点が問題

**対処:** 動的評価が必要な処理は静的に書き直す。どうしても必要な場合は Offscreen Document 等で分離し、最小スコープに限定する。

---

### [HIGH] `host_permissions: ["<all_urls>"]`

**箇所:** `host_permissions`

全ドメインへのアクセス権を要求している。

- ユーザーの閲覧するすべてのページに対してリクエスト送信・レスポンス傍受が可能になる
- インストール時に「すべてのウェブサイトのデータの読み取りと変更」という警告が表示され、ユーザーの信頼を著しく損なう
- 侵害された場合の影響範囲が最大になる

**対処:** 実際に必要なドメインのみに絞る（例: `"https://example.com/*"`）。

---

### [HIGH] `web_accessible_resources` のスコープが広すぎる

**箇所:** `web_accessible_resources`

`resources: ["*.js", "*.css", "*.html"]` かつ `matches: ["<all_urls>"]` の組み合わせにより、拡張機能内のすべてのスクリプト・スタイル・HTMLファイルを任意の外部ページから参照可能にしている。

- 拡張機能内部のロジックやリソースパスが外部に露出する
- 悪意あるページが `chrome-extension://` スキームで拡張リソースを読み込み、フィンガープリントや情報収集に利用できる
- `*.js` を公開することで内部実装が逆解析されやすくなる

**対処:**
- `resources` は実際に外部ページから参照が必要なファイルのみを列挙する
- `matches` は必要なドメインに限定する

---

### [HIGH] `nativeMessaging` パーミッション

**箇所:** `permissions`

Native Messaging Host との通信を許可するパーミッション。

- ローカルホスト上のネイティブアプリケーションとの双方向通信が可能になる
- 拡張機能が侵害された場合、ローカルファイルシステムやシステムコマンドへのアクセス経路になりうる
- 拡張機能本体にこの機能が必要かどうかが manifest から判断できず、攻撃対象面を不必要に拡大している

**対処:** Native Messaging を実際に使用しない場合は削除する。使用する場合はホスト側のホワイトリスト設定を厳密に行う。

---

### [MEDIUM] `cookies` パーミッション

**箇所:** `permissions`

全サイト（`host_permissions: <all_urls>` と組み合わさることで）のCookieの読み書きが可能になる。

- セッショントークンや認証Cookieの読み取りが可能
- `httpOnly` フラグのないCookieについては、コンテンツスクリプトからも間接的にアクセスされうる

**対処:** Cookie操作が必要な場合も、対象ドメインを `host_permissions` で最小化することで影響範囲を限定する。

---

### [MEDIUM] `history` パーミッション

**箇所:** `permissions`

ユーザーのブラウジング履歴全体の読み書きが可能になる。

- プライバシー上のリスクが高く、ユーザーの行動パターンを把握・改ざんできる
- Chrome Web Store の審査でも「センシティブなパーミッション」として扱われ、説明が求められる

**対処:** 機能上不要であれば削除する。必要な場合は利用目的をプライバシーポリシーに明記する。

---

### [MEDIUM] `tabs` パーミッション

**箇所:** `permissions`

`tabs` パーミッションにより、全タブのURL・タイトル・faviconの読み取りが可能になる（`activeTab` では不十分な場合に使用される）。

- ユーザーの閲覧しているURLが全タブ分取得可能となり、プライバシー侵害につながる

**対処:** 現在アクティブなタブのみで十分な場合は `activeTab` に置き換える。

---

## 総評

| 深刻度 | 件数 |
|--------|------|
| CRITICAL | 1 |
| HIGH | 3 |
| MEDIUM | 3 |

この manifest は最小権限の原則（Principle of Least Privilege）に大きく反している。特に `'unsafe-eval'` + `<all_urls>` + `nativeMessaging` の組み合わせは、侵害時の影響が最大級になる構成であり、本番リリース前に全項目の修正が必要。
