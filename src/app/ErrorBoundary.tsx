import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error.name, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto max-w-xl px-6 py-16">
          <h1 className="section-title text-2xl">Something went wrong</h1>
          <p className="mt-4 text-muted">
            The dashboard hit an unexpected error. The details are in the browser console. Ticket
            text is not included in that report.
          </p>
          <button
            type="button"
            className="mt-6 rounded-full bg-brand px-4 py-2 font-bold text-on-brand"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
