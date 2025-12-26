// src/devtools/extension.ts

import type { DevToolsDispatchPayload, DevToolsEvent, DevToolsInitMessage } from './index';
import { DEVTOOLS_SOURCE_APP, DEVTOOLS_SOURCE_EXTENSION } from './index';

/**
 * Сообщение от панели в приложение
 */
export type ExtensionHandshakeMessage = {
    source: string;
    type: 'HANDSHAKE';
};

export type ExtensionDispatchMessage = {
    source: string;
    type: 'DISPATCH';
    payload: DevToolsDispatchPayload;
};

export type ExtensionToAppMessage = ExtensionHandshakeMessage | ExtensionDispatchMessage;

/**
 * Сообщение из приложения в панель
 */
export type AppToExtensionMessage =
    | DevToolsInitMessage
    | { source: string; type: 'EVENT'; event: DevToolsEvent };

function isBrowser() {
    return typeof window !== 'undefined' && typeof window.postMessage === 'function';
}

/**
 * Отправить HANDSHAKE в приложение
 */
export function sendHandshake() {
    if (!isBrowser()) return;

    const msg: ExtensionHandshakeMessage = {
        source: DEVTOOLS_SOURCE_EXTENSION,
        type: 'HANDSHAKE',
    };

    window.postMessage(msg, '*');
}

/**
 * Отправить DISPATCH команду в приложение
 */
export function sendDispatch(payload: DevToolsDispatchPayload) {
    if (!isBrowser()) return;

    const msg: ExtensionDispatchMessage = {
        source: DEVTOOLS_SOURCE_EXTENSION,
        type: 'DISPATCH',
        payload,
    };

    window.postMessage(msg, '*');
}

/**
 * Подписка на сообщения из приложения (INIT/EVENT)
 */
export function subscribeAppMessages(
    listener: (msg: AppToExtensionMessage) => void
) {
    if (!isBrowser()) return () => {};

    const handler = (event: MessageEvent) => {
        const data = event.data as any;
        if (!data || data.source !== DEVTOOLS_SOURCE_APP) return;

        if (data.type === 'INIT' || data.type === 'EVENT') {
            listener(data as AppToExtensionMessage);
        }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
}
