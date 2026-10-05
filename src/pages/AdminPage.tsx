import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  formatArabicDate, formatCurrency, formatShortDate, formatTime,
  formatCheckInTime, formatCheckOutTime,
  generateWhatsAppLink, buildBookingWhatsAppMessage
} from '../lib/utils'
import {
  BarChart3, CalendarCheck, Clock, Settings, Users, Loader2,
  Check, X, MessageCircle, Trash2, RefreshCw, Plus, Edit3,
  AlertTriangle, Shield, ChevronRight, ChevronLeft, Home,
  CheckCircle2, XCircle, Banknote, Eye, Info, Phone, Calendar,
  CreditCard, Search, Filter, AlertCircle, FileText, CheckCircle,
  Droplets, Navigation, MapPin, Truck, ExternalLink
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, parseISO, isSameDay } from 'date-fns'
import { ar } from 'date-fns/locale'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface BookingAddon {
  id: string
  quantity: number
  unit_price: number
  addons?: {
    name: string
    icon: string
  }
}

interface Booking {
  id: string
  property_id: string
  customer_id: string | null
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
  cancelled_at?: string | null
  created_at: string
  properties?: { name: string }
  booking_addons?: BookingAddon[]
}

const getBookingWhatsAppMsg = (b: Booking) => {
  const addonsText = b.booking_addons && b.booking_addons.length > 0
    ? b.booking_addons.map(a => `${a.addons?.name ?? 'إضافة'} (${a.quantity})`).join('، ')
    : ''
  return buildBookingWhatsAppMessage({
    customerName: b.customer_name,
    customerPhone: b.customer_phone,
    propertyName: b.properties?.name || 'منتجع وبستان خالد العمدة',
    date: b.booking_date,
    checkIn: b.check_in,
    checkOut: b.check_out,
    addonsListText: addonsText,
    totalAmount: b.total_amount,
    depositAmount: b.deposit_amount,
    paymentMethod: b.payment_method || 'bank_transfer',
  })
}

interface Settings {
  deposit_percentage: number
  default_check_in_time: string
  default_check_out_time: string
  bank_name: string
  bank_account_name: string
  bank_iban: string
  contact_phone: string
  contact_whatsapp: string
  resort_name: string
}

interface Property {
  id: string
  name: string
  description: string | null
  weekday_price: number
  weekend_price: number
  amenities: string[]
  max_guests: number
  is_active: boolean
}

interface Addon {
  id: string
  name: string
  description: string | null
  price: number
  total_inventory: number
  icon: string
  is_active: boolean
}

interface WaterTankerSize {
  id: string
  name: string
  capacity_label: string
  price: number
  is_active: boolean
  display_order: number
  created_at?: string
}

interface WaterOrder {
  id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string
  tanker_size_id: string | null
  tanker_size_name: string
  tanker_price: number
  district: string
  street_address: string | null
  google_maps_url: string | null
  tank_type: 'أرضي' | 'علوي' | 'كلاهما'
  payment_method: 'cash' | 'pos_on_delivery' | 'bank_transfer'
  status: 'new' | 'dispatched' | 'delivered' | 'cancelled'
  notes: string | null
  created_at: string
}

const DEFAULT_WATER_SIZES: WaterTankerSize[] = [
  { id: '1', name: 'وايت عايدي (حجم متوسط)', capacity_label: '12 طن - 12,000 لتر', price: 120, is_active: true, display_order: 1 },
  { id: '2', name: 'وايت تريلا (حجم كبير)', capacity_label: '30 طن - 30,000 لتر', price: 250, is_active: true, display_order: 2 },
]

// ─────────────────────────────────────────────
// STATUS BADGES & CONFIG
// ─────────────────────────────────────────────
export const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; dotColor: string }> = {
  pending_receipt: {
    label: 'بانتظار الإيصال',
    badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    dotColor: 'bg-amber-400'
  },
  pending_verification: {
    label: 'بانتظار المراجعة',
    badgeClass: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    dotColor: 'bg-blue-400'
  },
  confirmed: {
    label: 'مؤكد',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    dotColor: 'bg-emerald-400'
  },
  cancelled: {
    label: 'ملغي',
    badgeClass: 'bg-red-500/15 text-red-400 border border-red-500/30',
    dotColor: 'bg-red-400'
  },
  completed: {
    label: 'مكتمل',
    badgeClass: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
    dotColor: 'bg-slate-400'
  },
  expired: {
    label: 'منتهي',
    badgeClass: 'bg-gray-500/15 text-gray-400 border border-gray-500/30',
    dotColor: 'bg-gray-400'
  }
}

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const conf = STATUS_CONFIG[status] || {
    label: status,
    badgeClass: 'bg-gray-500/15 text-gray-300 border border-gray-500/30',
    dotColor: 'bg-gray-400'
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${conf.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${conf.dotColor}`} />
      {conf.label}
    </span>
  )
}

// ─────────────────────────────────────────────
// METRICS CARD
// ─────────────────────────────────────────────
const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string }> = ({
  icon, label, value, sub, color = 'emerald'
}) => (
  <div className="card p-5">
    <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-${color}-500/20 text-${color}-400`}>
      {icon}
    </div>
    <p className="text-2xl font-black text-white">{value}</p>
    <p className="text-sm text-gray-400 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
  </div>
)

