
export function createHistoryDevToolsPanel() {
  return {
    name: 'history',
    
    render() {
      return `
        <div class="history-panel">
          <h3>History (Undo/Redo)</h3>
          <div class="history-controls">
            <button id="history-undo" disabled>Undo (0)</button>
            <button id="history-redo" disabled>Redo (0)</button>
            <button id="history-clear">Clear</button>
          </div>
          <div class="history-stats">
            <div>Past: <span id="history-past-count">0</span></div>
            <div>Future: <span id="history-future-count">0</span></div>
            <div>Total: <span id="history-total-count">0</span></div>
          </div>
          <div class="history-list" id="history-entries">
            <!-- Записи истории будут здесь -->
          </div>
        </div>
      `;
    },
    
    setup(element: HTMLElement) {
      const updateUI = () => {
        if (!(window as any).__QWIKLYTICS_HISTORY_API) return;
        
        const api = (window as any).__QWIKLYTICS_HISTORY_API;
        const info = api.getHistoryInfo();
        const entries = api.getHistoryEntries({ limit: 10 });
        
        // Обновляем кнопки
        const undoBtn = element.querySelector('#history-undo') as HTMLButtonElement;
        const redoBtn = element.querySelector('#history-redo') as HTMLButtonElement;
        
        undoBtn.disabled = !info.canUndo;
        undoBtn.textContent = `Undo (${info.pastCount})`;
        redoBtn.disabled = !info.canRedo;
        redoBtn.textContent = `Redo (${info.futureCount})`;
        
        // Обновляем счетчики
        element.querySelector('#history-past-count')!.textContent = info.pastCount.toString();
        element.querySelector('#history-future-count')!.textContent = info.futureCount.toString();
        element.querySelector('#history-total-count')!.textContent = info.totalActions.toString();
        
        // Обновляем список записей
        const entriesContainer = element.querySelector('#history-entries')!;
        entriesContainer.innerHTML = entries.entries.map(entry => `
          <div class="history-entry" data-id="${entry.id}">
            <div class="history-entry-action">${entry.action}</div>
            <div class="history-entry-time">
              ${new Date(entry.timestamp).toLocaleTimeString()}
            </div>
            <div class="history-entry-diff">
              ${Object.keys(entry.diff || {}).length} changes
            </div>
            <button class="history-entry-jump">Jump</button>
          </div>
        `).join('');
      };
      
      // Обработчики кнопок
      element.querySelector('#history-undo')?.addEventListener('click', () => {
        (window as any).__QWIKLYTICS_HISTORY_API?.undo();
        updateUI();
      });
      
      element.querySelector('#history-redo')?.addEventListener('click', () => {
        (window as any).__QWIKLYTICS_HISTORY_API?.redo();
        updateUI();
      });
      
      element.querySelector('#history-clear')?.addEventListener('click', () => {
        (window as any).__QWIKLYTICS_HISTORY_API?.clearHistory();
        updateUI();
      });
      
      // Подписываемся на события истории
      if ((window as any).__QWIKLYTICS_DEVTOOLS__) {
        (window as any).__QWIKLYTICS_DEVTOOLS__.subscribe((event: any) => {
          if (event.type.includes('HISTORY')) {
            updateUI();
          }
        });
      }
      
      // Экспортируем API для DevTools
      (window as any).__QWIKLYTICS_HISTORY_API = {
        getHistoryInfo: () => (window as any).__QWIKLYTICS_HISTORY_STORE?.getHistoryInfo() || {},
        undo: () => (window as any).__QWIKLYTICS_HISTORY_STORE?.undo(),
        redo: () => (window as any).__QWIKLYTICS_HISTORY_STORE?.redo(),
        clearHistory: () => (window as any).__QWIKLYTICS_HISTORY_STORE?.clearHistory(),
        getHistoryEntries: (options: any) => 
          (window as any).__QWIKLYTICS_HISTORY_STORE?.getHistoryEntries(options) || { entries: [] },
      };
      
      // Обновляем UI каждую секунду
      setInterval(updateUI, 1000);
      updateUI();
    },
    
    styles: `
      .history-panel {
        padding: 10px;
        font-family: monospace;
        font-size: 12px;
      }
      .history-controls {
        display: flex;
        gap: 5px;
        margin-bottom: 10px;
      }
      .history-controls button {
        padding: 5px 10px;
        font-size: 12px;
      }
      .history-stats {
        display: flex;
        gap: 15px;
        margin-bottom: 10px;
        padding: 5px;
        background: #f5f5f5;
        border-radius: 3px;
      }
      .history-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 3px;
      }
      .history-entry {
        display: flex;
        align-items: center;
        padding: 5px;
        border-bottom: 1px solid #eee;
      }
      .history-entry:hover {
        background: #f9f9f9;
      }
      .history-entry-action {
        flex: 1;
        font-weight: bold;
        color: #007acc;
      }
      .history-entry-time {
        width: 80px;
        color: #666;
        font-size: 11px;
      }
      .history-entry-diff {
        width: 80px;
        font-size: 11px;
        color: #888;
      }
      .history-entry-jump {
        padding: 2px 5px;
        font-size: 11px;
        margin-left: 5px;
      }
    `,
  };
}