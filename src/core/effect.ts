/**
 * Effect - асинхронное действие с побочными эффектами
 */
export interface Effect<P = any, R = any> {
    type: string;
    execute: (payload: P) => Promise<R>;
    status: 'idle' | 'pending' | 'success' | 'error';
    error?: Error | string;
}

/**
 * Создание эффекта с автоматическим отслеживанием статуса
 * @param type - уникальный тип эффекта
 * @param executor - асинхронная функция выполнения
 */
export function createEffect<P = void, R = any>(
    type: string,
    executor: (payload: P) => Promise<R>
): Effect<P, R> {
    const effect: Effect<P, R> = {
        type,
        status: 'idle',
        error: undefined,
        execute: async (payload: P) => {
            effect.status = 'pending';
            effect.error = undefined;

            // DevTools интеграция - начало выполнения эффекта
            if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_DEVTOOLS__) {
                (window as any).__QWIKLYTICS_DEVTOOLS__.dispatch({
                    type: 'EFFECT_STARTED',
                    effectType: type,
                    payload,
                    timestamp: Date.now(),
                });
            }

            try {
                const result = await executor(payload);
                effect.status = 'success';

                // DevTools интеграция - успешное завершение эффекта
                if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_DEVTOOLS__) {
                    (window as any).__QWIKLYTICS_DEVTOOLS__.dispatch({
                        type: 'EFFECT_COMPLETED',
                        effectType: type,
                        result,
                        timestamp: Date.now(),
                    });
                }

                return result;
            } catch (error) {
                effect.status = 'error';
                effect.error = error instanceof Error ? error : String(error);

                // DevTools интеграция - ошибка выполнения эффекта
                if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_DEVTOOLS__) {
                    (window as any).__QWIKLYTICS_DEVTOOLS__.dispatch({
                        type: 'EFFECT_FAILED',
                        effectType: type,
                        error: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                        timestamp: Date.now(),
                    });
                }

                throw error;
            } finally {
                // Финальные действия после выполнения эффекта
                if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_DEVTOOLS__) {
                    (window as any).__QWIKLYTICS_DEVTOOLS__.dispatch({
                        type: 'EFFECT_FINALIZED',
                        effectType: type,
                        status: effect.status,
                        timestamp: Date.now(),
                    });
                }
            }
        },
    };

    return effect;
}