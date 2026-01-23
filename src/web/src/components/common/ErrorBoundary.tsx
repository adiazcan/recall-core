import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Something went wrong</h1>
            
            <p className="text-neutral-600 mb-6">
              We're sorry, but something unexpected happened. The error has been logged and we'll look into it.
            </p>

            {this.state.error && (
              <details className="mb-6">
                <summary className="text-sm font-medium text-neutral-700 cursor-pointer hover:text-neutral-900">
                  Error details
                </summary>
                <div className="mt-2 p-4 bg-neutral-50 rounded-md">
                  <p className="text-xs font-mono text-red-600 mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-xs font-mono text-neutral-600 overflow-x-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <Button onClick={this.handleReset} variant="outline" className="flex-1">
                Try again
              </Button>
              <Button onClick={this.handleReload} className="flex-1">
                Reload page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
