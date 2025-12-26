// src/qwik/index.ts

// Интеграция (Context/Provider + типы конфигурации)
export { createStoreContext } from './integration';
export type { StoreConfig } from './integration';

// Основные Qwik-хуки (store + селекторы + реэкспорт хуков плагинов)
export {
    useStore$,
    useSelector$,
    useHistoryPlugin$,
} from './hooks';

export type {
    UseStoreOptions,
    UseStoreResult,
    HistoryHookResult,
} from './hooks';
