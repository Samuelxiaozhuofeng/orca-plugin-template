// Copies the freshly built dist/ into the local Orca plugin folder so the
// plugin can be reloaded in Orca without a manual copy. Override the target
// with ORCA_PLUGIN_DIR; skipped (without failing the build) when the target
// folder does not exist, so builds on another machine still succeed.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "dist");
const target =
  process.env.ORCA_PLUGIN_DIR ??
  "/Users/samdagreat/Documents/orca/plugins/whiteboard";

if (!existsSync(source)) {
  console.error(`[deploy] no build output at ${source}`);
  process.exit(1);
}

if (!existsSync(target)) {
  console.warn(`[deploy] skipped: plugin folder not found at ${target}`);
  process.exit(0);
}

const targetDist = join(target, "dist");
rmSync(targetDist, { recursive: true, force: true });
cpSync(source, targetDist, { recursive: true });
console.log(`[deploy] dist -> ${targetDist}`);
