import { jsxs as _jsxs, jsx as _jsx } from "@builder.io/qwik/jsx-runtime";
// Пример store
import { createStore, createPersistPlugin } from 'qwiklytics';
import { createLoggerMiddleware } from 'qwiklytics/middleware';
export const counterStore = createStore({
    name: 'counter',
    initialState: {
        count: 0,
        history: [],
    },
    actions: {
        increment: (state, payload = 1) => {
            state.count += payload;
            state.history.push(state.count);
        },
        decrement: (state, payload = 1) => {
            state.count -= payload;
            state.history.push(state.count);
        },
        reset: (state) => {
            state.count = 0;
            state.history = [];
        },
    },
    effects: {
        asyncIncrement: async ({ dispatch }, delay) => {
            await new Promise(resolve => setTimeout(resolve, delay));
            dispatch(actions.increment(1));
        },
    },
    selectors: {
        doubleCount: (state) => state.count * 2,
        historyCount: (state) => state.history.length,
    },
    middlewares: [
        createLoggerMiddleware('counter'),
    ],
    plugins: [
        createPersistPlugin({
            key: 'counter-storage',
            whitelist: ['count'],
        }),
    ],
});
// Qwik компонент
import { component$ } from '@builder.io/qwik';
import { useQwiklyticsStore } from 'qwiklytics/qwik';
export const CounterComponent = component$(() => {
    const { state, actions, doubleCount } = useQwiklyticsStore(counterStore);
    return (_jsxs("div", { children: [_jsxs("h1", { children: ["Count: ", state.count] }), _jsxs("h2", { children: ["Double: ", doubleCount.value] }), _jsx("button", { "onClick$": () => actions.increment(1), children: "+" }), _jsx("button", { "onClick$": () => actions.decrement(1), children: "-" }), _jsx("button", { "onClick$": () => actions.reset(), children: "Reset" })] }));
});
