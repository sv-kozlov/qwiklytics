// src/qwik/hooks.ts
import { 
  component$, 
  useSignal, 
  useStore, 
  useTask$, 
  useVisibleTask$, 
  useComputed$,
  $,
  type Signal,
  type NoSerialize,
  noSerialize
} from '@builder.io/qwik';
import { Store } from '../core/store';
import type { 
  StoreConfig, 
  StoreContext 
} from '../core/store';

// Типы для хуков
export type UseStoreOptions<T> = {
  selector?: (state: T) => any;
  equalityFn?: (a: any, b: any) => boolean;
  listenToActions?: string[];
  debounce?: number;
  throttle?: number;
};

export type UseActionOptions = {
  debounce?: number;
  throttle?: number;
  preventDefault?: boolean;
  stopPropagation?: boolean;
};

export type UseEffectOptions = {
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
  onFinally?: () => void;
  enabled?: boolean;
};

// Основной хук для использования store
export function useStore$<T, A, E, S>(
  storeConfig: StoreConfig<T, A, E, S> | (() => Store<T, A, E, S>),
  options: UseStoreOptions<T> = {}
) {
  const store = typeof storeConfig === 'function' 
    ? storeConfig() 
    : new Store(storeConfig);

  const state = useStore(store.getState());
  const error = useSignal<any>(null);
  const isLoading = useSignal(false);

  // Селектор для выбора части состояния
  const selectorFn = options.selector;
  const selectedState = selectorFn 
    ? useComputed$(() => selectorFn(state))
    : useSignal(state);

  // Функция для обновления состояния
  const updateState = $((newState: T) => {
    Object.assign(state, newState);
    if (selectorFn) {
      selectedState.value = selectorFn(state);
    }
  });

  // Подписка на изменения store
  useTask$(({ track, cleanup }) => {
    if (!store) return;

    const unsubscribe = store.subscribe((newState: T) => {
      updateState(newState);
    });

    // Отслеживаем изменения селектора
    if (selectorFn) {
      track(() => selectorFn(state));
    }

    cleanup(() => unsubscribe());
  });

  // Дебаунс/троттлинг для обновлений
  useTask$(({ track }) => {
    if (options.debounce || options.throttle) {
      track(() => state);
      // Реализация дебаунса/троттлинга
    }
  });

  // Получение actions из store
  const actions = {} as { [K in keyof A]: (payload?: any) => void };
  if (store) {
    Object.keys(storeConfig.actions || {}).forEach(key => {
      actions[key as keyof A] = $((payload?: any) => {
        const action = store.getAction(key);
        if (action) {
          action(payload);
        }
      });
    });
  }

  // Получение effects из store
  const effects = {} as { [K in keyof E]: (payload?: any) => Promise<any> };
  if (store && storeConfig.effects) {
    Object.keys(storeConfig.effects).forEach(key => {
      effects[key as keyof E] = $(async (payload?: any) => {
        isLoading.value = true;
        error.value = null;
        
        try {
          const effect = store.getEffect(key);
          const result = await effect(payload);
          return result;
        } catch (err) {
          error.value = err;
          throw err;
        } finally {
          isLoading.value = false;
        }
      });
    });
  }

  // Получение selectors из store
  const computedSelectors = {} as { [K in keyof S]: Signal<any> };
  if (store && storeConfig.selectors) {
    Object.keys(storeConfig.selectors).forEach(key => {
      computedSelectors[key as keyof S] = useComputed$(() => {
        const selector = store.getSelector(key);
        return selector ? selector() : undefined;
      });
    });
  }

  return {
    state: selectorFn ? selectedState : state,
    actions,
    effects,
    ...computedSelectors,
    isLoading,
    error,
    store,
    // Вспомогательные методы
    setState: $((partial: Partial<T>) => {
      const currentState = { ...state, ...partial };
      updateState(currentState as T);
    }),
    reset: $(() => {
      updateState(storeConfig.initialState);
    }),
    subscribe: $((listener: (state: T) => void) => {
      return store.subscribe(listener);
    }),
  };
}

