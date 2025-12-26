import { Draft, produce } from 'immer';
import { Action, createAction } from './action';
import { createSelector, Selector } from './selector';
import { Middleware } from './middleware';

/**
 * Контекст для эффектов
 */
export interface StoreContext<T> {
    getState(): T;
    dispatch<P>(action: Action<P>, payload: P): void;
}

/**
 * Store — владелец состояния
 */
export class Store<T, A extends Record<string, any>, S> {
    private state: T;
    private readonly listeners = new Set<(state: T) => void>();
    private readonly actions = new Map<string, Action<any>>();
    private readonly selectors = new Map<string, Selector<T, any>>();

    constructor(
        private readonly config: {
            name: string;
            initialState: T;
            actions: {
                [K in keyof A]: (state: Draft<T>, payload: any) => void;
            };
            selectors?: {
                [K in keyof S]: (state: T) => S[K];
            };
            middlewares?: readonly Middleware<T>[];
        }
    ) {
        this.state = config.initialState;

        this.initActions();
        this.initSelectors();
    }

    /* ============== init ============== */

    private initActions() {
        const middlewares = this.config.middlewares ?? [];

        Object.entries(this.config.actions).forEach(([key, reducer]) => {
            const action = createAction(
                `${this.config.name}/${key}`,
                payload => {
                    const nextState = produce(this.state, draft => {
                        reducer(draft, payload);
                    });

                    this.applyState(nextState);
                },
                middlewares
            );

            this.actions.set(key, action);
        });
    }

    private initSelectors() {
        if (!this.config.selectors) return;

        for (const key in this.config.selectors) {
            this.selectors.set(
                key,
                createSelector(this.config.selectors[key])
            );
        }
    }

    /* ============== state ============== */

    private applyState(nextState: T) {
        const prevState = this.state;
        const finalState = (this.config.middlewares ?? []).reduce(
            (state, mw) => (mw.process ? mw.process(prevState, state) : state),
            nextState
        );

        this.state = finalState;
        this.listeners.forEach(l => l(this.state));
    }

    /* ============== public API ============== */

    getState = () => this.state;

    dispatch<P>(action: Action<P>, payload: P) {
        action.execute(payload);
    }

    getAction<K extends keyof A>(key: K): A[K] {
        const action = this.actions.get(String(key));
        if (!action) throw new Error(`Action "${String(key)}" not found`);
        return action.execute as A[K];
    }

    getSelector<K extends keyof S>(key: K): () => S[K] {
        const selector = this.selectors.get(String(key));
        if (!selector) throw new Error(`Selector "${String(key)}" not found`);
        return () => selector(this.state);
    }

    subscribe(listener: (state: T) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    hydrate(state: T) {
        this.state = state;
        this.listeners.forEach(l => l(this.state));
    }

    destroy() {
        this.listeners.clear();
        this.actions.clear();
        this.selectors.clear();
    }
}
