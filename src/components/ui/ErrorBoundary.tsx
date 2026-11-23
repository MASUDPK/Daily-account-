import React from 'react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-[#0F172A]">Application Notice</h1>
            <p className="mt-2 text-sm text-slate-600">
              DAILY ACCOUNT encountered an unexpected error while processing your request.
            </p>
            <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs font-mono text-slate-700 break-words">
              {this.state.errorMessage}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-[#0B1F3A] text-white text-sm font-medium hover:bg-[#163864] transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
