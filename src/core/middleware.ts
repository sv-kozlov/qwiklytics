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
            console.group(`Store: ${storeName}`);
            console.log('Previous state:', prevState);
            console.log('Next state:', nextState);
            console.groupEnd();
            return nextState;
        },
        onAction: (action) => {
            console.log(`Action: ${action.type}`, action.payload);
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
        process: (prevState, nextState) => nextState,
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
                console.error('State validation failed:', result);
                return prevState; // Откатываем к предыдущему состоянию
            }

            return nextState;
        },
    };
}

/**
 * Debounce middleware - отложенное применение изменений состояния
 * @param delay - задержка в миллисекундах перед применением
 */
export function createDebounceMiddleware<T>(delay: number): Middleware<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pendingState: T | null = null;
    let listeners: Array<(state: T) => void> = [];

    return {
        process: (prevState, nextState) => {
            // Сохраняем отложенное состояние
            pendingState = nextState;

            // Очищаем предыдущий таймер
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }

            // Устанавливаем новый таймер
            timeoutId = setTimeout(() => {
                if (pendingState !== null) {
                    // Применяем отложенное состояние
                    listeners.forEach(listener => listener(pendingState!));
                    pendingState = null;
                }
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
    return {
        process: (prevState, nextState) => {
            // Глубокое замораживание объекта
            const deepFreeze = (obj: any): any => {
                Object.freeze(obj);

                Object.getOwnPropertyNames(obj).forEach(prop => {
                    const value = obj[prop];
                    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
                        deepFreeze(value);
                    }
                });

                return obj;
            };

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
                    changes[key] = { from: prevValue, to: nextValue };
                }
            });

            if (Object.keys(changes).length > 0) {
                console.group(`Store Diff: ${storeName}`);
                console.log('Changes:', changes);
                console.groupEnd();
            }

            return nextState;
        },
    };
}