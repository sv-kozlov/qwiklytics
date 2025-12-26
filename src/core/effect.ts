/**
 * Асинхронный эффект (stateless).
 * Можно безопасно вызывать параллельно.
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
            dispatchDevTools('EFFECT_STARTED', { effectType: type, payload });

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
                dispatchDevTools('EFFECT_FINALIZED', { effectType: type });
            }
        },
    };
}

/* ================= Utils ================= */

function normalizeError(error: unknown) {
    if (error instanceof Error) {
        return { message: error.message, stack: error.stack };
    }
    return { message: String(error) };
}

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
