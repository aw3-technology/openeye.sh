import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary that wraps the entire application.
 * Catches any unhandled rendering errors and shows a full-page fallback.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // TODO: Send to external error reporting service (e.g. Sentry, Datadog)
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center"
          role="alert"
        >
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              An unexpected error prevented the application from rendering. Please reload the page
              to try again.
            </p>
          </div>
          {this.state.error?.message && (
            <pre className="max-w-lg rounded-md bg-muted p-4 text-left text-xs text-muted-foreground overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
