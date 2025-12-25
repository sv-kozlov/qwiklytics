export interface Action<P = any> {
    type: string;
    payload: P;
    execute: (payload: P, store?: any) => void;
}

export function createAction<P = void>(
    type: string,
    executor: (payload: P) => void,
    store?: any // Опциональный store для middleware
): Action<P> {
    const action: Action<P> = {
        type,
        payload: undefined as P,
        execute: (payload: P, currentStore?: any) => {
            action.payload = payload;

            // Вызываем onAction у middleware перед выполнением
            if (currentStore?.middlewares) {
                currentStore.middlewares.forEach((middleware: any) => {
                    if (middleware.onAction) {
                        middleware.onAction({type, payload});
                    }
                });
            }

            executor(payload);

            // DevTools
            if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_DEVTOOLS__) {
                (window as any).__QWIKLYTICS_DEVTOOLS__.dispatch({
                    type: 'ACTION_DISPATCHED',
                    action: type,
                    payload,
                    timestamp: Date.now(),
                });
            }
        },
    };

    return action;
}