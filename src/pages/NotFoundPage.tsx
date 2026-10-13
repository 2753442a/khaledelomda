import React from 'react'
import { Link } from 'react-router-dom'
import { Home, CalendarCheck, HelpCircle } from 'lucide-react'

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md w-full glass p-8 sm:p-10 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mb-6 shadow-inner">
          <span className="text-4xl">🌴</span>
        </div>

        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 mb-3 tracking-wider font-mono">
          404
        </h1>

        <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
          عذراً، الصفحة غير موجودة!
        </h2>

        <p className="text-sm text-gray-400 mb-8 leading-relaxed">
          يبدو أنك وصلت إلى رابط غير صحيح أو تم نقل هذه الصفحة. يمكنك العودة للصفحة الرئيسية أو استكشاف المنتجع والحجز.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="btn-primary flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/30"
          >
            <Home size={18} />
            الرئيسية
          </Link>
          <Link
            to="/book"
            className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-medium text-sm glass hover:bg-white/10 text-gray-200 border border-white/10 transition-colors"
          >
            <CalendarCheck size={18} className="text-emerald-400" />
            احجز الآن
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
