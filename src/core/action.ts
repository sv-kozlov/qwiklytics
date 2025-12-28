/**
 * Action — описание действия без внутреннего состояния
 */
export interface Action<P> {
    readonly type: string;
    execute(payload: P): void;
}

/**
 * Контекст middleware
 */
export interface ActionContext<P> {
    type: string;
    payload: P;
}

/**
 * Создание action
 */
export function createAction<P>(
    type: string,
    executor: (payload: P) => void,
    middlewares: {
        onAction?(ctx: ActionContext<P>): void;
    }[] = []
): Action<P> {
    return {
        type,

        execute(payload) {
            const ctx: ActionContext<P> = { type, payload };

            middlewares.forEach(mw => mw.onAction?.(ctx));
            executor(payload);
        },
    };
}