// Хук для использования отдельного action
export function useAction$<P = void, R = void>(
  actionFn: (payload: P) => R | Promise<R>,
  options: UseActionOptions = {}
) {
  const isLoading = useSignal(false);
  const error = useSignal<any>(null);
  const lastResult = useSignal<R | null>(null);

  let debounceTimer: any = null;
  let throttleTimer: any = null;
  let lastCallTime = 0;

  const execute = $(async (payload: P, event?: Event) => {
    // Обработка событий DOM
    if (event) {
      if (options.preventDefault) {
        event.preventDefault();
      }
      if (options.stopPropagation) {
        event.stopPropagation();
      }
    }

    // Дебаунс
    if (options.debounce) {
      clearTimeout(debounceTimer);
      return new Promise<R>((resolve) => {
        debounceTimer = setTimeout(async () => {
          try {
            isLoading.value = true;
            const result = await actionFn(payload);
            lastResult.value = result;
            resolve(result);
          } catch (err) {
            error.value = err;
            throw err;
          } finally {
            isLoading.value = false;
          }
        }, options.debounce);
      });
    }

    // Троттлинг
    if (options.throttle) {
      const now = Date.now();
      if (now - lastCallTime < options.throttle) {
        return Promise.resolve(lastResult.value as R);
      }
      lastCallTime = now;
    }

    // Обычное выполнение
    try {
      isLoading.value = true;
      error.value = null;
      const result = await actionFn(payload);
      lastResult.value = result;
      return result;
    } catch (err) {
      error.value = err;
      throw err;
    } finally {
      isLoading.value = false;
    }
  });

  return {
    execute,
    isLoading,
    error,
    lastResult,
    // Синхронная версия (без обработки промисов)
    executeSync: $((payload: P, event?: Event) => {
      if (event) {
        if (options.preventDefault) event.preventDefault();
        if (options.stopPropagation) event.stopPropagation();
      }
      return actionFn(payload);
    }),
  };
}

// Хук для использования эффектов с состояниями загрузки/ошибки
export function useEffector$<P = void, R = any>(
  effectFn: (payload: P) => Promise<R>,
  options: UseEffectOptions = {}
) {
  const isLoading = useSignal(false);
  const error = useSignal<any>(null);
  const data = useSignal<R | null>(null);
  const isEnabled = useSignal(options.enabled ?? true);

  const execute = $(async (payload: P): Promise<R> => {
    if (!isEnabled.value) {
      throw new Error('Effect is disabled');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const result = await effectFn(payload);
      data.value = result;
      
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      
      return result;
    } catch (err) {
      error.value = err;
      
      if (options.onError) {
        options.onError(err);
      }
      
      throw err;
    } finally {
      isLoading.value = false;
      
      if (options.onFinally) {
        options.onFinally();
      }
    }
  });

  const reset = $(() => {
    isLoading.value = false;
    error.value = null;
    data.value = null;
  });

  const enable = $(() => {
    isEnabled.value = true;
  });

  const disable = $(() => {
    isEnabled.value = false;
  });

  return {
    execute,
    isLoading,
    error,
    data,
    isEnabled,
    reset,
    enable,
    disable,
    // Перезапуск с теми же параметрами
    refetch: $((payload: P) => execute(payload)),
  };
}

// Хук для селекторов с мемоизацией
export function useSelector$<T, R>(
  selectorFn: (state: T) => R,
  deps: any[] = [],
  equalityFn: (a: R, b: R) => boolean = (a, b) => a === b
) {
  const value = useSignal<R | null>(null);
  const prevDeps = useSignal<any[]>([]);
  const prevValue = useSignal<R | null>(null);

  useTask$(({ track }) => {
    // Отслеживаем зависимости
    deps.forEach(dep => track(() => dep));
    
    // Проверяем, изменились ли зависимости
    const depsChanged = deps.some((dep, index) => 
      !equalityFn(dep, prevDeps.value[index])
    );
    
    if (depsChanged) {
      // Получаем текущее значение из store (нужно передавать state)
      // В реальном использовании state будет приходить из контекста
      prevDeps.value = [...deps];
      // Вычисляем новое значение
      const newValue = selectorFn({} as T); // Заглушка, в реальности будет state
      
      if (!equalityFn(newValue, prevValue.value)) {
        value.value = newValue;
        prevValue.value = newValue;
      }
    }
  });

  return value;
}

