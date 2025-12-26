// src/qwik/plugins/history.ts
import { $, useComputed$, type QRL } from '@builder.io/qwik';
import type { HistoryAPI, HistoryEntry, HistoryState } from '../../plugins/history';

/**
 * Qwik-обвязка над HistoryAPI.
 * Плагин остаётся framework-agnostic, а Qwik-логика живёт в src/qwik/*.
 */
export type HistoryHookResult<T extends object> = {
    /** computed: можно ли сделать undo */
    canUndo: ReturnType<typeof useComputed$<boolean>>;

    /** computed: можно ли сделать redo */
    canRedo: ReturnType<typeof useComputed$<boolean>>;

    /** computed: текущее состояние истории */
    history: ReturnType<typeof useComputed$<HistoryState<T>>>;

    /** computed: последние записи истории */
    entries: (options?: { limit?: number }) => ReturnType<typeof useComputed$<HistoryEntry<T>[]>>;

    /** QRL команды для событий Qwik */
    undo$: QRL<() => void>;
    redo$: QRL<() => void>;
    clearHistory$: QRL<() => void>;
};

/**
 * Создаёт Qwik-хук для history-плагина.
 *
 * Важно: хук принимает уже готовый HistoryAPI (полученный из плагина),
 * чтобы не привязываться к конкретной реализации Store/PluginHost.
 */
export function useHistoryPlugin$<T extends object>(
    api: HistoryAPI<T>
): HistoryHookResult<T> {
    // computed вокруг "чистого" API
    const canUndo = useComputed$(() => api.canUndo());
    const canRedo = useComputed$(() => api.canRedo());
    const history = useComputed$(() => api.getState());

    const entries = (options?: { limit?: number }) =>
        useComputed$(() => api.getEntries(options));

    // QRL команды
    const undo$ = $(() => api.undo());
    const redo$ = $(() => api.redo());
    const clearHistory$ = $(() => api.clearHistory());

    return {
        canUndo,
        canRedo,
        history,
        entries,
        undo$,
        redo$,
        clearHistory$,
    };
}
