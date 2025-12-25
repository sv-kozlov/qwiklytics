interface SelectorOptions<T> {
    memoize: boolean;
    maxSize?: number;
    equalityFn?: (a: T, b: T) => boolean;
}

export interface Selector<T, R> {
    (state: T): R;

    recomputations: number;
    resetRecomputations: () => void;
}

export function createSelector<T, R>(
    selectorFn: (state: T) => R,
    options: SelectorOptions<T> = {memoize: true, maxSize: 1}
): Selector<T, R> {
    let lastState: T | null = null;
    let lastResult: R | null = null;
    let recomputations = 0;
    const cache = new Map<string, R>();

    // Функция сравнения по умолчанию
    const equalityFn = options.equalityFn || ((a: T, b: T) => {
        if (a === b) return true;
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch {
            return false;
        }
    });

    const selector = function (state: T): R {
        // Простая мемоизация с правильным сравнением
        if (options.memoize && lastState !== null && equalityFn(lastState, state)) {
            return lastResult!;
        }

        // LRU кэш
        if (options.memoize && options.maxSize && options.maxSize > 1) {
            const key = JSON.stringify(state);
            if (cache.has(key)) {
                return cache.get(key)!;
            }

            const result = selectorFn(state);
            cache.set(key, result);

            // Ограничиваем размер кэша
            if (cache.size > options.maxSize) {
                const firstKey = cache.keys().next().value;
                cache.delete(firstKey);
            }

            recomputations++;
            lastState = state;
            lastResult = result;
            return result;
        }

        // Без мемоизации
        const result = selectorFn(state);
        recomputations++;
        lastState = state;
        lastResult = result;
        return result;
    } as Selector<T, R>;

    selector.recomputations = recomputations;
    selector.resetRecomputations = () => {
        recomputations = 0;
        cache.clear();
        lastState = null;
        lastResult = null;
    };

    return selector;
}