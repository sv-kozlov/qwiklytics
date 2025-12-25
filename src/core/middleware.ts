export interface Middleware<T> {
    process: (prevState: T, nextState: T) => T;
    onAction?: (action: any) => void;
}

// Logger middleware
export function createLoggerMiddleware<T>(storeName: string): Middleware<T> {
    return {
        process: (prevState, nextState) => {
            console.group(`Store: ${storeName}`);
            console.log('Previous state:', prevState);
            console.log('Next state:', nextState);
            console.groupEnd();
            return nextState;
        },
        onAction: (action) => {
            console.log(`Action: ${action.type}`, action.payload);
        },
    };
}

// Persist middleware
export function createPersistMiddleware<T>(
    key: string,
    storage: Storage = localStorage
): Middleware<T> {
    // Загружаем начальное состояние
    const saved = storage.getItem(key);
    const initialState = saved ? JSON.parse(saved) : null;

    return {
        process: (prevState, nextState) => {
            // Сохраняем при каждом изменении
            storage.setItem(key, JSON.stringify(nextState));
            return nextState;
        },
    };
}

export function createAnalyticsMiddleware<T>(
    track: (event: string, data: any) => void
): Middleware<T> {
    return {
        onAction: (action) => {
            track('store_action', {
                type: action.type,
                payload: action.payload,
                timestamp: Date.now(),
            });
        },
    };
}