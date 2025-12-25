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
 * Throttle middleware - ограничение частоты обновлений состояния
 * @param delay - задержка в миллисекундах между обновлениями
 */
export function createThrottleMiddleware<T>(delay: number): Middleware<T> {
    let lastUpdate = 0;
    let pendingState: T | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    return {
        process: (prevState, nextState) => {
            const now = Date.now();

            // Если прошло достаточно времени - применяем сразу
            if (now - lastUpdate >= delay) {
                lastUpdate = now;
                return nextState;
            }

            // Иначе - откладываем обновление
            pendingState = nextState;

            if (!timeoutId) {
                timeoutId = setTimeout(() => {
                    lastUpdate = Date.now();
                    timeoutId = null;
                }, delay - (now - lastUpdate));
            }

            return prevState;
        },
    };
}