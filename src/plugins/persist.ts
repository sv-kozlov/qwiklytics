// src/plugins/persist.ts
export interface PersistConfig {
  key: string;
  storage?: Storage;
  whitelist?: string[];
  blacklist?: string[];
  migrate?: (oldState: any) => any;
  version?: number;
}

export function createPersistPlugin(config: PersistConfig) {
  const storage = config.storage || 
    (typeof window !== 'undefined' ? localStorage : null);
  
  return {
    name: 'persist',
    
    init(store: any) {
      if (!storage) return;
      
      // Загружаем сохраненное состояние
      const saved = storage.getItem(config.key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          
          // Проверяем версию
          if (config.version && parsed._version !== config.version) {
            if (config.migrate) {
              const migrated = config.migrate(parsed);
              store.hydrate(migrated);
            }
          } else {
            // Фильтруем по whitelist/blacklist
            let stateToRestore = parsed;
            if (config.whitelist) {
              stateToRestore = config.whitelist.reduce((acc, key) => {
                acc[key] = parsed[key];
                return acc;
              }, {} as any);
            } else if (config.blacklist) {
              stateToRestore = { ...parsed };
              config.blacklist.forEach(key => delete stateToRestore[key]);
            }
            
            store.hydrate(stateToRestore);
          }
        } catch (error) {
          console.error('Failed to load persisted state:', error);
        }
      }
      
      // Подписываемся на изменения
      return store.subscribe((state: any) => {
        try {
          // Добавляем версию
          const stateToSave = {
            ...state,
            _version: config.version || 1,
            _timestamp: Date.now(),
          };
          
          storage.setItem(config.key, JSON.stringify(stateToSave));
        } catch (error) {
          console.error('Failed to persist state:', error);
        }
      });
    },
  };
}