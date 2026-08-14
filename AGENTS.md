# Repository Guidelines

## Project Overview

An Orca Note plugin that adds a **Heptabase-style whiteboard** to Orca: outline blocks become freely-placed cards on an infinite pan/zoom canvas, cards stay live-editable in place rather than being read-only previews, and hand-drawn arrows between cards can be promoted into real note references. When deciding interaction details, match Heptabase's behaviour unless an Orca API limit or an explicit instruction says otherwise.

React and Valtio are **not bundled** — Orca supplies them as `window.React` / `window.Valtio` globals (see the externals in `vite.config.ts`), so modules destructure hooks off `window.React` instead of importing `react`. `orca` is likewise a runtime global.

## Project Structure & Module Organization

The entry point is `src/main.tsx`, which exports `load` and `unload`. Register startup behaviour (panel, block renderer, commands, headbar button, settings schema, injected CSS) in `load`, and release every one of them — plus listeners, timers, and pending writes — in `unload`.

- `src/whiteboard/` holds the whole feature: data/persistence, canvas view and gestures, edges, card rendering, dialogs, and one `*Styles.ts` per CSS area.
- `src/libs/` contains reusable helper modules such as localization.
- `src/translations/` stores built-in locale dictionaries, for example `zhCN.ts`.
- `src/orca.d.ts` defines the global Orca API types used by plugin code.
- `plugin-docs/` contains Orca API, command, renderer, and config references. API types in `plugin-docs/types/` are modularized into domain files (`block-types.md`, `command-types.md`, `query-types.md`, `ui-layout-types.md`, `plugin-runtime-types.md`, `orca-api.md`). See `plugin-docs/types/README.md` for the index.
- `scripts/deploy-dist.mjs` runs after every build to copy `dist/` into the local Orca plugins folder.
- Root config lives in `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, and `index.html`.

See `CLAUDE.md` for the architecture walkthrough (board state model, persistence pipeline, canvas composition).

## Build, Test, and Development Commands

- `npm install`: install development dependencies. React and Valtio are peer dependencies supplied by Orca at runtime.
- `npm run build`: typecheck with `tsc`, produce the Vite library build, then deploy `dist/` into the local Orca plugin folder. Override the destination with `ORCA_PLUGIN_DIR`; the copy is skipped without failing when the folder does not exist.
- `npm test`: run the pure-logic assertion script (`src/whiteboard/cardTreeLoad.test.ts`) via `node --experimental-strip-types`.
- `npm run dev` / `npm run preview`: Vite server and preview. Of limited use — the plugin only renders inside Orca.

Minimum verification for any change is `npm run build` followed by reloading the plugin in Orca.

## Coding Style & Naming Conventions

Use TypeScript ES modules and keep `strict` mode clean. Match the existing style: 2-space indentation, semicolons, double quotes, and small focused modules. Prefer named exports for helpers. Use `camelCase` for variables and functions, `PascalCase` for React components and types, and locale file names such as `zhCN.ts`. CSS classes are prefixed `owb-`.

Keep files split by responsibility, one concern per file, and well under 500 lines. Add new behaviour as a new module rather than growing `Canvas.tsx` or `main.tsx`. All user-facing strings go through `t()` from `src/libs/l10n`.

## Testing Guidelines

No test framework is configured; tests are plain assertion scripts run by `node --experimental-strip-types`. Prefer colocated `*.test.ts` files for pure utilities (parsing, planning, geometry, layout) and extend the `test` script in `package.json` when adding one. Logic that needs the `orca` global or the DOM is verified manually inside Orca.

For lifecycle changes, verify `load` and `unload` in a real Orca session — in particular that `unload` leaves no registered command, renderer, listener, or injected CSS behind.

## Persistence Invariants

Two rules that are easy to break and expensive to debug:

- **Never write board properties through `invokeEditorCommand`.** It no-ops when the active panel has no `viewState.editor`, and the whiteboard panel never has one. Board writes go through `boardWrite.ts` to the backend directly, then read back and verify.
- **Unreadable properties put the board in protect mode.** If a stored `cards`/`edges` value is not a JSON array, all saving for that board stops so nothing overwrites data the plugin failed to parse. Do not add a write path that bypasses this check.

## Commit & Pull Request Guidelines

Use Conventional Commit prefixes, optionally scoped — for example `feat: add card tree loading`, `feat(whiteboard): add new board functionalities`, `fix: clean up unload handler`.

Pull requests should include a short summary, verification steps with actual commands run, linked issues when applicable, and screenshots or recordings for visible UI changes.

## Security & Configuration Tips

Do not hardcode secrets or user-specific repository locations. `scripts/deploy-dist.mjs` currently carries a machine-specific default path — override it with `ORCA_PLUGIN_DIR` rather than editing it for your machine. Treat `orca` as a runtime global supplied by Orca Note, and keep external runtime dependencies aligned with the `vite.config.ts` externals.
