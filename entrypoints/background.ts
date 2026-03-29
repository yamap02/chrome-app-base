export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((detail) => {
    if (detail.reason === 'install') {
      console.log('Extension installed');
    }
  });
});
