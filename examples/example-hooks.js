import { jsxs as _jsxs, jsx as _jsx } from "@builder.io/qwik/jsx-runtime";
// Пример 1: Основной хук useStore$
export const CounterComponent = component$(() => {
    const { state, actions, doubleCount } = useStore$(counterStore, {
        selector: (state) => state.count, // Выбираем только count
        debounce: 100, // Дебаунс обновлений
    });
    return (_jsxs("div", { children: [_jsxs("div", { children: ["Count: ", state.value] }), _jsxs("div", { children: ["Double: ", doubleCount.value] }), _jsx("button", { "onClick$": () => actions.increment(1), children: "+" })] }));
});
// Пример 2: Хук useAction$ с дебаунсом
export const SearchComponent = component$(() => {
    const searchQuery = useSignal('');
    const { execute, isLoading } = useAction$(async (query) => {
        // API вызов с дебаунсом
        const results = await searchAPI(query);
        return results;
    }, {
        debounce: 300, // Автоматический дебаунс 300ms
    });
    return (_jsxs("div", { children: [_jsx("input", { value: searchQuery.value, "onInput$": (_, el) => {
                    searchQuery.value = el.value;
                    execute(el.value); // Автоматически дебаунсится
                } }), isLoading.value && _jsx("div", { children: "Searching..." })] }));
});
// Пример 3: Хук useEffector$ с обработкой состояний
export const UserProfile = component$(() => {
    const userId = useSignal('123');
    const { execute: fetchUser, data: user, isLoading, error, refetch, } = useEffector$(async (id) => {
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
    return (_jsxs("div", { children: [isLoading.value && _jsx("div", { children: "Loading..." }), error.value && _jsxs("div", { children: ["Error: ", error.value.message] }), user.value && (_jsxs("div", { children: [_jsx("h2", { children: user.value.name }), _jsx("button", { "onClick$": () => refetch(userId.value), children: "Refresh" })] }))] }));
});
// Пример 4: Локальный store с useLocalStore$
export const TodoList = component$(() => {
    const { state, addTodo, toggleTodo, createSelector } = useLocalStore$({
        todos: [],
        filter: 'all',
    }, {
        addTodo: (state, text) => {
            state.todos.push({
                id: Date.now(),
                text,
                completed: false,
            });
        },
        toggleTodo: (state, id) => {
            const todo = state.todos.find(t => t.id === id);
            if (todo) {
                todo.completed = !todo.completed;
            }
        },
    });
    // Динамический селектор
    const completedTodos = createSelector((s) => s.todos.filter(todo => todo.completed));
    return (_jsxs("div", { children: [_jsx("input", { "onKeyDown$": (ev, el) => {
                    if (ev.key === 'Enter' && el.value.trim()) {
                        addTodo(el.value.trim());
                        el.value = '';
                    }
                } }), _jsx("div", { children: state.todos.map(todo => (_jsxs("div", { children: [_jsx("input", { type: "checkbox", checked: todo.completed, "onChange$": () => toggleTodo(todo.id) }), todo.text] }, todo.id))) }), _jsxs("div", { children: ["Completed: ", completedTodos.value.length] })] }));
});
// Пример 5: Хук useStorage$ для синхронизации с localStorage
export const ThemeSwitcher = component$(() => {
    const { value: theme, setValue: setTheme } = useStorage$('app-theme', 'light', {
        watchChanges: true, // Отслеживать изменения из других вкладок
    });
    return (_jsx("div", { class: theme.value === 'dark' ? 'dark-theme' : 'light-theme', children: _jsxs("button", { "onClick$": () => setTheme(theme.value === 'light' ? 'dark' : 'light'), children: ["Switch to ", theme.value === 'light' ? 'Dark' : 'Light', " Mode"] }) }));
});
// Пример 6: Хук useAsync$ для асинхронных операций
export const DataFetcher = component$(() => {
    const { execute, data, isLoading, error, refetch } = useAsync$(async (url) => {
        const response = await fetch(url);
        if (!response.ok)
            throw new Error('Failed to fetch');
        return response.json();
    }, {
        immediate: true, // Автоматически выполнить при монтировании
        onSuccess: (data) => console.log('Data loaded:', data),
        onError: (error) => console.error('Error:', error),
    });
    return (_jsxs("div", { children: [_jsx("button", { "onClick$": () => execute('/api/data'), disabled: isLoading.value, children: isLoading.value ? 'Loading...' : 'Load Data' }), error.value && _jsxs("div", { children: ["Error: ", error.value.message] }), data.value && _jsx("pre", { children: JSON.stringify(data.value, null, 2) }), _jsx("button", { "onClick$": () => refetch(), children: "Refresh" })] }));
});
// Пример 7: Дебаунс и троттлинг
export const RealTimeInput = component$(() => {
    const inputValue = useSignal('');
    const { value: debouncedValue, isDebouncing } = useDebounce$(inputValue, 500, { leading: true, trailing: true });
    const { value: throttledValue } = useThrottle$(inputValue, 1000, { leading: true, trailing: true });
    return (_jsxs("div", { children: [_jsx("input", { value: inputValue.value, "onInput$": (_, el) => inputValue.value = el.value }), _jsxs("div", { children: ["Real-time: ", inputValue.value] }), _jsxs("div", { children: ["Debounced (500ms): ", debouncedValue.value, isDebouncing.value && ' (debouncing...)'] }), _jsxs("div", { children: ["Throttled (1s): ", throttledValue.value] })] }));
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
    return (_jsxs(StoreProvider, { children: [_jsx(CounterComponent, {}), _jsx(AnotherComponent, {})] }));
});
// Использование в дочернем компоненте
export const AnotherComponent = component$(() => {
    const state = useStoreState(); // Автоматически подписывается на изменения
    return _jsxs("div", { children: ["Count from context: ", state.count] });
});
