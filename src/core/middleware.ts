/**
 * Middleware для Store
 * Позволяет перехватывать и модифицировать состояние и действия
 */

export interface Middleware<T> {
    /** Обработка изменения состояния */
    process: (prevState: T, nextState: T) => T;
    /** Обработка действий перед их выполнением */
    onAction?: (action: any) => void;
}

/**
 * Logger middleware - логирование всех изменений состояния
 * @param storeName - имя store для идентификации в логах
 */
export function createLoggerMiddleware<T>(storeName: string): Middleware<T> {
    return {
        process: (prevState, nextState) => {
            console.group(`📦 Store: ${storeName}`);
            console.log('⬅️  Previous state:', prevState);
            console.log('➡️  Next state:', nextState);
            console.groupEnd();
            return nextState;
        },
        onAction: (action) => {
            console.log(`🎬 Action: ${action.type}`, action.payload);
        },
    };
}

/**
 * Analytics middleware - отправка событий в систему аналитики
 * @param track - функция отправки событий
 */
export function createAnalyticsMiddleware<T>(
    track: (event: string, data: any) => void
): Middleware<T> {
    return {
        process: (prevState, nextState) => {
            // Не модифицируем состояние, только отслеживаем
            return nextState;
        },
        onAction: (action) => {
            track('store_action', {
                type: action.type,
                payload: action.payload,
                timestamp: Date.now(),
            });
        },
    };
}

/**
 * Validation middleware - валидация состояния перед применением
 * @param validator - функция валидации состояния
 */
export function createValidationMiddleware<T>(
    validator: (state: T) => boolean | string
): Middleware<T> {
    return {
        process: (prevState, nextState) => {
            const result = validator(nextState);

            if (result === false || typeof result === 'string') {
                const errorMessage = typeof result === 'string' ? result : 'Validation failed';
                console.error('❌ State validation failed:', errorMessage);
                console.log('🔄 Reverting to previous state');
                return prevState; // Откатываем к предыдущему состоянию
            }

            return nextState;
        },
    };
}

/**
 * Throttle middleware - ограничение частоты обновлений состояния
 * @param delay - минимальная задержка в миллисекундах между обновлениями
 */
export function createThrottleMiddleware<T>(delay: number): Middleware<T> {
    let lastUpdate = 0;
    let throttleCount = 0;

    return {
        process: (prevState, nextState) => {
            const now = Date.now();

            // Если прошло достаточно времени - применяем обновление
            if (now - lastUpdate >= delay) {
                lastUpdate = now;
                if (throttleCount > 0) {
                    console.debug(`⏱️  Throttled ${throttleCount} updates (${delay}ms)`);
                    throttleCount = 0;
                }
                return nextState;
            }

            // Иначе - игнорируем обновление (throttle)
            throttleCount++;
            return prevState;
        },
    };
}

/**
 * Debounce middleware - отложенное применение изменений состояния
 * Примечание: Данный middleware работает синхронно и не может
 * откладывать обновления асинхронно в текущей архитектуре.
 * Для полноценного debounce требуется асинхронная обработка в Store.
 * @param delay - задержка в миллисекундах перед применением
 */
export function createDebounceMiddleware<T>(delay: number): Middleware<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastUpdate = 0;
    let debounceCount = 0;

    return {
        process: (prevState, nextState) => {
            const now = Date.now();

            // Очищаем предыдущий таймер
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                debounceCount++;
            }

            // Если прошло достаточно времени с последнего обновления
            if (now - lastUpdate >= delay) {
                lastUpdate = now;
                if (debounceCount > 0) {
                    console.debug(`⏳ Debounced ${debounceCount} updates (${delay}ms)`);
                    debounceCount = 0;
                }
                return nextState;
            }

            // Устанавливаем таймер для будущего обновления
            timeoutId = setTimeout(() => {
                lastUpdate = Date.now();
                timeoutId = null;
            }, delay);

            // Возвращаем предыдущее состояние (отложенное не применяется сразу)
            return prevState;
        },
    };
}

/**
 * Freeze middleware - замораживание состояния для предотвращения мутаций
 */
export function createFreezeMiddleware<T>(): Middleware<T> {
    /**
     * Глубокое замораживание объекта
     * @param obj - объект для замораживания
     */
    const deepFreeze = (obj: any): any => {
        // Замораживаем сам объект
        Object.freeze(obj);

        // Рекурсивно замораживаем все свойства
        Object.getOwnPropertyNames(obj).forEach(prop => {
            const value = obj[prop];
            if (value && typeof value === 'object' && !Object.isFrozen(value)) {
                deepFreeze(value);
            }
        });

        return obj;
    };

    return {
        process: (prevState, nextState) => {
            return deepFreeze(nextState);
        },
    };
}

/**
 * Diff middleware - логирование только изменений в состоянии
 * @param storeName - имя store для идентификации в логах
 */
export function createDiffMiddleware<T>(storeName: string): Middleware<T> {
    return {
        process: (prevState, nextState) => {
            // Простое сравнение на верхнем уровне
            const changes: Record<string, { from: any; to: any }> = {};

            const prevKeys = Object.keys(prevState as any);
            const nextKeys = Object.keys(nextState as any);
            const allKeys = new Set([...prevKeys, ...nextKeys]);

            allKeys.forEach(key => {
                const prevValue = (prevState as any)[key];
                const nextValue = (nextState as any)[key];

                if (prevValue !== nextValue) {
                    changes[key] = {from: prevValue, to: nextValue};
                }
            });

            if (Object.keys(changes).length > 0) {
                console.group(`🔍 Store Diff: ${storeName}`);
                console.table(changes);
                console.groupEnd();
            }

            return nextState;
        },
    };
}

/**
 * Performance middleware - измерение производительности обновлений
 * @param storeName - имя store для идентификации в логах
 */
export function createPerformanceMiddleware<T>(storeName: string): Middleware<T> {
    let currentActionType: string | null = null;

    return {
        onAction: (action) => {
            currentActionType = action.type;
            console.time(`⚡ ${currentActionType}`);
        },
        process: (prevState, nextState) => {
            if (currentActionType) {
                console.timeEnd(`⚡ ${currentActionType}`);
                currentActionType = null;
            }
            return nextState;
        },
    };
}