// src/plugins/index.ts
export * from './persist';
export * from './history';

// Реэкспорт типов
export type {
  PersistConfig,
  Storage,
  PersistPlugin,
} from './persist';

export type {
  HistoryPluginConfig,
  HistoryEntry,
  HistoryState,
  HistoryPlugin,
  HistoryAPI,
} from './history';

// Базовые типы для всех плагинов
export interface Plugin {
  name: string;
  version?: string;
  init?: (store: any, config?: any) => any;
  destroy?: (store: any) => void;
  api?: Record<string, any>;
  middleware?: any;
}

export interface PluginConfig {
  [key: string]: any;
}

// Реестр плагинов для автоматической загрузки
export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private instances: Map<string, any> = new Map();

  register(plugin: Plugin) {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin "${plugin.name}" is already registered`);
      return;
    }
    
    this.plugins.set(plugin.name, plugin);
    
    // Автоматически добавляем в глобальный объект для DevTools
    if (typeof window !== 'undefined') {
      if (!(window as any).__QWIKLYTICS_PLUGINS) {
        (window as any).__QWIKLYTICS_PLUGINS = {};
      }
      (window as any).__QWIKLYTICS_PLUGINS[plugin.name] = plugin;
    }
  }

  unregister(name: string) {
    const plugin = this.plugins.get(name);
    if (plugin?.destroy && this.instances.has(name)) {
      plugin.destroy(this.instances.get(name));
    }
    
    this.plugins.delete(name);
    this.instances.delete(name);
    
    if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_PLUGINS) {
      delete (window as any).__QWIKLYTICS_PLUGINS[name];
    }
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  initializePlugin(name: string, store: any, config?: any): any {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin "${name}" is not registered`);
    }

    if (this.instances.has(name)) {
      console.warn(`Plugin "${name}" is already initialized`);
      return this.instances.get(name);
    }

    let instance = null;
    if (plugin.init) {
      instance = plugin.init(store, config);
    }

    this.instances.set(name, instance || plugin);
    return instance;
  }

  getInstance(name: string): any {
    return this.instances.get(name);
  }

  destroyPlugin(name: string) {
    const plugin = this.plugins.get(name);
    const instance = this.instances.get(name);
    
    if (plugin?.destroy && instance) {
      plugin.destroy(instance);
    }
    
    this.instances.delete(name);
  }

  destroyAll() {
    this.instances.forEach((instance, name) => {
      const plugin = this.plugins.get(name);
      if (plugin?.destroy) {
        plugin.destroy(instance);
      }
    });
    
    this.instances.clear();
    this.plugins.clear();
    
    if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_PLUGINS) {
      (window as any).__QWIKLYTICS_PLUGINS = {};
    }
  }

  // Статический синглтон
  private static instance: PluginRegistry;
  
  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }
}

// Глобальный реестр плагинов
export const pluginRegistry = PluginRegistry.getInstance();

// Утилиты для создания плагинов
export function createPlugin<T extends PluginConfig = PluginConfig>(
  name: string,
  factory: (config?: T) => Plugin
) {
  return (config?: T) => {
    const plugin = factory(config);
    pluginRegistry.register(plugin);
    return plugin;
  };
}

// Встроенные middleware для плагинов
export function createPluginMiddleware(pluginName: string, middleware: any) {
  return {
    name: `plugin:${pluginName}`,
    ...middleware,
  };
}

// Плагин для логирования (встроенный)
export const createLoggerPlugin = createPlugin(
  'logger',
  (config: { level?: 'info' | 'warn' | 'error' } = {}) => ({
    name: 'logger',
    version: '1.0.0',
    init(store: any) {
      const level = config.level || 'info';
      
      const loggerMiddleware = {
        process: (prevState: any, nextState: any) => {
          if (level === 'info') {
            console.group(`Store: ${store.name}`);
            console.log('Previous state:', prevState);
            console.log('Next state:', nextState);
            console.groupEnd();
          }
          return nextState;
        },
        onAction: (action: any) => {
          if (level === 'info') {
            console.log(`Action: ${action.type}`, action.payload);
          }
        },
      };
      
      // Добавляем middleware в store
      store.middlewares.push(loggerMiddleware);
      
      return {
        setLevel: (newLevel: 'info' | 'warn' | 'error') => {
          level = newLevel;
        },
        log: (message: string, data?: any) => {
          console.log(`[${store.name}] ${message}`, data);
        },
        warn: (message: string, data?: any) => {
          console.warn(`[${store.name}] ${message}`, data);
        },
        error: (message: string, data?: any) => {
          console.error(`[${store.name}] ${message}`, data);
        },
      };
    },
    destroy(store: any) {
      // Удаляем middleware при уничтожении
      store.middlewares = store.middlewares.filter(
        (m: any) => m.name !== 'plugin:logger'
      );
    },
  })
);

