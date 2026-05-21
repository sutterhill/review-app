# Review App Agent Guide

## Project Layout

- `packages/app/src/main` contains Electron main-process code only.
- `packages/app/src/preload` contains isolated preload bridge code only.
- `packages/app/src/renderer` contains React UI, routes, store, services, and components.
- `packages/app/src/renderer/components` contains reusable UI components with colocated tests.
- `packages/app/src/renderer/store` contains Redux Toolkit slices, selectors, types, and sagas.
- `packages/worker` is reserved for the Cloudflare Worker backend.

## Redux Saga Architecture

- Redux state must be JSON serializable: no `Date`, `Map`, `Set`, functions, class instances,promises, generators, DOM nodes, or Electron runtime objects.
- Convert dates to ISO strings before dispatching actions.
- Use `createSlice` from `@reduxjs/toolkit`; action types must follow `sliceName/actionName`.
- Reducers must be deterministic and side-effect free. Do not generate timestamps, random IDs, orperform IO in reducers.
- Side effects belong in sagas only: API calls, localStorage, timers, IPC, retries, debouncing,polling, and navigation caused by async workflows.

## Store File Organization

Use one domain folder per feature:

```text
packages/app/src/renderer/store/<domain>/
├── <domain>-slice.ts
├── <domain>-slice.test.ts
├── <domain>-selectors.ts
├── <domain>-types.ts
└── sagas/
    ├── <domain>-saga.ts
    └── <domain>-saga.test.ts
```

## Import Boundaries

- Components may import actions from `*-slice.ts`, selectors from `*-selectors.ts`, and types from`*-types.ts`.
- Components must never import saga files, store setup internals, reducer internals, or services thatperform side effects directly.
- Services may import actions, selectors, and serializable types. Services must not import Reactcomponents.
- Sagas may import services, actions, selectors, and types for their domain.
- Preload and main-process code must not import renderer store modules.

## Testing Requirements

- Use Vitest for unit tests.
- Keep tests colocated with the code under test.
- Every slice needs a colocated `*-slice.test.ts` covering initial state, reducers, and edge cases.
- Every saga with branching or IO needs a colocated saga test using `redux-saga-test-plan` or explicitgenerator stepping.
- Update or add tests in the same task that changes behavior.

## Commands

- `pnpm dev` or `pnpm start` launches the Electron app.
- `pnpm run lint` runs oxlint with strict settings.
- `pnpm run format` writes oxfmt changes.
- `pnpm run format:check` verifies formatting.
- `pnpm run typecheck` or `pnpm exec tsc --noEmit` runs TypeScript checks.
