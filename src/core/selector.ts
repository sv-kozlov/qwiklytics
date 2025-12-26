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
    let lastState: T | undefined;
    let lastResult: R;
    let recomputations = 0;

    const selector = ((state: T) => {
        if (state === lastState) {
            return lastResult;
        }

        recomputations++;
        lastState = state;
        lastResult = fn(state);
        return lastResult;
    }) as Selector<T, R>;

    Object.defineProperty(selector, 'recomputations', {
        get: () => recomputations,
    });

    selector.reset = () => {
        recomputations = 0;
        lastState = undefined;
    };

    return selector;
}
