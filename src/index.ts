import { Store } from './core/store';
import { createLoggerMiddleware, createPersistMiddleware } from './core/middleware';
import { useQwiklyticsStore, createStoreContext } from './qwik/integration';
import { devTools, enableQwiklyticsDevTools } from './devtools';
import { createPersistPlugin } from './plugins/persist';

// Основная функция создания store
export function createStore<T, A extends Record<string, any>, E extends Record<string, any>, S extends Record<string, any>>(
  config: {
    name: string;
    initialState: T;
    actions: {
      [K in keyof A]: (state: T, payload: Parameters<A[K]>[1]) => void;
    };
    effects?: {
      [K in keyof E]: (
        context: any,
        payload: Parameters<E[K]>[0]
      ) => Promise<any>;
    };
    selectors?: {
      [K in keyof S]: (state: T) => S[K];
    };
    middlewares?: any[];
    plugins?: any[];
  }
) {
  const store = new Store(config);
  
  // Инициализируем плагины
  if (config.plugins) {
    config.plugins.forEach(plugin => {
      if (plugin.init) {
        plugin.init(store);
      }
    });
  }
  
  return store;
}

// Хелперы
export const actions = {
  create: (type: string, executor: any) => ({ type, executor }),
};

export const effects = {
  create: (type: string, executor: any) => ({ type, executor }),
};

// Комбинирование модулей
export function combineModules(modules: Record<string, any>) {
  const initialState = {} as any;
  const actions = {} as any;
  const effects = {} as any;
  const selectors = {} as any;
  
  Object.entries(modules).forEach(([name, module]) => {
    initialState[name] = module.initialState;
    Object.entries(module.actions || {}).forEach(([actionName, action]) => {
      actions[`${name}/${actionName}`] = action;
    });
    // ... аналогично для effects и selectors
  });
  
  return createStore({
    name: 'root',
    initialState,
    actions,
    effects,
    selectors,
  });
}


// Обновляем src/index.ts для экспорта хуков
export * from './qwik/hooks';

// Добавляем в основной экспорт
export {
    useStore$,
    useAction$,
    useEffector$,
    useLocalStore$,
    useStorage$,
    useAsync$,
    useDebounce$,
    useThrottle$,
    createStoreProvider$,
    createTypedContext$,
} from './qwik/hooks';


// Экспортируем все необходимое
export {
  // Core
  Store,
  
  // Middleware
  createLoggerMiddleware,
  createPersistMiddleware,
  
  // Qwik Integration
  useQwiklyticsStore,
  createStoreContext,
  
  // DevTools
  devTools,
  enableQwiklyticsDevTools,
  
  // Plugins
  createPersistPlugin,
  
  // Types
  type StoreConfig,
  type StoreContext,
};