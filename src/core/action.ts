/**
 * Action — описание действия без внутреннего состояния
 */
export interface Action<P = unknown> {
    readonly type: string;
    execute: (payload: P) => void;
}

/**
 * Контекст для middleware
 */
export interface ActionContext<P> {
    type: string;
    payload: P;
}

/**
 * Создание действия для изменения состояния
 * @param type - уникальный тип действия
 * @param executor - функция выполнения действия
 * @param middlewares
 */
export function createAction<P>(
    type: string,
    executor: (payload: P) => void,
    middlewares?: readonly any[]
): Action<P> {
    return {
        type,

        execute(payload: P) {
            const context: ActionContext<P> = { type, payload };

            // Middleware: before action
            middlewares?.forEach(mw => {
                mw.onAction?.(context);
            });

            executor(payload);

            // DevTools
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
}
