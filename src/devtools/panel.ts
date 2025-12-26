// src/devtools/panel.ts

import type { DevToolsEvent } from './index';
import { sendDispatch, sendHandshake, subscribeAppMessages } from './extension';

/**
 * UI панель DevTools (Events).
 * Можно встраивать в iframe/страницу расширения.
 */
export function mountDevToolsPanel(container: HTMLElement) {
    // ===== UI =====
    container.innerHTML = `
        <div class="qwiklytics-devtools">
          <h3>Qwiklytics DevTools</h3>

          <div class="controls">
            <button data-action="clear">Clear</button>
            <button data-action="export">Export</button>
          </div>

          <div class="event-list"></div>
        </div>
    `;

    const root = container.querySelector<HTMLDivElement>('.qwiklytics-devtools')!;
    const listEl = root.querySelector<HTMLDivElement>('.event-list')!;

    // ===== State =====
    const events: DevToolsEvent[] = [];

    // ===== Render =====
    const addEvent = (event: DevToolsEvent) => {
        events.push(event);

        const row = document.createElement('div');
        row.className = 'event';

        const header = document.createElement('div');

        const type = document.createElement('span');
        type.className = 'event-type';
        type.textContent = String(event.type ?? '(unknown)');

        const time = document.createElement('span');
        time.className = 'event-time';
        const ts = typeof event.timestamp === 'number' ? event.timestamp : Date.now();
        time.textContent = new Date(ts).toLocaleTimeString();

        header.appendChild(type);
        header.appendChild(time);

        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(event, null, 2);

        row.appendChild(header);
        row.appendChild(pre);

        listEl.appendChild(row);
        listEl.scrollTop = listEl.scrollHeight;
    };

    const renderAll = (next: DevToolsEvent[]) => {
        listEl.innerHTML = '';
        next.forEach(addEvent);
    };

    // ===== Wiring =====
    const onClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        const action = target?.getAttribute?.('data-action');
        if (!action) return;

        if (action === 'clear') {
            sendDispatch({ type: 'CLEAR_EVENTS' });
            return;
        }

        if (action === 'export') {
            const data = JSON.stringify({ exportedAt: Date.now(), events }, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `qwiklytics-devtools-events-${Date.now()}.json`;
            a.click();

            URL.revokeObjectURL(url);
        }
    };

    root.addEventListener('click', onClick);

    // Подключаемся к приложению
    const unsubscribe = subscribeAppMessages(msg => {
        if (msg.type === 'INIT') {
            const initEvents = Array.isArray(msg.events) ? msg.events : [];
            events.length = 0;
            events.push(...initEvents);
            renderAll(events);
            return;
        }

        if (msg.type === 'EVENT') {
            addEvent(msg.event);
        }
    });

    // Handshake
    sendHandshake();

    // ===== Styles (минимально, можно вынести в CSS) =====
    const style = document.createElement('style');
    style.textContent = `
      .qwiklytics-devtools { font-family: monospace; font-size: 12px; }
      .controls { display:flex; gap:8px; margin: 10px 0; }
      .event-list { max-height: 400px; overflow-y:auto; border:1px solid #ddd; padding: 6px; }
      .event { padding: 6px 4px; border-bottom:1px solid #eee; }
      .event:last-child { border-bottom:none; }
      .event-type { font-weight:bold; color:#007acc; margin-right: 8px; }
      .event-time { color:#666; }
      pre { margin: 6px 0 0; white-space: pre-wrap; word-break: break-word; }
    `;
    container.appendChild(style);

    return () => {
        root.removeEventListener('click', onClick);
        unsubscribe();
        style.remove();
    };
}