// Хук для создания локального store (похож на useState в React)
export function useLocalStore$<T extends object>(
  initialState: T | (() => T),
  actions?: Record<string, (state: T, ...args: any[]) => void>
) {
  const state = useStore(
    typeof initialState === 'function' 
      ? (initialState as () => T)() 
      : initialState
  );

  // Создаем actions
  const boundActions = useStore<Record<string, (...args: any[]) => void>>({});
  
  useVisibleTask$(() => {
    if (actions) {
      Object.keys(actions).forEach(key => {
        boundActions[key] = (...args: any[]) => {
          const action = actions[key];
          // Используем immer-like мутации
          const draft = { ...state };
          action(draft as T, ...args);
          Object.assign(state, draft);
        };
      });
    }
  });

  // Селекторы
  const createSelector = $((selectorFn: (state: T) => any) => {
    return useComputed$(() => selectorFn(state));
  });

  return {
    state,
    ...boundActions,
    createSelector,
    setState: $((partial: Partial<T> | ((prev: T) => T)) => {
      if (typeof partial === 'function') {
        const newState = partial(state);
        Object.assign(state, newState);
      } else {
        Object.assign(state, partial);
      }
    }),
    reset: $(() => {
      const initial = typeof initialState === 'function' 
        ? (initialState as () => T)() 
        : initialState;
      Object.assign(state, initial);
    }),
  };
}

// Хук для подписки на изменения store с дебаунсом
export function useStoreSubscription$<T>(
  store: Store<any, any, any, any>,
  listener: (state: T) => void,
  options: {
    debounce?: number;
    throttle?: number;
    selector?: (state: T) => any;
    equalityFn?: (a: any, b: any) => boolean;
  } = {}
) {
  const isSubscribed = useSignal(false);

  useTask$(({ cleanup }) => {
    if (!store) return;

    let lastValue: any;
    let debounceTimer: any;
    let lastCallTime = 0;

    const wrappedListener = (state: T) => {
      let value = state;
      
      // Применяем селектор
      if (options.selector) {
        value = options.selector(state);
      }
      
      // Проверяем равенство
      if (options.equalityFn && options.equalityFn(value, lastValue)) {
        return;
      }
      
      lastValue = value;

      // Дебаунс
      if (options.debounce) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          listener(value);
        }, options.debounce);
        return;
      }

      // Троттлинг
      if (options.throttle) {
        const now = Date.now();
        if (now - lastCallTime < options.throttle) {
          return;
        }
        lastCallTime = now;
      }

      // Немедленный вызов
      listener(value);
    };

    const unsubscribe = store.subscribe(wrappedListener);
    isSubscribed.value = true;

    cleanup(() => {
      unsubscribe();
      isSubscribed.value = false;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    });
  });

  return {
    isSubscribed,
    unsubscribe: $(() => {
      isSubscribed.value = false;
    }),
  };
}

// Хук для оптимизированных массовых обновлений
export function useBatchUpdates$() {
  const batchQueue = useSignal<any[]>([]);
  const isBatching = useSignal(false);

  const startBatch = $(() => {
    isBatching.value = true;
    batchQueue.value = [];
  });

  const addToBatch = $((update: any) => {
    if (isBatching.value) {
      batchQueue.value.push(update);
    } else {
      // Немедленное выполнение
      update();
    }
  });

  const commitBatch = $(async () => {
    if (!isBatching.value) return;

    // Выполняем все обновления
    for (const update of batchQueue.value) {
      await update();
    }

    // Очищаем очередь
    batchQueue.value = [];
    isBatching.value = false;
  });

  const cancelBatch = $(() => {
    batchQueue.value = [];
    isBatching.value = false;
  });

  return {
    startBatch,
    addToBatch,
    commitBatch,
    cancelBatch,
    isBatching,
  };
}

// Хук для реактивного значения с поддержкой трансформаций
export function useReactive$<T>(
  initialValue: T,
  options: {
    transformer?: (value: T) => T;
    validator?: (value: T) => boolean;
    onChanged?: (value: T) => void;
  } = {}
) {
  const value = useSignal(initialValue);
  const isValid = useSignal(true);
  const error = useSignal<string | null>(null);

  const setValue = $((newValue: T | ((prev: T) => T)) => {
    let finalValue: T;
    
    if (typeof newValue === 'function') {
      finalValue = (newValue as (prev: T) => T)(value.value);
    } else {
      finalValue = newValue;
    }

    // Применяем трансформацию
    if (options.transformer) {
      finalValue = options.transformer(finalValue);
    }

    // Валидация
    if (options.validator) {
      const valid = options.validator(finalValue);
      isValid.value = valid;
      if (!valid) {
        error.value = 'Validation failed';
      } else {
        error.value = null;
      }
    }

    // Обновляем значение
    value.value = finalValue;

    // Колбэк при изменении
    if (options.onChanged) {
      options.onChanged(finalValue);
    }
  });

  const reset = $(() => {
    value.value = initialValue;
    isValid.value = true;
    error.value = null;
  });

  // Производные значения
  const derived = useComputed$(() => value.value);

  return {
    value,
    setValue,
    reset,
    isValid,
    error,
    derived,
    // Утилиты для работы с массивами
    push: $((item: any) => {
      if (Array.isArray(value.value)) {
        setValue([...value.value, item] as any);
      }
    }),
    pop: $(() => {
      if (Array.isArray(value.value)) {
        const newArray = [...value.value];
        newArray.pop();
        setValue(newArray as any);
      }
    }),
    // Утилиты для работы с объектами
    setField: $((field: string, fieldValue: any) => {
      if (typeof value.value === 'object' && value.value !== null) {
        setValue({
          ...value.value,
          [field]: fieldValue,
        } as any);
      }
    }),
  };
}

