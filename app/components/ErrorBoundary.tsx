"use client";

import { Component, ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#FAF8FC] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-red-200 p-6 shadow-sm space-y-3">
          <h2 className="text-base font-bold text-red-700">エラーが発生しました</h2>
          <p className="text-sm text-red-600 font-mono break-all">{error.message}</p>
          <pre className="text-xs text-gray-500 overflow-auto max-h-40 bg-gray-50 rounded p-2">
            {error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 bg-[#634B99] text-white rounded-xl text-sm font-semibold"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }
}
