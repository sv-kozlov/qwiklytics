# Architecture

This document describes the project’s architecture, layers, and integration rules.
It is a living spec: when code and this document diverge, **update this document** or explicitly mark an exception.

---

## Goals

- Keep **core** framework-agnostic and reusable.
- Provide thin **framework adapters** (e.g. Qwik) without leaking framework concerns into plugins/core.
- Enable a stable **plugin system** via a `PluginHost` adapter.
- Make the public API consistent and predictable.

---

## Repository layout

### Core (framework-agnostic)
- `src/core/`
    - `store.ts`
    - `action.ts`
    - `effect.ts`
    - `selector.ts`
    - `middleware.ts`
    - `types.ts`

> These files are considered the **canonical core implementation**.

### Hooks (framework-agnostic helpers)
- `src/hooks/`
    - `useAction.ts`
    - `useEffect.ts`
    - `index.ts`

> These files are considered the **canonical hooks implementation** and may be used alongside core and framework layers.

### Plugins (framework-agnostic)
- `src/plugins/`
    - Framework-agnostic plugin implementations only.

**Rule:** No framework-specific code inside `src/plugins`.

### Qwik adapter layer
- `src/qwik/`
    - `integration.tsx`
    - `hooks.ts`
    - `index.ts`
    - `plugins/history.ts` (Qwik-specific plugin glue)

> These files are considered the **canonical Qwik implementation**.

### Public entry point
- `src/index.ts`

> This file is considered the **canonical public API entry**.

---

## Layering rules

### Dependency direction

- `core` → depends on nothing framework-specific
- `hooks` → may depend on `core`, but not on framework code
- `plugins` → depend on `core` contracts via `PluginHost`, but **not** on framework code
- `qwik` → depends on `core` + `hooks` + (optional) `plugins`

**Allowed imports**
- `src/core/*` can import only from `src/core/*`
- `src/hooks/*` can import from `src/core/*` and `src/hooks/*`
- `src/plugins/*` can import from `src/core/*` and `src/plugins/*`
- `src/qwik/*` can import from `src/core/*`, `src/hooks/*`, `src/plugins/*`, `src/qwik/*`

**Forbidden**
- `src/plugins/*` importing from `src/qwik/*` (or any other framework layer)
- `src/core/*` importing from any framework/hook/plugin UI layer

---

## Plugin architecture

Plugins are **framework-agnostic**. They operate through a `PluginHost` adapter provided by the framework integration.

### PluginHost responsibilities

A `PluginHost` is an adapter that exposes a minimal surface to plugins:

- `getState(): State`
- `setState(next: State)`: mutate state (or update)
- `replaceState(next: State)`: replace state entirely (preferred for time-travel / hydration patterns)
- `subscribe(listener): unsubscribe`
- optional: `subscribeAction(listener): unsubscribe` (if action stream is supported)

> The host is responsible for translating framework/store events into these primitives.

### Core requirements for plugins

To support plugins robustly, core needs:
- A **public state replacement** pathway (`replaceState`) so plugins can time-travel / restore snapshots.
- An **action hook / stream** so plugins can observe dispatched actions (if needed by plugin behavior).

### Where plugin glue lives

- Framework-agnostic plugins: `src/plugins/*`
- Framework-specific plugin wiring / helpers: `src/<framework>/*`

**Example:** Qwik-specific plugin support lives under `src/qwik/*`.
No Qwik code should appear in `src/plugins/*`.

---

## Qwik integration

Qwik integration is treated as an adapter layer around core:
- `src/qwik/integration.tsx` provides framework binding (component/provider style integration).
- `src/qwik/hooks.ts` provides Qwik-friendly hooks/facades.
- `src/qwik/index.ts` re-exports Qwik integration surface.
- `src/qwik/plugins/history.ts` contains Qwik-specific plugin glue (canonical).

**Rule:** Qwik code may import core/hooks/plugins, but must not push Qwik concerns back into core/plugins.

---

## Public API surface

The project’s public API is exported from:

- `src/index.ts` (**canonical**)

Guidelines:
- Prefer re-exporting stable contracts/types and factory functions.
- Avoid exporting deep internal file paths unless explicitly intended.

---

## Webapp conventions (React UI)

In the `webapp` project:

- `/src/components` contains **React components** (including RHS panels).
- Other webapp plugin files live in `/src`.
- Relative imports should be written with these base paths in mind.

### Top-right tools panel registration

The accepted registration function name:

- `registerTopRightToolsPanelComponent`

Slot behavior:
- `TopRightToolsPanel` registers icon buttons.

---

## Canonical files policy

When multiple versions exist or older drafts are present, the following are treated as canonical:

- Core: `src/core/{store,action,effect,selector,middleware,types}.ts`
- Hooks: `src/hooks/{useAction,useEffect,index}.ts`
- Qwik: `src/qwik/{integration.tsx,hooks.ts,index.ts}`
- Qwik plugin: `src/qwik/plugins/history.ts`
- Public entry: `src/index.ts`

Older or alternative implementations should be considered **deprecated** unless explicitly referenced.

---

## Testing & verification (recommended)

- Add a CI check for forbidden imports (plugins importing from framework, core importing from framework, etc.).
- Consider an eslint rule / custom script to enforce the dependency direction.
- Add smoke tests for:
    - store initialization + state replacement
    - action subscriptions (if used)
    - plugin host wiring in Qwik

---

## Decision log

Record architectural decisions here with date + short rationale.

- YYYY-MM-DD: (Decision) — (Why)
