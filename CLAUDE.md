# Repository Guidelines

## Project Structure & Module Organization

This is a Vite-powered TypeScript template for an Orca Note plugin. The entry point is `src/main.ts`, which exports `load` and `unload`. Register startup behavior in `load`, and release listeners, commands, timers, or resources in `unload`.

- `src/libs/` contains reusable helper modules such as localization.
- `src/translations/` stores built-in locale dictionaries, for example `zhCN.ts`.
- `src/orca.d.ts` defines the global Orca API types used by plugin code.
- `plugin-docs/` contains Orca API, command, renderer, and config references. API types in `plugin-docs/types/` are modularized into domain files (`block-types.md`, `command-types.md`, `query-types.md`, `ui-layout-types.md`, `plugin-runtime-types.md`, `orca-api.md`). See `plugin-docs/types/README.md` for index.
- Root config lives in `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, and `index.html`.

## Build, Test, and Development Commands

- `npm install`: install development dependencies. React and Valtio are peer dependencies supplied by Orca at runtime.
- `npm run dev`: start the Vite development server for local iteration.
- `npm run build`: run TypeScript checks with `tsc`, then produce the production Vite library build.
- `npm run preview`: preview the built Vite output locally.

No test or lint command is configured yet. Use `npm run build` as the minimum verification step.

## Coding Style & Naming Conventions

Use TypeScript ES modules and keep `strict` mode clean. Match the existing style: 2-space indentation, semicolons, double quotes, and small focused modules. Prefer named exports for helpers. Use `camelCase` for variables and functions, `PascalCase` for React components and types, and locale file names such as `zhCN.ts`.

Keep plugin features split by responsibility. For example, place reusable command registration helpers under `src/libs/` instead of growing `src/main.ts`.

## Testing Guidelines

No testing framework is configured. When adding meaningful logic, add a test runner in the same change and document the command in `package.json`. Prefer colocated tests named `*.test.ts` for pure utilities. For lifecycle changes, verify `npm run build` and manually test `load` and `unload` inside Orca.

## Commit & Pull Request Guidelines

This copy has no local Git history, so no repository-specific convention can be inferred. Use concise imperative messages, optionally with Conventional Commit prefixes, for example `feat: register sample command` or `fix: clean up unload handler`.

Pull requests should include a short summary, verification steps with actual commands run, linked issues when applicable, and screenshots or recordings for visible UI changes.

## Security & Configuration Tips

Do not hardcode secrets, file-system paths, or user-specific repository locations. Treat `orca` as a runtime global supplied by Orca Note, and keep external runtime dependencies aligned with `vite.config.ts` externals.
