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
 * Map селекторов
 */
export type SelectorMap<T> = Record<string, (state: T) => any>;

/**
 * Reducer действия
 */
export type ActionReducer<T, P> = (state: Draft<T>, payload: P) => void;
