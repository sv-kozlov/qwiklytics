/**
 * Конфигурация undo/redo плагина
 */
export interface HistoryPluginConfig {
    /** Максимальное количество записей в истории */
    limit?: number;

    /** Отслеживать только эти action types (если пусто — все) */
    filterActions?: string[];

    /** Игнорировать эти action types */
    excludeActions?: string[];

    /**
     * Дебаунс (мс) для группировки частых обновлений.
     * Полезно, когда state меняется серией быстрых действий.
     */
    debounceTime?: number;

    /**
     * Ключ для сохранения истории в localStorage.
     * Если не задан — история не сохраняется.
     */
    persistKey?: string;
}

/**
 * Запись в истории
 */
export interface HistoryEntry<T> {
    id: string;
    action: string;
    timestamp: number;
    prevState: T;
    nextState: T;
}

/**
 * Состояние истории
 */
export interface HistoryState<T> {
    past: HistoryEntry<T>[];
    present: T | null;
    future: HistoryEntry<T>[];
    isUndoing: boolean;
    isRedoing: boolean;
}

/**
 * Минимальный host-адаптер для плагинов.
 * Реализация может быть поверх core.Store, Qwik-обвязки, или любого другого рантайма.
 */
export interface PluginHost<T extends object> {
    /** Получить текущее состояние */
    getState(): T;

    /**
     * Установить состояние.
     * Важно для undo/redo и восстановления из persist.
     */
    setState(next: T): void;

    /** Подписка на изменения состояния */
    subscribe(listener: (state: T) => void): () => void;

    /**
     * (Опционально) Подписка на события action.
     * Если поддерживается — history будет хранить корректный action type.
     */
    subscribeAction?(
        listener: (ctx: { type: string; payload: unknown }) => void
    ): () => void;
}

/**
 * API истории, которое плагин отдаёт наружу
 */
export interface HistoryAPI<T extends object> {
    undo(): void;
    redo(): void;

    clearHistory(): void;

    canUndo(): boolean;
    canRedo(): boolean;

    getState(): HistoryState<T>;

    /** Для UI: получить последние записи */
    getEntries(options?: { limit?: number }): HistoryEntry<T>[];
}

/**
 * Плагин истории
 */
export interface HistoryPlugin<T extends object> {
    name: 'history';
    init(host: PluginHost<T>): () => void;
    api: HistoryAPI<T>;
}

/** Безопасная генерация id */
function createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isActionAllowed(
    type: string,
    filterActions?: string[],
    excludeActions?: string[]
) {
    if (excludeActions?.includes(type)) return false;
    if (filterActions && filterActions.length > 0) {
        return filterActions.includes(type);
    }
    return true;
}

function getStorage() {
    // SSR-safe
    if (typeof window === 'undefined') return null;
    return window.localStorage;
}

/**
 * Создаёт undo/redo плагин.
 * Важно: плагин не зависит от Qwik и может использоваться в любых обвязках.
 */
