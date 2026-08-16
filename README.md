# Orca Whiteboard

A Heptabase-style whiteboard for [Orca Note](https://orca.saer.cn/). Outline blocks become cards you can place freely on an infinite canvas, edit in place, and join with hand-drawn arrows that can become real note references.

## What you can do

- Open a full-screen canvas from a whiteboard block or a whiteboard page.
- Drop notes, journals, tags, or query results onto the board as live-editable cards.
- Draw arrows between cards; promote an arrow into a real reference in the note.
- Group cards into sections, search and filter cards, and collect a selection into a new sub-whiteboard.
- Keep cards in sync with the outline: a mark shows which blocks already sit on a board.

## Install

1. Download the zip from the [Releases](https://github.com/Samuelxiaozhuofeng/orca-plugin-whiteboard/releases) page.
2. Extract it into Orca Note’s `plugins` folder.  
   Orca’s folder is under your Documents directory, for example  
   `Documents/orca/plugins/` on macOS or `Documents\orca\plugins\` on Windows.
3. The extracted folder **must** be named `orca-plugin-whiteboard`.
4. The folder must contain at least `dist/index.js`, `package.json`, and `icon.png` (the icon is required by Orca’s plugin list).
5. Restart Orca Note, then enable **orca-plugin-whiteboard** in Settings → Plugins.

This plugin needs a current Orca Note. The API docs only say “latest version”; there is no pinned minimum version on record.

## First steps after enabling

**Create a board**

- In a note, type `/` and pick **New whiteboard** to insert a board block in that note.  
  Or pick **New whiteboard page** to create a searchable page you can open on its own and link to with `[[name]]`.
- Click the chalkboard icon in the top bar to open an existing board.

**Put the first card on the board**

- Right-click empty canvas and choose **New card here**.
- Or use **Place journals…** in the toolbar to lay out a date range of journals.
- Or drag blocks from a note onto the canvas.

**Move around the canvas**

- **Mouse mode** (default): scroll wheel zooms, right-drag pans.
- **Trackpad mode**: two-finger scroll pans, pinch zooms.
- Switch the mode in this plugin’s settings if pan/zoom feels wrong.

## Develop

```bash
git clone https://github.com/Samuelxiaozhuofeng/orca-plugin-whiteboard.git
cd orca-plugin-whiteboard
npm install
```

Build (works on macOS, Linux, and Windows — no Unix-only env syntax):

```bash
npm run build
```

That typechecks, writes `dist/index.js`, then copies `dist/` into the folder given by `ORCA_PLUGIN_DIR` if that folder exists. If the variable is unset, the copy is skipped and the build still succeeds.

Point the copy at your local Orca plugin folder:

```bash
# macOS / Linux
export ORCA_PLUGIN_DIR="$HOME/Documents/orca/plugins/orca-plugin-whiteboard"
npm run build

# Windows PowerShell
$env:ORCA_PLUGIN_DIR="$env:USERPROFILE\Documents\orca\plugins\orca-plugin-whiteboard"
npm run build

# Windows cmd
set ORCA_PLUGIN_DIR=%USERPROFILE%\Documents\orca\plugins\orca-plugin-whiteboard
npm run build
```

Reload the plugin in Orca after each build. `npm test` runs the pure-logic checks in `src/whiteboard/*.test.ts`.

## License

MIT. See [LICENSE](LICENSE).
