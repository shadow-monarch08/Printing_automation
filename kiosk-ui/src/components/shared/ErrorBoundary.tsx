import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] React component rendering fault:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "var(--bg-main, #0d0e12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            color: "var(--text-primary, #ffffff)",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          <div
            style={{
              maxWidth: "500px",
              width: "100%",
              background: "var(--bg-card, #161820)",
              border: "1px solid var(--border-default, #2a2e3d)",
              borderLeft: "4px solid var(--status-error, #ff4444)",
              padding: "32px",
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                letterSpacing: "1.5px",
                color: "var(--status-error, #ff4444)",
                marginBottom: "12px",
                fontWeight: 700,
              }}
            >
              [ SYSTEM UI FAULT ]
            </div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                margin: "0 0 12px 0",
                color: "var(--text-primary, #ffffff)",
              }}
            >
              Application Interface Fault
            </h2>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary, #9da4b4)",
                lineHeight: "1.6",
                margin: "0 0 24px 0",
              }}
            >
              An unexpected render crash occurred in the kiosk interface. The print engine remains active in the background.
            </p>
            {this.state.error && (
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid var(--border-default, #2a2e3d)",
                  padding: "12px",
                  fontSize: "11px",
                  color: "var(--status-error, #ff4444)",
                  marginBottom: "24px",
                  wordBreak: "break-all",
                }}
              >
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <button
              onClick={this.handleReload}
              style={{
                width: "100%",
                padding: "12px 20px",
                background: "var(--accent-primary, #3b82f6)",
                color: "#ffffff",
                border: "none",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "var(--font-mono, monospace)",
                cursor: "pointer",
                letterSpacing: "1px",
              }}
            >
              RELOAD INTERFACE
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
