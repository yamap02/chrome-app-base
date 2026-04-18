export function logDebug(message: string, context?: unknown): void {
  if (!import.meta.env.DEV) {
    return;
  }

  if (context === undefined) {
    console.info(`[extension] ${message}`);
    return;
  }

  console.info(`[extension] ${message}`, context);
}