export function createHistoryPlugin<T extends object>(
    config: HistoryPluginConfig = {}
): HistoryPlugin<T> {
    const {
        limit = 50,
        filterActions,
        excludeActions,
        debounceTime = 0,
        persistKey,
    } = config;

    let hostRef: PluginHost<T> | null = null;

    let historyState: HistoryState<T> = {
        past: [],
        present: null,
        future: [],
        isUndoing: false,
        isRedoing: false,
    };

    // Последний action type, если host умеет сообщать
    let lastActionType: string | null = null;

    // Debounce-буфер
    let pendingPrev: T | null = null;
    let pendingNext: T | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    function persistHistory() {
        if (!persistKey) return;

        const storage = getStorage();
        if (!storage) return;

        try {
            const data = {
                version: 1,
                // не раздуваем localStorage: сохраняем ограниченно
                past: historyState.past.slice(-10),
                present: historyState.present,
            };

            storage.setItem(persistKey, JSON.stringify(data));
        } catch {
            // не падаем из-за quota / json
        }
    }

    function restoreHistory() {
        if (!persistKey) return;

        const storage = getStorage();
        if (!storage) return;

        try {
            const raw = storage.getItem(persistKey);
            if (!raw) return;

            const parsed = JSON.parse(raw) as {
                version: number;
                past: HistoryEntry<T>[];
                present: T | null;
            };

            if (parsed?.version !== 1) return;

            historyState = {
                past: Array.isArray(parsed.past) ? parsed.past : [],
                present: parsed.present ?? null,
                future: [],
                isUndoing: false,
                isRedoing: false,
            };
        } catch {
            // ignore
        }
    }

    function pushEntry(prevState: T, nextState: T, actionType: string) {
        const entry: HistoryEntry<T> = {
            id: createId(),
            action: actionType,
            timestamp: Date.now(),
            prevState,
            nextState,
        };

        historyState.past = [...historyState.past, entry].slice(-limit);
        historyState.present = nextState;
        historyState.future = [];

        persistHistory();
    }

    function flushDebounce() {
        if (!pendingPrev || !pendingNext) return;

        const actionType = lastActionType ?? '(unknown)';
        if (isActionAllowed(actionType, filterActions, excludeActions)) {
            pushEntry(pendingPrev, pendingNext, actionType);
        }

        pendingPrev = null;
        pendingNext = null;
        debounceTimer = null;
    }

    function scheduleDebounce(prevState: T, nextState: T) {
        pendingPrev = prevState;
        pendingNext = nextState;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(flushDebounce, debounceTime);
    }

    function undo() {
        const host = hostRef;
        if (!host) return;

        const last = historyState.past[historyState.past.length - 1];
        if (!last) return;

        historyState.isUndoing = true;
        historyState.past = historyState.past.slice(0, -1);

        // переносим в future запись, которая описывает переход обратно
        const redoEntry: HistoryEntry<T> = {
            id: createId(),
            action: last.action,
            timestamp: Date.now(),
            prevState: last.prevState,
            nextState: last.nextState,
        };

        historyState.future = [redoEntry, ...historyState.future];
        historyState.present = last.prevState;

        host.setState(last.prevState);

        historyState.isUndoing = false;
        persistHistory();
    }

    function redo() {
        const host = hostRef;
        if (!host) return;

        const next = historyState.future[0];
        if (!next) return;

        historyState.isRedoing = true;
        historyState.future = historyState.future.slice(1);

        const entry: HistoryEntry<T> = {
            id: createId(),
            action: next.action,
            timestamp: Date.now(),
            prevState: next.prevState,
            nextState: next.nextState,
        };

        historyState.past = [...historyState.past, entry].slice(-limit);
        historyState.present = next.nextState;

        host.setState(next.nextState);

        historyState.isRedoing = false;
        persistHistory();
    }

    function clearHistory() {
        historyState = {
            past: [],
            present: hostRef?.getState() ?? historyState.present,
            future: [],
            isUndoing: false,
            isRedoing: false,
        };
        persistHistory();
    }

    function canUndo() {
        return historyState.past.length > 0;
    }

    function canRedo() {
        return historyState.future.length > 0;
    }

    function getEntries(options?: { limit?: number }) {
        const l = options?.limit ?? 20;
        return historyState.past.slice(-l);
    }

    function init(host: PluginHost<T>) {
        hostRef = host;

        // Восстановим историю из storage до первой подписки
        restoreHistory();

        // Инициализируем present, если не было restore
        if (historyState.present === null) {
            historyState.present = host.getState();
        }

        let prevState = host.getState();

        const unsubState = host.subscribe(nextState => {
            // Если это undo/redo — не пишем новые записи истории
            if (historyState.isUndoing || historyState.isRedoing) {
                prevState = nextState;
                return;
            }

            // Если нет subscribeAction — action неизвестен
            const actionType = lastActionType ?? '(unknown)';

            if (debounceTime > 0) {
                scheduleDebounce(prevState, nextState);
            } else if (
                isActionAllowed(actionType, filterActions, excludeActions)
            ) {
                pushEntry(prevState, nextState, actionType);
            }

            prevState = nextState;
            lastActionType = null;
        });

        const unsubAction =
            host.subscribeAction?.(ctx => {
                lastActionType = ctx.type;
            }) ?? null;

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            flushDebounce();
            unsubState();
            unsubAction?.();
            hostRef = null;
        };
    }

    return {
        name: 'history',
        init,
        api: {
            undo,
            redo,
            clearHistory,
            canUndo,
            canRedo,
            getState: () => historyState,
            getEntries,
        },
    };
}
