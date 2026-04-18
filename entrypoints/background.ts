import { logDebug } from "@/utils/logger";

type InstalledListener = Parameters<typeof browser.runtime.onInstalled.addListener>[0];
type InstalledDetails = Parameters<InstalledListener>[0];

function handleInstalled(details: InstalledDetails): void {
  if (details.reason !== "install") {
    return;
  }

  logDebug("Extension installed");
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(handleInstalled);
});