// Хук для синхронизации с localStorage/sessionStorage
export function useStorage$<T>(
  key: string,
  initialValue: T,
  options: {
    storage?: 'local' | 'session';
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
    watchChanges?: boolean; // Отслеживать изменения из других вкладок
  } = {}
) {
  const storage = options.storage === 'session' 
    ? (typeof window !== 'undefined' ? sessionStorage : null)
    : (typeof window !== 'undefined' ? localStorage : null);

  const serialize = options.serialize || JSON.stringify;
  const deserialize = options.deserialize || JSON.parse;

  const value = useSignal<T>(initialValue);
  const isPersisted = useSignal(false);

  // Загрузка из storage
  useVisibleTask$(() => {
    if (!storage) return;

    try {
      const stored = storage.getItem(key);
      if (stored !== null) {
        const parsed = deserialize(stored);
        value.value = parsed;
        isPersisted.value = true;
      }
    } catch (error) {
      console.warn(`Failed to load from storage (${key}):`, error);
    }

    // Отслеживание изменений из других вкладок
    if (options.watchChanges) {
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === key && e.newValue !== null) {
          try {
            const parsed = deserialize(e.newValue);
            value.value = parsed;
          } catch (error) {
            console.warn(`Failed to parse storage change (${key}):`, error);
          }
        }
      };

      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  });

  // Сохранение в storage
  useTask$(({ track }) => {
    if (!storage) return;

    const currentValue = track(() => value.value);
    
    try {
      storage.setItem(key, serialize(currentValue));
      isPersisted.value = true;
    } catch (error) {
      console.warn(`Failed to save to storage (${key}):`, error);
      isPersisted.value = false;
    }
  });

  const clear = $(() => {
    if (storage) {
      storage.removeItem(key);
      value.value = initialValue;
      isPersisted.value = false;
    }
  });

  const remove = $(() => {
    if (storage) {
      storage.removeItem(key);
      isPersisted.value = false;
    }
  });

  return {
    value,
    setValue: $((newValue: T | ((prev: T) => T)) => {
      if (typeof newValue === 'function') {
        value.value = (newValue as (prev: T) => T)(value.value);
      } else {
        value.value = newValue;
      }
    }),
    clear,
    remove,
    isPersisted,
    // Принудительное сохранение
    persist: $(() => {
      if (storage) {
        try {
          storage.setItem(key, serialize(value.value));
          isPersisted.value = true;
        } catch (error) {
          console.warn(`Failed to persist (${key}):`, error);
        }
      }
    }),
  };
}

// Хук для управления состоянием загрузки/ошибки
export function useAsync$<T, P extends any[]>(
  asyncFn: (...args: P) => Promise<T>,
  options: {
    immediate?: boolean;
    initialData?: T;
    onSuccess?: (data: T) => void;
    onError?: (error: any) => void;
  } = {}
) {
  const data = useSignal<T | null>(options.initialData || null);
  const isLoading = useSignal(false);
  const error = useSignal<any>(null);
  const isSuccess = useSignal(false);
  const isError = useSignal(false);

  const execute = $(async (...args: P): Promise<T> => {
    isLoading.value = true;
    error.value = null;
    isSuccess.value = false;
    isError.value = false;

    try {
      const result = await asyncFn(...args);
      data.value = result;
      isSuccess.value = true;
      
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      
      return result;
    } catch (err) {
      error.value = err;
      isError.value = true;
      
      if (options.onError) {
        options.onError(err);
      }
      
      throw err;
    } finally {
      isLoading.value = false;
    }
  });

  const reset = $(() => {
    data.value = options.initialData || null;
    error.value = null;
    isLoading.value = false;
    isSuccess.value = false;
    isError.value = false;
  });

  // Автоматический вызов при монтировании
  useVisibleTask$(() => {
    if (options.immediate) {
      execute(...([] as unknown as P));
    }
  });

  return {
    execute,
    data,
    isLoading,
    error,
    isSuccess,
    isError,
    reset,
    // Перезапуск с теми же аргументами
    refetch: $(() => {
      // Храним последние аргументы
      // В реальной реализации нужно хранить их в signal
    }),
  };
}

// Хук для создания контекста с типизацией
export function createTypedContext$<T>() {
  const contextId = createContextId<T>('qwiklytics-typed-context');
  
  const useContext$ = () => {
    const context = useContext(contextId);
    if (!context) {
      throw new Error('Context not found. Make sure to wrap with Provider.');
    }
    return context;
  };
  
  const Provider = component$(({ value, children }: { value: T; children?: any }) => {
    useContextProvider(contextId, value);
    return children;
  });
  
  return {
    useContext$,
    Provider,
    Context: contextId,
  };
}

// Хук для дебаунса значений
export function useDebounce$<T>(
  value: Signal<T>,
  delay: number,
  options?: {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
  }
) {
  const debouncedValue = useSignal(value.value);
  const isDebouncing = useSignal(false);

  useTask$(({ track, cleanup }) => {
    const currentValue = track(() => value.value);
    let timeoutId: any;
    let maxTimeoutId: any;
    let lastCallTime = 0;
    let leadingCalled = false;

    const clearTimers = () => {
      clearTimeout(timeoutId);
      clearTimeout(maxTimeoutId);
    };

    const updateValue = () => {
      debouncedValue.value = currentValue;
      isDebouncing.value = false;
      leadingCalled = false;
    };

    // Leading edge
    if (options?.leading && !leadingCalled) {
      updateValue();
      leadingCalled = true;
      return;
    }

    clearTimers();

    // Max wait
    if (options?.maxWait) {
      const now = Date.now();
      if (now - lastCallTime >= options.maxWait) {
        updateValue();
        return;
      }
      maxTimeoutId = setTimeout(updateValue, options.maxWait - (now - lastCallTime));
    }

    // Дебаунс
    isDebouncing.value = true;
    timeoutId = setTimeout(updateValue, delay);
    lastCallTime = Date.now();

    cleanup(clearTimers);
  });

  return {
    value: debouncedValue,
    isDebouncing,
    // Принудительное обновление
    flush: $(() => {
      debouncedValue.value = value.value;
      isDebouncing.value = false;
    }),
    // Отмена дебаунса
    cancel: $(() => {
      isDebouncing.value = false;
    }),
  };
}

// Хук для троттлинга
export function useThrottle$<T>(
  value: Signal<T>,
  interval: number,
  options?: {
    leading?: boolean;
    trailing?: boolean;
  }
) {
  const throttledValue = useSignal(value.value);
  const lastExecuted = useSignal(0);
  const trailingValue = useSignal<T | null>(null);
  const timeoutId = useSignal<any>(null);

  useTask$(({ track, cleanup }) => {
    const currentValue = track(() => value.value);
    const now = Date.now();

    const execute = () => {
      throttledValue.value = trailingValue.value !== null 
        ? trailingValue.value 
        : currentValue;
      lastExecuted.value = now;
      trailingValue.value = null;
      timeoutId.value = null;
    };

    // Проверяем, можно ли выполнить сразу
    if (lastExecuted.value === 0 && options?.leading !== false) {
      execute();
      return;
    }

    // Сохраняем значение для trailing edge
    if (options?.trailing !== false) {
      trailingValue.value = currentValue;
    }

    // Очищаем предыдущий таймер
    if (timeoutId.value) {
      clearTimeout(timeoutId.value);
    }

    // Устанавливаем новый таймер
    const timeSinceLastExec = now - lastExecuted.value;
    const delay = Math.max(interval - timeSinceLastExec, 0);

    timeoutId.value = setTimeout(execute, delay);

    cleanup(() => {
      if (timeoutId.value) {
        clearTimeout(timeoutId.value);
      }
    });
  });

  return {
    value: throttledValue,
    // Принудительное выполнение
    flush: $(() => {
      if (trailingValue.value !== null) {
        throttledValue.value = trailingValue.value;
        trailingValue.value = null;
      }
    }),
  };
}

