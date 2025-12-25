import { Draft, produce } from 'immer';
import { Action, createAction } from './action';
import { createSelector, Selector } from './selector';
import { Middleware } from './middleware';
import type { Plugin } from '../plugins';

/**
 * Контекст для эффектов
 */
export interface StoreContext<T> {
    getState(): T;
    dispatch<P>(action: Action<P>, payload: P): void;
}

/**
 * Основной Store
 */
export class Store<T, A extends Record<string, any>, E, S> {
    private state: T;
    private listeners = new Set<(state: T) => void>();
    private actions = new Map<string, Action<any>>();
    private selectors = new Map<string, Selector<T, any>>();
    private middlewares: Middleware<T>[];

    public readonly name: string;

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
            middlewares?: Middleware<T>[];
            plugins?: Plugin[];
        }
    ) {
        this.name = config.name;
        this.state = config.initialState;
        this.middlewares = config.middlewares ?? [];

        this.initActions();
        this.initSelectors();
    }

    /**
     * Инициализация actions
     */
    private initActions() {
        Object.entries(this.config.actions).forEach(([key, reducer]) => {
            const type = `${this.name}/${key}`;

            const action = createAction(
                type,
                (payload) => {
                    const nextState = produce(this.state, draft => {
                        reducer(draft, payload);
                    });

                    this.applyState(nextState);
                },
                this.middlewares
            );

            this.actions.set(key, action);
        });
    }

    /**
     * Инициализация selectors
     */
    private initSelectors() {
        if (!this.config.selectors) return;

        for (const key in this.config.selectors) {
            const selectorFn = this.config.selectors[key];
            this.selectors.set(key, createSelector(selectorFn));
        }
    }


    /**
     * Применение нового состояния через middleware
     */
    private applyState(nextState: T) {
        const prevState = this.state;

        const finalState = this.middlewares.reduce(
            (state, mw) => mw.process ? mw.process(prevState, state) : state,
            nextState
        );

        this.state = finalState;
        this.listeners.forEach(l => l(this.state));
    }

    /**
     * Dispatch action
     */
    public dispatch<P>(action: Action<P>, payload: P) {
        action.execute(payload);
    }

    /**
     * Получить action по ключу
     */
    public getAction<K extends keyof A>(key: K): A[K] {
        const action = this.actions.get(String(key));
        if (!action) {
            throw new Error(`Action "${String(key)}" not found`);
        }
        return action.execute as A[K];
    }

    /**
     * Получить selector
     */
    public getSelector<K extends keyof S>(key: K): () => S[K] {
        const selector = this.selectors.get(String(key));
        if (!selector) {
            throw new Error(`Selector "${String(key)}" not found`);
        }
        return () => selector(this.state);
    }

    /**
     * Подписка на изменения
     */
    public subscribe(listener: (state: T) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Гидратация состояния (SSR)
     */
    public hydrate(state: T) {
        this.state = state;
        this.listeners.forEach(l => l(this.state));
    }

    /**
     * Очистка ресурсов
     */
    public destroy() {
        this.listeners.clear();
        this.actions.clear();
        this.selectors.clear();
    }
}
