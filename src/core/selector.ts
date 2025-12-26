/**
 * Selector — чистая функция derived-state
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
 * Создание селектора с мемоизацией по ссылке state
 */
export function createSelector<T, R>(
    selectorFn: (state: T) => R,
    { memoize = true }: SelectorOptions = {}
): Selector<T, R> {
    let lastState: T | undefined;
    let lastResult: R;
    let recomputations = 0;

    const selector = ((state: T) => {
        if (memoize && state === lastState) {
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
