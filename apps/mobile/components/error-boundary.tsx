import { Component, type ReactNode } from 'react';

// React error boundaries must be class components; there is no functional equivalent.
// Deliberate exception to the arrow-function convention used elsewhere.

interface IErrorBoundaryProps {
  fallback: ReactNode;
  onError?: (error: Error) => void;
  children: ReactNode;
}

interface IErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
  state: IErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): IErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error);
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
