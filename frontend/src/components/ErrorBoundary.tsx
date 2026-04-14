import type { ReactNode } from 'react';
import React from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch and display React errors
 * Prevents entire app from crashing on component errors
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    // You could also log the error to an error reporting service here
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface p-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-error-container text-error rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-[32px]">error</span>
              </div>
              <h1 className="text-2xl font-black text-error">Something went wrong</h1>
            </div>

            <div className="bg-error-container/20 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-on-surface mb-2 font-medium">Error Details:</p>
              <p className="text-xs text-on-surface-variant font-mono break-words">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-primary text-white py-3 rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined inline mr-2 text-[18px]">login</span>
                Return to Login
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-surface-variant text-on-surface py-3 rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined inline mr-2 text-[18px]">refresh</span>
                Reload
              </button>
            </div>

            <p className="text-xs text-on-surface-variant mt-6">
              If this error persists, please contact support with the details above.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
