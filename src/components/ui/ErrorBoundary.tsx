import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full rounded-xl bg-white dark:bg-gray-800 p-6 shadow-lg text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <span className="text-2xl">!</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Noe gikk galt
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              En uventet feil oppstod. Prøv å laste siden på nytt.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-bingo-500 px-4 py-2 text-sm font-medium text-white hover:bg-bingo-600"
            >
              Last inn på nytt
            </button>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-xs text-gray-400">
                  Tekniske detaljer
                </summary>
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-gray-100 dark:bg-gray-700 p-2 text-xs text-gray-600 dark:text-gray-300">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
