/**
 * Селекторы с мемоизацией для оптимизации вычислений
 */
interface SelectorOptions<T> {
    memoize: boolean;
    maxSize?: number;
    equalityFn?: (a: T, b: T) => boolean;
}

export interface Selector<T, R> {
    /** Функция вычисления значения из состояния */
    (state: T): R;

    /** Счетчик пересчетов для отладки */
    recomputations: number;
    /** Сброс статистики и кэша */
    resetRecomputations: () => void;
}

/**
 * Создание селектора с опциональной мемоизацией
 * @param selectorFn - функция вычисления значения
 * @param options - настройки мемоизации
 */
export function createSelector<T, R>(    selectorFn: (state: T) => R,
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

            // Обновляем свойство selector
            selector.recomputations = recomputations;

            return result;
        }

        // Без мемоизации
        const result = selectorFn(state);
        recomputations++;
        lastState = state;
        lastResult = result;
        // Обновляем свойство selector
        selector.recomputations = recomputations;
        return result;
    } as Selector<T, R>;

    // Инициализация свойств
    Object.defineProperty(selector, 'recomputations', {
        get: () => recomputations,
        enumerable: true,
    });

    selector.resetRecomputations = () => {
        recomputations = 0;
        cache.clear();
        lastState = null;
        lastResult = null;
    };

    return selector;
}