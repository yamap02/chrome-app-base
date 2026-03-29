import type { Settings } from './storage';

/**
 * 拡張機能内で使用するメッセージ型定義
 * popup ↔ background ↔ content script 間の通信に使う
 */
export type ExtensionMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'SETTINGS_UPDATED'; payload: Partial<Settings> }
  | { type: 'PING' };

export type MessageResponse<T extends ExtensionMessage> =
  T extends { type: 'GET_SETTINGS' }
    ? Settings
    : T extends { type: 'PING' }
      ? 'pong'
      : void;

/**
 * background service worker へメッセージを送信する
 */
export async function sendMessage<T extends ExtensionMessage>(
  message: T,
): Promise<MessageResponse<T>> {
  return browser.runtime.sendMessage(message);
}

/**
 * アクティブタブのコンテントスクリプトへメッセージを送信する
 */
export async function sendMessageToActiveTab<T extends ExtensionMessage>(
  message: T,
): Promise<MessageResponse<T> | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return undefined;
  return browser.tabs.sendMessage(tab.id, message);
}

/**
 * メッセージリスナーを登録する（background / content script で使用）
 *
 * @example
 * onMessage((message, sender) => {
 *   if (message.type === 'PING') return 'pong';
 * });
 */
export function onMessage(
  handler: (
    message: ExtensionMessage,
    sender: { tab?: { id?: number; url?: string }; frameId?: number; id?: string; url?: string },
  ) => Promise<unknown> | unknown,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser.runtime.onMessage.addListener(handler as any);
}
