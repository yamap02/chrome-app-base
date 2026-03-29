export default defineContentScript({
  // 対象サイトのURLパターンに変更する
  matches: ['https://*.example.com/*'],
  main() {
    if (import.meta.env.DEV) console.log('Content script running on:', window.location.href);
    // ここに各サイト固有のロジックを実装する
  },
});
