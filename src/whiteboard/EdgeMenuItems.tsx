import { t } from "../libs/l10n";
import { edgeHasNoteLink, linkEdgeByProperty } from "./edgeLink";
import { type WhiteboardEdge } from "./edges";
import { linkEdgeToNote } from "./linkEdge";
import { currentWhiteboardSettings } from "./settings";

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
  const settings = currentWhiteboardSettings();
  const canUnlink = edge.linkRefId != null;

  const createReference = async () => {
    if (edgeHasNoteLink(edge)) return;
    close();
    const useChild = settings.edgeLinkMode === "child";
    let marked: WhiteboardEdge;
    try {
      if (useChild) {
        await linkEdgeToNote(edge);
        marked = { ...edge, linked: true };
      } else {
        const refId = await linkEdgeByProperty(edge);
        marked = { ...edge, linkRefId: refId };
      }
    } catch (error) {
      console.error("[whiteboard] link edge failed", error);
      orca.notify("error", t("Failed to create a note reference"));
      return;
    }
    const next = edges.map((item: WhiteboardEdge) =>
      item.id === edge.id ? marked : item,
    );
    const ok = await onCommit(next);
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
      useChild
        ? t(
            "Added a reference under the source note. Deleting this line will not remove that note.",
          )
        : t("Linked these cards in the notes."),
    );
  };

  const removeReference = async () => {
    if (edge.linkRefId == null) return;
    close();
    const cleared = edges.map((item: WhiteboardEdge) => {
      if (item.id !== edge.id) return item;
      const next = { ...item };
      delete next.linkRefId;
      return next;
    });
    const ok = await onCommit(cleared);
    if (!ok) {
      orca.notify("error", t("Failed to remove the note reference"));
    }
  };

  return (
    <>
      {canUnlink ? (
        <orca.components.MenuText
          title={t("Remove note reference")}
          subtitle={t("Removes the reference from the source note.")}
          preIcon="ti ti-unlink"
          onClick={() => {
            void removeReference();
          }}
        />
      ) : (
        <orca.components.MenuText
          title={t("Create a note reference")}
          subtitle={
            settings.edgeLinkMode === "child"
              ? t(
                  "Adds a child under the source note. Deleting this line later will not remove that child.",
                )
              : t(
                  "Creates a reference on the source note. Deleting this line later will remove it.",
                )
          }
          preIcon="ti ti-link"
          disabled={edge.linked === true}
          onClick={() => {
            void createReference();
          }}
        />
      )}
      <orca.components.MenuSeparator />
      <orca.components.MenuText
        title={t("Delete")}
        dangerous
        onClick={() => {
          close();
          void onCommit(edges.filter((item) => item.id !== edge.id)).then(
            (ok) => {
              if (ok) onSelect(null);
            },
          );
        }}
      />
    </>
  );
}
