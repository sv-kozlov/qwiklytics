/**
 * Селектор с мемоизацией по ссылке состояния
 */
export interface Selector<T, R> {
    (state: T): R;
    readonly recomputations: number;
    reset(): void;
}

/**
 * Создание селектора
 */
export function createSelector<T, R>(
    fn: (state: T) => R
): Selector<T, R> {
    let hasCache = false;
    let lastState!: T;
    let lastResult!: R;
    let recomputations = 0;

    const selector = ((state: T) => {
        if (hasCache && state === lastState) {
            return lastResult;
        }

        recomputations++;
        lastState = state;
        lastResult = fn(state);
        hasCache = true;
        return lastResult;
    }) as Selector<T, R>;

    Object.defineProperty(selector, 'recomputations', {
        get: () => recomputations,
    });

    selector.reset = () => {
        hasCache = false;
        recomputations = 0;
        lastState = undefined as unknown as T;
        lastResult = undefined as unknown as R;
    };

    return selector;
}
