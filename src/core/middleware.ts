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
    onAction?<P>(action: MiddlewareContext<P>): void;
    process?(prevState: T, nextState: T): T;
}

/**
 * Logger middleware
 */
export const createLoggerMiddleware = <T>(storeName: string): Middleware<T> => ({
    onAction(action) {
        console.log(`🎬 [${storeName}]`, action.type, action.payload);
    },
    process(prev, next) {
        console.group(`📦 Store: ${storeName}`);
        console.log('Prev:', prev);
        console.log('Next:', next);
        console.groupEnd();
        return next;
    },
});

/**
 * Validation middleware
 */
export const createValidationMiddleware = <T>(
    validator: (state: T) => boolean | string
): Middleware<T> => ({
    process(prev, next) {
        const result = validator(next);
        if (result !== true) {
            console.error('❌ Validation failed:', result);
            return prev;
        }
        return next;
    },
});

/**
 * Throttle middleware (state-level)
 */
export const createThrottleMiddleware = <T>(delay: number): Middleware<T> => {
    let lastApply = 0;

    return {
        process(prev, next) {
            const now = Date.now();
            if (now - lastApply < delay) return prev;
            lastApply = now;
            return next;
        },
    };
};

/**
 * Freeze middleware (DEV only)
 */
export const createFreezeMiddleware = <T>(): Middleware<T> => ({
    process(_, next) {
        if (process.env.NODE_ENV !== 'production') {
            Object.freeze(next);
        }
        return next;
    },
});
