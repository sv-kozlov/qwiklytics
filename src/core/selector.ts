
interface SelectorOptions {
  memoize: boolean;
  maxSize?: number;
}

export interface Selector<T, R> {
  (state: T): R;
  recomputations: number;
  resetRecomputations: () => void;
}

export function createSelector<T, R>(
  selectorFn: (state: T) => R,
  options: SelectorOptions = { memoize: true, maxSize: 1 }
): Selector<T, R> {
  let lastState: T | null = null;
  let lastResult: R | null = null;
  let recomputations = 0;
  const cache = new Map<string, R>();
  
  const selector = function(state: T): R {
    // Простая мемоизация
    if (options.memoize && lastState === state) {
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