/**
 * Action — описание синхронного действия.
 * Не хранит внутреннее состояние.
 */
export interface Action<P = unknown> {
    readonly type: string;
    execute(payload: P): void;
}

/**
 * Контекст, передаваемый в middleware
 */
export interface ActionContext<P = unknown> {
    type: string;
    payload: P;
}

/**
 * Создание action
 */
export function createAction<P>(
    type: string,
    executor: (payload: P) => void,
    middlewares: readonly Middleware<any>[] = []
): Action<P> {
    return {
        type,

        execute(payload: P) {
            const context: ActionContext<P> = { type, payload };

            // Вызываем middleware ДО выполнения reducer
            middlewares.forEach(mw => mw.onAction?.(context));

            executor(payload);

            dispatchDevTools('ACTION_DISPATCHED', {
                actionType: type,
                payload,
            });
        },
    };
}

/* ================= DevTools ================= */

type DevToolsPayload = Record<string, unknown>;

function dispatchDevTools(
    type: string,
    payload: DevToolsPayload = {}
) {
    if (typeof window === 'undefined') return;

    (window as any).__QWIKLYTICS_DEVTOOLS__?.dispatch({
        type,
        ...payload,
        timestamp: Date.now(),
    });
}


/* ================= Types ================= */

import type { Middleware } from './middleware';
