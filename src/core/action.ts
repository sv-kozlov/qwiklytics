/**
 * Action - действие для изменения состояния store
 */
export interface Action<P = any> {
    type: string;
    payload: P;
    execute: (payload: P, store?: any) => void;
}

export function createAction<P = void>(
    type: string,
    executor: (payload: P) => void
): Action<P> {
    const action: Action<P> = {
        type,
        payload: undefined as P,
        execute: (payload: P) => {
            action.payload = payload;
            executor(payload);
            // DevTools интеграция
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