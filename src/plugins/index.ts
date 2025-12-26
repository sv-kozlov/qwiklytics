// src/plugins/index.ts

export type {
    HistoryAPI,
    HistoryEntry,
    HistoryPlugin,
    HistoryPluginConfig,
    HistoryState,
} from './history';
export { createHistoryPlugin } from './history';

export type { PersistConfig, PersistPlugin } from './persist';
export { createPersistPlugin } from './persist';
