// src/qwik/integration.tsx
import {
    component$,
    createContextId,
    noSerialize,
    Slot,
    useContext,
    useContextProvider,
    useSignal,
    type Component,
    type ContextId,
    type NoSerialize,
} from '@builder.io/qwik';

import { Store } from '../core/store';
import type { ActionMap, EffectMap, SelectorMap } from '../core/types';

/**
 * Конфигурация Store (форма соответствует конструктору core.Store)
 */
export type StoreConfig<
    T,
    A extends ActionMap,
    E extends EffectMap,
    S extends SelectorMap<T>
> = {
    name: string;
    initialState: T;

    actions: {
        [K in keyof A]: (
            state: import('immer').Draft<T>,
            payload: A[K]
        ) => void;
    };

    effects?: E;

    selectors?: {
        [K in keyof S]: (state: T) => S[K];
    };
};

type StoreContextBundle = {
    StoreContext: ContextId<Store<any, any, any, any>>;
    StoreProvider: Component;
    useStoreInstance: () => Store<any, any, any, any>;
};

/**
 * Кеш контекстов по имени `qwiklytics:${storeName}`.
 * Нужен, чтобы ContextId был стабильным и не создавался заново на каждый вызов.
 */
const contextCache = new Map<string, StoreContextBundle>();

/**
 * Создаёт Qwik Context + Provider для конкретного StoreConfig
 */
export function createStoreContext<
    T,
    A extends ActionMap,
    E extends EffectMap,
    S extends SelectorMap<T>
>(storeConfig: StoreConfig<T, A, E, S>) {
    const cacheKey = `qwiklytics:${storeConfig.name}`;
    const cached = contextCache.get(cacheKey);
    if (cached) {
        return cached as {
            StoreContext: ContextId<Store<T, A, E, S>>;
            StoreProvider: Component;
            useStoreInstance: () => Store<T, A, E, S>;
        };
    }

    const StoreContext = createContextId<Store<T, A, E, S>>(
        `qwiklytics:${storeConfig.name}`
    );

    /**
     * Provider создаёт store и кладёт его в Qwik Context
     */
    const StoreProvider: Component = component$(() => {
        /**
         * Делаем store стабильным и не сериализуемым.
         * Так инстанс не пересоздаётся и не попадает в snapshot.
         */
        const storeSig = useSignal<NoSerialize<Store<T, A, E, S>>>(
            noSerialize(new Store<T, A, E, S>(storeConfig))
        );

        useContextProvider(StoreContext, storeSig.value!);

        return <Slot />;
    });

    /**
     * Получение store из контекста
     */
    const useStoreInstance = () => useContext(StoreContext);

    const bundle: StoreContextBundle = {
        StoreContext: StoreContext as unknown as ContextId<Store<any, any, any, any>>,
        StoreProvider,
        useStoreInstance: useStoreInstance as unknown as () => Store<any, any, any, any>,
    };

    contextCache.set(cacheKey, bundle);

    return {
        StoreContext,
        StoreProvider,
        useStoreInstance,
    };
}
