/**
 * Контекст middleware
 */
export interface MiddlewareContext<P = unknown> {
    type: string;
    payload: P;
}

/**
 * Middleware Store
 */
export interface Middleware<T> {
    /** Перехват действия */
    onAction?<P>(action: MiddlewareContext<P>): void;

    /** Обработка изменения состояния */
    process?(prevState: T, nextState: T): T;
}

/**
 * Logger middleware
 */
export function createLoggerMiddleware<T>(storeName: string): Middleware<T> {
    return {
        onAction(action) {
            console.log(`🎬 [${storeName}] Action:`, action.type, action.payload);
        },
        process(prev, next) {
            console.group(`📦 Store: ${storeName}`);
            console.log('Prev:', prev);
            console.log('Next:', next);
            console.groupEnd();
            return next;
        },
    };
}

/**
 * Analytics middleware
 */
export function createAnalyticsMiddleware<T>(
    track: (event: string, data: unknown) => void
): Middleware<T> {
    return {
        onAction(action) {
            track('store_action', {
                type: action.type,
                payload: action.payload,
                timestamp: Date.now(),
            });
        },
    };
}

/**
 * Validation middleware
 */
export function createValidationMiddleware<T>(
    validator: (state: T) => boolean | string
): Middleware<T> {
    return {
        process(prev, next) {
            const result = validator(next);
            if (result !== true) {
                console.error('❌ State validation failed:', result);
                return prev;
            }
            return next;
        },
    };
}

/**
 * Throttle middleware (state-level)
 * ⚠️ Ограничивает частоту применения state
 */
export function createThrottleMiddleware<T>(delay: number): Middleware<T> {
    let lastApply = 0;

    return {
        process(prev, next) {
            const now = Date.now();
            if (now - lastApply < delay) {
                return prev;
            }
            lastApply = now;
            return next;
        },
    };
}

/**
 * Freeze middleware (DEV ONLY)
 */
export function createFreezeMiddleware<T>(): Middleware<T> {
    return {
        process(_, next) {
            if (process.env.NODE_ENV !== 'production') {
                Object.freeze(next);
            }
            return next;
        },
    };
}

/**
 * Diff middleware
 */
export function createDiffMiddleware<T extends object>(
    storeName: string
): Middleware<T> {
    return {
        process(prev, next) {
            const diff: Record<string, { from: unknown; to: unknown }> = {};

            for (const key of Object.keys({...prev, ...next})) {
                if ((prev as any)[key] !== (next as any)[key]) {
                    diff[key] = {
                        from: (prev as any)[key],
                        to: (next as any)[key],
                    };
                }
            }

            if (Object.keys(diff).length) {
                console.group(`🔍 Diff [${storeName}]`);
                console.table(diff);
                console.groupEnd();
            }

            return next;
        },
    };
}

/**
 * Performance middleware
 */
export function createPerformanceMiddleware<T>(): Middleware<T> {
    let label: string | null = null;

    return {
        onAction(action) {
            label = `⚡ ${action.type}`;
            console.time(label);
        },
        process(_, next) {
            if (label) {
                console.timeEnd(label);
                label = null;
            }
            return next;
        },
    };
}
