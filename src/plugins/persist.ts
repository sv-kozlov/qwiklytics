/**
 * Конфиг persist плагина
 */
export interface PersistConfig<T extends object> {
    /** Ключ для storage */
    key: string;

    /** Storage (по умолчанию localStorage на клиенте) */
    storage?: Storage | null;

    /** Белый список ключей состояния для сохранения */
    whitelist?: Array<keyof T>;

    /** Чёрный список ключей состояния для исключения */
    blacklist?: Array<keyof T>;

    /** Миграция старого формата */
    migrate?: (oldState: unknown) => T;

    /** Версия сохранённого состояния */
    version?: number;
}

export interface PluginHost<T extends object> {
    getState(): T;
    setState(next: T): void;
    subscribe(listener: (state: T) => void): () => void;
}

/**
 * Persist плагин
 */
export interface PersistPlugin<T extends object> {
    name: 'persist';
    init(host: PluginHost<T>): () => void;
}

/** SSR-safe storage */
function resolveStorage(storage?: Storage | null) {
    if (storage) return storage;
    if (typeof window === 'undefined') return null;
    return window.localStorage;
}

function pickKeys<T extends object>(
    state: T,
    whitelist?: Array<keyof T>,
    blacklist?: Array<keyof T>
) {
    const result: Partial<T> = {};

    const keys = whitelist ?? (Object.keys(state) as Array<keyof T>);
    keys.forEach(key => {
        if (blacklist?.includes(key)) return;
        result[key] = state[key];
    });

    return result as T;
}

/**
 * Создаёт persist плагин.
 * Важно: плагин не зависит от Qwik и может использоваться в любых обвязках.
 */
export function createPersistPlugin<T extends object>(
    config: PersistConfig<T>
): PersistPlugin<T> {
    const storage = resolveStorage(config.storage);
    const version = config.version ?? 1;

    function load(): T | null {
        if (!storage) return null;

        try {
            const raw = storage.getItem(config.key);
            if (!raw) return null;

            const parsed = JSON.parse(raw) as {
                _version?: number;
                _timestamp?: number;
                state?: unknown;
            };

            const rawState =
                parsed && typeof parsed === 'object' && 'state' in parsed
                    ? (parsed as any).state
                    : parsed;

            if (config.migrate) {
                return config.migrate(rawState);
            }

            return rawState as T;
        } catch {
            return null;
        }
    }

    function save(state: T) {
        if (!storage) return;

        try {
            const filtered = pickKeys(state, config.whitelist, config.blacklist);

            const payload = {
                _version: version,
                _timestamp: Date.now(),
                state: filtered,
            };

            storage.setItem(config.key, JSON.stringify(payload));
        } catch {
            // ignore quota/json errors
        }
    }

    function init(host: PluginHost<T>) {
        // hydrate
        const restored = load();
        if (restored) {
            host.setState(restored);
        }

        // subscribe → persist
        const unsubscribe = host.subscribe(next => {
            save(next);
        });

        return () => {
            unsubscribe();
        };
    }

    return {
        name: 'persist',
        init,
    };
}
