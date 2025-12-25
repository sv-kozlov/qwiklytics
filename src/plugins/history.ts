export interface HistoryPluginConfig {
  limit?: number;          // Максимальное количество записей в истории
  filterActions?: string[]; // Какие действия отслеживать (если пусто - все)
  excludeActions?: string[]; // Какие действия игнорировать
  debounceTime?: number;   // Дебаунс для группировки действий
  persistKey?: string;     // Ключ для сохранения в localStorage
}

export interface HistoryEntry {
  id: string;
  action: string;
  timestamp: number;
  prevState: any;
  nextState: any;
  diff: any;
}

export interface HistoryState {
  past: HistoryEntry[];    // История для undo
  present: any;           // Текущее состояние
  future: HistoryEntry[]; // История для redo
  isUndoing: boolean;
  isRedoing: boolean;
}

export function createHistoryPlugin(config: HistoryPluginConfig = {}) {
  const {
    limit = 50,
    filterActions = [],
    excludeActions = [],
    debounceTime = 0,
    persistKey = 'qwiklytics-history',
  } = config;

  let historyState: HistoryState = {
    past: [],
    present: null,
    future: [],
    isUndoing: false,
    isRedoing: false,
  };

  let debounceTimer: any = null;
  let lastActionTime = 0;
  const ACTION_GROUP_THRESHOLD = 500; // Группируем действия в пределах 500мс

  // Утилита для глубокого сравнения
  function deepDiff(obj1: any, obj2: any): any {
    if (obj1 === obj2) return null;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || 
        obj1 === null || obj2 === null) {
      return obj2;
    }

    const diff: any = {};
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

    for (const key of allKeys) {
      const val1 = obj1[key];
      const val2 = obj2[key];

      if (val1 === val2) continue;

      if (typeof val1 === 'object' && typeof val2 === 'object' &&
          val1 !== null && val2 !== null) {
        const nestedDiff = deepDiff(val1, val2);
        if (nestedDiff !== null) {
          diff[key] = nestedDiff;
        }
      } else {
        diff[key] = val2;
      }
    }

    return Object.keys(diff).length > 0 ? diff : null;
  }

  // Утилита для применения diff
  function applyDiff(state: any, diff: any): any {
    if (!diff) return state;

    const result = { ...state };
    for (const key in diff) {
      if (typeof diff[key] === 'object' && diff[key] !== null && 
          !Array.isArray(diff[key])) {
        result[key] = applyDiff(result[key] || {}, diff[key]);
      } else {
        result[key] = diff[key];
      }
    }
    return result;
  }

  // Сохранение состояния в localStorage
  function persistHistory() {
    if (!persistKey || typeof window === 'undefined') return;
    
    try {
      const data = {
        past: historyState.past.slice(-10), // Сохраняем только последние 10
        present: historyState.present,
        version: 1,
      };
      localStorage.setItem(persistKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist history:', error);
    }
  }

  // Загрузка из localStorage
  function loadPersistedHistory() {
    if (!persistKey || typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.version === 1) {
          historyState.past = data.past || [];
          historyState.present = data.present;
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted history:', error);
    }
  }

  // Проверка, нужно ли отслеживать действие
  function shouldTrackAction(actionType: string): boolean {
    if (excludeActions.includes(actionType)) return false;
    if (filterActions.length > 0 && !filterActions.includes(actionType)) {
      return false;
    }
    return true;
  }

  // Добавление записи в историю
  function addToHistory(action: string, prevState: any, nextState: any) {
    if (!shouldTrackAction(action)) return;
    if (historyState.isUndoing || historyState.isRedoing) return;

    const now = Date.now();
    const diff = deepDiff(prevState, nextState);
    
    // Если изменений нет, не добавляем в историю
    if (!diff) return;

    const entry: HistoryEntry = {
      id: `${action}-${now}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      timestamp: now,
      prevState,
      nextState,
      diff,
    };

    // Группировка быстрых действий
    if (now - lastActionTime < ACTION_GROUP_THRESHOLD && 
        historyState.past.length > 0) {
      const lastEntry = historyState.past[historyState.past.length - 1];
      
      // Если это то же самое действие, объединяем
      if (lastEntry.action === action) {
        lastEntry.nextState = nextState;
        lastEntry.diff = deepDiff(lastEntry.prevState, nextState);
        lastActionTime = now;
        return;
      }
    }

    // Добавляем новую запись
    historyState.past.push(entry);
    historyState.present = nextState;
    
    // Очищаем future при новом действии
    historyState.future = [];
    
    // Ограничиваем размер истории
    if (historyState.past.length > limit) {
      historyState.past = historyState.past.slice(-limit);
    }

    lastActionTime = now;
    
    // Сохраняем в localStorage с дебаунсом
    if (debounceTime > 0) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(persistHistory, debounceTime);
    } else {
      persistHistory();
    }

    // Отправляем в DevTools
    if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_DEVTOOLS__) {
      (window as any).__QWIKLYTICS_DEVTOOLS__.dispatch({
        type: 'HISTORY_ADDED',
        entry,
        historyLength: historyState.past.length,
      });
    }
  }

  // Undo
  function undo() {
    if (historyState.past.length === 0) return null;
    
    historyState.isUndoing = true;
    
    const lastEntry = historyState.past.pop()!;
    historyState.future.unshift({
      ...lastEntry,
      id: `${lastEntry.action}-undo-${Date.now()}`,
      timestamp: Date.now(),
    });
    
    const previousState = lastEntry.prevState;
    historyState.present = previousState;
    
    historyState.isUndoing = false;
    
    // DevTools
    if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_DEVTOOLS__) {
      (window as any).__QWIKLYTICS_DEVTOOLS__.dispatch({
        type: 'HISTORY_UNDO',
        entry: lastEntry,
        historyLength: historyState.past.length,
        futureLength: historyState.future.length,
      });
    }
    
    persistHistory();
    return previousState;
  }

  // Redo
  function redo() {
    if (historyState.future.length === 0) return null;
    
    historyState.isRedoing = true;
    
    const nextEntry = historyState.future.shift()!;
    historyState.past.push({
      ...nextEntry,
      id: `${nextEntry.action}-redo-${Date.now()}`,
      timestamp: Date.now(),
    });
    
    const nextState = nextEntry.nextState;
    historyState.present = nextState;
    
    historyState.isRedoing = false;
    
    // DevTools
    if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_DEVTOOLS__) {
      (window as any).__QWIKLYTICS_DEVTOOLS__.dispatch({
        type: 'HISTORY_REDO',
        entry: nextEntry,
        historyLength: historyState.past.length,
        futureLength: historyState.future.length,
      });
    }
    
    persistHistory();
    return nextState;
  }

  // Прыжок к определенной точке в истории
  function jumpToPoint(entryId: string) {
    const pastIndex = historyState.past.findIndex(entry => entry.id === entryId);
    const futureIndex = historyState.future.findIndex(entry => entry.id === entryId);
    
    if (pastIndex !== -1) {
      // Откатываемся к точке в past
      const entriesToMove = historyState.past.slice(pastIndex + 1);
      historyState.future = [...entriesToMove.reverse(), ...historyState.future];
      historyState.past = historyState.past.slice(0, pastIndex + 1);
      historyState.present = historyState.past[historyState.past.length - 1].nextState;
    } else if (futureIndex !== -1) {
      // Переходим к точке в future
      const entriesToMove = historyState.future.slice(0, futureIndex + 1);
      historyState.past = [...historyState.past, ...entriesToMove];
      historyState.future = historyState.future.slice(futureIndex + 1);
      historyState.present = entriesToMove[entriesToMove.length - 1].nextState;
    }
    
    persistHistory();
    return historyState.present;
  }

  // Очистка истории
  function clearHistory() {
    historyState = {
      past: [],
      present: null,
      future: [],
      isUndoing: false,
      isRedoing: false,
    };
    
    if (persistKey && typeof window !== 'undefined') {
      localStorage.removeItem(persistKey);
    }
    
    // DevTools
    if (typeof window !== 'undefined' && (window as any).__QWIKLYTICS_DEVTOOLS__) {
      (window as any).__QWIKLYTICS_DEVTOOLS__.dispatch({
        type: 'HISTORY_CLEARED',
      });
    }
  }

  // Получение информации об истории
  function getHistoryInfo() {
    return {
      canUndo: historyState.past.length > 0,
      canRedo: historyState.future.length > 0,
      pastCount: historyState.past.length,
      futureCount: historyState.future.length,
      totalActions: historyState.past.length + historyState.future.length,
      limit,
    };
  }

  // Получение списка записей
  function getHistoryEntries(options?: {
    limit?: number;
    offset?: number;
    filterAction?: string;
  }) {
    const { limit: entriesLimit = 20, offset = 0, filterAction } = options || {};
    
    let entries = [...historyState.past, ...historyState.future];
    
    if (filterAction) {
      entries = entries.filter(entry => entry.action.includes(filterAction));
    }
    
    entries.sort((a, b) => b.timestamp - a.timestamp); // Сначала новые
    
    return {
      entries: entries.slice(offset, offset + entriesLimit),
      total: entries.length,
      hasMore: offset + entriesLimit < entries.length,
    };
  }

  // Восстановление состояния из истории
  function restoreFromHistory(state: any) {
    historyState.present = state;
    persistHistory();
  }

  return {
    name: 'history',
    
    init(store: any) {
      loadPersistedHistory();
      
      // Сохраняем начальное состояние
      historyState.present = store.getState();
      
      // Подписываемся на изменения store
      const unsubscribe = store.subscribe((nextState: any) => {
        if (historyState.present === null) {
          historyState.present = nextState;
          return;
        }
        
        // Получаем последнее действие из DevTools или middleware
        const lastAction = (window as any).__QWIKLYTICS_LAST_ACTION;
        if (lastAction) {
          addToHistory(lastAction.type, historyState.present, nextState);
        }
        
        historyState.present = nextState;
      });
      
      // Middleware для отслеживания действий
      const historyMiddleware = {
        process: (prevState: any, nextState: any) => {
          // Информация о действии будет приходить через глобальную переменную
          // которую устанавливает система действий
          return nextState;
        },
        onAction: (action: any) => {
          // Сохраняем последнее действие для истории
          if (typeof window !== 'undefined') {
            (window as any).__QWIKLYTICS_LAST_ACTION = action;
          }
        },
      };
      
      // Добавляем middleware в store
      store.middlewares.push(historyMiddleware);
      
      // Возвращаем API для управления историей
      return {
        unsubscribe,
        api: {
          undo: () => {
            const state = undo();
            if (state) store.hydrate(state);
          },
          redo: () => {
            const state = redo();
            if (state) store.hydrate(state);
          },
          jumpToPoint,
          clearHistory,
          getHistoryInfo,
          getHistoryEntries,
          restoreFromHistory,
          getHistoryState: () => ({ ...historyState }),
        },
      };
    },
    
    // API для использования вне плагина
    api: {
      undo,
      redo,
      jumpToPoint,
      clearHistory,
      getHistoryInfo,
      getHistoryEntries,
      restoreFromHistory,
    },
  };
}

// Хук для использования истории в Qwik компонентах
export function createHistoryHook(store: any) {
  const historyApi = store.plugins.history?.api;
  
  if (!historyApi) {
    throw new Error('History plugin not initialized for this store');
  }
  
  return () => {
    const canUndo = useSignal(false);
    const canRedo = useSignal(false);
    const historyInfo = useSignal({ pastCount: 0, futureCount: 0 });
    
    // Подписываемся на изменения истории
    useTask$(({ track }) => {
      const info = historyApi.getHistoryInfo();
      track(() => info);
      
      canUndo.value = info.canUndo;
      canRedo.value = info.canRedo;
      historyInfo.value = {
        pastCount: info.pastCount,
        futureCount: info.futureCount,
      };
    });
    
    return {
      canUndo,
      canRedo,
      historyInfo,
      undo: $(() => historyApi.undo()),
      redo: $(() => historyApi.redo()),
      clearHistory: $(() => historyApi.clearHistory()),
      getHistoryEntries: $(historyApi.getHistoryEntries),
    };
  };
}