import { t } from "../libs/l10n";
import type { CardLoadCause, CardLoadScope } from "./cardTreeLoad";

type Props = {
  scope: CardLoadScope;
  cause: CardLoadCause;
  fill?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
};

function noticeLabel(
  scope: CardLoadScope,
  cause: CardLoadCause,
  retrying: boolean,
): string {
  if (retrying) return t("Retrying…");
  if (cause === "gone") {
    return scope === "empty"
      ? t("This note is gone")
      : t("Some of this note is gone");
  }
  return scope === "empty"
    ? t("Couldn't load this card. Click to retry")
    : t("Some content didn't load. Click to retry");
}

export function CardLoadNotice({
  scope,
  cause,
  fill = false,
  retrying = false,
  onRetry,
}: Props) {
  const canRetry = cause === "retryable" && !retrying;
  const className = [
    "owb-card-load-error",
    fill ? "is-fill" : "is-banner",
    canRetry ? "" : "is-static",
    retrying ? "is-busy" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const label = noticeLabel(scope, cause, retrying);
  const stopDrag = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };

  if (canRetry) {
    return (
      <button
        type="button"
        className={className}
        onMouseDown={stopDrag}
        onClick={(event) => {
          event.stopPropagation();
          onRetry?.();
        }}
      >
        {label}
      </button>
    );
  }
  return (
    <div className={className} role="status" onMouseDown={stopDrag}>
      {label}
    </div>
  );
}
