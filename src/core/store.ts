import {Draft, produce} from 'immer';
import {Action, createAction} from './action';
import {createEffect, Effect} from './effect';
import {createSelector, Selector} from './selector';
import {Middleware} from './middleware';
import type {Plugin} from '../plugins';

/**
 * Конфигурация Store
 */
export type StoreConfig<
    T,
    A extends Record<string, any>,
    E extends Record<string, any>,
    S extends Record<string, any>
> = {
    /** Имя store для идентификации */
    name: string;
    /** Начальное состояние */
    initialState: T;
    /** Действия для изменения состояния */
    actions: {
        [K in keyof A]: (state: Draft<T>, payload: Parameters<A[K]>[1]) => void;
    };
    /** Асинхронные эффекты */
    effects?: {
        [K in keyof E]: (
            context: StoreContext<T>,
            payload: Parameters<E[K]>[0]
        ) => Promise<any>;
    };
    /** Селекторы для вычисляемых значений */
    selectors?: {
        [K in keyof S]: (state: T) => S[K];
    };
    /** Middleware для перехвата изменений */
    middlewares?: Middleware<T>[];
    /** Плагины для расширения функциональности */
    plugins?: Plugin[];
};

/**
 * Контекст для эффектов
 */
export interface StoreContext<T> {
    getState: () => T;
    dispatch: (action: Action) => void;
    actions: Record<string, Action>;
}

/**
 * Основной класс Store
 * Управляет состоянием, действиями, эффектами и селекторами
 */
export class Store<T, A, E, S> {
    private state: T;
    private listeners: Set<(state: T) => void> = new Set();
    private actions: Map<string, Action> = new Map();
    private effects: Map<string, Effect> = new Map();
    private selectors: Map<string, Selector<T, any>> = new Map();
    private plugins: Map<string, any> = new Map();
    private _middlewares: Middleware<T>[] = [];

    /** Имя store для идентификации */
    public readonly name: string;

    /**
     * Геттер для доступа к middleware (только для чтения извне)
     * Используется в action.ts для вызова onAction
     */
    public get middlewares(): readonly Middleware<T>[] {
        return this._middlewares;
    }

    constructor(private config: StoreConfig<T, A, E, S>) {
        this.name = config.name;
        this.state = config.initialState;
        this._middlewares = config.middlewares || [];

        this.initializeActions();
        this.initializeEffects();
        this.initializeSelectors();
        this.initializePlugins();
    }

    /**
     * Инициализация действий из конфигурации
     */
    private initializeActions() {
        Object.entries(this.config.actions).forEach(([key, reducer]) => {
            const actionType = `${this.config.name}/${key}`;

            const action = createAction(
                actionType,
                (payload: any, store?: any) => {
                    // Применяем reducer через immer
                    const nextState = produce(this.state, (draft: Draft<T>) => {
                        // Передаем draft и payload в reducer
                        (reducer as any)(draft, payload);
                    });

                    // Обновляем состояние через middleware
                    this.setState(nextState);
                },
                this // Передаем store в action
            );

            this.actions.set(key, action);
        });
    }

    /**
     * Инициализация эффектов из конфигурации
     */
    private initializeEffects() {
        if (!this.config.effects) return;

        Object.entries(this.config.effects).forEach(([key, effectFn]) => {
            const effect = createEffect(
                `${this.config.name}/${key}`,
                async (payload: any) => {
                    // Создаем контекст для эффекта
                    const context: StoreContext<T> = {
                        getState: () => this.state,
                        dispatch: (action) => this.dispatch(action),
                        actions: Object.fromEntries(this.actions),
                    };

                    // Выполняем эффект с контекстом
                    return await (effectFn as any)(context, payload);
                }
            );

            this.effects.set(key, effect);
        });
    }

    /**
     * Инициализация селекторов из конфигурации
     */
    private initializeSelectors() {
        if (!this.config.selectors) return;

        Object.entries(this.config.selectors).forEach(([key, selectorFn]) => {
            const selector = createSelector(
                selectorFn as any,
                {memoize: true, maxSize: 10}
            );

            this.selectors.set(key, selector);
        });
    }

    /**
     * Инициализация плагинов из конфигурации
     */
    private initializePlugins() {
        if (!this.config.plugins) return;

        this.config.plugins.forEach(plugin => {
            this.initializePlugin(plugin);
        });
    }

