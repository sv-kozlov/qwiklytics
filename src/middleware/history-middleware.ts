// src/middleware/history-middleware.ts
export function createHistoryTrackingMiddleware(historyPlugin: any) {
  let currentAction: any = null;
  
  return {
    name: 'history-tracking',
    
    beforeAction(action: any) {
      currentAction = action;
      
      if (typeof window !== 'undefined') {
        (window as any).__QWIKLYTICS_LAST_ACTION = action;
        
        // Сохраняем для DevTools
        if ((window as any).__QWIKLYTICS_HISTORY_STORE) {
          (window as any).__QWIKLYTICS_HISTORY_STORE.currentAction = action;
        }
      }
    },
    
    afterAction(action: any, prevState: any, nextState: any) {
      if (historyPlugin && currentAction) {
        // Используем API плагина для добавления в историю
        const api = historyPlugin.api;
        if (api && api.addToHistory) {
          api.addToHistory(currentAction.type, prevState, nextState);
        }
      }
      currentAction = null;
    },
    
    // Для интеграции с существующей middleware системой
    process: (prevState: any, nextState: any) => {
      // История обрабатывается отдельно через плагин
      return nextState;
    },
    
    onAction: (action: any) => {
      // Сохраняем действие для истории
      if (typeof window !== 'undefined') {
        (window as any).__QWIKLYTICS_LAST_ACTION = action;
      }
    },
  };
}