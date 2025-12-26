import type { Store } from '../core/store';
import type { ActionMap, EffectMap, SelectorMap } from '../core/types';

/**
 * Хук для action
 * 100% inference payload
 */
export function useAction<
    T extends object,
    A extends ActionMap,
    E extends EffectMap,
    S extends SelectorMap<T>,
    K extends keyof A
>(store: Store<T, A, E, S>, key: K): (payload: A[K]) => void {
    return store.getAction(key);
}

