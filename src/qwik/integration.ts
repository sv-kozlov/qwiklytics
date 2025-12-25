// src/qwik/integration.ts
import { createContextId, useContextProvider, useContext } from '@builder.io/qwik';
import { Store } from '../core/store';

export function createStoreContext<T, A, E, S>(
  storeConfig: any
) {
  const StoreContext = createContextId<Store<T, A, E, S>>(
    `qwiklytics:${storeConfig.name}`
  );
  
  return {
    StoreContext,
    createStoreProvider: () => {
      const store = new Store(storeConfig);
      
      const StoreProvider = ({ children }: any) => {
        useContextProvider(StoreContext, store);
        return children;
      };
      
      return StoreProvider;
    },
    useStore: () => useContext(StoreContext),
  };
}

// Qwik хук для использования store
export function useQwiklyticsStore<T, A, E, S>(
  storeConfig: any,
  options?: { selectors?: string[] }
) {
  const { StoreContext, createStoreProvider } = createStoreContext(storeConfig);
  const store = useContext(StoreContext);
  
  // Реактивная подписка через useTask$
  const state = useStore(store?.getState() || storeConfig.initialState);
  
  useTask$(({ track }) => {
    if (!store) return;
    
    const unsubscribe = store.subscribe((newState) => {
      Object.assign(state, newState);
    });
    
    track(() => state); // Отслеживаем изменения
    
    return unsubscribe;
  });
  
  // Собираем actions
  const actions = {} as any;
  if (store) {
    Object.keys(storeConfig.actions).forEach(key => {
      actions[key] = $(store.getAction(key).bind(store));
    });
  }
  
  // Собираем effects
  const effects = {} as any;
  if (store && storeConfig.effects) {
    Object.keys(storeConfig.effects).forEach(key => {
      effects[key] = $(store.getEffect(key).bind(store));
    });
  }
  
  // Собираем selectors
  const computedSelectors = {} as any;
  if (store && storeConfig.selectors) {
    Object.keys(storeConfig.selectors).forEach(key => {
      computedSelectors[key] = useComputed$(() => 
        store.getSelector(key)()
      );
    });
  }
  
  return {
    state,
    actions,
    effects,
    ...computedSelectors,
    store,
  };
}