// Плагин для аналитики
export const createAnalyticsPlugin = createPlugin(
  'analytics',
  (config: { 
    track: (event: string, data: any) => void;
    enabled?: boolean;
  }) => ({
    name: 'analytics',
    version: '1.0.0',
    init(store: any) {
      const isEnabled = config.enabled ?? true;
      
      const analyticsMiddleware = {
        process: (prevState: any, nextState: any) => {
          if (!isEnabled) return nextState;
          
          // Отслеживаем изменения состояния
          const changes = getStateChanges(prevState, nextState);
          if (Object.keys(changes).length > 0) {
            config.track('state_changed', {
              store: store.name,
              changes,
              timestamp: Date.now(),
            });
          }
          
          return nextState;
        },
        onAction: (action: any) => {
          if (!isEnabled) return;
          
          config.track('action_dispatched', {
            store: store.name,
            action: action.type,
            payload: action.payload,
            timestamp: Date.now(),
          });
        },
      };
      
      store.middlewares.push(analyticsMiddleware);
      
      return {
        enable: () => { isEnabled = true; },
        disable: () => { isEnabled = false; },
        isEnabled: () => isEnabled,
        trackCustomEvent: (event: string, data: any) => {
          if (isEnabled) {
            config.track(event, { ...data, store: store.name });
          }
        },
      };
    },
    destroy(store: any) {
      store.middlewares = store.middlewares.filter(
        (m: any) => m.name !== 'plugin:analytics'
      );
    },
  })
);

// Плагин для валидации состояния
export const createValidationPlugin = createPlugin(
  'validation',
  (config: {
    schema?: any; // JSON Schema, Zod, Yup и т.д.
    validate?: (state: any) => { valid: boolean; errors: string[] };
    onInvalid?: (state: any, errors: string[]) => void;
  }) => ({
    name: 'validation',
    version: '1.0.0',
    init(store: any) {
      const validationMiddleware = {
        process: (prevState: any, nextState: any) => {
          if (config.validate) {
            const result = config.validate(nextState);
            if (!result.valid) {
              if (config.onInvalid) {
                config.onInvalid(nextState, result.errors);
              }
              // Можно вернуть предыдущее состояние или выбросить ошибку
              console.error('State validation failed:', result.errors);
              // return prevState; // Откат изменений
            }
          }
          return nextState;
        },
      };
      
      store.middlewares.push(validationMiddleware);
      
      return {
        validateState: (state: any) => {
          if (config.validate) {
            return config.validate(state);
          }
          return { valid: true, errors: [] };
        },
        resetValidation: () => {
          // Сброс валидации
        },
      };
    },
    destroy(store: any) {
      store.middlewares = store.middlewares.filter(
        (m: any) => m.name !== 'plugin:validation'
      );
    },
  })
);

