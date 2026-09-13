import { Component, type ReactNode } from "react";
import { logDebug } from "@/utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error): void {
    logDebug("Popup rendering failed", error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <p className="error-boundary-title">popup error</p>
          <small className="error-boundary-message">{this.state.error?.message}</small>
        </div>
      );
    }
    return this.props.children;
  }
}
