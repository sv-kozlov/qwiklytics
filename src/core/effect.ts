/**
 * Асинхронный эффект (stateless)
 * Не хранит внутреннее состояние — безопасен для параллельных вызовов
 */
export interface Effect<P = unknown, R = unknown> {
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

        async execute(payload: P): Promise<R> {
            dispatchDevTools('EFFECT_STARTED', {
                effectType: type,
                payload,
            });

            try {
                const result = await executor(payload);

                dispatchDevTools('EFFECT_COMPLETED', {
                    effectType: type,
                    result,
                });

                return result;
            } catch (error) {
                dispatchDevTools('EFFECT_FAILED', {
                    effectType: type,
                    error: normalizeError(error),
                });

                throw error;
            } finally {
                dispatchDevTools('EFFECT_FINALIZED', {
                    effectType: type,
                });
            }
        },
    };
}

/**
 * Приведение ошибки к безопасному формату
 */
function normalizeError(error: unknown) {
    if (error instanceof Error) {
        return { message: error.message, stack: error.stack };
    }
    return { message: String(error) };
}

/**
 * Безопасная отправка событий в DevTools
 */
function dispatchDevTools(type: string, payload: any) {
    if (typeof window === 'undefined') return;
    const devtools = (window as any).__QWIKLYTICS_DEVTOOLS__;
    devtools?.dispatch({
        type,
        ...payload,
        timestamp: Date.now(),
    });
}
