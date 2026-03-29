export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((detail) => {
    if (detail.reason === 'install') {
      if (import.meta.env.DEV) console.log('Extension installed');
    }
  });
});
