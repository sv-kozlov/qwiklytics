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

type StoreConfigSignature = {
    name: string;
    /** Список ключей actions (детерминированный) */
    actionKeys: string[];
    /** Ссылки на reducer-функции (по ключу) */
    reducersByKey: Record<string, unknown>;
    /** Ссылка на initialState (как минимум, чтобы ловить совсем другой объект) */
    initialStateRef: unknown;
};

type CacheEntry = {
    bundle: StoreContextBundle;
    signature: StoreConfigSignature;
};

/**
 * Кеш контекстов по ключу `qwiklytics:${storeName}`.
 * Нужен, чтобы ContextId был стабильным и не создавался заново на каждый вызов.
 */
const contextCache = new Map<string, CacheEntry>();

/**
 * Признак dev-режима.
 * В Qwik/Vite обычно доступно import.meta.env.DEV.
 * Если окружение не поддерживает import.meta — просто считаем, что это production.
 */
function isDevMode() {
    try {
        return Boolean((import.meta as any)?.env?.DEV);
    } catch {
        return false;
    }
}

/**
 * Создаёт "сигнатуру" конфига, чтобы отлавливать конфликты:
 * один store name должен иметь один конфиг.
 */
function createConfigSignature<
    T,
    A extends ActionMap,
    E extends EffectMap,
    S extends SelectorMap<T>
>(storeConfig: StoreConfig<T, A, E, S>): StoreConfigSignature {
    const actionKeys = Object.keys(storeConfig.actions).sort();

    const reducersByKey: Record<string, unknown> = {};
    actionKeys.forEach(key => {
        reducersByKey[key] = (storeConfig.actions as Record<string, unknown>)[key];
    });

    return {
        name: storeConfig.name,
        actionKeys,
        reducersByKey,
        initialStateRef: storeConfig.initialState,
    };
}

/**
 * Проверяет, что конфиг совместим с уже закешированным.
 * Проверка сделана максимально "дешёвой" и устойчивой:
 * - совпадают ключи actions
 * - совпадают ссылки на reducer-функции по ключам
 * - совпадает ссылка initialState (опционально помогает ловить другой объект)
 */
function assertCompatibleConfig(
    cacheKey: string,
    prev: StoreConfigSignature,
    next: StoreConfigSignature
) {
    if (prev.name !== next.name) return;

    const sameKeys =
        prev.actionKeys.length === next.actionKeys.length &&
        prev.actionKeys.every((k, i) => k === next.actionKeys[i]);

    if (!sameKeys) {
        throw new Error(
            `[qwiklytics] Конфликт store-конфига для "${cacheKey}". ` +
            `Ключи actions отличаются. ` +
            `Правило: один store name → один конфиг.`
        );
    }

    for (const key of prev.actionKeys) {
        if (prev.reducersByKey[key] !== next.reducersByKey[key]) {
            throw new Error(
                `[qwiklytics] Конфликт store-конфига для "${cacheKey}". ` +
                `Reducer для action "${key}" отличается. ` +
                `Правило: один store name → один конфиг.`
            );
        }
    }

    if (prev.initialStateRef !== next.initialStateRef) {
        throw new Error(
            `[qwiklytics] Конфликт store-конфига для "${cacheKey}". ` +
            `initialState отличается (другая ссылка). ` +
            `Правило: один store name → один конфиг.`
        );
    }
}

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
        // Runtime-защита в dev: один name → один конфиг
        if (isDevMode()) {
            const nextSig = createConfigSignature(storeConfig);
            assertCompatibleConfig(cacheKey, cached.signature, nextSig);
        }

        return cached.bundle as {
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

    contextCache.set(cacheKey, {
        bundle,
        signature: createConfigSignature(storeConfig),
    });

    return {
        StoreContext,
        StoreProvider,
        useStoreInstance,
    };
}