// Плагин для синхронизации между вкладками (BroadcastChannel)
export const createBroadcastPlugin = createPlugin(
  'broadcast',
  (config: {
    channelName?: string;
    syncActions?: boolean;
    syncState?: boolean;
  }) => ({
    name: 'broadcast',
    version: '1.0.0',
    init(store: any) {
      if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
        console.warn('BroadcastChannel not supported');
        return null;
      }
      
      const channelName = config.channelName || `qwiklytics-${store.name}`;
      const channel = new BroadcastChannel(channelName);
      const shouldSyncActions = config.syncActions ?? true;
      const shouldSyncState = config.syncState ?? true;
      
      // Слушаем сообщения от других вкладок
      channel.addEventListener('message', (event) => {
        const { type, data, source } = event.data;
        
        // Игнорируем свои же сообщения
        if (source === 'self') return;
        
        switch (type) {
          case 'ACTION':
            if (shouldSyncActions) {
              // Диспатчим действие из другой вкладки
              const action = store.getAction(data.actionType);
              if (action) {
                action(data.payload);
              }
            }
            break;
            
          case 'STATE':
            if (shouldSyncState) {
              // Синхронизируем состояние
              store.hydrate(data.state);
            }
            break;
            
          case 'REQUEST_STATE':
            // Отправляем состояние по запросу
            channel.postMessage({
              type: 'STATE',
              data: { state: store.getState() },
              source: 'self',
              timestamp: Date.now(),
            });
            break;
        }
      });
      
      // Middleware для отправки действий в другие вкладки
      const broadcastMiddleware = {
        onAction: (action: any) => {
          if (shouldSyncActions) {
            channel.postMessage({
              type: 'ACTION',
              data: {
                actionType: action.type,
                payload: action.payload,
              },
              source: 'self',
              timestamp: Date.now(),
            });
          }
        },
      };
      
      store.middlewares.push(broadcastMiddleware);
      
      // Отправляем начальное состояние
      if (shouldSyncState) {
        setTimeout(() => {
          channel.postMessage({
            type: 'STATE',
            data: { state: store.getState() },
            source: 'self',
            timestamp: Date.now(),
          });
        }, 100);
      }
      
      return {
        channel,
        broadcastAction: (actionType: string, payload: any) => {
          channel.postMessage({
            type: 'ACTION',
            data: { actionType, payload },
            source: 'self',
            timestamp: Date.now(),
          });
        },
        broadcastState: () => {
          channel.postMessage({
            type: 'STATE',
            data: { state: store.getState() },
            source: 'self',
            timestamp: Date.now(),
          });
        },
        requestState: () => {
          channel.postMessage({
            type: 'REQUEST_STATE',
            source: 'self',
            timestamp: Date.now(),
          });
        },
        disconnect: () => {
          channel.close();
        },
      };
    },
    destroy(store: any) {
      store.middlewares = store.middlewares.filter(
        (m: any) => m.name !== 'plugin:broadcast'
      );
      
      const instance = pluginRegistry.getInstance('broadcast');
      if (instance?.disconnect) {
        instance.disconnect();
      }
    },
  })
);

// Плагин для кэширования (memoization)
export const createCachePlugin = createPlugin(
  'cache',
  (config: {
    ttl?: number; // Time to live в миллисекундах
    maxSize?: number;
    strategy?: 'lru' | 'fifo' | 'lfu';
  }) => ({
    name: 'cache',
    version: '1.0.0',
    init(store: any) {
      const cache = new Map();
      const ttl = config.ttl || 5 * 60 * 1000; // 5 минут по умолчанию
      const maxSize = config.maxSize || 100;
      const strategy = config.strategy || 'lru';
      
      // LRU кэш
      const lruKeys: string[] = [];
      
      const cleanupCache = () => {
        const now = Date.now();
        
        // Удаляем просроченные записи
        for (const [key, entry] of cache.entries()) {
          if (entry.expiresAt && entry.expiresAt < now) {
            cache.delete(key);
            const index = lruKeys.indexOf(key);
            if (index > -1) {
              lruKeys.splice(index, 1);
            }
          }
        }
        
        // Ограничиваем размер
        if (cache.size > maxSize) {
          if (strategy === 'lru' && lruKeys.length > 0) {
            const oldestKey = lruKeys.shift()!;
            cache.delete(oldestKey);
          } else {
            // FIFO: удаляем первую запись
            const firstKey = cache.keys().next().value;
            if (firstKey) {
              cache.delete(firstKey);
              const index = lruKeys.indexOf(firstKey);
              if (index > -1) {
                lruKeys.splice(index, 1);
              }
            }
          }
        }
      };
      
      // Периодическая очистка кэша
      const cleanupInterval = setInterval(cleanupCache, 60000); // Каждую минуту
      
      const cacheApi = {
        set: (key: string, value: any, customTTL?: number) => {
          const expiresAt = Date.now() + (customTTL || ttl);
          cache.set(key, { value, expiresAt });
          
          // Обновляем LRU
          const index = lruKeys.indexOf(key);
          if (index > -1) {
            lruKeys.splice(index, 1);
          }
          lruKeys.push(key);
          
          return value;
        },
        
        get: (key: string) => {
          const entry = cache.get(key);
          if (!entry) return undefined;
          
          // Проверяем срок действия
          if (entry.expiresAt && entry.expiresAt < Date.now()) {
            cache.delete(key);
            const index = lruKeys.indexOf(key);
            if (index > -1) {
              lruKeys.splice(index, 1);
            }
            return undefined;
          }
          
          // Обновляем LRU
          if (strategy === 'lru') {
            const index = lruKeys.indexOf(key);
            if (index > -1) {
              lruKeys.splice(index, 1);
              lruKeys.push(key);
            }
          }
          
          return entry.value;
        },
        
        has: (key: string) => {
          const entry = cache.get(key);
          if (!entry) return false;
          
          if (entry.expiresAt && entry.expiresAt < Date.now()) {
            cache.delete(key);
            const index = lruKeys.indexOf(key);
            if (index > -1) {
              lruKeys.splice(index, 1);
            }
            return false;
          }
          
          return true;
        },
        
        delete: (key: string) => {
          const deleted = cache.delete(key);
          const index = lruKeys.indexOf(key);
          if (index > -1) {
            lruKeys.splice(index, 1);
          }
          return deleted;
        },
        
        clear: () => {
          cache.clear();
          lruKeys.length = 0;
        },
        
        size: () => cache.size,
        
        keys: () => Array.from(cache.keys()),
        
        setTTL: (newTTL: number) => {
          ttl = newTTL;
        },
        
        setMaxSize: (newMaxSize: number) => {
          maxSize = newMaxSize;
          cleanupCache();
        },
      };
      
      // Добавляем cache API в store
      store.cache = cacheApi;
      
      return {
        ...cacheApi,
        cleanupCache,
        getStats: () => ({
          size: cache.size,
          maxSize,
          ttl,
          strategy,
          lruKeysCount: lruKeys.length,
        }),
      };
    },
    destroy() {
      clearInterval(cleanupInterval);
    },
  })
);

