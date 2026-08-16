# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An **Orca Note plugin** that adds a **Heptabase-style whiteboard** to Orca. The design target is Heptabase's canvas feel: outline blocks become freely-placed cards on an infinite pannable/zoomable canvas, cards stay live-editable in place (not read-only previews), and cards are joined by hand-drawn arrows that can be promoted into real note references. When making interaction decisions (drag/select/zoom/edge-drawing behaviour, card chrome, keyboard shortcuts), match Heptabase's behaviour unless there is a reason not to — Orca API limits, or an explicit user instruction.

Runtime is Orca itself: React and Valtio are **not bundled**, they arrive as `window.React` / `window.Valtio` globals (see `vite.config.ts` externals). Code therefore destructures hooks from `window.React` at module top rather than importing `react`. `orca` is a global; its types live in `src/orca.d.ts`, and the API reference is in `plugin-docs/` (start at `plugin-docs/types/README.md`).

## Commands

```bash
npm run build
```
Runs `tsc` (typecheck, `noEmit`) then the Vite library build, then `scripts/deploy-dist.mjs` copies `dist/` into the local Orca plugins folder so the plugin can be reloaded in Orca. Set `ORCA_PLUGIN_DIR` to the destination folder; the copy is skipped without failing when the variable is unset or the folder is absent.

```bash
npm test
```
Runs `src/whiteboard/*.test.ts` via `node --experimental-strip-types` — plain assertion scripts, no framework. Pure-logic tests only. Add new pure-utility tests the same way; the `test` script already includes every `*.test.ts` in that folder.

`npm run dev` / `npm run preview` exist but are of limited use: the plugin only renders inside Orca. Real verification is `npm run build` + reload the plugin in Orca.

## Architecture

Entry `src/main.tsx` exports `load(name)` / `unload()`. `load` registers everything (panel, block renderer, editor + slash + block-menu commands, headbar button, settings schema, injected CSS, block marks); `unload` must undo all of it, and flushes pending writes first. Everything else lives in `src/whiteboard/`.

**Two surfaces for one board.** A whiteboard is a normal Orca block with `_repr.type === "whiteboard.canvas"` (`WHITEBOARD_TYPE`). It renders inline in the outline via `BoardBlock` (registered block renderer) and full-screen via `BoardPanel` (registered panel type `whiteboard.board` = `PANEL_TYPE`). `data.ts` is the barrel re-exporting layout/cards/edges/journals for consumers.

**Board state = two block properties.** `cards` and `edges` are JSON strings on the board block. `cards.ts` / `edges.ts` own parse-normalize-write for each, both exposing a `tryRead*` (result type, distinguishes "unreadable" from "empty") and a `read*` (lossy). Writes go through `boardWrite.ts` → `orca.invokeBackend("set-properties", …)`, then read back and verify, then `orca.broadcasts.broadcast("orca.refresh-blocks", …)`.

Two invariants worth knowing before touching persistence:
- **Never use `invokeEditorCommand` to write board props.** It no-ops when the active panel has no `viewState.editor`, and the whiteboard panel never has one. This is why `writeProperties` calls the backend directly.
- **Unreadable props ⇒ protect mode.** If a stored `cards`/`edges` value isn't a JSON array, the board is flagged `protect` and *all* saving stops so nothing overwrites data the plugin failed to understand (`boardPropsReadable`, `refuseIfProtected`, `BOARD_UNREADABLE_MSG`).

**Persistence pipeline** (the trickiest part of the codebase, read these three together):
- `boardSession.ts` — one shared `BoardSession` per board id, refcounted across panels; holds `cards`/`edges`, their write baselines, pending buffers, dirty/in-flight/awaiting-echo flags, and a listener set.
- `boardPersistQueue.ts` — debounced (300 ms) card writes, serialized per-lane promise chains, rollback to baseline on failure, and `applyCardEcho`/`applyEdgeEcho` which reconcile server state back into the session *without* clobbering local edits still in flight.
- `useBoardPersist.ts` — the React hook panels use; `cardPersist.ts` / `edgePersist.ts` are thin flush facades used by `unload`.

`boardHistory.ts` is a separate per-board undo/redo stack (snapshots of cards+edges, limit 50) retained while any panel for that board is mounted; `runAsHistoryStep` wraps mutations. `boardEvents.ts` is a tiny emitter (`onBoardCardsChanged`) that decouples persistence from listeners like `blockMarks.ts`.

**Canvas composition.** `Canvas.tsx` is mostly wiring; the behaviour lives in hooks and imperative gesture modules:
- `useCanvasView.ts` + `viewTransform.ts` — pan/zoom, wheel vs. pinch, world↔client coords, viewport culling (`visibleCards`), LOD threshold, and the block-text/excerpt cache.
- `useCanvasPointer.ts` + `cardGestures.ts` + `marquee.ts` + `snap.ts` — drag/resize/marquee/alignment guides. These deliberately mutate DOM directly during a gesture (`applyCardBox`, `paintGuides`, `paintMarquee`) and only commit to React state on gesture end; keep that pattern for anything running at pointer-move frequency.
- `useCanvasBoard.ts` — selection, editing card, arrange actions, keyboard (`canvasKeys.ts`).
- Edges: `edgeGeometry.ts` (pure curve/anchor math) → `edgeGestures.ts` (imperative draw) → `EdgeLayer.tsx`/`useEdgeLayerApi.ts` (SVG, driven per-frame via `edgeApiRef.onFrame`). `edgeRefs.ts` derives *implicit* dashed edges from real note references; `linkEdge.ts` turns a drawn edge into a real reference in the note.
- Cards: `Card.tsx` + `CardBlockTree.tsx` render live editable block trees; `cardTreePlan.ts` (pure planning, depth/node caps, fold + host-renderer awareness) and `cardTreeLoad.ts` (batched `get-blocks` per level, only for visible cards) keep large boards from loading the whole graph.
- `blockWatch.ts` — `useWatchedValue`, subscribes to individual Valtio block proxies so a card re-renders only when *its* blocks change. Prefer it over `useSnapshot(orca.state)` in card-level components; a broad snapshot re-renders the whole board on any note edit.

**Cross-cutting**
- `settings.ts` — settings schema + `readWhiteboardSettings` (all reads go through it so defaults stay in one place). `bindWhiteboardPlugin(name)` must be called before any settings read.
- Styles: every `*Styles.ts` exports a CSS string; `styles.ts` concatenates them and injects via `orca.themes.injectCSS` under a role key. `blockMarks.ts` generates CSS at runtime to mark outline rows that already have a card. Class prefix is `owb-`.
- `hostOverlay.ts` — selector list for Orca's own popups/menus, used to keep canvas gestures from hijacking host UI. Its class names are inferred from other plugins/themes, not documented; verify in a real Orca session before relying on additions.

## Conventions

TypeScript ESM, `strict`, 2-space indent, semicolons, double quotes, named exports for helpers. `camelCase` values, `PascalCase` components/types. Files are grouped by responsibility, one concern per file, and kept well under 500 lines — follow that when adding rather than growing `Canvas.tsx`/`main.tsx`. User-facing strings go through `t()` from `src/libs/l10n`, with the zh-CN dictionary in `src/translations/zhCN.ts`.

Commits use Conventional Commit prefixes (`feat:`, `fix:`, occasionally scoped e.g. `feat(whiteboard):`).