// ─────────────────────────────────────────────
// ADMIN CALENDAR
// ─────────────────────────────────────────────
const AdminCalendar: React.FC<{ bookings: Booking[]; properties: Property[]; onSelectBooking: (b: Booking) => void }> = ({
  bookings, onSelectBooking
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const rawFirstDay = getDay(startOfMonth(currentMonth))
  const firstDayOfWeek = (rawFirstDay + 1) % 7

  const getBookingsForDay = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd')
    return bookings.filter(b => b.booking_date === key)
  }

  return (
    <div className="card p-5 border border-white/10 shadow-xl">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/8">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="glass p-2.5 rounded-xl hover:bg-white/10" aria-label="الشهر السابق">
          <ChevronRight size={18} />
        </button>
        <h3 className="font-bold text-white text-base">
          {format(currentMonth, 'MMMM yyyy', { locale: ar })}
        </h3>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="glass p-2.5 rounded-xl hover:bg-white/10" aria-label="الشهر القادم">
          <ChevronLeft size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center font-bold text-xs sm:text-sm text-slate-400 py-2 mb-1" dir="rtl">
        {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map(d => (
          <div key={d} className="truncate py-1 select-none">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5" dir="rtl">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const dayBookings = getBookingsForDay(day)
          const hasConfirmed = dayBookings.some(b => b.status === 'confirmed')
          const hasPending = dayBookings.some(b => ['pending_receipt', 'pending_verification'].includes(b.status))

          return (
            <div key={format(day, 'yyyy-MM-dd')} className={`
              relative min-h-[56px] rounded-lg p-1 text-center border transition-all hover:bg-white/5
              ${hasConfirmed ? 'border-emerald-500/40 bg-emerald-500/10' :
                hasPending ? 'border-amber-500/40 bg-amber-500/10' :
                'border-transparent'}
            `}>
              <span className={`text-sm font-medium ${hasConfirmed ? 'text-emerald-400' : hasPending ? 'text-amber-400' : 'text-gray-400'}`}>
                {format(day, 'd')}
              </span>
              {dayBookings.slice(0, 2).map((b) => (
                <div
                  key={b.id}
                  onClick={() => onSelectBooking(b)}
                  className={`text-[9px] truncate px-1 py-0.5 rounded mt-0.5 leading-tight cursor-pointer font-medium hover:scale-105 transition-transform ${
                    b.status === 'confirmed' ? 'bg-emerald-500/30 text-emerald-300' :
                    b.status === 'pending_verification' ? 'bg-blue-500/30 text-blue-300' :
                    b.status === 'pending_receipt' ? 'bg-amber-500/30 text-amber-300' :
                    'bg-white/10 text-gray-400'
                  }`}
                  title={`${b.customer_name} (${b.properties?.name ?? 'استراحة'})`}
                >
                  {b.customer_name.split(' ')[0]}
                </div>
              ))}
              {dayBookings.length > 2 && (
                <div className="text-[9px] text-gray-500">+{dayBookings.length - 2}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ACTIONABLE BOOKING CARD (PENDING TAB)
// ─────────────────────────────────────────────
const ActionableBookingCard: React.FC<{
  booking: Booking
  onConfirm: (booking: Booking) => void
  onCancel: (booking: Booking) => void
  onOpenDetails: (booking: Booking) => void
  loading: boolean
}> = ({ booking, onConfirm, onCancel, onOpenDetails, loading }) => {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  useEffect(() => {
    const fetchUrl = async () => {
      if (!booking.payment_receipt_url || booking.payment_receipt_url.startsWith('archived')) return
      const { data } = await supabase.storage.from('receipts').createSignedUrl(booking.payment_receipt_url, 3600)
      if (data) setReceiptUrl(data.signedUrl)
    }
    fetchUrl()
  }, [booking.payment_receipt_url])

  const isPendingReceipt = booking.status === 'pending_receipt'

  return (
    <div className={`card p-5 border transition-all animate-fade-in-up ${
      isPendingReceipt ? 'border-amber-500/30 bg-amber-500/[0.02]' : 'border-blue-500/30 bg-blue-500/[0.02]'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-white text-base">{booking.customer_name}</h4>
            <StatusBadge status={booking.status} />
          </div>
          <p className="text-sm text-gray-400 font-mono" dir="ltr">{booking.customer_phone}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-emerald-400 text-lg">{formatCurrency(booking.total_amount)}</p>
          <p className="text-xs text-amber-400 font-medium">العربون: {formatCurrency(booking.deposit_amount)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-300 mb-4 p-2.5 rounded-xl bg-white/5 border border-white/5">
        <span className="flex items-center gap-1">
          <Calendar size={13} className="text-emerald-400" />
          <span>{formatShortDate(booking.booking_date)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Home size={13} className="text-blue-400" />
          <span>{booking.properties?.name ?? 'منتجع وبستان خالد العمدة'}</span>
        </span>
        <span className="flex items-center gap-1">
          <CreditCard size={13} className="text-amber-400" />
          <span>{booking.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'نقداً عند الوصول (يدوي)'}</span>
        </span>
      </div>

      {receiptUrl ? (
        <div className="mb-4 p-2 rounded-xl bg-black/40 border border-white/10">
          <button
            onClick={() => setShowReceipt(!showReceipt)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            <Eye size={13} />
            <span>{showReceipt ? 'إخفاء الإيصال البنكي' : 'معاينة الإيصال البنكي المرفق'}</span>
          </button>
          {showReceipt && (
            <div className="mt-2 text-center">
              <img src={receiptUrl} alt="إيصال السداد" className="max-h-56 mx-auto rounded-lg object-contain border border-white/10" />
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-blue-400 underline"
              >
                فتح بالحجم الكامل
              </a>
            </div>
          )}
        </div>
      ) : isPendingReceipt ? (
        <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>لم يقم العميل برفع إيصال بنكي (دفع يدوي) — يمكنك تأكيد الحجز واستلام العربون يدوياً.</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
        <button
          onClick={() => onConfirm(booking)}
          disabled={loading}
          className="btn-primary text-xs py-2 px-3.5 font-bold shadow-md shadow-emerald-500/20"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
          <span>{isPendingReceipt ? 'تأكيد واستلام العربون ✅' : 'تأكيد الحجز ✅'}</span>
        </button>

        <button
          onClick={() => onCancel(booking)}
          disabled={loading}
          className="btn-danger text-xs py-2 px-3 font-medium"
        >
          <X size={14} />
          <span>إلغاء الحجز ❌</span>
        </button>

        <button
          onClick={() => onOpenDetails(booking)}
          className="glass text-xs py-2 px-3 text-gray-300 hover:text-white rounded-xl flex items-center gap-1.5"
        >
          <Info size={13} />
          <span>تفاصيل</span>
        </button>

        <a
          href={generateWhatsAppLink(booking.customer_phone, getBookingWhatsAppMsg(booking))}
          target="_blank"
          rel="noopener noreferrer"
          className="glass text-xs py-2 px-3 text-green-400 hover:text-green-300 rounded-xl flex items-center gap-1.5 mr-auto"
        >
          <MessageCircle size={14} />
          <span>واتساب 💬</span>
        </a>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// BOOKING DETAILS MODAL
// ─────────────────────────────────────────────
const BookingDetailsModal: React.FC<{
  booking: Booking | null
  onClose: () => void
  onConfirm: (booking: Booking) => void
  onCancel: (booking: Booking) => void
}> = ({ booking, onClose, onConfirm, onCancel }) => {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(false)

  useEffect(() => {
    if (!booking?.payment_receipt_url) {
      setReceiptUrl(null)
      return
    }
    const fetchReceipt = async () => {
      setLoadingReceipt(true)
      const { data } = await supabase.storage.from('receipts').createSignedUrl(booking.payment_receipt_url!, 3600)
      if (data) setReceiptUrl(data.signedUrl)
      setLoadingReceipt(false)
    }
    fetchReceipt()
  }, [booking?.payment_receipt_url])

  if (!booking) return null

  const isPending = booking.status === 'pending_receipt' || booking.status === 'pending_verification'
  const isCancellable = booking.status !== 'cancelled' && booking.status !== 'completed'
  const remainingAmount = Math.max(0, booking.total_amount - booking.deposit_amount)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="card glass-strong max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 border border-white/15 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>تفاصيل الحجز #{booking.id.slice(0, 8)}</span>
                <StatusBadge status={booking.status} />
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                تاريخ الإنشاء: {formatShortDate(booking.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="glass p-2 rounded-xl text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 text-sm">
          {/* Customer info */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">اسم العميل</p>
              <p className="font-semibold text-white text-base">{booking.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">رقم الجوال</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white text-base" dir="ltr">{booking.customer_phone}</span>
                <a
                  href={generateWhatsAppLink(booking.customer_phone, getBookingWhatsAppMsg(booking))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs flex items-center gap-1"
                >
                  <MessageCircle size={12} />
                  واتساب
                </a>
              </div>
            </div>
          </div>

          {/* Unit & Dates */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
              <Calendar size={14} className="text-emerald-400" />
              بيانات الوحدة والمواعيد
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <p className="text-xs text-gray-400">الوحدة المحجوزة</p>
                <p className="font-medium text-white">{booking.properties?.name ?? 'منتجع وبستان خالد العمدة'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">تاريخ الحجز</p>
                <p className="font-medium text-emerald-400">{formatShortDate(booking.booking_date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">أوقات الوصول والمغادرة</p>
                <p className="font-medium text-gray-300 flex items-center gap-1.5 mt-0.5">
                  <span className="text-emerald-400 font-mono">{formatCheckInTime(booking.check_in)}</span>
                  <span>⬅</span>
                  <span className="text-amber-400 font-mono">{formatCheckOutTime(booking.check_out)}</span>
                  <span className="text-[10px] text-gray-400">(اليوم التالي)</span>
                </p>
              </div>
            </div>
          </div>

          {/* Addons */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
              <Zap size={14} className="text-amber-400" />
              الإضافات المطلوبة
            </h4>
            {booking.booking_addons && booking.booking_addons.length > 0 ? (
              <div className="divide-y divide-white/5">
                {booking.booking_addons.map((add) => (
                  <div key={add.id} className="py-2 flex items-center justify-between text-xs">
                    <span className="text-white font-medium">
                      {add.addons?.icon ?? '✨'} {add.addons?.name ?? 'إضافة'} × {add.quantity}
                    </span>
                    <span className="text-amber-400 font-mono">
                      {formatCurrency(add.unit_price * add.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 py-1">لا توجد خدمات أو إضافات إضافية في هذا الحجز</p>
            )}
          </div>

          {/* Financial Breakdown */}
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
            <h4 className="font-semibold text-emerald-400 flex items-center gap-2 text-xs uppercase tracking-wider">
              <Banknote size={14} />
              الملخص المالي وطريقة الدفع
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <p className="text-xs text-gray-400">إجمالي المبلغ</p>
                <p className="text-base font-bold text-white">{formatCurrency(booking.total_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">العربون المطلوب</p>
                <p className="text-base font-bold text-amber-400">{formatCurrency(booking.deposit_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">المتبقي عند الوصول</p>
                <p className="text-base font-bold text-gray-300">{formatCurrency(remainingAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">طريقة الدفع</p>
                <span className="inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded bg-white/10 text-white">
                  {booking.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'نقداً عند الوصول (يدوي)'}
                </span>
              </div>
            </div>
          </div>

          {/* Receipt Section */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
              <Eye size={14} className="text-blue-400" />
              إيصال السداد البنكي
            </h4>
            {loadingReceipt ? (
              <div className="py-6 text-center text-gray-400 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>جاري تحميل الإيصال...</span>
              </div>
            ) : receiptUrl ? (
              <div className="space-y-2">
                <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40 max-h-64 flex items-center justify-center">
                  <img src={receiptUrl} alt="إيصال السداد" className="max-h-64 object-contain" />
                </div>
                <div className="text-left">
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
                  >
                    <span>فتح الإيصال بالحجم الكامل في نافذة جديدة</span>
                    <ChevronRight size={12} className="rotate-180" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>لم يتم إرفاق إيصال بعد (دفع يدوي أو نقداً عند الوصول) — يمكنك تأكيد استلام العربون يدوياً أدناه.</span>
              </div>
            )}
          </div>

          {/* Cancellation reason if cancelled */}
          {booking.cancellation_reason && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              <span className="font-bold">سبب الإلغاء: </span>
              <span>{booking.cancellation_reason}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-5 mt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {isPending && (
              <button
                onClick={() => {
                  onClose()
                  onConfirm(booking)
                }}
                className="btn-primary text-xs py-2.5 px-4 font-bold shadow-md shadow-emerald-500/20"
              >
                <Check size={14} />
                <span>تأكيد الحجز ✅</span>
              </button>
            )}
            {isCancellable && (
              <button
                onClick={() => {
                  onClose()
                  onCancel(booking)
                }}
                className="btn-danger text-xs py-2.5 px-4 font-medium"
              >
                <X size={14} />
                <span>إلغاء الحجز ❌</span>
              </button>
            )}
            <a
              href={generateWhatsAppLink(booking.customer_phone, getBookingWhatsAppMsg(booking))}
              target="_blank"
              rel="noopener noreferrer"
              className="glass text-xs py-2.5 px-4 text-green-400 hover:text-green-300 rounded-xl flex items-center gap-1.5"
            >
              <MessageCircle size={14} />
              <span>مراسلة واتساب</span>
            </a>
          </div>

          <button
            onClick={onClose}
            className="glass py-2.5 px-5 rounded-xl text-gray-400 hover:text-white text-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// CONFIRM ACTION MODAL
// ─────────────────────────────────────────────
const ConfirmActionModal: React.FC<{
  booking: Booking | null
  onClose: () => void
  onConfirm: (booking: Booking) => Promise<void>
  loading: boolean
}> = ({ booking, onClose, onConfirm, loading }) => {
  if (!booking) return null

  const isPendingReceipt = booking.status === 'pending_receipt'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="card glass-strong max-w-md w-full p-6 border border-emerald-500/30 shadow-2xl animate-scale-in">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} />
        </div>

        <h3 className="text-lg font-bold text-white text-center mb-2">
          {isPendingReceipt ? 'تأكيد الحجز واستلام العربون يدوياً' : 'تأكيد واعتماد الحجز'}
        </h3>

        <div className="text-sm text-gray-300 text-center mb-4 leading-relaxed">
          {isPendingReceipt ? (
            <p>
              هل تم استلام العربون بمبلغ{' '}
              <strong className="text-emerald-400 font-bold">{formatCurrency(booking.deposit_amount)}</strong>{' '}
              من العميل <strong className="text-white">{booking.customer_name}</strong> يدوياً وتريد تأكيد الحجز؟
            </p>
          ) : (
            <p>
              هل قمت بمراجعة بيانات حجز العميل{' '}
              <strong className="text-white">{booking.customer_name}</strong> بتاريخ{' '}
              <strong className="text-emerald-400">{formatShortDate(booking.booking_date)}</strong>{' '}
              وتريد تأكيده نهائياً؟
            </p>
          )}
        </div>

        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 mb-6 space-y-1">
          <p>• سيتم تحويل حالة الحجز إلى: <span className="text-emerald-400 font-bold">مؤكد</span></p>
          <p>• سيتم تثبيت التاريخ في تقويم الحجوزات كحجز مؤكد.</p>
        </div>

        <div className="flex items-center gap-3 justify-center">
          <button
            onClick={() => onConfirm(booking)}
            disabled={loading}
            className="btn-primary w-full py-2.5 font-bold shadow-lg shadow-emerald-500/20"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            <span>{isPendingReceipt ? 'تأكيد واستلام العربون ✅' : 'تأكيد الحجز الآن ✅'}</span>
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="glass w-full py-2.5 rounded-xl text-gray-400 hover:text-white"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// CANCEL ACTION MODAL
// ─────────────────────────────────────────────
const CancelActionModal: React.FC<{
  booking: Booking | null
  onClose: () => void
  onCancel: (booking: Booking, reason: string) => Promise<void>
  loading: boolean
}> = ({ booking, onClose, onCancel, loading }) => {
  const [reason, setReason] = useState('')

  if (!booking) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="card glass-strong max-w-md w-full p-6 border border-red-500/30 shadow-2xl animate-scale-in">
        <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} />
        </div>

        <h3 className="text-lg font-bold text-white text-center mb-2">إلغاء الحجز وإتاحة التاريخ</h3>

        <p className="text-sm text-gray-300 text-center mb-4 leading-relaxed">
          هل أنت متأكد من رغبتك في إلغاء حجز العميل{' '}
          <strong className="text-white">{booking.customer_name}</strong> بتاريخ{' '}
          <strong className="text-amber-400">{formatShortDate(booking.booking_date)}</strong>؟
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            سبب الإلغاء (اختياري):
          </label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="مثال: بناءً على طلب العميل / عدم تحويل العربون"
            className="input-field text-sm min-h-[44px]"
          />
        </div>

        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 mb-6">
          ⚠️ تنبيه: سيتم تحرير تاريخ {formatShortDate(booking.booking_date)} في التقويم فوراً ليصبح متاحاً للعملاء.
        </div>

        <div className="flex items-center gap-3 justify-center">
          <button
            onClick={() => onCancel(booking, reason)}
            disabled={loading}
            className="btn-danger w-full py-2.5 font-bold shadow-lg shadow-red-500/20"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
            <span>نعم، إلغاء الحجز ❌</span>
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="glass w-full py-2.5 rounded-xl text-gray-400 hover:text-white"
          >
            تراجع
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SETTINGS TAB
// ─────────────────────────────────────────────
const SettingsTab: React.FC<{ settings: Settings; onSave: (s: Settings) => Promise<void> }> = ({ settings: initial, onSave }) => {
  const [form, setForm] = useState<Settings>(initial)
  const [saving, setSaving] = useState(false)
  const [purging, setPurging] = useState(false)
  const [saved, setSaved] = useState(false)
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null)

  const set = (key: keyof Settings, val: string | number) =>
    setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    await onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  const handlePurge = async () => {
    setPurging(true)
    setPurgeMsg(null)
    const { error } = await supabase.rpc('purge_old_receipts')
    if (error) setPurgeMsg('⚠️ خطأ: ' + error.message)
    else setPurgeMsg('✅ تم تنظيف الإيصالات المنتهية بنجاح')
    setPurging(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><Banknote size={18} className="text-amber-400" /> إعدادات الدفع</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">نسبة العربون (%)</label>
            <input type="number" min={1} max={100} value={form.deposit_percentage}
              onChange={e => set('deposit_percentage', Number(e.target.value))} className="input-field min-h-[48px]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">اسم البنك</label>
            <input type="text" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="input-field min-h-[48px]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">اسم صاحب الحساب</label>
            <input type="text" value={form.bank_account_name} onChange={e => set('bank_account_name', e.target.value)} className="input-field min-h-[48px]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">رقم الآيبان (IBAN)</label>
            <input type="text" value={form.bank_iban} onChange={e => set('bank_iban', e.target.value)} className="input-field min-h-[48px] font-mono text-left" dir="ltr" />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><Clock size={18} className="text-blue-400" /> أوقات الوصول والمغادرة</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">وقت الوصول (Check-in)</label>
            <input type="time" value={form.default_check_in_time} onChange={e => set('default_check_in_time', e.target.value)} className="input-field min-h-[48px]" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">وقت المغادرة (Check-out)</label>
            <input type="time" value={form.default_check_out_time} onChange={e => set('default_check_out_time', e.target.value)} className="input-field min-h-[48px]" dir="ltr" />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><MessageCircle size={18} className="text-green-400" /> معلومات التواصل</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">هاتف التواصل</label>
            <input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="input-field min-h-[48px] text-right font-mono" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">واتساب</label>
            <input type="tel" value={form.contact_whatsapp} onChange={e => set('contact_whatsapp', e.target.value)} className="input-field min-h-[48px] text-right font-mono" dir="ltr" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary min-h-[48px]">
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
          {saved ? 'تم الحفظ ✓' : 'حفظ الإعدادات'}
        </button>
        <button onClick={handlePurge} disabled={purging} className="btn-ghost min-h-[48px] flex items-center gap-2">
          {purging ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          تنظيف الإيصالات المنتهية
        </button>
      </div>

      {purgeMsg && (
        <div className={`p-3 rounded-xl text-sm ${purgeMsg.startsWith('✅') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {purgeMsg}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// PROPERTIES TAB
// ─────────────────────────────────────────────
const PropertiesTab: React.FC<{ properties: Property[]; onRefresh: () => void }> = ({ properties, onRefresh }) => {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', weekday_price: '', weekend_price: '', max_guests: '50', amenities: '' })
  const [saving, setSaving] = useState(false)

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    const data = {
      name: form.name,
      description: form.description,
      weekday_price: Number(form.weekday_price),
      weekend_price: Number(form.weekend_price),
      max_guests: Number(form.max_guests),
      amenities: form.amenities.split('،').map(a => a.trim()).filter(Boolean),
    }

    if (editingId) {
      await supabase.from('properties').update(data).eq('id', editingId)
    } else {
      await supabase.from('properties').insert(data)
    }

    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', description: '', weekday_price: '', weekend_price: '', max_guests: '50', amenities: '' })
    onRefresh()
    setSaving(false)
  }

  const startEdit = (p: Property) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description ?? '',
      weekday_price: String(p.weekday_price),
      weekend_price: String(p.weekend_price),
      max_guests: String(p.max_guests),
      amenities: p.amenities.join('، '),
    })
    setShowForm(true)
  }

  const toggleActive = async (p: Property) => {
    await supabase.from('properties').update({ is_active: !p.is_active }).eq('id', p.id)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white">الوحدات والاستراحات</h3>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', description: '', weekday_price: '', weekend_price: '', max_guests: '50', amenities: '' }) }}
          className="btn-primary text-sm py-2 px-3">
          <Plus size={15} />
          إضافة وحدة
        </button>
      </div>

      {showForm && (
        <div className="card p-5 border border-emerald-500/25 animate-fade-in-up">
          <h4 className="font-bold text-white mb-4">{editingId ? 'تعديل الوحدة' : 'إضافة وحدة جديدة'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">اسم الوحدة *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="input-field min-h-[48px]" placeholder="مثال: الاستراحة الكبيرة" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">الوصف</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="input-field min-h-[72px] resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">سعر الأيام العادية (ر.س)</label>
              <input type="number" value={form.weekday_price} onChange={e => set('weekday_price', e.target.value)} className="input-field min-h-[48px]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">سعر العطل (ر.س)</label>
              <input type="number" value={form.weekend_price} onChange={e => set('weekend_price', e.target.value)} className="input-field min-h-[48px]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">أقصى عدد ضيوف</label>
              <input type="number" value={form.max_guests} onChange={e => set('max_guests', e.target.value)} className="input-field min-h-[48px]" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">المرافق (مفصولة بـ ،)</label>
              <input type="text" value={form.amenities} onChange={e => set('amenities', e.target.value)} className="input-field min-h-[48px]" placeholder="مسبح، مطبخ، مجلس VIP" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="btn-ghost min-h-[48px] text-sm py-2 px-5">إلغاء</button>
            <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary min-h-[48px] text-sm py-2 px-5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editingId ? 'حفظ التعديلات' : 'إضافة'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {properties.map(p => (
          <div key={p.id} className={`card p-4 ${!p.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-white">{p.name}</h4>
                {!p.is_active && <span className="text-xs badge-cancelled px-2 py-0.5 rounded-full">معطّل</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(p)} className="glass p-2 rounded-lg hover:bg-white/10">
                  <Edit3 size={13} />
                </button>
                <button onClick={() => toggleActive(p)} className={`glass p-2 rounded-lg ${p.is_active ? 'hover:bg-red-500/10' : 'hover:bg-emerald-500/10'}`}>
                  {p.is_active ? <XCircle size={13} className="text-red-400" /> : <CheckCircle2 size={13} className="text-emerald-400" />}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
              <span>أيام عادية: <span className="text-white font-medium">{formatCurrency(p.weekday_price)}</span></span>
              <span>عطل: <span className="text-white font-medium">{formatCurrency(p.weekend_price)}</span></span>
              <span>ضيوف: <span className="text-white font-medium">{p.max_guests}</span></span>
            </div>
            {p.amenities.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {p.amenities.map((a, i) => <span key={i} className="text-xs glass px-2 py-0.5 rounded-full text-gray-300">{a}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ADDONS TAB
// ─────────────────────────────────────────────
const AddonsTab: React.FC<{ addons: Addon[]; onRefresh: () => void }> = ({ addons, onRefresh }) => {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', price: '', total_inventory: '1', icon: 'Zap' })
  const [saving, setSaving] = useState(false)

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    const data = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      total_inventory: Number(form.total_inventory),
      icon: form.icon,
    }
    if (editingId) {
      await supabase.from('addons').update(data).eq('id', editingId)
    } else {
      await supabase.from('addons').insert(data)
    }
    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', description: '', price: '', total_inventory: '1', icon: 'Zap' })
    onRefresh()
    setSaving(false)
  }

  const startEdit = (a: Addon) => {
    setEditingId(a.id)
    setForm({ name: a.name, description: a.description ?? '', price: String(a.price), total_inventory: String(a.total_inventory), icon: a.icon })
    setShowForm(true)
  }

  const toggleActive = async (a: Addon) => {
    await supabase.from('addons').update({ is_active: !a.is_active }).eq('id', a.id)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white">الإضافات المتاحة</h3>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', description: '', price: '', total_inventory: '1', icon: 'Zap' }) }}
          className="btn-primary text-sm py-2 px-3">
          <Plus size={15} />
          إضافة
        </button>
      </div>

      {showForm && (
        <div className="card p-5 border border-emerald-500/25 animate-fade-in-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">الاسم *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="input-field min-h-[48px]" placeholder="سكوتر كهربائي" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">السعر (ر.س)</label>
              <input type="number" value={form.price} onChange={e => set('price', e.target.value)} className="input-field min-h-[48px]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">المخزون الكلي</label>
              <input type="number" value={form.total_inventory} onChange={e => set('total_inventory', e.target.value)} className="input-field min-h-[48px]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">الأيقونة</label>
              <input type="text" value={form.icon} onChange={e => set('icon', e.target.value)} className="input-field min-h-[48px]" placeholder="Zap" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="btn-ghost min-h-[48px] text-sm py-2 px-5">إلغاء</button>
            <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary min-h-[48px] text-sm py-2 px-5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editingId ? 'حفظ' : 'إضافة'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {addons.map(a => (
          <div key={a.id} className={`card p-4 flex items-center justify-between ${!a.is_active ? 'opacity-60' : ''}`}>
            <div>
              <p className="font-semibold text-white">{a.name}</p>
              <p className="text-sm text-gray-400">{formatCurrency(a.price)} / قطعة • مخزون: {a.total_inventory}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(a)} className="glass p-2 rounded-lg hover:bg-white/10"><Edit3 size={13} /></button>
              <button onClick={() => toggleActive(a)} className="glass p-2 rounded-lg">
                {a.is_active ? <XCircle size={13} className="text-red-400" /> : <CheckCircle2 size={13} className="text-emerald-400" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// WATER ORDERS TAB (وايت ماء حلو)
// ─────────────────────────────────────────────
interface WaterOrdersTabProps {
  orders: WaterOrder[]
  sizes: WaterTankerSize[]
  onRefresh: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

const WaterOrdersTab: React.FC<WaterOrdersTabProps> = ({ orders, sizes, onRefresh, showToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'sizes'>('orders')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

  // Tanker Size Form State
  const [showSizeModal, setShowSizeModal] = useState(false)
  const [editingSizeId, setEditingSizeId] = useState<string | null>(null)
  const [sizeForm, setSizeForm] = useState({
    name: '',
    capacity_label: '',
    price: '',
    display_order: '1',
    is_active: true,
  })
  const [savingSize, setSavingSize] = useState(false)

  // Analytics calculation
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayOrders = useMemo(() => {
    return orders.filter(o => o.created_at?.slice(0, 10) === todayStr)
  }, [orders, todayStr])

  const todayDeliveredRevenue = useMemo(() => {
    return todayOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + Number(o.tanker_price || 0), 0)
  }, [todayOrders])

  const activeOrdersCount = useMemo(() => {
    return orders.filter(o => o.status === 'new' || o.status === 'dispatched').length
  }, [orders])

  const sizeBreakdown = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {}
    orders.forEach(o => {
      const name = o.tanker_size_name || 'غير محدد'
      if (!map[name]) map[name] = { count: 0, revenue: 0 }
      map[name].count += 1
      if (o.status === 'delivered') {
        map[name].revenue += Number(o.tanker_price || 0)
      }
    })
    return map
  }, [orders])

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const q = search.toLowerCase()
      const matchesSearch =
        !search ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.includes(q) ||
        o.district?.toLowerCase().includes(q) ||
        o.tanker_size_name?.toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'all' || o.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [orders, search, statusFilter])

  // Update order status
  const handleUpdateStatus = async (orderId: string, newStatus: WaterOrder['status']) => {
    setUpdatingOrderId(orderId)
    try {
      const { error } = await supabase
        .from('water_orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (error) {
        showToast('⚠️ لم يتم حفظ الحالة: ' + error.message, 'error')
      } else {
        showToast('✅ تم تحديث حالة الطلب بنجاح')
        onRefresh()
      }
    } catch (e: any) {
      showToast('⚠️ خطأ في الاتصال بالخادم', 'error')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  // Handle Tanker Size Save
  const handleSaveSize = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sizeForm.name.trim() || !sizeForm.price) return
    setSavingSize(true)

    const payload = {
      name: sizeForm.name.trim(),
      capacity_label: sizeForm.capacity_label.trim(),
      price: Number(sizeForm.price),
      display_order: Number(sizeForm.display_order) || 1,
      is_active: sizeForm.is_active,
    }

    try {
      if (editingSizeId) {
        const { error } = await supabase
          .from('water_tanker_sizes')
          .update(payload)
          .eq('id', editingSizeId)
        if (error) throw error
        showToast('✅ تم تعديل حجم الوايت بنجاح')
      } else {
        const { error } = await supabase
          .from('water_tanker_sizes')
          .insert([payload])
        if (error) throw error
        showToast('✅ تم إضافة حجم الوايت بنجاح')
      }
      setShowSizeModal(false)
      setEditingSizeId(null)
      setSizeForm({ name: '', capacity_label: '', price: '', display_order: '1', is_active: true })
      onRefresh()
    } catch (err: any) {
      showToast('⚠️ خطأ: ' + err.message, 'error')
    } finally {
      setSavingSize(false)
    }
  }

  const startEditSize = (s: WaterTankerSize) => {
    setEditingSizeId(s.id)
    setSizeForm({
      name: s.name,
      capacity_label: s.capacity_label,
      price: String(s.price),
      display_order: String(s.display_order || 1),
      is_active: s.is_active,
    })
    setShowSizeModal(true)
  }

  const toggleSizeActive = async (s: WaterTankerSize) => {
    try {
      const { error } = await supabase
        .from('water_tanker_sizes')
        .update({ is_active: !s.is_active })
        .eq('id', s.id)
      if (error) throw error
      showToast(s.is_active ? 'تم تعطيل الحجم' : 'تم تفعيل الحجم بنجاح')
      onRefresh()
    } catch (err: any) {
      showToast('⚠️ خطأ في التحديث', 'error')
    }
  }

  const getDriverWhatsAppMsg = (o: WaterOrder) => {
    const paymentLabel = o.payment_method === 'cash'
      ? 'نقداً عند التفريغ'
      : o.payment_method === 'pos_on_delivery'
      ? 'شبكة (مدى) عند الوصول'
      : 'تحويل بنكي مسبق'

    return `💧 *توجيه طلب وايت ماء حلو للسائق* 💧
📋 *تفاصيل الطلب:*
ــــــــــــــــــــــــــــــــــــــــ
👤 *العميل:* ${o.customer_name}
📱 *الجوال:* ${o.customer_phone}
🚚 *حجم الوايت:* ${o.tanker_size_name}
💵 *المبلغ المطلوب:* ${formatCurrency(o.tanker_price)}
📍 *الحي:* ${o.district}
${o.street_address ? `🏠 *العنوان / الشارع:* ${o.street_address}\n` : ''}🎯 *نوع الخزان:* ${o.tank_type}
💳 *طريقة الدفع:* ${paymentLabel}
${o.google_maps_url ? `🗺️ *رابط الموقع (GPS):*\n${o.google_maps_url}\n` : ''}${o.notes ? `📝 *ملاحظات:* ${o.notes}\n` : ''}ــــــــــــــــــــــــــــــــــــــــ
🌟 نرجو سرعة التوصيل والتأكيد بعد التفريغ!`
  }

  const WATER_STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
    new: { label: 'جديد', badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
    dispatched: { label: 'جاري التوصيل', badgeClass: 'bg-blue-500/15 text-blue-300 border border-blue-500/30' },
    delivered: { label: 'تم التفريغ والدفع', badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
    cancelled: { label: 'ملغي', badgeClass: 'bg-red-500/15 text-red-300 border border-red-500/30' },
  }

  return (
    <div className="space-y-6">
      {/* ── Section A: Daily Analytics & Financial KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          icon={<Truck size={20} />}
          label="طلبات اليوم"
          value={todayOrders.length}
          sub={`منها ${activeOrdersCount} قيد التنفيذ`}
          color="blue"
        />
        <MetricCard
          icon={<Banknote size={20} />}
          label="إيراد الوايت اليومي"
          value={formatCurrency(todayDeliveredRevenue)}
          sub="من الطلبات المفرغة اليوم"
          color="emerald"
        />
        <MetricCard
          icon={<Droplets size={20} />}
          label="طلبات نشطة"
          value={activeOrdersCount}
          sub="جديد + جاري التوصيل"
          color="amber"
        />
        <MetricCard
          icon={<Users size={20} />}
          label="إجمالي الطلبات"
          value={orders.length}
          sub="جميع الأوقات"
          color="purple"
        />
      </div>

      {/* Tanker Size Breakdown Banner */}
      <div className="p-4 rounded-2xl bg-teal-950/30 border border-teal-500/20 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        <span className="font-bold text-teal-300 flex items-center gap-1.5">
          <Droplets size={16} />
          <span>توزيع أحجام الوايت المسجلة:</span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(sizeBreakdown).map(([name, data]) => (
            <span
              key={name}
              className="px-3 py-1 rounded-xl bg-white/5 border border-white/8 text-white font-medium flex items-center gap-1.5"
            >
              <span className="text-teal-400 font-bold">{data.count}x</span>
              <span>{name}:</span>
              <span className="text-amber-300 font-bold">{formatCurrency(data.revenue)}</span>
            </span>
          ))}
          {Object.keys(sizeBreakdown).length === 0 && (
            <span className="text-gray-400">لا توجد طلبات مسجلة بعد</span>
          )}
        </div>
      </div>

      {/* Subtab Toggle: Orders vs Tanker Sizes */}
      <div className="flex items-center justify-between border-b border-white/8 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeSubTab === 'orders'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            طلبات التوصيل ({orders.length})
          </button>
          <button
            onClick={() => setActiveSubTab('sizes')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeSubTab === 'sizes'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            إدارة الأحجام والأسعار ({sizes.length})
          </button>
        </div>

        {activeSubTab === 'sizes' && (
          <button
            onClick={() => {
              setEditingSizeId(null)
              setSizeForm({ name: '', capacity_label: '', price: '', display_order: '1', is_active: true })
              setShowSizeModal(true)
            }}
            className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>إضافة حجم وايت جديد</span>
          </button>
        )}
      </div>

      {/* ── Subtab 1: Live Orders Table ── */}
      {activeSubTab === 'orders' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <input
                type="text"
                placeholder="البحث بالاسم، الجوال، الحي، أو الحجم..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pr-9 min-h-[42px] text-xs sm:text-sm"
              />
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'new', label: 'جديد' },
                { id: 'dispatched', label: 'جاري التوصيل' },
                { id: 'delivered', label: 'تم التفريغ' },
                { id: 'cancelled', label: 'ملغي' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    statusFilter === st.id
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'glass text-gray-400 hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden border border-white/10 shadow-xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-right text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3 text-gray-400 text-xs">
                    <th className="p-3.5">#</th>
                    <th className="p-3.5">العميل والتواصل</th>
                    <th className="p-3.5">حجم الوايت والسعر</th>
                    <th className="p-3.5">الحي والعنوان</th>
                    <th className="p-3.5">نوع الخزان</th>
                    <th className="p-3.5">موقع الـ GPS</th>
                    <th className="p-3.5">الدفع</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-500">
                        لا توجد طلبات مطابقة للبحث
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order, idx) => {
                      const cfg = WATER_STATUS_CONFIG[order.status] || WATER_STATUS_CONFIG.new
                      return (
                        <tr key={order.id} className="hover:bg-white/3 transition-colors">
                          <td className="p-3.5 font-mono text-gray-500 text-xs">
                            #{order.id.slice(0, 6)}
                          </td>
                          <td className="p-3.5">
                            <p className="font-bold text-white">{order.customer_name}</p>
                            <p className="font-mono text-gray-400 text-xs mt-0.5" dir="ltr">
                              {order.customer_phone}
                            </p>
                          </td>
                          <td className="p-3.5">
                            <p className="font-semibold text-teal-300">{order.tanker_size_name}</p>
                            <p className="font-bold text-amber-300 text-xs">
                              {formatCurrency(order.tanker_price)}
                            </p>
                          </td>
                          <td className="p-3.5">
                            <p className="font-medium text-white">{order.district}</p>
                            {order.street_address && (
                              <p className="text-gray-400 text-[11px] truncate max-w-[140px]" title={order.street_address}>
                                {order.street_address}
                              </p>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300 text-xs">
                              خزان {order.tank_type}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {order.google_maps_url ? (
                              <a
                                href={order.google_maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-2.5 py-1 rounded-lg border border-teal-500/20 transition-colors"
                              >
                                <Navigation size={12} />
                                <span>الخريطة ↗</span>
                              </a>
                            ) : (
                              <span className="text-gray-500 text-xs">يدوي</span>
                            )}
                          </td>
                          <td className="p-3.5 text-xs text-gray-300">
                            {order.payment_method === 'cash' ? 'نقداً' : order.payment_method === 'pos_on_delivery' ? 'شبكة مدى' : 'تحويل بنكي'}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeClass}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-2">
                              {/* One-click status change selector */}
                              <select
                                value={order.status}
                                disabled={updatingOrderId === order.id}
                                onChange={(e) => handleUpdateStatus(order.id, e.target.value as any)}
                                className="bg-slate-900 border border-white/15 text-white text-xs rounded-lg px-2 py-1.5 focus:border-teal-400 focus:outline-none cursor-pointer"
                              >
                                <option value="new">جديد</option>
                                <option value="dispatched">جاري التوصيل</option>
                                <option value="delivered">تم التفريغ والدفع</option>
                                <option value="cancelled">إلغاء الطلب</option>
                              </select>

                              {/* WhatsApp Dispatch Button */}
                              <a
                                href={generateWhatsAppLink(order.customer_phone, getDriverWhatsAppMsg(order))}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="glass p-2 rounded-xl text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors shrink-0"
                                title="إرسال تفاصيل الطلب للسائق أو العميل بالواتساب"
                              >
                                <MessageCircle size={15} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Subtab 2: Tanker Sizes & Pricing Management ── */}
      {activeSubTab === 'sizes' && (
        <div className="space-y-4">
          <div className="card overflow-hidden border border-white/10 shadow-xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-base">قائمة أحجام الوايت وأسعار التوصيل</h4>
                <p className="text-xs text-gray-400">تحكم بالأسعار والسعات وإتاحة الأحجام للعملاء</p>
              </div>
            </div>

            <div className="divide-y divide-white/5">
              {sizes.map((sz) => (
                <div key={sz.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-white/3 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🚚</span>
                      <h5 className="font-bold text-white text-base">{sz.name}</h5>
                      {!sz.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/20">
                          معطّل
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      السعة: <span className="text-teal-300 font-semibold">{sz.capacity_label}</span> • الترتيب: {sz.display_order}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xl font-black text-amber-300">
                      {formatCurrency(sz.price)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => startEditSize(sz)}
                        className="glass p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                        title="تعديل السعر والبيانات"
                      >
                        <Edit3 size={15} />
                      </button>

                      <button
                        onClick={() => toggleSizeActive(sz)}
                        className={`glass p-2 rounded-xl transition-colors ${
                          sz.is_active ? 'hover:bg-red-500/10 text-emerald-400' : 'hover:bg-emerald-500/10 text-gray-500'
                        }`}
                        title={sz.is_active ? 'تعطيل الحجم' : 'تفعيل الحجم'}
                      >
                        {sz.is_active ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Tanker Size Modal */}
      {showSizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="card glass-strong max-w-md w-full p-6 border border-teal-500/30 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-white text-base">
                {editingSizeId ? 'تعديل حجم الوايت والسعر' : 'إضافة حجم وايت جديد'}
              </h3>
              <button
                onClick={() => setShowSizeModal(false)}
                className="glass p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSize} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">اسم الحجم</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: وايت عايدي (حجم متوسط)"
                  value={sizeForm.name}
                  onChange={e => setSizeForm(f => ({ ...f, name: e.target.value }))}
                  className="input-field min-h-[44px] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">وصف السعة (بالطن أو اللتر)</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: 12 طن - 12,000 لتر"
                  value={sizeForm.capacity_label}
                  onChange={e => setSizeForm(f => ({ ...f, capacity_label: e.target.value }))}
                  className="input-field min-h-[44px] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">السعر (ر.س)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={sizeForm.price}
                    onChange={e => setSizeForm(f => ({ ...f, price: e.target.value }))}
                    className="input-field min-h-[44px] text-sm font-bold text-amber-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">ترتيب العرض</label>
                  <input
                    type="number"
                    min={1}
                    value={sizeForm.display_order}
                    onChange={e => setSizeForm(f => ({ ...f, display_order: e.target.value }))}
                    className="input-field min-h-[44px] text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="size_active"
                  checked={sizeForm.is_active}
                  onChange={e => setSizeForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded text-teal-500"
                />
                <label htmlFor="size_active" className="text-xs text-gray-300 cursor-pointer">
                  تفعيل الحجم وإتاحته للعملاء فوراً
                </label>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSizeModal(false)}
                  className="btn-ghost w-1/2 py-2.5 text-xs font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingSize}
                  className="btn-primary w-1/2 py-2.5 text-xs font-bold"
                >
                  {savingSize ? <Loader2 size={15} className="animate-spin" /> : editingSizeId ? 'حفظ التعديل' : 'إضافة الحجم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN ADMIN PAGE
// ─────────────────────────────────────────────
type Tab = 'overview' | 'pending' | 'bookings' | 'water' | 'properties' | 'addons' | 'settings'

const AdminPage: React.FC = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [waterOrders, setWaterOrders] = useState<WaterOrder[]>([])
  const [waterSizes, setWaterSizes] = useState<WaterTankerSize[]>(DEFAULT_WATER_SIZES)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [loading, setLoading] = useState(true)

  // Interactive action modal states
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null)
  const [bookingToConfirm, setBookingToConfirm] = useState<Booking | null>(null)
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [pendingFilter, setPendingFilter] = useState<'all' | 'receipt' | 'verification'>('all')

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      navigate('/')
    }
  }, [profile])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: b }, { data: s }, { data: p }, { data: a }, { data: wo }, { data: ws }] = await Promise.all([
      supabase
        .from('bookings')
        .select('*, properties(name), booking_addons(*, addons(*))')
        .order('created_at', { ascending: false }),
      supabase.from('resort_settings').select('*').eq('id', 1).single(),
      supabase.from('properties').select('*').order('name'),
      supabase.from('addons').select('*').order('name'),
      supabase.from('water_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('water_tanker_sizes').select('*').order('display_order', { ascending: true }),
    ])
    if (b) setBookings(b as any)
    if (s) setSettings(s)
    if (p) setProperties(p)
    if (a) setAddons(a)
    if (wo) setWaterOrders(wo as any)
    if (ws && ws.length > 0) setWaterSizes(ws as any)
    else setWaterSizes(DEFAULT_WATER_SIZES)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Execute confirmation
  const handleExecuteConfirm = async (booking: Booking) => {
    setActionLoading(true)
    // Optimistic update
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'confirmed' } : b))

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', booking.id)

    if (error) {
      showToast('⚠️ تعذر تحديث الحجز: ' + error.message, 'error')
      await fetchAll()
    } else {
      showToast('تم تأكيد الحجز بنجاح واعتماد التاريخ ✅', 'success')
      await fetchAll()
    }

    setActionLoading(false)
    setBookingToConfirm(null)
  }

  // Execute cancellation
  const handleExecuteCancel = async (booking: Booking, reason: string) => {
    setActionLoading(true)
    const cancellationReason = reason.trim() || 'أُلغي من قبل إدارة المنتجع'

    // Optimistic update
    setBookings(prev => prev.map(b => b.id === booking.id ? {
      ...b,
      status: 'cancelled',
      cancellation_reason: cancellationReason,
      cancelled_at: new Date().toISOString()
    } : b))

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: cancellationReason,
        cancelled_at: new Date().toISOString()
      })
      .eq('id', booking.id)

    if (error) {
      showToast('⚠️ تعذر إلغاء الحجز: ' + error.message, 'error')
      await fetchAll()
    } else {
      showToast('تم إلغاء الحجز وإتاحة التاريخ مجدداً في التقويم ❌', 'success')
      await fetchAll()
    }

    setActionLoading(false)
    setBookingToCancel(null)
  }

  const handleSaveSettings = async (s: Settings) => {
    await supabase.from('resort_settings').update(s).eq('id', 1)
    setSettings(s)
    showToast('تم حفظ إعدادات المنتجع بنجاح ✓', 'success')
  }

  // Pending counts
  const pendingReceipt = useMemo(() => bookings.filter(b => b.status === 'pending_receipt'), [bookings])
  const pendingVerification = useMemo(() => bookings.filter(b => b.status === 'pending_verification'), [bookings])
  const allPending = useMemo(() => bookings.filter(b => b.status === 'pending_verification' || b.status === 'pending_receipt'), [bookings])
  const confirmed = useMemo(() => bookings.filter(b => b.status === 'confirmed'), [bookings])
  const totalRevenue = useMemo(() => bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + b.deposit_amount, 0), [bookings])

  // Filtered pending list based on chip
  const displayedPending = useMemo(() => {
    if (pendingFilter === 'receipt') return pendingReceipt
    if (pendingFilter === 'verification') return pendingVerification
    return allPending
  }, [pendingFilter, pendingReceipt, pendingVerification, allPending])

  // Filtered bookings table
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchesSearch = searchQuery === '' ||
        b.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.customer_phone.includes(searchQuery) ||
        (b.properties?.name && b.properties.name.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'pending' ? (b.status === 'pending_receipt' || b.status === 'pending_verification') : b.status === statusFilter)

      return matchesSearch && matchesStatus
    })
  }, [bookings, searchQuery, statusFilter])

  if (loading && bookings.length === 0) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={32} className="text-emerald-400 animate-spin" />
    </div>
  )

  const newWaterOrdersCount = useMemo(() => {
    return waterOrders.filter(o => o.status === 'new').length
  }, [waterOrders])

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: <BarChart3 size={16} /> },
    { id: 'pending', label: 'بانتظار الإجراء', icon: <Clock size={16} />, badge: allPending.length },
    { id: 'bookings', label: 'جميع الحجوزات', icon: <CalendarCheck size={16} /> },
    { id: 'water', label: 'وايتات الماء 💧', icon: <Droplets size={16} className="text-teal-400" />, badge: newWaterOrdersCount },
    { id: 'properties', label: 'الوحدات', icon: <Home size={16} /> },
    { id: 'addons', label: 'الإضافات', icon: <Zap size={16} /> },
    { id: 'settings', label: 'الإعدادات', icon: <Settings size={16} /> },
  ]

  return (
    <div className="min-h-screen pt-16">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className={`px-5 py-3 rounded-2xl shadow-2xl border text-sm font-bold flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 backdrop-blur-md shadow-emerald-950/50'
              : 'bg-red-950/90 text-red-300 border-red-500/40 backdrop-blur-md shadow-red-950/50'
          }`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Admin top bar */}
      <div className="border-b border-white/8 bg-[#161b22]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">لوحة تحكم إدارة المنتجع</span>
            <span className="text-gray-600 hidden sm:inline">—</span>
            <span className="text-sm text-gray-400 hidden sm:inline">مرحباً بك ({profile?.phone})</span>
          </div>

          <button onClick={fetchAll} className="glass py-1.5 px-3 rounded-xl hover:bg-white/10 text-xs text-gray-300 flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto custom-scrollbar pb-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'glass text-gray-400 hover:text-white hover:bg-white/8'
              }`}
            >
              {t.icon}
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="bg-amber-500 text-black text-xs rounded-full px-1.5 py-0.5 font-bold leading-none">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard icon={<Banknote size={20} />} label="إجمالي الإيرادات" value={formatCurrency(totalRevenue)} sub="من العربونات المؤكدة" color="emerald" />
              <MetricCard icon={<CalendarCheck size={20} />} label="حجوزات مؤكدة" value={confirmed.length} color="blue" />
              <MetricCard icon={<Clock size={20} />} label="بانتظار الإجراء" value={allPending.length} sub={`${pendingVerification.length} مراجعة • ${pendingReceipt.length} إيصال`} color="amber" />
              <MetricCard icon={<Users size={20} />} label="إجمالي الحجوزات" value={bookings.length} color="purple" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-white mb-3 flex items-center justify-between">
                  <span>تقويم الحجوزات</span>
                  <span className="text-xs text-gray-400 font-normal">اضغط على أي حجز لعرض تفاصيله</span>
                </h3>
                <AdminCalendar
                  bookings={bookings}
                  properties={properties}
                  onSelectBooking={b => setSelectedBookingForDetails(b)}
                />
              </div>

              <div>
                <h3 className="font-bold text-white mb-3">آخر الحجوزات المسجلة</h3>
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto custom-scrollbar">
                  {bookings.slice(0, 10).map(b => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBookingForDetails(b)}
                      className="card p-3 flex items-center justify-between text-sm hover:border-emerald-500/40 transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="font-medium text-white">{b.customer_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatShortDate(b.booking_date)} • {b.properties?.name ?? '—'} • {formatCurrency(b.total_amount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={b.status} />
                        <ChevronRight size={14} className="text-gray-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PENDING TAB */}
        {activeTab === 'pending' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="font-bold text-white text-lg">
                  الحجوزات التي تتطلب اتخاذ إجراء
                  {allPending.length > 0 && <span className="mr-2 text-amber-400">({allPending.length})</span>}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  حجوزات بانتظار التحقق من الإيصال أو تأكيد استلام العربون يدوياً
                </p>
              </div>

              {/* Filter chips */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl glass">
                <button
                  onClick={() => setPendingFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    pendingFilter === 'all' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  الكل ({allPending.length})
                </button>
                <button
                  onClick={() => setPendingFilter('verification')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    pendingFilter === 'verification' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  بانتظار المراجعة ({pendingVerification.length})
                </button>
                <button
                  onClick={() => setPendingFilter('receipt')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    pendingFilter === 'receipt' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  بانتظار الإيصال / يدوي ({pendingReceipt.length})
                </button>
              </div>
            </div>

            {displayedPending.length === 0 ? (
              <div className="card py-16 text-center border-dashed border-white/10">
                <CheckCircle2 size={44} className="text-emerald-400 mx-auto mb-3" />
                <h4 className="text-base font-bold text-white mb-1">لا توجد حجوزات بانتظار الإجراء حالياً</h4>
                <p className="text-xs text-gray-400">جميع الحجوزات معتمدة ومؤكدة بشكل سليم</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {displayedPending.map(b => (
                  <ActionableBookingCard
                    key={b.id}
                    booking={b}
                    onConfirm={booking => setBookingToConfirm(booking)}
                    onCancel={booking => setBookingToCancel(booking)}
                    onOpenDetails={booking => setSelectedBookingForDetails(booking)}
                    loading={actionLoading}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ALL BOOKINGS TAB */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-lg">سجل جميع الحجوزات ({bookings.length})</h3>
                <p className="text-xs text-gray-400">عرض وإدارة وتأكيد كافة الحجوزات المسجلة في النظام</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="بحث باسم العميل أو الجوال..."
                    className="input-field text-xs pr-8 py-2 min-h-[38px]"
                  />
                </div>

                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="input-field text-xs py-2 px-3 min-h-[38px] cursor-pointer bg-[#161b22]"
                  >
                    <option value="all">كل الحالات ({bookings.length})</option>
                    <option value="pending">بانتظار الإجراء ({allPending.length})</option>
                    <option value="confirmed">مؤكد ({confirmed.length})</option>
                    <option value="cancelled">ملغي ({bookings.filter(b => b.status === 'cancelled').length})</option>
                    <option value="completed">مكتمل</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#161b22]/50 shadow-2xl">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-xs text-gray-400 font-semibold">
                    <th className="px-4 py-3.5">العميل</th>
                    <th className="px-4 py-3.5">الوحدة والتاريخ</th>
                    <th className="px-4 py-3.5">المالي</th>
                    <th className="px-4 py-3.5">طريقة الدفع</th>
                    <th className="px-4 py-3.5">الحالة</th>
                    <th className="px-4 py-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500 text-sm">
                        لا توجد حجوزات مطابقة لمعايير البحث
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map(b => {
                      const isPending = b.status === 'pending_receipt' || b.status === 'pending_verification'
                      const isCancellable = b.status !== 'cancelled' && b.status !== 'completed'

                      return (
                        <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-white">{b.customer_name}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5" dir="ltr">{b.customer_phone}</p>
                          </td>

                          <td className="px-4 py-3.5">
                            <p className="font-medium text-emerald-400">{formatShortDate(b.booking_date)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{b.properties?.name ?? '—'}</p>
                          </td>

                          <td className="px-4 py-3.5">
                            <p className="font-bold text-white">{formatCurrency(b.total_amount)}</p>
                            <p className="text-xs text-amber-400 font-medium mt-0.5">عربون: {formatCurrency(b.deposit_amount)}</p>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-gray-300 font-medium">
                              {b.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'نقداً عند الوصول'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <StatusBadge status={b.status} />
                          </td>

                          {/* ACTIONS COLUMN */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Details button */}
                              <button
                                onClick={() => setSelectedBookingForDetails(b)}
                                className="glass p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                                title="عرض التفاصيل"
                              >
                                <Info size={15} />
                              </button>

                              {/* Confirm button (for pending_receipt & pending_verification) */}
                              {isPending && (
                                <button
                                  onClick={() => setBookingToConfirm(b)}
                                  className="btn-primary text-xs py-1.5 px-2.5 font-bold shadow-sm shadow-emerald-500/20"
                                  title="تأكيد الحجز"
                                >
                                  <Check size={14} />
                                  <span className="hidden xl:inline">تأكيد</span>
                                </button>
                              )}

                              {/* Cancel button */}
                              {isCancellable && (
                                <button
                                  onClick={() => setBookingToCancel(b)}
                                  className="btn-danger text-xs py-1.5 px-2.5 font-medium"
                                  title="إلغاء الحجز"
                                >
                                  <X size={14} />
                                  <span className="hidden xl:inline">إلغاء</span>
                                </button>
                              )}

                              {/* WhatsApp link */}
                              <a
                                href={generateWhatsAppLink(b.customer_phone, getBookingWhatsAppMsg(b))}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="glass p-2 rounded-xl text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors"
                                title="مراسلة واتساب"
                              >
                                <MessageCircle size={15} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* OTHER TABS */}
        {activeTab === 'water' && (
          <WaterOrdersTab
            orders={waterOrders}
            sizes={waterSizes}
            onRefresh={fetchAll}
            showToast={showToast}
          />
        )}

        {activeTab === 'properties' && (
          <PropertiesTab properties={properties} onRefresh={fetchAll} />
        )}

        {activeTab === 'addons' && (
          <AddonsTab addons={addons} onRefresh={fetchAll} />
        )}

        {activeTab === 'settings' && settings && (
          <SettingsTab settings={settings} onSave={handleSaveSettings} />
        )}
      </div>

      {/* MODALS */}
      <BookingDetailsModal
        booking={selectedBookingForDetails}
        onClose={() => setSelectedBookingForDetails(null)}
        onConfirm={b => setBookingToConfirm(b)}
        onCancel={b => setBookingToCancel(b)}
      />

      <ConfirmActionModal
        booking={bookingToConfirm}
        onClose={() => setBookingToConfirm(null)}
        onConfirm={handleExecuteConfirm}
        loading={actionLoading}
      />

      <CancelActionModal
        booking={bookingToCancel}
        onClose={() => setBookingToCancel(null)}
        onCancel={handleExecuteCancel}
        loading={actionLoading}
      />
    </div>
  )
}

// Icon helper
const Zap: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

export default AdminPage
