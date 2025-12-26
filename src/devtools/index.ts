// src/devtools/index.ts

/**
 * DevTools ядро — браузерный мост между приложением и панелью расширения.
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

export type DevToolsInitMessage = {
    source: string;
    type: 'INIT';
    events: DevToolsEvent[];
    plugins: Record<string, unknown>;
};

export type DevToolsEventMessage = {
    source: string;
    type: 'EVENT';
    event: DevToolsEvent;
};

export type DevToolsGlobal = {
    push(
        event: Omit<DevToolsEvent, 'id' | 'timestamp'> & { timestamp?: number }
    ): void;

    subscribe(listener: (event: DevToolsEvent) => void): () => void;

    getEvents(): DevToolsEvent[];

    setPlugins(plugins: Record<string, unknown>): void;
    getPlugins(): Record<string, unknown>;
};

/**
 * Исторически panel.html слушает source === 'qwiklytics-devtools'
 * и пишет в source === 'qwiklytics-devtools-extension' :contentReference[oaicite:2]{index=2}
 */
export const DEVTOOLS_SOURCE_APP = 'qwiklytics-devtools';
export const DEVTOOLS_SOURCE_EXTENSION = 'qwiklytics-devtools-extension';

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
class DevToolsCore {
    private readonly events: DevToolsEvent[] = [];
    private readonly listeners = new Set<(event: DevToolsEvent) => void>();

    private plugins: Record<string, unknown> = {};

    private readonly maxEvents = 500;

    private connected = false;
    private isSetup = false;

    setup() {
        if (!isBrowser() || this.isSetup) return;
        this.isSetup = true;

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

    push(event: Omit<DevToolsEvent, 'id' | 'timestamp'> & { timestamp?: number }) {
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

        if (this.connected && isBrowser()) {
            const msg: DevToolsEventMessage = {
                source: DEVTOOLS_SOURCE_APP,
                type: 'EVENT',
                event: next,
            };
            window.postMessage(msg, '*');
        }
    }

    subscribe(listener: (event: DevToolsEvent) => void) {
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
     * DevTools ↔ plugins:
     * передаём сюда подключённые плагины (например historyPlugin или historyPlugin.api).
     * Панель получит INIT с plugins.
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

        const msg: DevToolsInitMessage = {
            source: DEVTOOLS_SOURCE_APP,
            type: 'INIT',
            events: this.events,
            plugins: this.plugins,
        };

        window.postMessage(msg, '*');
    }

    private handleDispatch(payload: DevToolsDispatchPayload) {
        this.push({ type: 'DEVTOOLS/DISPATCH', payload });

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

const core = new DevToolsCore();

export const devTools: DevToolsGlobal = {
    push(event) {
        core.setup();
        core.push(event);
    },
    subscribe(listener) {
        core.setup();
        return core.subscribe(listener);
    },
    getEvents() {
        core.setup();
        return core.getEvents();
    },
    setPlugins(plugins) {
        core.setup();
        core.setPlugins(plugins);
    },
    getPlugins() {
        core.setup();
        return core.getPlugins();
    },
};

/**
 * Включение devtools и экспорт в window для panel scripts.
 */
export function enableQwiklyticsDevTools() {
    if (!isBrowser()) return devTools;

    core.setup();

    // Экспортируем в window для панелей
    (window as any).__QWIKLYTICS_DEVTOOLS__ = devTools;

    // Пробуем установить связь с панелью/расширением
    window.postMessage({ source: DEVTOOLS_SOURCE_APP, type: 'HANDSHAKE' }, '*');

    return devTools;
}
