import { Component } from "react";
import { t } from "../libs/l10n";

type Props = { children: React.ReactNode };
type State = { failed: boolean };

/**
 * Isolates one card's inner tree. A throw here must not blank the canvas.
 */
export class CardErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(err: unknown): void {
    console.error("[whiteboard] card render failed", err);
  }

  render(): React.ReactNode {
    if (this.state.failed) {
      return (
        <div className="owb-card-crash" role="alert">
          {t("This card could not be opened")}
        </div>
      );
    }
    return this.props.children;
  }
}
