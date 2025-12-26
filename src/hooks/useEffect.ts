import type { Store } from '../core/store';
import type { ActionMap, EffectMap, SelectorMap } from '../core/types';

/**
 * Хук для effect
 * payload и return типизируются автоматически
 */
export function useEffect<
    T extends object,
    A extends ActionMap,
    E extends EffectMap,
    S extends SelectorMap<T>,
    K extends keyof E
>(store: Store<T, A, E, S>, key: K): E[K] {
    return store.getEffect(key);
}