// Плагин для мониторинга производительности
export const createPerformancePlugin = createPlugin(
  'performance',
  (config: {
    trackActions?: boolean;
    trackSelectors?: boolean;
    trackEffects?: boolean;
    slowThreshold?: number; // Порог для медленных операций (мс)
  }) => ({
    name: 'performance',
    version: '1.0.0',
    init(store: any) {
      const metrics = {
        actions: new Map<string, { count: number; totalTime: number }>(),
        selectors: new Map<string, { count: number; totalTime: number }>(),
        effects: new Map<string, { count: number; totalTime: number }>(),
      };
      
      const trackActions = config.trackActions ?? true;
      const trackSelectors = config.trackSelectors ?? true;
      const trackEffects = config.trackEffects ?? true;
      const slowThreshold = config.slowThreshold || 100; // 100ms
      
      const performanceMiddleware = {
        onAction: (action: any) => {
          if (!trackActions) return;
          
          const startTime = performance.now();
          
          // Используем setTimeout для измерения после выполнения
          setTimeout(() => {
            const duration = performance.now() - startTime;
            
            const existing = metrics.actions.get(action.type) || { count: 0, totalTime: 0 };
            metrics.actions.set(action.type, {
              count: existing.count + 1,
              totalTime: existing.totalTime + duration,
            });
            
            if (duration > slowThreshold) {
              console.warn(`Slow action detected: ${action.type} took ${duration.toFixed(2)}ms`);
            }
          }, 0);
        },
      };
      
      store.middlewares.push(performanceMiddleware);
      
      // Перехват селекторов
      if (trackSelectors && store.selectors) {
        const originalSelectors = new Map();
        
        for (const [key, selector] of store.selectors.entries()) {
          originalSelectors.set(key, selector);
          
          const wrappedSelector = (...args: any[]) => {
            const startTime = performance.now();
            const result = selector(...args);
            const duration = performance.now() - startTime;
            
            const existing = metrics.selectors.get(key) || { count: 0, totalTime: 0 };
            metrics.selectors.set(key, {
              count: existing.count + 1,
              totalTime: existing.totalTime + duration,
            });
            
            return result;
          };
          
          store.selectors.set(key, wrappedSelector);
        }
      }
      
      // Перехват эффектов
      if (trackEffects && store.effects) {
        const originalEffects = new Map();
        
        for (const [key, effect] of store.effects.entries()) {
          originalEffects.set(key, effect);
          
          const wrappedEffect = async (...args: any[]) => {
            const startTime = performance.now();
            try {
              const result = await effect(...args);
              const duration = performance.now() - startTime;
              
              const existing = metrics.effects.get(key) || { count: 0, totalTime: 0 };
              metrics.effects.set(key, {
                count: existing.count + 1,
                totalTime: existing.totalTime + duration,
              });
              
              if (duration > slowThreshold) {
                console.warn(`Slow effect detected: ${key} took ${duration.toFixed(2)}ms`);
              }
              
              return result;
            } catch (error) {
              const duration = performance.now() - startTime;
              
              const existing = metrics.effects.get(key) || { count: 0, totalTime: 0 };
              metrics.effects.set(key, {
                count: existing.count + 1,
                totalTime: existing.totalTime + duration,
              });
              
              throw error;
            }
          };
          
          store.effects.set(key, wrappedEffect);
        }
      }
      
      return {
        getMetrics: () => {
          const calculateAverages = (map: Map<string, any>) => {
            const result: Record<string, any> = {};
            for (const [key, value] of map.entries()) {
              result[key] = {
                ...value,
                averageTime: value.count > 0 ? value.totalTime / value.count : 0,
              };
            }
            return result;
          };
          
          return {
            actions: calculateAverages(metrics.actions),
            selectors: calculateAverages(metrics.selectors),
            effects: calculateAverages(metrics.effects),
          };
        },
        
        resetMetrics: () => {
          metrics.actions.clear();
          metrics.selectors.clear();
          metrics.effects.clear();
        },
        
        getSlowOperations: (threshold?: number) => {
          const thr = threshold || slowThreshold;
          const slow: any[] = [];
          
          // Проверяем действия
          for (const [key, value] of metrics.actions.entries()) {
            const avg = value.count > 0 ? value.totalTime / value.count : 0;
            if (avg > thr) {
              slow.push({ type: 'action', name: key, averageTime: avg, count: value.count });
            }
          }
          
          // Проверяем селекторы
          for (const [key, value] of metrics.selectors.entries()) {
            const avg = value.count > 0 ? value.totalTime / value.count : 0;
            if (avg > thr) {
              slow.push({ type: 'selector', name: key, averageTime: avg, count: value.count });
            }
          }
          
          // Проверяем эффекты
          for (const [key, value] of metrics.effects.entries()) {
            const avg = value.count > 0 ? value.totalTime / value.count : 0;
            if (avg > thr) {
              slow.push({ type: 'effect', name: key, averageTime: avg, count: value.count });
            }
          }
          
          return slow.sort((a, b) => b.averageTime - a.averageTime);
        },
      };
    },
    destroy(store: any) {
      store.middlewares = store.middlewares.filter(
        (m: any) => m.name !== 'plugin:performance'
      );
    },
  })
);

