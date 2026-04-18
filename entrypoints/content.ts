import { logDebug } from "@/utils/logger";

const CONTENT_SCRIPT_MATCHES = ["https://*.example.com/*"];

function startContentScript(currentUrl: string): () => void {
  logDebug("Content script attached", { url: currentUrl });

  return () => {
    logDebug("Content script detached", { url: currentUrl });
  };
}

export default defineContentScript({
  matches: CONTENT_SCRIPT_MATCHES,
  main() {
    return startContentScript(window.location.href);
  },
});
