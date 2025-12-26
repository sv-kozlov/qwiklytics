import { Draft, produce } from 'immer';
import { createAction } from './action';
import { createSelector, Selector } from './selector';
import type { ActionMap, EffectMap, SelectorMap } from './types';

/**
 * Основной Store
 */
export class Store<
    T,
    A extends ActionMap,
    E extends EffectMap,
    S extends SelectorMap<T>
> {
    private state: T;

    private actions = new Map<keyof A, any>();
    private effects = new Map<keyof E, any>();
    private selectors = new Map<keyof S, Selector<T, any>>();
    private listeners = new Set<(state: T) => void>();

    constructor(
        private readonly config: {
            name: string;
            initialState: T;

            actions: {
                [K in keyof A]: (state: Draft<T>, payload: A[K]) => void;
            };

            effects?: E;

            selectors?: {
                [K in keyof S]: (state: T) => S[K];
            };
        }
    ) {
        this.state = config.initialState;

        this.initActions();
        this.initEffects();
        this.initSelectors();
    }

    /**
     * Инициализация actions
     */
    private initActions() {
        const { actions, name } = this.config;

        (Object.keys(actions) as Array<keyof A>).forEach(key => {
            const reducer = actions[key];

            this.actions.set(
                key,
                createAction<A[typeof key]>(`${name}/${String(key)}`, (payload: A[typeof key]) => {
                    const next = produce(this.state, draft => {
                        reducer(draft, payload);
                    });
                    this.setState(next);
                })
            );
        });
    }

    /**
     * Инициализация effects
     */
    private initEffects() {
        if (!this.config.effects) return;

        (Object.keys(this.config.effects) as Array<keyof E>).forEach(key => {
            this.effects.set(key, this.config.effects![key]);
        });
    }

    /**
     * Инициализация selectors
     */
    private initSelectors() {
        if (!this.config.selectors) return;

        (Object.keys(this.config.selectors) as Array<keyof S>).forEach(key => {
            this.selectors.set(
                key,
                createSelector(this.config.selectors![key])
            );
        });
    }

    private setState(state: T) {
        this.state = state;
        this.listeners.forEach(l => l(this.state));
    }

    getState(): T {
        return this.state;
    }

    subscribe(listener: (state: T) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** ===== PUBLIC API ===== */

    getAction<K extends keyof A>(key: K): (payload: A[K]) => void {
        return this.actions.get(key)!.execute;
    }

    getEffect<K extends keyof E>(key: K): E[K] {
        return this.effects.get(key);
    }

    getSelector<K extends keyof S>(key: K): () => S[K] {
        const selector = this.selectors.get(key)!;
        return () => selector(this.state);
    }
}
