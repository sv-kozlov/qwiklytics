// Пример store
import { createStore, createPersistPlugin } from 'qwiklytics';
import { createLoggerMiddleware } from 'qwiklytics/middleware';

export const counterStore = createStore({
  name: 'counter',
  initialState: {
    count: 0,
    history: [] as number[],
  },
  actions: {
    increment: (state, payload: number = 1) => {
      state.count += payload;
      state.history.push(state.count);
    },
    decrement: (state, payload: number = 1) => {
      state.count -= payload;
      state.history.push(state.count);
    },
    reset: (state) => {
      state.count = 0;
      state.history = [];
    },
  },
  effects: {
    asyncIncrement: async ({ dispatch }, delay: number) => {
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
  
  return (
    <div>
      <h1>Count: {state.count}</h1>
      <h2>Double: {doubleCount.value}</h2>
      <button onClick$={() => actions.increment(1)}>+</button>
      <button onClick$={() => actions.decrement(1)}>-</button>
      <button onClick$={() => actions.reset()}>Reset</button>
    </div>
  );
});