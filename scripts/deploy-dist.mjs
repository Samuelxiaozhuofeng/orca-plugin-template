// Copies the freshly built dist/ into the local Orca plugin folder so the
// plugin can be reloaded in Orca without a manual copy. The destination comes
// from ORCA_PLUGIN_DIR, or from a gitignored `scripts/deploy-target.local`
// file holding the folder path (one line). Skipped (without failing the build)
// when neither is set.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "dist");

function localTarget() {
  const file = join(root, "scripts", "deploy-target.local");
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8").trim();
}

const target = process.env.ORCA_PLUGIN_DIR || localTarget();

if (!existsSync(source)) {
  console.error(`[deploy] no build output at ${source}`);
  process.exit(1);
}

if (!target) {
  console.warn(
    "[deploy] skipped: set ORCA_PLUGIN_DIR or scripts/deploy-target.local to your Orca plugin folder.",
  );
  process.exit(0);
}

mkdirSync(target, { recursive: true });

const targetDist = join(target, "dist");
rmSync(targetDist, { recursive: true, force: true });
cpSync(source, targetDist, { recursive: true });

// Orca reads these from the plugin folder root, not from dist/.
for (const name of ["package.json", "icon.png", "README.md", "LICENSE"]) {
  const from = join(root, name);
  if (existsSync(from)) cpSync(from, join(target, name));
}

console.log(`[deploy] dist -> ${targetDist}`);
