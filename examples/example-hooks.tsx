// Пример 1: Основной хук useStore$
export const CounterComponent = component$(() => {
  const { state, actions, doubleCount } = useStore$(counterStore, {
    selector: (state) => state.count, // Выбираем только count
    debounce: 100, // Дебаунс обновлений
  });

  return (
    <div>
      <div>Count: {state.value}</div>
      <div>Double: {doubleCount.value}</div>
      <button onClick$={() => actions.increment(1)}>+</button>
    </div>
  );
});

// Пример 2: Хук useAction$ с дебаунсом
export const SearchComponent = component$(() => {
  const searchQuery = useSignal('');
  
  const { execute, isLoading } = useAction$(async (query: string) => {
    // API вызов с дебаунсом
    const results = await searchAPI(query);
    return results;
  }, {
    debounce: 300, // Автоматический дебаунс 300ms
  });

  return (
    <div>
      <input 
        value={searchQuery.value}
        onInput$={(_, el) => {
          searchQuery.value = el.value;
          execute(el.value); // Автоматически дебаунсится
        }}
      />
      {isLoading.value && <div>Searching...</div>}
    </div>
  );
});

// Пример 3: Хук useEffector$ с обработкой состояний
export const UserProfile = component$(() => {
  const userId = useSignal('123');
  
  const {
    execute: fetchUser,
    data: user,
    isLoading,
    error,
    refetch,
  } = useEffector$(async (id: string) => {
    return await userAPI.fetch(id);
  }, {
    onSuccess: (user) => {
      console.log('User loaded:', user.name);
    },
    onError: (error) => {
      console.error('Failed to load user:', error);
    },
    enabled: !!userId.value, // Автоматически отключается если userId пустой
  });

  useVisibleTask$(({ track }) => {
    const id = track(() => userId.value);
    if (id) {
      fetchUser(id);
    }
  });

  return (
    <div>
      {isLoading.value && <div>Loading...</div>}
      {error.value && <div>Error: {error.value.message}</div>}
      {user.value && (
        <div>
          <h2>{user.value.name}</h2>
          <button onClick$={() => refetch(userId.value)}>
            Refresh
          </button>
        </div>
      )}
    </div>
  );
});

// Пример 4: Локальный store с useLocalStore$
export const TodoList = component$(() => {
  const { state, addTodo, toggleTodo, createSelector } = useLocalStore$(
    {
      todos: [] as Array<{ id: number; text: string; completed: boolean }>,
      filter: 'all',
    },
    {
      addTodo: (state, text: string) => {
        state.todos.push({
          id: Date.now(),
          text,
          completed: false,
        });
      },
      toggleTodo: (state, id: number) => {
        const todo = state.todos.find(t => t.id === id);
        if (todo) {
          todo.completed = !todo.completed;
        }
      },
    }
  );

  // Динамический селектор
  const completedTodos = createSelector((s) => 
    s.todos.filter(todo => todo.completed)
  );

  return (
    <div>
      <input 
        onKeyDown$={(ev, el) => {
          if (ev.key === 'Enter' && el.value.trim()) {
            addTodo(el.value.trim());
            el.value = '';
          }
        }}
      />
      <div>
        {state.todos.map(todo => (
          <div key={todo.id}>
            <input 
              type="checkbox" 
              checked={todo.completed}
              onChange$={() => toggleTodo(todo.id)}
            />
            {todo.text}
          </div>
        ))}
      </div>
      <div>Completed: {completedTodos.value.length}</div>
    </div>
  );
});

// Пример 5: Хук useStorage$ для синхронизации с localStorage
export const ThemeSwitcher = component$(() => {
  const { value: theme, setValue: setTheme } = useStorage$('app-theme', 'light', {
    watchChanges: true, // Отслеживать изменения из других вкладок
  });

  return (
    <div class={theme.value === 'dark' ? 'dark-theme' : 'light-theme'}>
      <button onClick$={() => 
        setTheme(theme.value === 'light' ? 'dark' : 'light')
      }>
        Switch to {theme.value === 'light' ? 'Dark' : 'Light'} Mode
      </button>
    </div>
  );
});

// Пример 6: Хук useAsync$ для асинхронных операций
export const DataFetcher = component$(() => {
  const { execute, data, isLoading, error, refetch } = useAsync$(
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    {
      immediate: true, // Автоматически выполнить при монтировании
      onSuccess: (data) => console.log('Data loaded:', data),
      onError: (error) => console.error('Error:', error),
    }
  );

  return (
    <div>
      <button onClick$={() => execute('/api/data')} disabled={isLoading.value}>
        {isLoading.value ? 'Loading...' : 'Load Data'}
      </button>
      {error.value && <div>Error: {error.value.message}</div>}
      {data.value && <pre>{JSON.stringify(data.value, null, 2)}</pre>}
      <button onClick$={() => refetch()}>Refresh</button>
    </div>
  );
});

// Пример 7: Дебаунс и троттлинг
export const RealTimeInput = component$(() => {
  const inputValue = useSignal('');
  
  const { value: debouncedValue, isDebouncing } = useDebounce$(
    inputValue,
    500,
    { leading: true, trailing: true }
  );
  
  const { value: throttledValue } = useThrottle$(
    inputValue,
    1000,
    { leading: true, trailing: true }
  );

  return (
    <div>
      <input 
        value={inputValue.value}
        onInput$={(_, el) => inputValue.value = el.value}
      />
      <div>Real-time: {inputValue.value}</div>
      <div>Debounced (500ms): {debouncedValue.value} 
        {isDebouncing.value && ' (debouncing...)'}
      </div>
      <div>Throttled (1s): {throttledValue.value}</div>
    </div>
  );
});

// Пример 8: Store Provider с типизированным контекстом
const { StoreProvider, useStoreState } = createStoreProvider$(counterStore, {
  onInit: (store) => {
    console.log('Store initialized:', store.name);
    // Восстановление из localStorage и т.д.
  },
  onDestroy: (store) => {
    console.log('Store destroyed:', store.name);
    // Очистка ресурсов
  },
});

// Обертка приложения
export const App = component$(() => {
  return (
    <StoreProvider>
      <CounterComponent />
      <AnotherComponent />
    </StoreProvider>
  );
});

// Использование в дочернем компоненте
export const AnotherComponent = component$(() => {
  const state = useStoreState(); // Автоматически подписывается на изменения
  
  return <div>Count from context: {state.count}</div>;
});