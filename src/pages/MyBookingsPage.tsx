import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  formatArabicDate, formatCurrency, formatTime,
  generateWhatsAppLink, STATUS_LABELS, STATUS_CLASSES
} from '../lib/utils'
import { MessageCircle, AlertTriangle, X, Loader2, RefreshCw, Clock, CheckCircle2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface Booking {
  id: string
  property_id: string
  customer_name: string
  customer_phone: string
  booking_date: string
  check_in: string
  check_out: string
  total_amount: number
  deposit_amount: number
  payment_method: string | null
  payment_receipt_url: string | null
  status: string
  cancellation_reason: string | null
  cancelled_at: string | null
  created_at: string
  properties?: { name: string }
}

const MyBookingsPage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelModal, setCancelModal] = useState<Booking | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    if (cancelModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [cancelModal])

  const fetchBookings = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, properties(name)')
      .eq('customer_id', user.id)
      .order('booking_date', { ascending: false })
    if (data) setBookings(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchBookings()
  }, [user])

  const handleCancel = async () => {
    if (!cancelModal || !profile) return
    setCancelLoading(true)

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: cancelReason || 'ألغى العميل الحجز',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', cancelModal.id)
      .eq('customer_id', user!.id)

    if (!error) {
      // Increment cancellation count
      const newCount = (profile.cancellation_count ?? 0) + 1
      const updates: any = { cancellation_count: newCount }
      if (newCount >= 2) updates.is_flagged = true

      await supabase.from('profiles').update(updates).eq('id', user!.id)
      await refreshProfile()

      await fetchBookings()
      setCancelModal(null)
      setCancelReason('')
    }
    setCancelLoading(false)
  }

  const canCancel = (b: Booking) => ['pending_receipt', 'pending_verification', 'confirmed'].includes(b.status)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle2 size={14} />
      case 'pending_receipt': case 'pending_verification': return <Clock size={14} />
      case 'cancelled': case 'expired': return <X size={14} />
      default: return null
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">يجب تسجيل الدخول لعرض حجوزاتك</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">حجوزاتي</h1>
            <p className="text-sm text-gray-400 mt-0.5">سجل جميع حجوزاتك في المنتجع</p>
          </div>
          <button onClick={fetchBookings} className="glass p-2 rounded-xl hover:bg-white/10 transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Account status badge */}
        {profile && (
          <div className={`mb-6 flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
            profile.is_blacklisted ? 'bg-red-500/10 border border-red-500/25 text-red-400' :
            profile.is_flagged ? 'bg-amber-500/10 border border-amber-500/25 text-amber-300' :
            'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
          }`}>
            {profile.is_blacklisted ? (
              <><AlertTriangle size={16} /> حسابك موقوف — تواصل مع الإدارة</>
            ) : profile.is_flagged ? (
              <><AlertTriangle size={16} /> تنبيه: سجل إلغاءات — يلزم الدفع الكامل بالتحويل البنكي</>
            ) : (
              <><CheckCircle2 size={16} /> عميل مميز — شكراً لثقتك بنا</>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="text-emerald-400 animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-gray-400">لا توجد حجوزات بعد</p>
            <a href="/book" className="btn-primary mt-4 inline-flex">احجز الآن</a>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map(b => (
              <div key={b.id} className="card p-5 animate-fade-in-up">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-white">{b.properties?.name ?? 'المنتجع'}</h3>
                    <p className="text-sm text-gray-400">{formatArabicDate(parseISO(b.booking_date))}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${STATUS_CLASSES[b.status]}`}>
                    {getStatusIcon(b.status)}
                    {STATUS_LABELS[b.status] ?? b.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="glass p-2.5 rounded-lg">
                    <p className="text-gray-500 text-xs mb-0.5">الإجمالي</p>
                    <p className="font-bold text-white">{formatCurrency(b.total_amount)}</p>
                  </div>
                  <div className="glass p-2.5 rounded-lg">
                    <p className="text-gray-500 text-xs mb-0.5">العربون</p>
                    <p className="font-bold text-amber-400">{formatCurrency(b.deposit_amount)}</p>
                  </div>
                </div>

                {b.status === 'pending_receipt' && (
                  <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex gap-2">
                    <Clock size={12} className="flex-shrink-0 mt-0.5" />
                    بانتظار رفع الإيصال — ينتهي الحجز خلال ساعتين إن لم يُرفع
                  </div>
                )}

                {b.cancellation_reason && (
                  <div className="mb-3 text-xs text-gray-500">
                    سبب الإلغاء: {b.cancellation_reason}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {canCancel(b) && (
                    <button
                      onClick={() => setCancelModal(b)}
                      className="btn-danger text-xs py-2 px-3"
                    >
                      <X size={13} />
                      إلغاء الحجز
                    </button>
                  )}
                  <a
                    href={generateWhatsAppLink('0547382222', `السلام عليكم، لدي استفسار عن حجزي رقم: ${b.id.slice(0, 8)}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost text-xs py-2 px-3"
                  >
                    <MessageCircle size={13} />
                    تواصل معنا
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pb-safe">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setCancelModal(null)} />
          <div className="relative w-full max-w-md animate-scale-in card glass-strong p-6 sm:p-7 border border-white/15 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-3">تأكيد إلغاء الحجز</h3>

            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 mb-4 text-sm text-red-200 flex gap-2.5">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-red-400" />
              <div>
                <p className="font-bold text-red-300 mb-1">⚠️ تنبيه هام لسياسة الإلغاء:</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-red-200/90 leading-relaxed">
                  <li>العربون المدفوع غير مسترد لتعويض حجز الموعد</li>
                  <li>عند إلغاء حجزين أو أكثر يصبح الحساب "غير صامل" ويُلزم بالدفع البنكي المسبق</li>
                  <li>سجل الإلغاءات الحالي لحسابك: <span className="font-bold text-white">{(cancelModal && profile?.cancellation_count) ?? 0}</span> إلغاء</li>
                </ul>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">سبب الإلغاء (اختياري)</label>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="اكتب سبب الإلغاء هنا..."
                rows={3}
                className="input-field min-h-[84px] resize-none placeholder-slate-400"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setCancelModal(null)} className="btn-ghost flex-1 min-h-[48px] font-bold">
                لا، تراجع
              </button>
              <button onClick={handleCancel} disabled={cancelLoading} className="btn-danger flex-1 min-h-[48px] font-bold">
                {cancelLoading ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                نعم، تأكيد الإلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyBookingsPage
