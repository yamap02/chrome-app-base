import { logDebug } from "@/utils/logger";
import { getSettings, settingsStorage } from "@/utils/storage";

import { EXTENSION_METADATA } from "@/utils/metadata";

function startContentScript(currentUrl: string): () => void {
  logDebug("Content script attached", { url: currentUrl });

  return () => {
    logDebug("Content script detached", { url: currentUrl });
  };
}

export default defineContentScript({
  matches: [...EXTENSION_METADATA.contentMatches],
  main() {
    let cleanup: (() => void) | undefined;
    let disposed = false;
    const apply = (enabled: boolean) => {
      cleanup?.();
      cleanup = enabled ? startContentScript(window.location.href) : undefined;
    };
    void getSettings().then((settings) => {
      if (!disposed) apply(settings.enabled);
    });
    const unwatch = settingsStorage.watch((settings) => apply(settings.enabled));
    return () => {
      disposed = true;
      unwatch();
      cleanup?.();
      cleanup = undefined;
    };
  },
});
