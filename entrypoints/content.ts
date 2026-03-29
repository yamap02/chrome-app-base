export default defineContentScript({
  // 対象サイトのURLパターンに変更する
  matches: ['https://*.example.com/*'],
  main() {
    if (import.meta.env.DEV) console.log('Content script running on:', window.location.href);

    // ここに各サイト固有のロジックを実装する
    // 例: const observer = new MutationObserver(...);

    // クリーンアップ関数を返す（拡張機能が無効化・アンロードされた際に呼ばれる）
    return () => {
      // イベントリスナー、Observer、注入した要素などを削除する
      // 例: observer.disconnect();
    };
  },
});
