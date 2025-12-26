// src/devtools/index.ts

/**
 * DevTools слой — браузерный мост между приложением и панелью расширения.
 *
 * Принципы:
 * - никаких зависимостей от Qwik/React
 * - безопасно для SSR (не трогает window при импорте)
 * - единый протокол сообщений через postMessage
 * - devtools ↔ plugins: плагины подключаются явно через setPlugins()
 */

export type DevToolsEvent = {
    id: string;
    type: string;
    timestamp: number;
    payload?: unknown;
};

export type DevToolsDispatchPayload =
    | { type: 'CLEAR' }
    | { type: 'CLEAR_EVENTS' }
    | { type: 'HISTORY_UNDO' }
    | { type: 'HISTORY_REDO' }
    | { type: 'HISTORY_CLEAR' }
    | { type: string; payload?: unknown };

type DevToolsListener = (event: DevToolsEvent) => void;

export type DevToolsGlobal = {
    /** Логировать событие в DevTools */
    push(
        event: Omit<DevToolsEvent, 'id' | 'timestamp'> & { timestamp?: number }
    ): void;

    /** Подписка на события DevTools */
    subscribe(listener: DevToolsListener): () => void;

    /** Экспорт событий для панели */
    getEvents(): DevToolsEvent[];

    /** Подключить плагины (например history/persist) */
    setPlugins(plugins: Record<string, unknown>): void;

    /** Получить подключенные плагины */
    getPlugins(): Record<string, unknown>;
};

/**
 * Исторически panel.html слушает source === 'qwiklytics-devtools'
 * Поэтому используем этот source как "app source".
 */
const DEVTOOLS_SOURCE_APP = 'qwiklytics-devtools';
const DEVTOOLS_SOURCE_EXTENSION = 'qwiklytics-devtools-extension';

/** Простая генерация id без зависимостей */
function createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isBrowser() {
    return typeof window !== 'undefined' && typeof window.postMessage === 'function';
}

type AnyHistoryApi = {
    undo?: () => void;
    redo?: () => void;
    clearHistory?: () => void;
};

function resolveHistoryApi(plugins: Record<string, unknown>): AnyHistoryApi | null {
    const history = (plugins as any).history;
    return (history?.api ?? history) ?? null;
}

/**
 * Синглтон DevTools. Имеет небольшой event-bus и мост в расширение.
 */
class QwiklyticsDevToolsImpl {
    private readonly events: DevToolsEvent[] = [];
    private readonly listeners = new Set<DevToolsListener>();

    private plugins: Record<string, unknown> = {};

    /** Ограничиваем буфер, чтобы не раздувать память */
    private readonly maxEvents = 500;

    private connected = false;
    private isSetup = false;

    setup() {
        if (!isBrowser() || this.isSetup) return;
        this.isSetup = true;

        // Слушаем сообщения от панели расширения
        window.addEventListener('message', event => {
            const data = event.data as any;
            if (!data || data.source !== DEVTOOLS_SOURCE_EXTENSION) return;

            if (data.type === 'HANDSHAKE') {
                this.connected = true;
                this.postInit();
                return;
            }

            if (data.type === 'DISPATCH') {
                this.handleDispatch(data.payload as DevToolsDispatchPayload);
            }
        });
    }

    push(
        event: Omit<DevToolsEvent, 'id' | 'timestamp'> & { timestamp?: number }
    ) {
        const next: DevToolsEvent = {
            id: createId(),
            type: event.type,
            timestamp: event.timestamp ?? Date.now(),
            payload: event.payload,
        };

        this.events.push(next);
        if (this.events.length > this.maxEvents) {
            this.events.splice(0, this.events.length - this.maxEvents);
        }

        this.listeners.forEach(listener => listener(next));

        // Если подключена панель — стримим события
        if (this.connected && isBrowser()) {
            window.postMessage(
                { source: DEVTOOLS_SOURCE_APP, type: 'EVENT', event: next },
                '*'
            );
        }
    }

    subscribe(listener: DevToolsListener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    getEvents() {
        return [...this.events];
    }

    clearEvents() {
        this.events.length = 0;
        this.postInit();
    }

    /**
     * Devtools ↔ plugins:
     * сюда передаются подключённые плагины (например historyPlugin или historyPlugin.api).
     * После установки — панель получит INIT с plugins.
     */
    setPlugins(plugins: Record<string, unknown>) {
        this.plugins = { ...plugins };
        this.postInit();
    }

    getPlugins() {
        return { ...this.plugins };
    }

    /**
     * INIT панели (events + plugins)
     */
    private postInit() {
        if (!this.connected || !isBrowser()) return;

        window.postMessage(
            {
                source: DEVTOOLS_SOURCE_APP,
                type: 'INIT',
                events: this.events,
                plugins: this.plugins,
            },
            '*'
        );
    }

    private handleDispatch(payload: DevToolsDispatchPayload) {
        // Логируем команду панели
        this.push({ type: 'DEVTOOLS/DISPATCH', payload });

        // Backward-compat: CLEAR → CLEAR_EVENTS
        if (payload.type === 'CLEAR' || payload.type === 'CLEAR_EVENTS') {
            this.clearEvents();
            return;
        }

        // Делегируем команды в history API (если подключён)
        const historyApi = resolveHistoryApi(this.plugins);
        if (payload.type === 'HISTORY_UNDO') historyApi?.undo?.();
        if (payload.type === 'HISTORY_REDO') historyApi?.redo?.();
        if (payload.type === 'HISTORY_CLEAR') historyApi?.clearHistory?.();
    }
}

const impl = new QwiklyticsDevToolsImpl();

/**
 * Публичный экспорт: devTools
 */
export const devTools: DevToolsGlobal = {
    push(event) {
        impl.setup();
        impl.push(event);
    },
    subscribe(listener) {
        impl.setup();
        return impl.subscribe(listener);
    },
    getEvents() {
        impl.setup();
        return impl.getEvents();
    },
    setPlugins(plugins) {
        impl.setup();
        impl.setPlugins(plugins);
    },
    getPlugins() {
        impl.setup();
        return impl.getPlugins();
    },
};

/**
 * Включение devtools и экспорт в window для панели.
 */
export function enableQwiklyticsDevTools() {
    if (!isBrowser()) return devTools;

    impl.setup();

    // Экспортируем в window для panel scripts (history-panel и др.)
    (window as any).__QWIKLYTICS_DEVTOOLS__ = devTools;

    // Handshake в сторону расширения (если оно есть)
    window.postMessage(
        { source: DEVTOOLS_SOURCE_APP, type: 'HANDSHAKE' },
        '*'
    );

    return devTools;
}
