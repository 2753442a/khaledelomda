import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d1117] text-gray-100 flex items-center justify-center p-4">
          <div className="card glass-strong max-w-md w-full p-6 sm:p-8 text-center border border-red-500/20 shadow-2xl animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4 text-red-400 shadow-inner">
              <AlertTriangle size={32} />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">
              {this.props.fallbackTitle || 'عذراً، حدث خطأ غير متوقع'}
            </h2>

            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              {this.props.fallbackMessage || 'يرجى المحاولة مرة أخرى أو التحقق من الاتصال بالشبكة'}
            </p>

            {this.state.error?.message && (
              <div className="mb-6 p-3 rounded-lg bg-black/40 border border-white/5 text-xs font-mono text-gray-400 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="btn-primary w-full sm:w-auto py-2.5 px-5 flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                <span>إعادة تحميل الصفحة</span>
              </button>

              <button
                onClick={this.handleReset}
                className="glass w-full sm:w-auto py-2.5 px-5 rounded-xl hover:bg-white/10 transition-colors text-sm text-gray-300 flex items-center justify-center gap-2"
              >
                <Home size={16} />
                <span>إعادة المحاولة</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