    /**
     * Инициализация одного плагина
     */
    private initializePlugin(pluginConfig: any) {
        if (typeof pluginConfig === 'function') {
            // Плагин как фабричная функция
            const plugin = pluginConfig();
            this.plugins.set(plugin.name, plugin);

            // Вызываем init если есть
            if (plugin.init) {
                const result = plugin.init(this);
                if (result) {
                    this.plugins.set(plugin.name, {...plugin, api: result});
                }
            }

            // Добавляем middleware плагина
            if (plugin.middleware) {
                this._middlewares.push(plugin.middleware);
            }
        } else if (pluginConfig.name) {
            // Уже созданный плагин
            this.plugins.set(pluginConfig.name, pluginConfig);

            // Вызываем init если есть
            if (pluginConfig.init) {
                const result = pluginConfig.init(this);
                if (result) {
                    this.plugins.set(pluginConfig.name, {...pluginConfig, api: result});
                }
            }

            // Добавляем middleware плагина
            if (pluginConfig.middleware) {
                this._middlewares.push(pluginConfig.middleware);
            }
        }
    }

    /**
     * Обновление состояния с применением middleware
     */
    private setState(nextState: T) {
        const prevState = this.state;

        // Применяем middleware process для трансформации состояния
        let finalState = nextState;
        for (const middleware of this._middlewares) {
            if (middleware.process) {
                finalState = middleware.process(prevState, finalState);
            }
        }

        this.state = finalState;

        // Уведомляем подписчиков об изменении
        this.notifyListeners();

        // Отправляем событие в DevTools
        this.notifyDevTools(prevState, finalState);
    }

    /**
     * Уведомление подписчиков о изменении состояния
     */
    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.state));
    }

    /**
     * Отправка событий в DevTools
     */
    private notifyDevTools(prevState: T, nextState: T) {
        if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_DEVTOOLS__) {
            (window as any).__QWIKLYTICS_DEVTOOLS__.dispatch({
                type: 'STATE_CHANGED',
                store: this.name,
                prevState,
                nextState,
            });
        }
    }

    /**
     * Получение текущего состояния
     */
    public getState(): T {
        return this.state;
    }

    /**
     * Выполнение действия
     */
    public dispatch(action: Action) {
        action.execute(action.payload);
    }

    /**
     * Получение функции действия по ключу
     */
    public getAction<K extends keyof A>(key: K): A[K] {
        const action = this.actions.get(key as string);
        if (!action) {
            throw new Error(`Action ${String(key)} not found in store ${this.name}`);
        }
        return action.execute as A[K];
    }

    /**
     * Получение функции эффекта по ключу
     */
    public getEffect<K extends keyof E>(key: K): E[K] {
        const effect = this.effects.get(key as string);
        if (!effect) {
            throw new Error(`Effect ${String(key)} not found in store ${this.name}`);
        }
        return effect.execute as E[K];
    }

    /**
     * Получение функции селектора по ключу
     */
    public getSelector<K extends keyof S>(key: K): () => S[K] {
        const selector = this.selectors.get(key as string);
        if (!selector) {
            throw new Error(`Selector ${String(key)} not found in store ${this.name}`);
        }
        return () => selector(this.state);
    }

    /**
     * Получение инстанса плагина
     */
    public getPlugin<K extends keyof any>(name: string): any {
        return this.plugins.get(name)?.instance;
    }

    /**
     * Получение API плагина
     */
    public getPluginApi(name: string): any {
        const plugin = this.plugins.get(name);
        return plugin?.api || plugin?.result?.api;
    }

    /**
     * Подписка на изменения состояния
     * @returns функция отписки
     */
    public subscribe(listener: (state: T) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Гидратация состояния (например, при SSR)
     */
    public hydrate(state: T) {
        this.state = state;
        this.notifyListeners();
    }

    /**
     * Уничтожение store и очистка ресурсов
     */
    public destroy() {
        // Очищаем listeners
        this.listeners.clear();

        // Вызываем destroy у плагинов
        this.plugins.forEach((plugin) => {
            if (plugin.instance?.destroy) {
                plugin.instance.destroy(this);
            }
        });

        // Очищаем коллекции
        this.actions.clear();
        this.effects.clear();
        this.selectors.clear();
        this.plugins.clear();

        // Очищаем middleware
        this._middlewares = [];
    }
}