// src/index.ts

/**
 * Публичный API пакета.
 *
 * Принципы:
 * - core: базовая реализация store (framework-agnostic)
 * - hooks: общие helper-хуки для работы с core.Store
 * - plugins: framework-agnostic плагины
 * - qwik: Qwik-интеграция и Qwik-обвязки (хуки/провайдеры)
 *
 * Важно: здесь используются только re-export'ы, чтобы не было лишних side-effects.
 */

/** ===== Core ===== */
export * from './core/store';
export * from './core/action';
export * from './core/effect';
export * from './core/selector';
export * from './core/middleware';
export * from './core/types';

/** ===== Framework-agnostic hooks ===== */
export * from './hooks';

/** ===== Plugins ===== */
export * from './plugins';

/** ===== Qwik integration ===== */
export * from './qwik';

/** ===== DevTools =====
 * Экспортируем целиком, чтобы не привязываться к конкретным именам.
 */
export * from './devtools';
