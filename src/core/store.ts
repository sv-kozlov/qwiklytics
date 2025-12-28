import { produce } from 'immer';
import type { Draft } from 'immer';

import type { Action } from './action';
import { createAction } from './action';
import { createSelector } from './selector';
import type { Selector } from './selector';
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
    /** Текущее состояние стора */
    private state: T;

    /** Зарегистрированные actions */
    private readonly actions = new Map<keyof A, Action<A[keyof A]>>();

    /** Зарегистрированные effects */
    private readonly effects = new Map<keyof E, E[keyof E]>();

    /** Зарегистрированные selectors */
    private readonly selectors = new Map<keyof S, Selector<T, S[keyof S]>>();

    /** Подписчики на изменение state */
    private readonly listeners = new Set<(state: T) => void>();

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
                createAction<A[typeof key]>(
                    `${name}/${String(key)}`,
                    (payload: A[typeof key]) => {
                        const next = produce(this.state, draft => {
                            reducer(draft, payload);
                        });

                        this.setState(next);
                    }
                )
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

    /**
     * Централизованная установка state + уведомление подписчиков
     */
    private setState(state: T) {
        this.state = state;
        this.listeners.forEach(listener => listener(this.state));
    }

    /**
     * Получить текущее состояние
     */
    getState(): T {
        return this.state;
    }

    /**
     * Подписаться на изменения state
     */
    subscribe(listener: (state: T) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** ===== PUBLIC API ===== */

    /**
     * Получить action по ключу
     */
    getAction<K extends keyof A>(key: K): (payload: A[K]) => void {
        return this.actions.get(key)!.execute;
    }

    /**
     * Получить effect по ключу
     */
    getEffect<K extends keyof E>(key: K): E[K] {
        return this.effects.get(key)! as E[K];
    }

    /**
     * Получить selector по ключу
     */
    getSelector<K extends keyof S>(key: K): () => S[K] {
        const selector = this.selectors.get(key)! as Selector<T, S[K]>;
        return () => selector(this.state);
    }
}
