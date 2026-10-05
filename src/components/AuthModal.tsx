import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { X, Phone, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

const AuthModal: React.FC<AuthModalProps> = ({ open, onClose }) => {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'login') {
      const { error: err } = await signIn(phone, password)
      if (err) setError(err)
      else onClose()
    } else {
      if (!fullName.trim()) { setError('الرجاء إدخال الاسم الكامل'); setLoading(false); return }
      if (phone.length < 10) { setError('الرجاء إدخال رقم جوال صحيح'); setLoading(false); return }
      if (password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); setLoading(false); return }
      const { error: err } = await signUp(fullName, phone, password)
      if (err) setError(err)
      else onClose()
    }
    setLoading(false)
  }

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError(null)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pb-safe">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md animate-scale-in">
        <div className="card glass-strong p-6 sm:p-7 relative border border-white/15 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {mode === 'login' ? 'أهلاً بك في منتجع خالد العمدة' : 'سجّل معنا لحجز استراحتك'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="glass p-2.5 rounded-xl hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>
          </div>

          {/* Resort Badge */}
          <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-2xl">🌴</span>
            <div>
              <p className="text-sm font-semibold text-emerald-400">منتجع وبستان خالد العمدة</p>
              <p className="text-xs text-gray-400">أفراح • مناسبات • إيجار يومي</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">الاسم الكامل</label>
                <div className="relative">
                  <User size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="أدخل اسمك الكامل"
                    className="input-field input-icon-right placeholder-slate-400 min-h-[48px]"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">رقم الجوال</label>
              <div className="relative">
                <Phone size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="input-field input-icon-right placeholder-slate-400 min-h-[48px] text-right font-mono"
                  required
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <Lock size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field input-icon-both placeholder-slate-400 min-h-[48px] font-sans"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white transition-colors"
                  aria-label="إظهار كلمة المرور"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full min-h-[48px] text-base font-bold shadow-lg shadow-emerald-600/30">
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'جاري المعالجة...' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <span className="text-sm text-gray-400">
              {mode === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}{' '}
            </span>
            <button onClick={switchMode} className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">
              {mode === 'login' ? 'سجّل الآن' : 'سجّل الدخول'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthModal
