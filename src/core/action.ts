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

            // Определяем какой store использовать (приоритет currentStore)
            const targetStore = currentStore || store;

            // Вызываем onAction у middleware перед выполнением действия
            if (targetStore?.middlewares) {
                targetStore.middlewares.forEach((middleware: any) => {
                    if (middleware.onAction) {
                        middleware.onAction({type, payload});
                    }
                });
            }

            // Выполняем основное действие
            executor(payload, targetStore);

            // DevTools интеграция - отправка события
            if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_DEVTOOLS__) {
                (window as any).__QWIKLYTICS_DEVTOOLS__.dispatch({
                    type: 'ACTION_DISPATCHED',
                    actionType: type,
                    payload,
                    timestamp: Date.now(),
                });
            }
        },
    };

    return action;
}