// src/devtools/history-panel.ts

/**
 * Историческая панель DevTools.
 *
 * Важно:
 * - панель НЕ зависит от Qwik
 * - ожидает глобальный window.__QWIKLYTICS_DEVTOOLS__
 * - работает с новым HistoryAPI (undo/redo/clearHistory/getState/getEntries)
 */

type AnyHistoryApi = {
    undo?: () => void;
    redo?: () => void;
    clearHistory?: () => void;
    canUndo?: () => boolean;
    canRedo?: () => boolean;
    getState?: () => { past?: unknown[]; future?: unknown[] } | unknown;
    getEntries?: (options?: { limit?: number }) => unknown[];
};

function getDevTools() {
    return (window as any).__QWIKLYTICS_DEVTOOLS__ as
        | {
        subscribe: (listener: (event: any) => void) => () => void;
        getPlugins: () => Record<string, unknown>;
        push: (event: any) => void;
    }
        | undefined;
}

function getHistoryApi(): AnyHistoryApi | null {
    const devTools = getDevTools();
    const plugins = devTools?.getPlugins?.() ?? {};
    const history = plugins['history'] as any;

    // Поддерживаем два варианта:
    // 1) plugins.history.api
    // 2) plugins.history (если туда положили сразу api)
    return (history?.api ?? history) ?? null;
}

export function createHistoryDevToolsPanel() {
    return {
        name: 'history',

        render() {
            return `
        <div class="history-panel">
          <h3>History (Undo/Redo)</h3>

          <div class="history-controls">
            <button id="history-undo" disabled>Undo</button>
            <button id="history-redo" disabled>Redo</button>
            <button id="history-clear">Clear</button>
          </div>

          <div class="history-meta" id="history-meta"></div>

          <div class="history-entries" id="history-entries"></div>
        </div>
      `;
        },

        init(container: HTMLElement) {
            const undoBtn = container.querySelector<HTMLButtonElement>('#history-undo')!;
            const redoBtn = container.querySelector<HTMLButtonElement>('#history-redo')!;
            const clearBtn = container.querySelector<HTMLButtonElement>('#history-clear')!;
            const meta = container.querySelector<HTMLDivElement>('#history-meta')!;
            const entriesContainer = container.querySelector<HTMLDivElement>('#history-entries')!;

            const updateUI = () => {
                const api = getHistoryApi();

                if (!api) {
                    meta.textContent = 'History plugin not connected';
                    undoBtn.disabled = true;
                    redoBtn.disabled = true;
                    entriesContainer.innerHTML = '';
                    return;
                }

                const state = api.getState?.() as any;
                const pastCount = Array.isArray(state?.past) ? state.past.length : 0;
                const futureCount = Array.isArray(state?.future) ? state.future.length : 0;

                const canUndo = api.canUndo?.() ?? pastCount > 0;
                const canRedo = api.canRedo?.() ?? futureCount > 0;

                undoBtn.disabled = !canUndo;
                redoBtn.disabled = !canRedo;

                undoBtn.textContent = `Undo (${pastCount})`;
                redoBtn.textContent = `Redo (${futureCount})`;

                meta.textContent = `past: ${pastCount} | future: ${futureCount}`;

                const entries = api.getEntries?.({ limit: 50 }) ?? [];
                entriesContainer.innerHTML = entries
                    .map((entry: any) => {
                        const action = String(entry?.action ?? '(unknown)');
                        const ts = typeof entry?.timestamp === 'number' ? entry.timestamp : Date.now();
                        return `
                  <div class="history-entry">
                    <div class="history-entry-action">${action}</div>
                    <div class="history-entry-time">${new Date(ts).toLocaleTimeString()}</div>
                  </div>
                `;
                    })
                    .join('');
            };

            undoBtn.addEventListener('click', () => {
                getHistoryApi()?.undo?.();
                updateUI();
            });

            redoBtn.addEventListener('click', () => {
                getHistoryApi()?.redo?.();
                updateUI();
            });

            clearBtn.addEventListener('click', () => {
                getHistoryApi()?.clearHistory?.();
                updateUI();
            });

            // Обновляем UI на события devtools (и периодически — как fallback)
            const devTools = getDevTools();
            const unsub =
                devTools?.subscribe?.((event: any) => {
                    if (typeof event?.type === 'string' && event.type.includes('HISTORY')) {
                        updateUI();
                    }
                }) ?? null;

            const interval = window.setInterval(updateUI, 1000);
            updateUI();

            return () => {
                unsub?.();
                window.clearInterval(interval);
            };
        },

        styles: `
      .history-panel {
        padding: 10px;
        font-family: monospace;
        font-size: 12px;
      }

      .history-controls {
        display: flex;
        gap: 6px;
        margin-bottom: 8px;
      }

      .history-controls button {
        padding: 4px 8px;
        font-size: 12px;
      }

      .history-meta {
        margin-bottom: 8px;
        color: #666;
      }

      .history-entries {
        border: 1px solid #ddd;
        max-height: 260px;
        overflow-y: auto;
        padding: 6px;
      }

      .history-entry {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        padding: 4px 0;
        border-bottom: 1px solid #eee;
      }

      .history-entry:last-child {
        border-bottom: none;
      }

      .history-entry-action {
        font-weight: bold;
      }

      .history-entry-time {
        color: #888;
      }
    `,
    };
}
