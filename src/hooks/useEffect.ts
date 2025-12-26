import type { Store } from '../core/store';

/**
 * Хук для effect
 * payload и return типизируются автоматически
 */
export function useEffect<
    T,
    A,
    E extends Record<string, (payload: any) => Promise<any>>,
    S,
    K extends keyof E
>(store: Store<T, A, E, S>, key: K): E[K] {
    return store.getEffect(key);
}
