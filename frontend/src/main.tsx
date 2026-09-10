import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error in JuridFlow:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-slate-800 border border-red-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-lg">
                ⚠️
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">JuridFlow - Diagnóstico de Inicialização</h1>
                <p className="text-xs text-slate-400">Ocorreu um erro durante a renderização do componente visual.</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl text-red-300 font-mono text-xs overflow-x-auto space-y-2 border border-slate-800">
              <p className="font-bold text-red-400">{this.state.error && this.state.error.toString()}</p>
              {this.state.errorInfo && (
                <pre className="text-[11px] text-slate-400 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => window.location.reload()}
                aria-label="Recarregar aplicação JuridFlow"
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg transition-all"
              >
                Recarregar Aplicação
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

