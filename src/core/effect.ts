/**
 * Асинхронный эффект (stateless)
 */
export interface Effect<P, R> {
    readonly type: string;
    execute(payload: P): Promise<R>;
}

/**
 * Создание эффекта
 */
export function createEffect<P, R>(
    type: string,
    executor: (payload: P) => Promise<R>
): Effect<P, R> {
    return {
        type,
        execute: executor,
    };
}
