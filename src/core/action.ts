/**
 * Action - действие для изменения состояния store
 */
export interface Action<P = any> {
    type: string;
    payload: P;
    execute: (payload: P, store?: any) => void;
}

/**
 * Создание действия для изменения состояния
 * @param type - уникальный тип действия
 * @param executor - функция выполнения действия
 * @param store - опциональный store для middleware
 */
export function createAction<P = void>(
    type: string,
    executor: (payload: P, store?: any) => void,
    store?: any
): Action<P> {
    const action: Action<P> = {
        type,
        payload: undefined as P,
        execute: (payload: P, currentStore?: any) => {
            action.payload = payload;

            // Определяем какой store использовать
            const targetStore = currentStore || store;

            // Вызываем onAction у middleware перед выполнением
            // Защита от дублирования: middleware вызываются только если action вызван напрямую
            if (targetStore?.middlewares && !currentStore) {
                for (const middleware of targetStore.middlewares) {
                    if (middleware.onAction) {
                        middleware.onAction({type, payload});
                    }
                }
            }

            // Выполняем действие
            executor(payload, targetStore);

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