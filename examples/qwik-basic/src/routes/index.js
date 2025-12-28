import { jsx as _jsx, jsxs as _jsxs } from "@builder.io/qwik/jsx-runtime";
import { component$ } from '@builder.io/qwik';
import { createStoreContext, useStore$ } from '../../../../src';
/**
 * Конфигурация store
 * name должен быть уникален (архитектурное правило)
 */
const counterStore = {
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
export const { StoreProvider } = createStoreContext(counterStore);
export default component$(() => {
    const { state, actions, selectors } = useStore$(counterStore);
    return (_jsxs("div", { children: [_jsx("h1", { children: "Qwiklytics counter" }), _jsxs("p", { children: ["count: ", state.count] }), _jsxs("p", { children: ["doubled: ", selectors.doubled?.value] }), _jsx("button", { "onClick$": () => actions.inc({ by: 1 }), children: "+" }), _jsx("button", { "onClick$": () => actions.dec({ by: 1 }), children: "-" })] }));
});
