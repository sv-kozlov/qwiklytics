/**
 * Селектор с мемоизацией по ссылке состояния
 */
export interface Selector<T, R> {
    (state: T): R;
    readonly recomputations: number;
    resetRecomputations(): void;
}

export interface SelectorOptions {
    memoize?: boolean;
}

/**
 * Создание селектора
 */
export function createSelector<T, R>(
    selectorFn: (state: T) => R,
    options: SelectorOptions = { memoize: true }
): Selector<T, R> {
    let lastState: T | undefined;
    let lastResult: R;
    let recomputations = 0;

    const selector = ((state: T) => {
        if (options.memoize && state === lastState) {
            return lastResult;
        }

        recomputations++;
        lastState = state;
        lastResult = selectorFn(state);

        return lastResult;
    }) as Selector<T, R>;

    Object.defineProperty(selector, 'recomputations', {
        get: () => recomputations,
    });

    selector.resetRecomputations = () => {
        recomputations = 0;
        lastState = undefined;
    };

    return selector;
}
