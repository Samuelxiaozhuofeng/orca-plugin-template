import { t } from "../libs/l10n";
import type { EdgeArrow, WhiteboardEdge } from "./edges";
import { linkEdgeToNote } from "./linkEdge";

type Props = {
  edge: WhiteboardEdge;
  edges: WhiteboardEdge[];
  close: () => void;
  onCommit: (next: WhiteboardEdge[]) => Promise<boolean>;
  onSelect: (id: string | null) => void;
};

export function EdgeMenuItems({
  edge,
  edges,
  close,
  onCommit,
  onSelect,
}: Props) {
  const setArrow = (arrow: EdgeArrow) => {
    close();
    if (edge.arrow === arrow) return;
    void onCommit(
      edges.map((item: WhiteboardEdge) =>
        item.id === edge.id ? { ...item, arrow } : item,
      ),
    );
  };

  const createReference = async () => {
    if (edge.linked) return;
    close();
    try {
      await linkEdgeToNote(edge);
    } catch (error) {
      console.error("[whiteboard] link edge failed", error);
      orca.notify(
        "error",
        error instanceof Error
          ? error.message
          : t("Failed to create a note reference"),
      );
      return;
    }
    const marked = edges.map((item: WhiteboardEdge) =>
      item.id === edge.id ? { ...item, linked: true as const } : item,
    );
    const ok = await onCommit(marked);
    if (!ok) {
      orca.notify(
        "error",
        t(
          "Created the note reference but could not mark this line. The reference is already in the source note.",
        ),
      );
      return;
    }
    orca.notify(
      "success",
      t(
        "Added a reference under the source note. Deleting this line will not remove that note.",
      ),
    );
  };

  return (
    <>
      <orca.components.MenuText
        title={t("Arrow to end")}
        preIcon={edge.arrow === "end" ? "ti ti-check" : undefined}
        onClick={() => setArrow("end")}
      />
      <orca.components.MenuText
        title={t("Arrows on both ends")}
        preIcon={edge.arrow === "both" ? "ti ti-check" : undefined}
        onClick={() => setArrow("both")}
      />
      <orca.components.MenuText
        title={t("No arrows")}
        preIcon={edge.arrow === "none" ? "ti ti-check" : undefined}
        onClick={() => setArrow("none")}
      />
      <orca.components.MenuSeparator />
      <orca.components.MenuText
        title={t("Create a note reference")}
        subtitle={t(
          "Adds a child under the source note. Deleting this line later will not remove that child.",
        )}
        preIcon="ti ti-link"
        disabled={edge.linked === true}
        onClick={() => {
          void createReference();
        }}
      />
      <orca.components.MenuSeparator />
      <orca.components.MenuText
        title={t("Delete")}
        dangerous
        onClick={() => {
          close();
          void onCommit(edges.filter((item) => item.id !== edge.id));
          onSelect(null);
        }}
      />
    </>
  );
}
