import { component$ } from '@builder.io/qwik';
import { createStoreContext, useStore$ } from '../../../../src';
import type { StoreConfig } from '../../../../src';
type CounterState = {
    count: number;
};

type CounterActions = {
    inc: { by: number };
    dec: { by: number };
};

type CounterEffects = {};
type CounterSelectors = {
    doubled: number;
};

/**
 * Конфигурация store
 * name должен быть уникален (архитектурное правило)
 */
const counterStore: StoreConfig<
    CounterState,
    CounterActions,
    CounterEffects,
    CounterSelectors
> = {
    name: 'counter',
    initialState: { count: 0 },

    actions: {
        inc(state, payload) {
            state.count += payload.by;
        },
        dec(state, payload) {
            state.count -= payload.by;
        },
    },

    selectors: {
        doubled(state) {
            return state.count * 2;
        },
    },
};

/**
 * Создаём Qwik Context
 * ⚠️ делать это нужно один раз на модуль
 */
export const { StoreProvider } = createStoreContext<
    CounterState,
    CounterActions,
    CounterEffects,
    CounterSelectors
>(counterStore);

export default component$(() => {
    const { state, actions, selectors } = useStore$(counterStore);

    return (
        <div>
            <h1>Qwiklytics counter</h1>

    <p>count: {state.count}</p>
    <p>doubled: {selectors.doubled?.value}</p>

    <button onClick$={() => actions.inc({ by: 1 })}>+</button>
    <button onClick$={() => actions.dec({ by: 1 })}>-</button>
    </div>
);
});