// Утилитарные функции для плагинов
function getStateChanges(prevState: any, nextState: any): Record<string, any> {
  const changes: Record<string, any> = {};
  
  const compare = (obj1: any, obj2: any, path: string = '') => {
    if (obj1 === obj2) return;
    
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || 
        obj1 === null || obj2 === null) {
      changes[path || 'root'] = { from: obj1, to: obj2 };
      return;
    }
    
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    
    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      compare(obj1[key], obj2[key], newPath);
    }
  };
  
  compare(prevState, nextState);
  return changes;
}

// Автоматическая регистрация встроенных плагинов
pluginRegistry.register(createLoggerPlugin({}));
pluginRegistry.register(createPerformancePlugin({}));

// Экспорт фабрик плагинов
export {
  createLoggerPlugin,
  createAnalyticsPlugin,
  createValidationPlugin,
  createBroadcastPlugin,
  createCachePlugin,
  createPerformancePlugin,
};

// Экспорт реестра
export { pluginRegistry };

// Хелпер для использования плагинов в Qwik компонентах
import { $ } from '@builder.io/qwik';

export function usePlugin$(pluginName: string, store?: any) {
  return $(() => {
    if (!store) {
      // Пытаемся получить store из контекста или глобального объекта
      if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_STORE) {
        store = (window as any).__QWIKLYTICS_STORE;
      } else {
        throw new Error('Store not provided and not found in context');
      }
    }
    
    const plugin = pluginRegistry.getInstance(pluginName);
    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" not initialized`);
    }
    
    return plugin;
  });
}

// Декоратор для автоматического применения плагинов
export function withPlugins(...plugins: any[]) {
  return function<T extends { new (...args: any[]): any }>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        
        // Инициализируем плагины
        plugins.forEach(plugin => {
          if (typeof plugin === 'function') {
            const pluginInstance = plugin();
            pluginRegistry.register(pluginInstance);
            
            if (pluginInstance.init) {
              pluginInstance.init(this);
            }
          }
        });
      }
    };
  };
}

// TypeScript guard для проверки плагинов
export function isPlugin(obj: any): obj is Plugin {
  return obj && typeof obj === 'object' && 'name' in obj;
}

// Экспорт по умолчанию
export default {
  // Плагины
  createLoggerPlugin,
  createAnalyticsPlugin,
  createValidationPlugin,
  createBroadcastPlugin,
  createCachePlugin,
  createPerformancePlugin,
  
  // Реестр
  pluginRegistry,
  
  // Утилиты
  usePlugin$,
  withPlugins,
  isPlugin,
  
  // Типы
  Plugin,
  PluginConfig,
};