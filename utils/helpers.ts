/**
 * ユーティリティ関数
 * 拡張機能固有のヘルパー関数をここに追加する
 */

/**
 * 指定したURLがパターンにマッチするか確認する
 * ワイルドカード (*) を使ったシンプルなパターンマッチング
 *
 * @example
 * matchesPattern('https://example.com/foo', 'https://example.com/*') // true
 * matchesPattern('https://other.com/', 'https://example.com/*')      // false
 */
export function matchesPattern(url: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$');
  return regex.test(url);
}
