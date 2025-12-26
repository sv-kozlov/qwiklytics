// src/qwik/hooks.ts
import {
    $,
    noSerialize,
    type NoSerialize,
    type QRL,
    useComputed$,
    useSignal,
    useStore,
    useVisibleTask$,
} from '@builder.io/qwik';

import type {ActionMap, EffectMap, SelectorMap} from '../core/types';
import type {Store} from '../core/store';
import {createStoreContext, type StoreConfig} from './integration';

/**
 * Синхронизирует объектное состояние:
 * - обновляет существующие ключи
 * - добавляет новые
 * - удаляет отсутствующие в next
 *
 * Важно для корректного отражения delete-операций из immer.
 */
function syncObjectState<T extends object>(target: T, next: T) {
    // Удаляем ключи, которых больше нет
    for (const key of Object.keys(target) as Array<keyof T>) {
        if (!(key in next)) {
            delete (target as Record<string, unknown>)[key as string];
        }
    }
    // Копируем/перезаписываем актуальные значения
    Object.assign(target, next);
}

/**
 * Опции подключения Qwik хука
 */
export type UseStoreOptions<S> = {
    /**
     * Если указано — считаем только эти селекторы.
     * Полезно, чтобы не создавать лишние useComputed$.
     */
    selectors?: Array<keyof S>;
};

/**
 * Результат основного хука
 */
export type UseStoreResult<
    T extends object,
    A extends ActionMap,
    E extends EffectMap,
    S extends SelectorMap<T>
> = {
    /** Реактивный state для компонентов Qwik */
    state: T;

    /** QRL actions для использования в onClick$ и т.п. */
    actions: { [K in keyof A]: QRL<(payload: A[K]) => void> };

    /** Effects (обычные async функции) */
    effects: E;

    /** Computed селекторы */
    selectors: { [K in keyof S]?: ReturnType<typeof useComputed$<S[K]>> };

    /** Инстанс store из core */
    store: Store<T, A, E, S>;
};

/**
 * Основной Qwik-хук: подключает core.Store к реактивности Qwik.
 *
 * Важно:
 * - store хранится как noSerialize внутри signal, чтобы не сериализоваться на SSR
 * - подписка на store делается только на клиенте через useVisibleTask$
 */
export function useStore$<
    T extends object,
    A extends ActionMap,
    E extends EffectMap,
    S extends SelectorMap<T>
>(
    storeConfig: StoreConfig<T, A, E, S>,
    options: UseStoreOptions<S> = {}
): UseStoreResult<T, A, E, S> {
    const {useStoreInstance} = createStoreContext(storeConfig);

    // Store должен быть предоставлен через Provider выше по дереву
    const store = useStoreInstance();

    /**
     * Делаем store "несериализуемым", чтобы Qwik не пытался тащить его в HTML/JSON.
     */
    const storeSig = useSignal<NoSerialize<Store<T, A, E, S>>>(noSerialize(store));

    /**
     * Реактивное состояние Qwik. Сохраняем ссылку и синхронизируем поля (включая удаления).
     */
    const state = useStore<T>(store.getState());

    /**
     * Подписка на изменения store — только на клиенте.
     */
    useVisibleTask$(({cleanup}) => {
        const s = storeSig.value;
        if (!s) return;

        const unsubscribe = s.subscribe(nextState => {
            syncObjectState(state, nextState);
        });

        cleanup(() => unsubscribe());
    });

    /**
     * Actions → QRL функции. Удобно для onClick$ и других событий.
     */
    const actions = {} as { [K in keyof A]: QRL<(payload: A[K]) => void> };

    (Object.keys(storeConfig.actions) as Array<keyof A>).forEach(key => {
        actions[key] = $((payload: A[typeof key]) => {
            const s = storeSig.value;
            if (!s) return;
            s.getAction(key)(payload);
        });
    });

    /**
     * Effects — прокидываем напрямую.
     */
    const effects = {} as E;
    if (storeConfig.effects) {
        (Object.keys(storeConfig.effects) as Array<keyof E>).forEach(key => {
            effects[key] = store.getEffect(key);
        });
    }

    /**
     * Селекторы — computed на базе текущего store.state.
     * Можно ограничить набор через options.selectors.
     */
    const selectors: { [K in keyof S]?: ReturnType<typeof useComputed$<S[K]>> } =
        {};

    const selectorKeys = options.selectors ?? (storeConfig.selectors
        ? (Object.keys(storeConfig.selectors) as Array<keyof S>)
        : []);

    if (storeConfig.selectors) {
        selectorKeys.forEach(key => {
            selectors[key] = useComputed$(() => {
                const s = storeSig.value;
                if (!s) return storeConfig.selectors![key](state) as S[typeof key];
                return s.getSelector(key)();
            });
        });
    }

    return {state, actions, effects, selectors, store};
}

/**
 * Хелпер-хук: возвращает computed селектор по ключу.
 * Удобно, если ты не хочешь создавать объект selectors.
 */
export function useSelector$<
    T extends object,
    A extends ActionMap,
    E extends EffectMap,
    S extends SelectorMap<T>,
    K extends keyof S
>(store: Store<T, A, E, S>, key: K) {
    // Основной кусок логики — computed вокруг store.getSelector
    return useComputed$(() => store.getSelector(key)());
}
