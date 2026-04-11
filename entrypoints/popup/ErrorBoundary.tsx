import { Component, ReactNode } from "react";

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

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "1rem", color: "#d32f2f", fontSize: "0.875rem" }}>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>エラーが発生しました</p>
          <small style={{ color: "#555" }}>{this.state.error?.message}</small>
        </div>
      );
    }
    return this.props.children;
  }
}
