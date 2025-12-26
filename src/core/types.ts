import type { Draft } from 'immer';

/**
 * Map действий: key → payload
 */
export type ActionMap = Record<string, any>;

/**
 * Map эффектов: key → async функция
 */
export type EffectMap = Record<string, (payload: any) => Promise<any>>;

/**
 * Map селекторов: key → возвращаемый тип селектора
 *
 * Пример:
 * type Selectors = { doubled: number; label: string };
 * selectors: { doubled: (s) => s.count * 2, label: (s) => `#${s.count}` }
 */
export type SelectorMap<T> = Record<string, any>;


/**
 * Reducer действия
 */
export type ActionReducer<T, P> = (state: Draft<T>, payload: P) => void;
