import { Component, ReactNode } from "react";
import { logDebug } from "@/utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error): void {
    logDebug("Popup rendering failed", error);
  }

  render() {
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