// Компонент-обертка для Provider
export function createStoreProvider$<T, A, E, S>(
  storeConfig: StoreConfig<T, A, E, S>,
  options?: {
    onInit?: (store: Store<T, A, E, S>) => void;
    onDestroy?: (store: Store<T, A, E, S>) => void;
  }
) {
  const { useContext$, Provider } = createTypedContext$<Store<T, A, E, S>>();

  const StoreProvider = component$(({ children }: { children?: any }) => {
    const store = useStore$(storeConfig).store as Store<T, A, E, S>;

    useVisibleTask$(() => {
      if (options?.onInit) {
        options.onInit(store);
      }

      return () => {
        if (options?.onDestroy) {
          options.onDestroy(store);
        }
      };
    });

    return <Provider value={store}>{children}</Provider>;
  });

  return {
    StoreProvider,
    useStore: useContext$,
    useStoreState: () => {
      const store = useContext$();
      const state = useStore(store.getState());
      
      useTask$(({ cleanup }) => {
        const unsubscribe = store.subscribe((newState) => {
          Object.assign(state, newState);
        });
        
        cleanup(() => unsubscribe());
      });
      
      return state;
    },
  };
}

// Дополнительные хуки в том же файле hooks.ts

// Хук для предыдущего значения
export function usePrevious$<T>(value: Signal<T>) {
    const previous = useSignal<T | undefined>(undefined);

    useTask$(({ track }) => {
        const current = track(() => value.value);
        previous.value = current;
    });

    return previous;
}

// Хук для определения, изменилось ли значение
export function useHasChanged$<T>(value: Signal<T>) {
    const previous = usePrevious$(value);
    const hasChanged = useComputed$(() =>
        previous.value !== undefined && previous.value !== value.value
    );

    return {
        hasChanged,
        previous,
        current: value,
    };
}

// Хук для управления булевыми состояниями
export function useToggle$(initialValue = false) {
    const value = useSignal(initialValue);

    const toggle = $(() => {
        value.value = !value.value;
    });

    const setTrue = $(() => {
        value.value = true;
    });

    const setFalse = $(() => {
        value.value = false;
    });

    const set = $((newValue: boolean) => {
        value.value = newValue;
    });

    return {
        value,
        toggle,
        setTrue,
        setFalse,
        set,
    };
}

// Хук для работы с интервалами
export function useInterval$(callback: () => void, delay: number | null) {
    useVisibleTask$(({ cleanup }) => {
        if (delay === null) return;

        const intervalId = setInterval(callback, delay);
        cleanup(() => clearInterval(intervalId));
    });
}

// Хук для работы с таймаутами
export function useTimeout$(callback: () => void, delay: number | null) {
    useVisibleTask$(({ cleanup }) => {
        if (delay === null) return;

        const timeoutId = setTimeout(callback, delay);
        cleanup(() => clearTimeout(timeoutId));
    });
}

// Хук для измерения размера элемента
export function useElementSize$() {
    const ref = useSignal<Element>();
    const size = useStore({ width: 0, height: 0 });

    useVisibleTask$(({ cleanup }) => {
        if (!ref.value) return;

        const updateSize = () => {
            if (ref.value) {
                const rect = ref.value.getBoundingClientRect();
                size.width = rect.width;
                size.height = rect.height;
            }
        };

        updateSize();

        const observer = new ResizeObserver(updateSize);
        observer.observe(ref.value);

        cleanup(() => {
            if (ref.value) {
                observer.unobserve(ref.value);
            }
        });
    });

    return {
        ref,
        size,
    };
}

// Хук для обработки кликов вне элемента
export function useClickOutside$(callback: () => void) {
    const ref = useSignal<Element>();

    useVisibleTask$(({ cleanup }) => {
        if (!ref.value) return;

        const handleClick = (event: MouseEvent) => {
            if (ref.value && !ref.value.contains(event.target as Node)) {
                callback();
            }
        };

        document.addEventListener('mousedown', handleClick);
        cleanup(() => document.removeEventListener('mousedown', handleClick));
    });

    return ref;
}

// Экспорт всех хуков
export {
  // Реэкспорт Qwik хуков для удобства
  component$,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
  useComputed$,
  $,
  useContext,
  useContextProvider,
  createContextId,
  type Signal,
  type NoSerialize,
  noSerialize,
};