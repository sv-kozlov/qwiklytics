import {Draft, produce} from 'immer';
import {Action, createAction} from './action';
import {createEffect, Effect} from './effect';
import {createSelector, Selector} from './selector';
import {Middleware} from './middleware';

export type StoreConfig<T, A extends Record<string, any>, E extends Record<string, any>, S extends Record<string, any>> = {
    name: string;
    initialState: T;
    actions: {
        [K in keyof A]: (state: Draft<T>, payload: Parameters<A[K]>[1]) => void;
    };
    effects?: {
        [K in keyof E]: (
            context: StoreContext<T>,
            payload: Parameters<E[K]>[0]
        ) => Promise<any>;
    };
    selectors?: {
        [K in keyof S]: (state: T) => S[K];
    };
    middlewares?: Middleware<T>[];
    plugins?: any[]; // ✅ Добавлено
};

export interface StoreContext<T> {
    getState: () => T;
    dispatch: (action: Action) => void;
    actions: Record<string, Action>;
}

export class Store<T, A, E, S> {
    private state: T;
    private listeners: Set<(state: T) => void> = new Set();
    private actions: Map<string, Action> = new Map();
    private effects: Map<string, Effect> = new Map();
    private selectors: Map<string, Selector<T, any>> = new Map();
    private plugins: Map<string, any> = new Map();
    private middlewares: Middleware<T>[] = [];

    public readonly name: string;

    constructor(private config: StoreConfig<T, A, E, S>) {
        this.name = config.name;
        this.state = config.initialState;
        this.middlewares = config.middlewares || [];

        // Регистрируем действия
        Object.entries(config.actions).forEach(([key, reducer]) => {
            const action = createAction(
                `${config.name}/${key}`,
                (payload: any) => {
                    const nextState = produce(this.state, (draft: Draft<T>) => {
                        reducer(draft, payload);
                    });
                    this.setState(nextState);
                }
            );
            this.actions.set(key, action);
        });

        // Регистрируем эффекты
        if (config.effects) {
            Object.entries(config.effects).forEach(([key, effectFn]) => {
                const effect = createEffect(
                    `${config.name}/${key}`,
                    async (payload: any) => {
                        const context: StoreContext<T> = {
                            getState: () => this.state,
                            dispatch: (action) => this.dispatch(action),
                            actions: Object.fromEntries(this.actions),
                        };
                        return await effectFn(context, payload);
                    }
                );
                this.effects.set(key, effect);
            });
        }

        // Регистрируем селекторы
        if (config.selectors) {
            Object.entries(config.selectors).forEach(([key, selectorFn]) => {
                const selector = createSelector(
                    selectorFn,
                    {memoize: true, maxSize: 10}
                );
                this.selectors.set(key, selector);
            });
        }

        // Инициализируем плагины
        if (config.plugins) {
            config.plugins.forEach(plugin => {
                this.initializePlugin(plugin);
            });
        }

        // Инициализируем middleware из конфига
        if (config.middlewares) {
            this.middlewares.push(...config.middlewares);
        }
    }

    private setState(nextState: T) {
        const prevState = this.state;

        // Вызываем onAction у middleware перед изменением состояния
        for (const middleware of this.middlewares) {
            if (middleware.onAction) {
                // Нужно получить текущее действие (это требует доработки)
                // middleware.onAction(currentAction);
            }
        }

        // Применяем middleware process
        let finalState = nextState;
        for (const middleware of this.middlewares) {
            if (middleware.process) {
                finalState = middleware.process(prevState, finalState);
            }
        }

        this.state = finalState;

        // Уведомляем подписчиков
        this.listeners.forEach(listener => listener(this.state));

        // DevTools
        if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_DEVTOOLS__) {
            (window as any).__QWIKLYTICS_DEVTOOLS__.dispatch({
                type: 'STATE_CHANGED',
                store: this.name,
                prevState,
                nextState: this.state,
            });
        }
    }

    private initializePlugin(pluginConfig: any) {
        if (typeof pluginConfig === 'function') {
            const plugin = pluginConfig();
            this.plugins.set(plugin.name, plugin);

            if (plugin.init) {
                const result = plugin.init(this);
                if (result) {
                    this.plugins.set(plugin.name, {...plugin, api: result});
                }
            }

            if (plugin.middleware) {
                this.middlewares.push(plugin.middleware);
            }
        } else if (pluginConfig.name) {
            // Уже созданный плагин
            this.plugins.set(pluginConfig.name, pluginConfig);
        }
    }

    public getState(): T {
        return this.state;
    }

    public dispatch(action: Action) {
        action.execute(action.payload);
    }

    public getAction<K extends keyof A>(key: K): A[K] {
        const action = this.actions.get(key as string);
        if (!action) throw new Error(`Action ${String(key)} not found`);
        return action.execute as A[K];
    }

    public getEffect<K extends keyof E>(key: K): E[K] {
        const effect = this.effects.get(key as string);
        if (!effect) throw new Error(`Effect ${String(key)} not found`);
        return effect.execute as E[K];
    }

    public getSelector<K extends keyof S>(key: K): () => S[K] {
        const selector = this.selectors.get(key as string);
        if (!selector) throw new Error(`Selector ${String(key)} not found`);
        return () => selector(this.state);
    }

    public getPlugin<K extends keyof any>(name: string): any {
        return this.plugins.get(name)?.instance;
    }

    public getPluginApi(name: string): any {
        const plugin = this.plugins.get(name);
        return plugin?.api || plugin?.result?.api;
    }

    public subscribe(listener: (state: T) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    public hydrate(state: T) {
        this.state = state;
        this.listeners.forEach(listener => listener(this.state));
    }
}