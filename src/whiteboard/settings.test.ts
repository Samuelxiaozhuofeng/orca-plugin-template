// @ts-nocheck — Node assertion script; tsc has no @types/node in this package.
import { register } from "node:module";

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, nextResolve) {
      try {
        return await nextResolve(specifier, context);
      } catch (err) {
        if (
          err?.code === "ERR_MODULE_NOT_FOUND" &&
          typeof specifier === "string" &&
          !specifier.endsWith(".ts") &&
          (specifier.startsWith(".") || specifier.startsWith("/"))
        ) {
          return nextResolve(specifier + ".ts", context);
        }
        throw err;
      }
    }
  `)}`,
  import.meta.url,
);

const {
  controlsModeFromSettings,
  migrateControlsMode,
} = await import("./controlsMode.ts");
const { readWhiteboardSettings } = await import("./settings.ts");

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

check(migrateControlsMode("rightDrag") === "mouse", "rightDrag → mouse");
check(migrateControlsMode("mouse") === "mouse", "mouse stays mouse");
check(migrateControlsMode("standard") === "trackpad", "standard → trackpad");
check(migrateControlsMode("trackpad") === "trackpad", "trackpad stays trackpad");
check(migrateControlsMode("nope") === "mouse", "unknown string → mouse");
check(migrateControlsMode(undefined) === "mouse", "undefined → mouse");
check(migrateControlsMode(null) === "mouse", "null → mouse");
check(migrateControlsMode(1) === "mouse", "number → mouse");
check(migrateControlsMode(true) === "mouse", "boolean → mouse");
check(migrateControlsMode({}) === "mouse", "object → mouse");
check(migrateControlsMode("") === "mouse", "empty string → mouse");

check(
  controlsModeFromSettings({ mouseScheme: "rightDrag" }) === "mouse",
  "read rightDrag",
);
check(
  controlsModeFromSettings({ mouseScheme: "standard" }) === "trackpad",
  "read standard",
);
check(
  controlsModeFromSettings({ mouseScheme: "mouse" }) === "mouse",
  "read mouse",
);
check(
  controlsModeFromSettings({ mouseScheme: "trackpad" }) === "trackpad",
  "read trackpad",
);
check(
  controlsModeFromSettings({ mouseScheme: "legacy" }) === "mouse",
  "read unknown",
);
check(
  controlsModeFromSettings(undefined) === "mouse",
  "read missing settings object",
);
check(
  controlsModeFromSettings({}) === "mouse",
  "read missing mouseScheme",
);
check(
  controlsModeFromSettings({ mouseScheme: 0 }) === "mouse",
  "read dirty non-string",
);

check(
  readWhiteboardSettings(undefined).autoLinkEdges === true,
  "auto-link defaults on",
);
check(
  readWhiteboardSettings({}).autoLinkEdges === true,
  "missing auto-link is on",
);
check(
  readWhiteboardSettings({ autoLinkEdges: false }).autoLinkEdges === false,
  "auto-link can be turned off",
);
check(
  readWhiteboardSettings(undefined).edgeLinkMode === "property",
  "link mode defaults to property",
);
check(
  readWhiteboardSettings({ edgeLinkMode: "child" }).edgeLinkMode === "child",
  "link mode can be the older child-block method",
);
check(
  readWhiteboardSettings({ edgeLinkMode: "nope" }).edgeLinkMode === "property",
  "unknown link mode falls back to property",
);
check(
  readWhiteboardSettings(undefined).bidirectionalEdgeLinks === true,
  "bidirectional link defaults on",
);
check(
  readWhiteboardSettings({}).bidirectionalEdgeLinks === true,
  "missing bidirectional link is on",
);
check(
  readWhiteboardSettings({ bidirectionalEdgeLinks: false }).bidirectionalEdgeLinks === false,
  "bidirectional link can be turned off",
);

console.log("settings tests passed");
