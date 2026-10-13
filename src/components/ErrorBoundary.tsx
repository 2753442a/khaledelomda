import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  fallbackTitle?: string
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
    console.error('Uncaught error in component tree:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[70vh] flex items-center justify-center p-4" dir="rtl">
          <div className="card glass-strong max-w-md w-full p-8 text-center border border-red-500/30 shadow-2xl space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center">
              <AlertTriangle size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {this.props.fallbackTitle || 'حدث خطأ غير متوقع'}
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                نعتذر عن هذا الخطأ التقني المفاجئ. يمكنك إعادة تحديث الصفحة أو العودة للصفحة الرئيسية للمنتجع.
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <div className="text-right p-3 rounded-xl bg-black/50 border border-red-500/20 text-red-300 text-xs font-mono overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="btn-primary py-2.5 px-5 flex-1 flex items-center justify-center gap-2 font-bold text-sm"
              >
                <RefreshCw size={16} />
                <span>إعادة المحاولة</span>
              </button>
              <a
                href="/"
                className="btn-ghost py-2.5 px-5 flex-1 flex items-center justify-center gap-2 font-medium text-sm"
              >
                <Home size={16} />
                <span>الرئيسية</span>
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
