import type {Store} from '../core/store';

/**
 * Хук для action
 * 100% inference payload
 */
export function useAction<
    T,
    A extends Record<string, any>,
    E,
    S,
    K extends keyof A
>(store: Store<T, A, E, S>, key: K): (payload: A[K]) => void {
    return store.getAction(key);
}
