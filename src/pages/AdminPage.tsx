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
  CheckCircle2, XCircle, Banknote, Eye, EyeOff, Info, Phone, Calendar,
  CreditCard, Search, Filter, AlertCircle, FileText, CheckCircle,
  Droplets, Navigation, MapPin, Truck, ExternalLink, Palmtree, Sparkles, Image as ImageIcon,
  Fuel, Wrench, TrendingUp, TrendingDown, Send, CalendarDays, Receipt
} from 'lucide-react'
import { Facility, DEFAULT_FACILITIES } from '../components/Facilities'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, parseISO, isSameDay, subDays, startOfWeek } from 'date-fns'
import { ar } from 'date-fns/locale'
import ImageUploader from '../components/ImageUploader'
import WebsiteCmsTab from '../components/admin/WebsiteCmsTab'
import MediaLibraryTab from '../components/admin/MediaLibraryTab'
import ManualBookingModal from '../components/admin/ManualBookingModal'

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
  cover_image?: string | null
  images?: string[]
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

export type ExpenseCategory = 'ديزل' | 'صيانة وقطع غيار' | 'زيوت وغسيل' | 'أخرى'

export interface WaterExpense {
  id: string
  expense_date: string
  category: ExpenseCategory
  amount: number
  notes: string | null
  receipt_image_url?: string | null
  created_at?: string
}

export interface WaterManualTrip {
  id: string
  trip_date: string
  tanker_size: string
  amount: number
  notes: string | null
  created_at?: string
}

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
  const [form, setForm] = useState({
    name: '',
    description: '',
    weekday_price: '',
    weekend_price: '',
    max_guests: '50',
    amenities: '',
    cover_image: '',
  })
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
      cover_image: form.cover_image || null,
      images: form.cover_image ? [form.cover_image] : [],
    }

    if (editingId) {
      await supabase.from('properties').update(data).eq('id', editingId)
    } else {
      await supabase.from('properties').insert(data)
    }

    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', description: '', weekday_price: '', weekend_price: '', max_guests: '50', amenities: '', cover_image: '' })
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
      cover_image: p.cover_image || (p.images && p.images[0]) || '',
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
        <div>
          <h3 className="font-bold text-white text-lg">الوحدات والاستراحات والأسعار</h3>
          <p className="text-xs text-gray-400">إدارة تفاصيل الوحدات، صورها، أسعار الأيام العادية والعطل، وإتاحتها للحجز</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', description: '', weekday_price: '', weekend_price: '', max_guests: '50', amenities: '', cover_image: '' }) }}
          className="btn-primary text-sm py-2 px-3">
          <Plus size={15} />
          إضافة وحدة جديدة
        </button>
      </div>

      {showForm && (
        <div className="card p-5 border border-emerald-500/25 animate-fade-in-up">
          <h4 className="font-bold text-white mb-4">{editingId ? 'تعديل بيانات وصور الوحدة' : 'إضافة وحدة واستراحة جديدة'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">اسم الوحدة *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="input-field min-h-[48px]" placeholder="مثال: الاستراحة الكبيرة أو المنتجع الكامل" />
            </div>

            {/* Image Uploader from Device */}
            <div className="sm:col-span-2">
              <ImageUploader
                value={form.cover_image}
                onChange={url => set('cover_image', url)}
                label="صورة الوحدة الرئيسية (اختر من جهازك أو من مكتبة المنتجع)"
                helperText="اختر صورة للوحدة من جهازك ليتم عرضها في بطاقة الحجز للعملاء"
                folder="properties"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">الوصف</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="input-field min-h-[72px] resize-none" placeholder="وصف تفصيلي لمزايا وتجهيزات هذه الوحدة..." />
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
              {editingId ? 'حفظ التعديلات' : 'إضافة الوحدة'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {properties.map(p => {
          const photo = p.cover_image || (p.images && p.images[0]) || ''
          return (
            <div key={p.id} className={`card p-4 flex flex-col justify-between ${!p.is_active ? 'opacity-60' : ''}`}>
              <div className="space-y-3">
                {photo && (
                  <div className="relative h-40 rounded-2xl overflow-hidden bg-slate-950 border border-white/10">
                    <img
                      src={photo}
                      alt={p.name}
                      className="w-full h-full object-cover object-center"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-base">{p.name}</h4>
                    {!p.is_active && <span className="text-xs badge-cancelled px-2 py-0.5 rounded-full">معطّل</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(p)} className="glass p-2 rounded-lg hover:bg-white/10" title="تعديل">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => toggleActive(p)} className={`glass p-2 rounded-lg ${p.is_active ? 'hover:bg-red-500/10' : 'hover:bg-emerald-500/10'}`} title={p.is_active ? 'تعطيل' : 'تفعيل'}>
                      {p.is_active ? <XCircle size={14} className="text-red-400" /> : <CheckCircle2 size={14} className="text-emerald-400" />}
                    </button>
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 pt-1 border-t border-white/5">
                  <span>أيام عادية: <span className="text-white font-bold">{formatCurrency(p.weekday_price)}</span></span>
                  <span>عطل: <span className="text-white font-bold">{formatCurrency(p.weekend_price)}</span></span>
                  <span>ضيوف: <span className="text-white font-bold">{p.max_guests}</span></span>
                </div>

                {p.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {p.amenities.map((a, i) => <span key={i} className="text-[11px] glass px-2 py-0.5 rounded-full text-gray-300">{a}</span>)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
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
  onNavigateToLedger?: () => void
}

const WaterOrdersTab: React.FC<WaterOrdersTabProps> = ({ orders, sizes, onRefresh, showToast, onNavigateToLedger }) => {
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

      {/* Subtab Toggle: Orders vs Tanker Sizes vs Ledger */}
      <div className="flex items-center justify-between border-b border-white/8 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
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
          {onNavigateToLedger && (
            <button
              onClick={onNavigateToLedger}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 transition-all flex items-center gap-1.5"
            >
              <BarChart3 size={15} />
              <span>سجل وحسابات الوايت 📊</span>
            </button>
          )}
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

          {/* ── Mobile Cards View (visible on mobile only) ── */}
          <div className="block md:hidden space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="card py-12 text-center text-gray-500 text-sm">
                لا توجد طلبات مطابقة للبحث
              </div>
            ) : (
              filteredOrders.map((order) => {
                const cfg = WATER_STATUS_CONFIG[order.status] || WATER_STATUS_CONFIG.new
                return (
                  <div key={order.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
                    {/* Header: Order ID + Status Badge */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-400">#{order.id.slice(0, 7)}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeClass}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Customer & Tanker Info */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white text-base">{order.customer_name}</h4>
                        <p className="text-xs text-slate-400 font-mono" dir="ltr">{order.customer_phone}</p>
                      </div>
                      <div className="text-left">
                        <span className="text-xs text-emerald-400 font-bold block">{order.tanker_size_name}</span>
                        <span className="text-sm font-black text-amber-400">{formatCurrency(order.tanker_price)}</span>
                      </div>
                    </div>

                    {/* Location & Details */}
                    <div className="bg-slate-950/60 rounded-xl p-2.5 text-xs text-slate-300 flex items-center justify-between gap-2">
                      <span className="truncate">📍 {order.district}{order.street_address ? ` • ${order.street_address}` : ''}</span>
                      <span className="text-slate-400 shrink-0">خزان {order.tank_type}</span>
                    </div>

                    {/* Payment & Date Row */}
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>💳 {order.payment_method === 'cash' ? 'نقداً' : order.payment_method === 'pos_on_delivery' ? 'شبكة مدى' : 'تحويل بنكي'}</span>
                      {order.created_at && <span>{formatShortDate(order.created_at)}</span>}
                    </div>

                    {/* Actions Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                      {order.google_maps_url ? (
                        <a
                          href={order.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 px-2 rounded-xl text-xs font-medium transition-colors"
                        >
                          🗺️ الخريطة
                        </a>
                      ) : (
                        <span className="flex items-center justify-center text-gray-600 text-xs">—</span>
                      )}
                      <a
                        href={generateWhatsAppLink(order.customer_phone, getDriverWhatsAppMsg(order))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 py-2.5 px-2 rounded-xl text-xs font-medium transition-colors"
                      >
                        💬 واتساب
                      </a>
                      <select
                        value={order.status}
                        disabled={updatingOrderId === order.id}
                        onChange={(e) => handleUpdateStatus(order.id, e.target.value as any)}
                        className="bg-slate-800 border border-white/10 text-white text-xs rounded-xl px-2 py-2.5 focus:border-teal-400 focus:outline-none cursor-pointer text-center"
                      >
                        <option value="new">🔄 جديد</option>
                        <option value="dispatched">🚚 جاري</option>
                        <option value="delivered">✅ تفريغ</option>
                        <option value="cancelled">❌ إلغاء</option>
                      </select>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* ── Desktop Table (hidden on mobile) ── */}
          <div className="hidden md:block card overflow-hidden border border-white/10 shadow-xl">
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
                    filteredOrders.map((order) => {
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
// WATER LEDGER & EXPENSES TAB (سجل وحسابات الوايت 📊)
// ─────────────────────────────────────────────
interface WaterLedgerTabProps {
  orders: WaterOrder[]
  sizes: WaterTankerSize[]
  settings: Settings | null
  showToast: (msg: string, type?: 'success' | 'error') => void
  onNavigateToWaterOrders?: () => void
}

const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; icon: string; badgeClass: string }[] = [
  { id: 'ديزل', label: 'ديزل', icon: '⛽', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { id: 'صيانة وقطع غيار', label: 'صيانة وقطع غيار', icon: '🔧', badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { id: 'زيوت وغسيل', label: 'زيوت وغسيل', icon: '🛢️', badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  { id: 'أخرى', label: 'أخرى ونثريات', icon: '📦', badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
]

const WaterLedgerTab: React.FC<WaterLedgerTabProps> = ({
  orders,
  sizes,
  settings,
  showToast,
  onNavigateToWaterOrders,
}) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const thisWeekStartStr = format(startOfWeek(new Date(), { weekStartsOn: 6 }), 'yyyy-MM-dd')
  const thisMonthStartStr = format(startOfMonth(new Date()), 'yyyy-MM-dd')

  const [dateFilterType, setDateFilterType] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today')
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)

  const [expenses, setExpenses] = useState<WaterExpense[]>([])
  const [manualTrips, setManualTrips] = useState<WaterManualTrip[]>([])
  const [loading, setLoading] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [activeSubView, setActiveSubView] = useState<'expenses' | 'trips'>('expenses')

  // Add Expense Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [savingExpense, setSavingExpense] = useState(false)
  const [expenseForm, setExpenseForm] = useState<{
    expense_date: string
    category: ExpenseCategory
    amount: string
    notes: string
    receipt_image_url?: string
  }>({
    expense_date: todayStr,
    category: 'ديزل',
    amount: '',
    notes: '',
    receipt_image_url: '',
  })

  // Add Manual Trip Modal
  const [showTripModal, setShowTripModal] = useState(false)
  const [savingTrip, setSavingTrip] = useState(false)
  const [tripForm, setTripForm] = useState<{
    trip_date: string
    tanker_size: string
    amount: string
    notes: string
  }>({
    trip_date: todayStr,
    tanker_size: sizes[0]?.name || 'وايت عايدي (حجم متوسط)',
    amount: String(sizes[0]?.price || 120),
    notes: '',
  })

  // Fetch Ledger data from Supabase
  const fetchLedgerData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: expData, error: expError }, { data: tripsData, error: tripsError }] = await Promise.all([
        supabase.from('water_expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('water_manual_trips').select('*').order('created_at', { ascending: false }),
      ])

      if (expError) {
        if (expError.message?.includes('schema cache') || expError.message?.includes('does not exist') || expError.code === '42P01') {
          setNeedsMigration(true)
        } else {
          console.warn('Expenses query notice:', expError.message)
        }
      } else if (expData) {
        setExpenses(expData as WaterExpense[])
        setNeedsMigration(false)
      }

      if (tripsError) {
        if (tripsError.message?.includes('schema cache') || tripsError.message?.includes('does not exist') || tripsError.code === '42P01') {
          setNeedsMigration(true)
        }
      } else if (tripsData) {
        setManualTrips(tripsData as WaterManualTrip[])
      }
    } catch (err: any) {
      console.warn('Could not fetch water ledger tables:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLedgerData()
  }, [fetchLedgerData])

  // Calculate Active Date Range
  const { startDate, endDate, dateTitle } = useMemo(() => {
    if (dateFilterType === 'today') {
      return { startDate: todayStr, endDate: todayStr, dateTitle: 'اليوم' }
    }
    if (dateFilterType === 'yesterday') {
      return { startDate: yesterdayStr, endDate: yesterdayStr, dateTitle: 'أمس' }
    }
    if (dateFilterType === 'week') {
      return { startDate: thisWeekStartStr, endDate: todayStr, dateTitle: 'هذا الأسبوع' }
    }
    if (dateFilterType === 'month') {
      return { startDate: thisMonthStartStr, endDate: todayStr, dateTitle: 'هذا الشهر' }
    }
    return { startDate: selectedDate, endDate: selectedDate, dateTitle: selectedDate }
  }, [dateFilterType, selectedDate, todayStr, yesterdayStr, thisWeekStartStr, thisMonthStartStr])

  // Filter Data
  const filteredDeliveredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status !== 'delivered') return false
      const d = o.created_at ? o.created_at.slice(0, 10) : ''
      return d >= startDate && d <= endDate
    })
  }, [orders, startDate, endDate])

  const filteredManualTrips = useMemo(() => {
    return manualTrips.filter(t => t.trip_date >= startDate && t.trip_date <= endDate)
  }, [manualTrips, startDate, endDate])

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => e.expense_date >= startDate && e.expense_date <= endDate)
  }, [expenses, startDate, endDate])

  // Financial Computations
  const onlineRevenue = useMemo(() => {
    return filteredDeliveredOrders.reduce((sum, o) => sum + Number(o.tanker_price || 0), 0)
  }, [filteredDeliveredOrders])

  const manualRevenue = useMemo(() => {
    return filteredManualTrips.reduce((sum, t) => sum + Number(t.amount || 0), 0)
  }, [filteredManualTrips])

  const totalTrips = filteredDeliveredOrders.length + filteredManualTrips.length
  const totalIncome = onlineRevenue + manualRevenue

  const dieselTotal = useMemo(() => {
    return filteredExpenses
      .filter(e => e.category === 'ديزل')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  }, [filteredExpenses])

  const maintenanceTotal = useMemo(() => {
    return filteredExpenses
      .filter(e => e.category === 'صيانة وقطع غيار')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  }, [filteredExpenses])

  const oilsTotal = useMemo(() => {
    return filteredExpenses
      .filter(e => e.category === 'زيوت وغسيل')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  }, [filteredExpenses])

  const otherExpensesTotal = useMemo(() => {
    return filteredExpenses
      .filter(e => e.category === 'أخرى')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  }, [filteredExpenses])

  const otherCombinedTotal = maintenanceTotal + oilsTotal + otherExpensesTotal
  const totalExpenses = dieselTotal + otherCombinedTotal
  const netProfit = totalIncome - totalExpenses

  // WhatsApp Closing Summary
  const handleSendWhatsAppClosing = () => {
    let formattedDateText = ''
    if (dateFilterType === 'today') {
      formattedDateText = `${formatArabicDate(todayStr)}`
    } else if (dateFilterType === 'yesterday') {
      formattedDateText = `${formatArabicDate(yesterdayStr)}`
    } else if (dateFilterType === 'week') {
      formattedDateText = `هذا الأسبوع (من ${thisWeekStartStr} إلى ${todayStr})`
    } else if (dateFilterType === 'month') {
      formattedDateText = `هذا الشهر (من ${thisMonthStartStr} إلى ${todayStr})`
    } else {
      formattedDateText = `${formatArabicDate(selectedDate)}`
    }

    const message = `🚚 *تقرير الإغلاق اليومي لوايت الماء* 💧
📅 *التاريخ:* ${formattedDateText}
ــــــــــــــــــــــــــــــــــــــــ
🚛 *عدد الردود:* ${totalTrips} رد
💵 *إجمالي الدخل:* ${totalIncome.toLocaleString('en-US')} ر.س
⛽ *مصروف الديزل:* ${dieselTotal.toLocaleString('en-US')} ر.س
🔧 *مصروف الصيانة والنثريات:* ${otherCombinedTotal.toLocaleString('en-US')} ر.س
📉 *إجمالي المصروفات:* ${totalExpenses.toLocaleString('en-US')} ر.س
ــــــــــــــــــــــــــــــــــــــــ
💰 *صافي ربح اليوم:* ${netProfit.toLocaleString('en-US')} ر.س
🌟 إغلاق تشغيلي معتمد`

    const targetPhone = settings?.contact_whatsapp || settings?.contact_phone || ''
    const waUrl = targetPhone
      ? generateWhatsAppLink(targetPhone, message)
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank')
  }

  // Handle Save Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = Number(expenseForm.amount)
    if (!numAmount || numAmount <= 0) {
      showToast('⚠️ يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error')
      return
    }
    setSavingExpense(true)

    const tempId = 'temp-' + Date.now()
    const newRecord: WaterExpense = {
      id: tempId,
      expense_date: expenseForm.expense_date,
      category: expenseForm.category,
      amount: numAmount,
      notes: expenseForm.notes.trim() || null,
      receipt_image_url: expenseForm.receipt_image_url?.trim() || null,
      created_at: new Date().toISOString(),
    }

    // Optimistic update
    setExpenses(prev => [newRecord, ...prev])
    setShowExpenseModal(false)
    setExpenseForm({
      expense_date: selectedDate,
      category: 'ديزل',
      amount: '',
      notes: '',
      receipt_image_url: '',
    })

    try {
      const { data, error } = await supabase
        .from('water_expenses')
        .insert([{
          expense_date: newRecord.expense_date,
          category: newRecord.category,
          amount: newRecord.amount,
          notes: newRecord.notes,
          receipt_image_url: newRecord.receipt_image_url,
        }])
        .select()

      if (error) {
        setExpenses(prev => prev.filter(x => x.id !== tempId))
        showToast('⚠️ تعذر تسجيل المصروف: ' + error.message, 'error')
      } else if (data && data[0]) {
        setExpenses(prev => [data[0] as WaterExpense, ...prev.filter(x => x.id !== tempId)])
        showToast('تم تسجيل المصروف بنجاح ✅')
      }
    } catch (err: any) {
      setExpenses(prev => prev.filter(x => x.id !== tempId))
      showToast('⚠️ خطأ في الاتصال: ' + err.message, 'error')
    } finally {
      setSavingExpense(false)
    }
  }

  // Handle Save Manual Trip
  const handleSaveManualTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = Number(tripForm.amount)
    if (isNaN(numAmount) || numAmount < 0) {
      showToast('⚠️ يرجى إدخال مبلغ صحيح', 'error')
      return
    }
    setSavingTrip(true)

    const tempId = 'temp-trip-' + Date.now()
    const newTrip: WaterManualTrip = {
      id: tempId,
      trip_date: tripForm.trip_date,
      tanker_size: tripForm.tanker_size,
      amount: numAmount,
      notes: tripForm.notes.trim() || null,
      created_at: new Date().toISOString(),
    }

    // Optimistic update
    setManualTrips(prev => [newTrip, ...prev])
    setShowTripModal(false)
    setTripForm({
      trip_date: selectedDate,
      tanker_size: sizes[0]?.name || 'وايت عايدي (حجم متوسط)',
      amount: String(sizes[0]?.price || 120),
      notes: '',
    })

    try {
      const { data, error } = await supabase
        .from('water_manual_trips')
        .insert([{
          trip_date: newTrip.trip_date,
          tanker_size: newTrip.tanker_size,
          amount: newTrip.amount,
          notes: newTrip.notes,
        }])
        .select()

      if (error) {
        setManualTrips(prev => prev.filter(x => x.id !== tempId))
        showToast('⚠️ تعذر تسجيل الرد: ' + error.message, 'error')
      } else if (data && data[0]) {
        setManualTrips(prev => [data[0] as WaterManualTrip, ...prev.filter(x => x.id !== tempId)])
        showToast('تم تسجيل الرد المباشر بنجاح ✅')
      }
    } catch (err: any) {
      setManualTrips(prev => prev.filter(x => x.id !== tempId))
      showToast('⚠️ خطأ في الاتصال: ' + err.message, 'error')
    } finally {
      setSavingTrip(false)
    }
  }

  // Handle Delete Expense
  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return
    const oldList = [...expenses]
    setExpenses(prev => prev.filter(e => e.id !== id))
    try {
      const { error } = await supabase.from('water_expenses').delete().eq('id', id)
      if (error) {
        setExpenses(oldList)
        showToast('⚠️ تعذر حذف المصروف: ' + error.message, 'error')
      } else {
        showToast('تم حذف المصروف بنجاح')
      }
    } catch (err: any) {
      setExpenses(oldList)
      showToast('⚠️ خطأ في الاتصال', 'error')
    }
  }

  // Handle Delete Manual Trip
  const handleDeleteManualTrip = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الرد المباشر؟')) return
    const oldList = [...manualTrips]
    setManualTrips(prev => prev.filter(t => t.id !== id))
    try {
      const { error } = await supabase.from('water_manual_trips').delete().eq('id', id)
      if (error) {
        setManualTrips(oldList)
        showToast('⚠️ تعذر حذف الرد: ' + error.message, 'error')
      } else {
        showToast('تم حذف الرد المباشر بنجاح')
      }
    } catch (err: any) {
      setManualTrips(oldList)
      showToast('⚠️ خطأ في الاتصال', 'error')
    }
  }

  // Copy Migration SQL
  const copyMigrationSql = () => {
    const sql = `-- 1. Create Water Expenses Table
create table if not exists public.water_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null check (category in ('ديزل', 'صيانة وقطع غيار', 'زيوت وغسيل', 'أخرى')),
  amount numeric not null check (amount > 0),
  notes text,
  receipt_image_url text,
  created_at timestamptz default now()
);

alter table public.water_expenses enable row level security;
drop policy if exists "Admin manage water expenses" on public.water_expenses;
create policy "Admin manage water expenses" on public.water_expenses for all using (public.is_admin());

create table if not exists public.water_manual_trips (
  id uuid primary key default gen_random_uuid(),
  trip_date date not null default current_date,
  tanker_size text not null default 'عايدي',
  amount numeric not null check (amount >= 0),
  notes text,
  created_at timestamptz default now()
);

alter table public.water_manual_trips enable row level security;
drop policy if exists "Admin manage manual trips" on public.water_manual_trips;
create policy "Admin manage manual trips" on public.water_manual_trips for all using (public.is_admin());`

    navigator.clipboard.writeText(sql)
    showToast('تم نسخ كود SQL بنجاح! الصقه في Supabase SQL Editor واضغط Run ✅')
  }

  return (
    <div className="space-y-6">
      {/* ── Migration Alert Banner (If tables don't exist yet) ── */}
      {needsMigration && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-400 shrink-0" size={24} />
            <div>
              <p className="text-sm font-bold text-white">تنبيه قاعدة البيانات: يلزم إنشاء جداول السجل المالي والمصروفات</p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                قم بتشغيل ملف <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-200">supabase/water_ledger_migration.sql</code> في محرر Supabase لتفعيل الحفظ الدائم.
              </p>
            </div>
          </div>
          <button
            onClick={copyMigrationSql}
            className="btn-primary py-2 px-4 text-xs font-bold shrink-0 flex items-center justify-center gap-2"
          >
            <span>📋 نسخ كود SQL للتهيئة</span>
          </button>
        </div>
      )}

      {/* ── SECTION A: Date Filter & Control Bar ── */}
      <div className="card p-4 sm:p-5 border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Right: Date Picker & Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setDateFilterType('today')
                  setSelectedDate(todayStr)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  dateFilterType === 'today'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateFilterType('yesterday')
                  setSelectedDate(yesterdayStr)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  dateFilterType === 'yesterday'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                أمس
              </button>
              <button
                type="button"
                onClick={() => setDateFilterType('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  dateFilterType === 'week'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                هذا الأسبوع
              </button>
              <button
                type="button"
                onClick={() => setDateFilterType('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  dateFilterType === 'month'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                هذا الشهر
              </button>
            </div>

            {/* Custom Date Input */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value)
                    setDateFilterType('custom')
                  }}
                  className="bg-slate-900 border border-white/10 text-white text-xs rounded-xl px-3 py-2 focus:border-emerald-400 focus:outline-none cursor-pointer"
                />
              </div>
              <button
                onClick={fetchLedgerData}
                disabled={loading}
                className="glass p-2 rounded-xl text-gray-400 hover:text-white transition-colors"
                title="تحديث البيانات"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-400' : ''} />
              </button>
            </div>
          </div>

          {/* Left: Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setExpenseForm({
                  expense_date: selectedDate,
                  category: 'ديزل',
                  amount: '',
                  notes: '',
                })
                setShowExpenseModal(true)
              }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all"
            >
              <Plus size={16} />
              <span>تسجيل مصروف جديد</span>
            </button>

            <button
              onClick={() => {
                setTripForm({
                  trip_date: selectedDate,
                  tanker_size: sizes[0]?.name || 'وايت عايدي (حجم متوسط)',
                  amount: String(sizes[0]?.price || 120),
                  notes: '',
                })
                setShowTripModal(true)
              }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-lg shadow-teal-500/20 transition-all"
            >
              <Truck size={16} />
              <span>تسجيل رد مباشر</span>
            </button>

            <button
              onClick={handleSendWhatsAppClosing}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-600/25 transition-all"
              title="إرسال تقرير الإغلاق المالي للواتساب"
            >
              <MessageCircle size={16} />
              <span>إرسال إغلاق اليوم لواتساب</span>
            </button>
          </div>
        </div>

        {/* Selected Period Indicator */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-emerald-400" />
            <span>الفترة المحددة: <strong className="text-white">{dateTitle}</strong> {startDate !== endDate && `(من ${startDate} إلى ${endDate})`}</span>
          </div>
          {onNavigateToWaterOrders && (
            <button
              onClick={onNavigateToWaterOrders}
              className="text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1 transition-colors"
            >
              <span>عرض جدول الطلبات الأونلاين ({orders.length})</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── SECTION B: Summary Financial Cards (KPIs: Clean 2x2 grid on mobile) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: عدد الردود المنجزة */}
        <div className="card p-4 sm:p-5 bg-gradient-to-br from-slate-900/90 to-teal-950/20 border border-teal-500/20 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">عدد الردود المنجزة</span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center">
              <Truck size={17} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">
            {totalTrips.toLocaleString('en-US')} <span className="text-xs sm:text-sm font-normal text-gray-400">رد</span>
          </p>
          <p className="text-[11px] text-teal-300/80 mt-1 truncate">
            {filteredDeliveredOrders.length} طلب موقع • {filteredManualTrips.length} رد يدوي
          </p>
        </div>

        {/* KPI 2: إجمالي الدخل */}
        <div className="card p-4 sm:p-5 bg-gradient-to-br from-slate-900/90 to-emerald-950/20 border border-emerald-500/20 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">إجمالي الدخل</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Banknote size={17} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400">
            {formatCurrency(totalIncome)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1 truncate">
            {formatCurrency(onlineRevenue)} موقع + {formatCurrency(manualRevenue)} يدوي
          </p>
        </div>

        {/* KPI 3: إجمالي المصروفات */}
        <div className="card p-4 sm:p-5 bg-gradient-to-br from-slate-900/90 to-amber-950/20 border border-amber-500/20 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">إجمالي المصروفات</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <TrendingDown size={17} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-400">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="text-[11px] text-amber-300/80 mt-1 truncate">
            ديزل ({formatCurrency(dieselTotal)}) • صيانة وأخرى ({formatCurrency(otherCombinedTotal)})
          </p>
        </div>

        {/* KPI 4: صافي الربح */}
        <div className={`card p-4 sm:p-5 relative overflow-hidden shadow-xl transition-all ${
          netProfit >= 0
            ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-900 border border-emerald-500/40 shadow-emerald-950/30'
            : 'bg-gradient-to-br from-rose-950/40 via-slate-900/90 to-slate-900 border border-rose-500/40 shadow-rose-950/30'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">صافي الربح</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              netProfit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {netProfit >= 0 ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
            </div>
          </div>
          <p className={`text-2xl sm:text-3xl font-black ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(netProfit)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            الدخل - المصروفات ({netProfit >= 0 ? 'أرباح تشغيلية محققة 🌟' : 'عجز مؤقت ⚠️'})
          </p>
        </div>
      </div>

      {/* ── Categorized Expense Breakdown Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-white/3 border border-white/8">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <span className="text-base">⛽</span>
          <div className="truncate">
            <p className="text-[11px] text-amber-300/80 font-medium">ديزل ومحروقات</p>
            <p className="text-xs sm:text-sm font-bold text-amber-300">{formatCurrency(dieselTotal)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <span className="text-base">🔧</span>
          <div className="truncate">
            <p className="text-[11px] text-blue-300/80 font-medium">صيانة وقطع غيار</p>
            <p className="text-xs sm:text-sm font-bold text-blue-300">{formatCurrency(maintenanceTotal)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <span className="text-base">🛢️</span>
          <div className="truncate">
            <p className="text-[11px] text-cyan-300/80 font-medium">زيوت وغسيل</p>
            <p className="text-xs sm:text-sm font-bold text-cyan-300">{formatCurrency(oilsTotal)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-500/10 border border-slate-500/20">
          <span className="text-base">📦</span>
          <div className="truncate">
            <p className="text-[11px] text-slate-300/80 font-medium">نثريات وأخرى</p>
            <p className="text-xs sm:text-sm font-bold text-slate-300">{formatCurrency(otherExpensesTotal)}</p>
          </div>
        </div>
      </div>

      {/* ── Sub-navigation: Expenses Log vs Trips Log ── */}
      <div className="flex items-center justify-between border-b border-white/8 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubView('expenses')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeSubView === 'expenses'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            <Receipt size={15} />
            <span>سجل المصروفات اليومية ({filteredExpenses.length})</span>
          </button>

          <button
            onClick={() => setActiveSubView('trips')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeSubView === 'trips'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            <Truck size={15} />
            <span>سجل الردود والرحلات ({totalTrips})</span>
          </button>
        </div>

        <span className="text-xs text-gray-400 hidden sm:inline">
          {activeSubView === 'expenses' ? `إجمالي المصروفات: ${formatCurrency(totalExpenses)}` : `إجمالي الدخل: ${formatCurrency(totalIncome)}`}
        </span>
      </div>

      {/* ── VIEW 1: EXPENSES LOG ── */}
      {activeSubView === 'expenses' && (
        <div className="space-y-4">
          {/* Mobile Cards (Touch-friendly cards) */}
          <div className="block md:hidden space-y-3">
            {filteredExpenses.length === 0 ? (
              <div className="card py-12 text-center text-gray-500 text-sm space-y-3">
                <Receipt size={36} className="mx-auto text-gray-600 opacity-60" />
                <p>لا توجد مصروفات مسجلة لهذه الفترة</p>
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="btn-primary py-2 px-4 text-xs font-bold mx-auto"
                >
                  ➕ إضافة أول مصروف
                </button>
              </div>
            ) : (
              filteredExpenses.map((expense) => {
                const catCfg = EXPENSE_CATEGORIES.find(c => c.id === expense.category) || EXPENSE_CATEGORIES[0]
                return (
                  <div key={expense.id} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${catCfg.badgeClass}`}>
                        <span>{catCfg.icon}</span>
                        <span>{expense.category}</span>
                      </span>
                      <span className="text-base font-black text-amber-300">
                        {formatCurrency(expense.amount)}
                      </span>
                    </div>

                    {expense.notes && (
                      <p className="text-xs text-slate-200 bg-white/5 p-2.5 rounded-xl border border-white/5">
                        {expense.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-white/5">
                      <span>📅 {formatShortDate(expense.expense_date)}</span>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                        title="حذف المصروف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block card overflow-hidden border border-white/10 shadow-xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-right text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3 text-gray-400 text-xs">
                    <th className="p-3.5">التصنيف</th>
                    <th className="p-3.5">المبلغ</th>
                    <th className="p-3.5">البيان / ملاحظات</th>
                    <th className="p-3.5">تاريخ المصروف</th>
                    <th className="p-3.5 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-500">
                        لا توجد مصروفات مسجلة لهذه الفترة
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((expense) => {
                      const catCfg = EXPENSE_CATEGORIES.find(c => c.id === expense.category) || EXPENSE_CATEGORIES[0]
                      return (
                        <tr key={expense.id} className="hover:bg-white/3 transition-colors">
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${catCfg.badgeClass}`}>
                              <span>{catCfg.icon}</span>
                              <span>{expense.category}</span>
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-amber-300 text-sm">
                            {formatCurrency(expense.amount)}
                          </td>
                          <td className="p-3.5 text-slate-300">
                            {expense.notes || <span className="text-gray-600">—</span>}
                          </td>
                          <td className="p-3.5 text-xs text-gray-400">
                            {formatShortDate(expense.expense_date)}
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="glass p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                              title="حذف المصروف"
                            >
                              <Trash2 size={15} />
                            </button>
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

      {/* ── VIEW 2: TRIPS & DELIVERIES LOG ── */}
      {activeSubView === 'trips' && (
        <div className="space-y-6">
          {/* Manual Trips Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>الردود اليدوية / المباشرة للسائق</span>
                <span className="text-xs text-teal-400 font-normal">({filteredManualTrips.length} رد • {formatCurrency(manualRevenue)})</span>
              </h4>
              <button
                onClick={() => setShowTripModal(true)}
                className="btn-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1"
              >
                <Plus size={14} />
                <span>تسجيل رد يدوي</span>
              </button>
            </div>

            {/* Mobile Cards for Manual Trips */}
            <div className="block md:hidden space-y-2.5">
              {filteredManualTrips.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white/3 border border-dashed border-white/10 text-center text-xs text-gray-500">
                  لا توجد ردود يدوية مسجلة لهذه الفترة
                </div>
              ) : (
                filteredManualTrips.map(trip => (
                  <div key={trip.id} className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                        <Truck size={14} />
                        <span>{trip.tanker_size}</span>
                      </span>
                      <span className="text-sm font-black text-emerald-400">
                        {formatCurrency(trip.amount)}
                      </span>
                    </div>
                    {trip.notes && (
                      <p className="text-xs text-slate-300 bg-white/5 p-2 rounded-xl">
                        {trip.notes}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-white/5">
                      <span>📅 {formatShortDate(trip.trip_date)}</span>
                      <button
                        onClick={() => handleDeleteManualTrip(trip.id)}
                        className="text-rose-400 hover:text-rose-300 p-1"
                        title="حذف الرد"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table for Manual Trips */}
            <div className="hidden md:block card overflow-hidden border border-white/10 shadow-lg">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3 text-gray-400">
                    <th className="p-3">حجم الوايت</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">البيان / ملاحظات</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredManualTrips.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        لا توجد ردود يدوية مسجلة لهذه الفترة
                      </td>
                    </tr>
                  ) : (
                    filteredManualTrips.map(trip => (
                      <tr key={trip.id} className="hover:bg-white/3">
                        <td className="p-3 font-semibold text-teal-300">{trip.tanker_size}</td>
                        <td className="p-3 font-bold text-emerald-400">{formatCurrency(trip.amount)}</td>
                        <td className="p-3 text-slate-300">{trip.notes || '—'}</td>
                        <td className="p-3 text-gray-400">{formatShortDate(trip.trip_date)}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeleteManualTrip(trip.id)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 transition-colors"
                            title="حذف الرد"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivered Online Orders Section */}
          <div className="space-y-3 pt-4 border-t border-white/8">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>طلبات الموقع المفرغة والمدفوعة (Delivered)</span>
              <span className="text-xs text-emerald-400 font-normal">({filteredDeliveredOrders.length} طلب • {formatCurrency(onlineRevenue)})</span>
            </h4>

            {/* Mobile Cards for Delivered Orders */}
            <div className="block md:hidden space-y-2.5">
              {filteredDeliveredOrders.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white/3 border border-dashed border-white/10 text-center text-xs text-gray-500">
                  لا توجد طلبات أونلاين مفرغة في هذا التاريخ
                </div>
              ) : (
                filteredDeliveredOrders.map(order => (
                  <div key={order.id} className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">{order.customer_name}</p>
                        <p className="text-[11px] text-gray-400">{order.district} • {order.tanker_size_name}</p>
                      </div>
                      <span className="text-sm font-black text-emerald-400">
                        {formatCurrency(order.tanker_price)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-white/5">
                      <span>💳 {order.payment_method === 'cash' ? 'كاش' : order.payment_method === 'pos_on_delivery' ? 'شبكة' : 'تحويل'}</span>
                      <span>#{order.id.slice(0, 6)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table for Delivered Orders */}
            <div className="hidden md:block card overflow-hidden border border-white/10 shadow-lg">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3 text-gray-400">
                    <th className="p-3">#</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">حجم الوايت</th>
                    <th className="p-3">الحي</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">طريقة الدفع</th>
                    <th className="p-3">تاريخ الطلب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredDeliveredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        لا توجد طلبات أونلاين مفرغة في هذا التاريخ
                      </td>
                    </tr>
                  ) : (
                    filteredDeliveredOrders.map(order => (
                      <tr key={order.id} className="hover:bg-white/3">
                        <td className="p-3 font-mono text-gray-500">#{order.id.slice(0, 6)}</td>
                        <td className="p-3 font-bold text-white">{order.customer_name}</td>
                        <td className="p-3 text-teal-300">{order.tanker_size_name}</td>
                        <td className="p-3 text-slate-300">{order.district}</td>
                        <td className="p-3 font-bold text-emerald-400">{formatCurrency(order.tanker_price)}</td>
                        <td className="p-3 text-gray-400">{order.payment_method === 'cash' ? 'نقداً' : order.payment_method === 'pos_on_delivery' ? 'شبكة مدى' : 'تحويل'}</td>
                        <td className="p-3 text-gray-400">{formatShortDate(order.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 1: ADD EXPENSE ── */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="card glass-strong max-w-md w-full p-6 border border-amber-500/30 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Receipt className="text-amber-400" size={20} />
                <h3 className="font-bold text-white text-base">تسجيل مصروف تشغيلي جديد</h3>
              </div>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="glass p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">التاريخ</label>
                <input
                  type="date"
                  required
                  value={expenseForm.expense_date}
                  onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))}
                  className="input-field min-h-[44px] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">التصنيف</label>
                <select
                  value={expenseForm.category}
                  onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}
                  className="input-field min-h-[44px] text-sm bg-slate-900 cursor-pointer"
                >
                  <option value="ديزل">ديزل ⛽</option>
                  <option value="صيانة وقطع غيار">صيانة وقطع غيار 🔧</option>
                  <option value="زيوت وغسيل">زيوت وغسيل 🛢️</option>
                  <option value="أخرى">أخرى ونثريات 📦</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">المبلغ (ر.س)</label>
                <input
                  type="number"
                  required
                  min={1}
                  step="any"
                  placeholder="مثال: 150"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                  className="input-field min-h-[44px] text-sm font-bold text-amber-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">البيان / ملاحظات</label>
                <input
                  type="text"
                  placeholder="مثال: تعبئة فل محطة الدريس، تغيير لي ماء 2 بوصة..."
                  value={expenseForm.notes}
                  onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))}
                  className="input-field min-h-[44px] text-sm"
                />
              </div>

              <div>
                <ImageUploader
                  value={expenseForm.receipt_image_url || ''}
                  onChange={url => setExpenseForm(f => ({ ...f, receipt_image_url: url }))}
                  label="صورة فاتورة أو إيصال المصروف (اختياري - من الجهاز)"
                  helperText="ارفع صورة فاتورة المحطة أو سند الصرف للتوثيق المالي"
                  aspectRatio="square"
                  folder="expenses"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="btn-ghost w-1/2 py-2.5 text-xs font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="btn-primary w-1/2 py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                >
                  {savingExpense ? <Loader2 size={15} className="animate-spin" /> : <span>حفظ المصروف</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: ADD MANUAL TRIP ── */}
      {showTripModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="card glass-strong max-w-md w-full p-6 border border-teal-500/30 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Truck className="text-teal-400" size={20} />
                <div>
                  <h3 className="font-bold text-white text-base">تسجيل رد يدوي / مباشر</h3>
                  <p className="text-[11px] text-gray-400">لرحلات السائق المباشرة بدون طلب عبر الموقع</p>
                </div>
              </div>
              <button
                onClick={() => setShowTripModal(false)}
                className="glass p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveManualTrip} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">التاريخ</label>
                <input
                  type="date"
                  required
                  value={tripForm.trip_date}
                  onChange={e => setTripForm(f => ({ ...f, trip_date: e.target.value }))}
                  className="input-field min-h-[44px] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">حجم الوايت</label>
                <select
                  value={tripForm.tanker_size}
                  onChange={e => {
                    const selectedSizeName = e.target.value
                    const matched = sizes.find(s => s.name === selectedSizeName)
                    setTripForm(f => ({
                      ...f,
                      tanker_size: selectedSizeName,
                      amount: matched ? String(matched.price) : f.amount,
                    }))
                  }}
                  className="input-field min-h-[44px] text-sm bg-slate-900 cursor-pointer"
                >
                  {sizes.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({formatCurrency(s.price)})
                    </option>
                  ))}
                  <option value="رد مباشر عايدي">رد مباشر عايدي (120 ر.س)</option>
                  <option value="رد مباشر تريلا">رد مباشر تريلا (250 ر.س)</option>
                  <option value="أخرى / حجم مخصص">أخرى / حجم مخصص</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">المبلغ المستلم (ر.س)</label>
                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={tripForm.amount}
                  onChange={e => setTripForm(f => ({ ...f, amount: e.target.value }))}
                  className="input-field min-h-[44px] text-sm font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">البيان / ملاحظات (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: رد مباشر لاستراحة مجاورة، دفع كاش..."
                  value={tripForm.notes}
                  onChange={e => setTripForm(f => ({ ...f, notes: e.target.value }))}
                  className="input-field min-h-[44px] text-sm"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTripModal(false)}
                  className="btn-ghost w-1/2 py-2.5 text-xs font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingTrip}
                  className="btn-primary w-1/2 py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                >
                  {savingTrip ? <Loader2 size={15} className="animate-spin" /> : <span>حفظ الرد</span>}
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
// FACILITIES CMS TAB (إدارة مرافق المنتجع 🏡)
// ─────────────────────────────────────────────
interface FacilitiesAdminTabProps {
  facilities: Facility[]
  onRefresh: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

const FacilitiesAdminTab: React.FC<FacilitiesAdminTabProps> = ({ facilities, onRefresh, showToast }) => {
  const [showModal, setShowModal] = useState(false)
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    badge_text: '',
    description: '',
    image_url: '',
    features: [] as string[],
    privacy_note: 'مشمول بكامل الخصوصية',
    cta_text: 'احجز هذه الوحدة',
    display_order: '1',
    is_active: true,
  })

  const openCreateModal = () => {
    setEditingFacility(null)
    setTagInput('')
    setForm({
      title: '',
      subtitle: '',
      badge_text: '',
      description: '',
      image_url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
      features: ['خصوصية عائلية كاملة', 'نظافة وتعقيم دوري'],
      privacy_note: 'مشمول بكامل الخصوصية',
      cta_text: 'احجز هذه الوحدة',
      display_order: String(facilities.length + 1),
      is_active: true,
    })
    setShowModal(true)
  }

  const openEditModal = (f: Facility) => {
    setEditingFacility(f)
    setTagInput('')
    setForm({
      title: f.title,
      subtitle: f.subtitle || '',
      badge_text: f.badge_text || '',
      description: f.description,
      image_url: f.image_url,
      features: Array.isArray(f.features) ? [...f.features] : [],
      privacy_note: f.privacy_note || 'مشمول بكامل الخصوصية',
      cta_text: f.cta_text || 'احجز هذه الوحدة',
      display_order: String(f.display_order ?? 1),
      is_active: f.is_active ?? true,
    })
    setShowModal(true)
  }

  const handleAddTag = () => {
    const val = tagInput.trim()
    if (!val) return
    if (!form.features.includes(val)) {
      setForm(prev => ({ ...prev, features: [...prev.features, val] }))
    }
    setTagInput('')
  }

  const handleRemoveTag = (index: number) => {
    setForm(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }))
  }

  const handleToggleActive = async (f: Facility) => {
    setTogglingId(f.id)
    try {
      if (f.id.startsWith('default-')) {
        const payload = {
          title: f.title,
          subtitle: f.subtitle || null,
          badge_text: f.badge_text || null,
          description: f.description,
          image_url: f.image_url,
          features: f.features,
          privacy_note: f.privacy_note || 'مشمول بكامل الخصوصية',
          cta_text: f.cta_text || 'احجز هذه الوحدة',
          display_order: f.display_order,
          is_active: !f.is_active,
        }
        const { error } = await supabase.from('resort_facilities').insert([payload])
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('resort_facilities')
          .update({ is_active: !f.is_active })
          .eq('id', f.id)
        if (error) throw error
      }
      showToast(f.is_active ? 'تم إخفاء المرفق من الموقع 👁️' : 'تم إظهار وتفعيل المرفق في الموقع ✅')
      onRefresh()
    } catch (err: any) {
      showToast('⚠️ تعذر تحديث حالة المرفق: ' + (err.message || 'خطأ غير متوقع'), 'error')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (f: Facility) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف مرفق "${f.title}" نهائياً من الموقع؟`)) return
    setDeletingId(f.id)
    try {
      if (!f.id.startsWith('default-')) {
        const { error } = await supabase.from('resort_facilities').delete().eq('id', f.id)
        if (error) throw error
      }
      showToast('تم حذف المرفق بنجاح 🗑️')
      onRefresh()
    } catch (err: any) {
      showToast('⚠️ تعذر حذف المرفق: ' + (err.message || 'خطأ غير متوقع'), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      showToast('يرجى كتابة عنوان المرفق', 'error')
      return
    }
    if (!form.description.trim()) {
      showToast('يرجى كتابة الوصف التفصيلي للمرفق', 'error')
      return
    }
    if (!form.image_url.trim()) {
      showToast('يرجى تحديد رابط صورة المرفق', 'error')
      return
    }

    setSaving(true)
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      badge_text: form.badge_text.trim() || null,
      description: form.description.trim(),
      image_url: form.image_url.trim(),
      features: form.features,
      privacy_note: form.privacy_note.trim() || 'مشمول بكامل الخصوصية',
      cta_text: form.cta_text.trim() || 'احجز هذه الوحدة',
      display_order: parseInt(form.display_order, 10) || 0,
      is_active: form.is_active,
    }

    try {
      if (editingFacility && !editingFacility.id.startsWith('default-')) {
        const { error } = await supabase
          .from('resort_facilities')
          .update(payload)
          .eq('id', editingFacility.id)
        if (error) throw error
        showToast('تم تحديث بيانات المرفق بنجاح ✅')
      } else {
        const { error } = await supabase
          .from('resort_facilities')
          .insert([payload])
        if (error) throw error
        showToast('تم إضافة المرفق الجديد ونشره بنجاح ✅')
      }
      setShowModal(false)
      onRefresh()
    } catch (err: any) {
      showToast('⚠️ تعذر حفظ بيانات المرفق: ' + (err.message || 'خطأ غير متوقع'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const activeCount = facilities.filter(f => f.is_active).length

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Palmtree size={20} />
            </span>
            <h2 className="text-xl font-bold text-white">إدارة مرافق الواحة والمنتجع (Bento CMS)</h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-400">
            تحكم كامل في تعديل وإضافة وإخفاء وترتيب مرافق الواحة التي تظهر في شبكة Bento بالصفحة الرئيسية
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-emerald-400 font-bold">{activeCount}</span>
            <span className="text-gray-400">نشط في الموقع</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-300 font-bold">{facilities.length}</span>
            <span className="text-gray-400">الإجمالي</span>
          </div>

          <button
            onClick={openCreateModal}
            className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/30 whitespace-nowrap"
          >
            <Plus size={16} />
            <span>إضافة مرفق جديد</span>
          </button>
        </div>
      </div>

      {/* Facilities Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {facilities.map((f, index) => {
          const tags = Array.isArray(f.features) ? f.features : []
          return (
            <div
              key={f.id || index}
              className={`rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col justify-between ${
                f.is_active
                  ? 'bg-slate-900/70 border-white/10 hover:border-emerald-500/40 shadow-xl'
                  : 'bg-slate-950/40 border-white/5 opacity-70 hover:opacity-100'
              }`}
            >
              {/* Top Image Preview Banner */}
              <div className="relative h-48 w-full overflow-hidden bg-slate-950">
                <img
                  src={f.image_url}
                  alt={f.title}
                  className="w-full h-full object-cover object-center select-none"
                  onError={(e) => {
                    // Fallback to placeholder if broken image
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                {/* Badge Overlay */}
                {f.badge_text && (
                  <div className="absolute top-3.5 right-3.5">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-950/80 border border-white/15 text-emerald-300 backdrop-blur-md shadow-md">
                      {f.badge_text}
                    </span>
                  </div>
                )}

                {/* Display Order & Active Pill */}
                <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-black/70 border border-white/10 text-amber-300 backdrop-blur-md">
                    ترتيب: #{f.display_order ?? (index + 1)}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-md ${
                      f.is_active
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                    }`}
                  >
                    {f.is_active ? 'ظاهر بالموقع' : 'مخفي مؤقتاً'}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                      {f.title}
                    </h3>
                    {f.subtitle && (
                      <p className="text-xs text-emerald-400 font-medium mt-0.5">
                        {f.subtitle}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed line-clamp-3">
                    {f.description}
                  </p>

                  {/* Feature Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-gray-300 border border-white/5"
                        >
                          <CheckCircle2 size={10} className="text-emerald-400" />
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Info & Actions */}
                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="font-medium text-gray-300">الشمول:</span>
                    <span>{f.privacy_note || 'مشمول بكامل الخصوصية'}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {/* Toggle Active Button */}
                    <button
                      onClick={() => handleToggleActive(f)}
                      disabled={togglingId === f.id}
                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all ${
                        f.is_active
                          ? 'glass text-gray-300 hover:text-amber-300 hover:bg-amber-500/10'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                      }`}
                      title={f.is_active ? 'إخفاء المرفق من الموقع' : 'إظهار المرفق في الموقع'}
                    >
                      {togglingId === f.id ? (
                        <Loader2 size={15} className="animate-spin text-emerald-400" />
                      ) : f.is_active ? (
                        <>
                          <EyeOff size={14} />
                          <span className="hidden sm:inline">إخفاء</span>
                        </>
                      ) : (
                        <>
                          <Eye size={14} />
                          <span className="hidden sm:inline">إظهار</span>
                        </>
                      )}
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => openEditModal(f)}
                      className="glass p-2 rounded-xl text-xs font-semibold text-white hover:bg-white/15 flex items-center gap-1"
                      title="تعديل بيانات المرفق"
                    >
                      <Edit3 size={14} className="text-emerald-400" />
                      <span className="hidden sm:inline">تعديل</span>
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(f)}
                      disabled={deletingId === f.id}
                      className="p-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                      title="حذف المرفق"
                    >
                      {deletingId === f.id ? (
                        <Loader2 size={15} className="animate-spin text-red-400" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit / Create Facility Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="card glass-strong max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 border border-white/15 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Palmtree size={18} />
                </span>
                <h3 className="font-bold text-white text-base">
                  {editingFacility ? 'تعديل بيانات المرفق' : 'إضافة مرفق جديد إلى المنتجع'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="glass p-2 rounded-xl text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-right">
              {/* Title & Subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300 mb-1 block font-medium">عنوان المرفق *</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="input-field text-xs sm:text-sm"
                    placeholder="مثال: مسبح متدرج وألعاب مائية"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 mb-1 block font-medium">العنوان الفرعي الترويجي</label>
                  <input
                    type="text"
                    value={form.subtitle}
                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    className="input-field text-xs sm:text-sm"
                    placeholder="مثال: انتعاش وخصوصية مطلقة لجميع الأعمار"
                  />
                </div>
              </div>

              {/* Badge & Display Order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300 mb-1 block font-medium">
                    نص الشارة العلوية (Badge)
                  </label>
                  <input
                    type="text"
                    value={form.badge_text}
                    onChange={(e) => setForm({ ...form, badge_text: e.target.value })}
                    className="input-field text-xs sm:text-sm"
                    placeholder="مثال: انتعاش ومرح عائلي 🌊"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 mb-1 block font-medium">ترتيب العرض (Display Order)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                    className="input-field text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-gray-300 mb-1 block font-medium">الوصف التفصيلي للمرفق *</label>
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-field text-xs sm:text-sm resize-none"
                  placeholder="اكتب وصفاً جذاباً يشرح مزايا وتجهيزات هذا المرفق للزوار..."
                />
              </div>

              {/* Image Uploader Component from Device or Presets */}
              <ImageUploader
                value={form.image_url}
                onChange={(url) => setForm({ ...form, image_url: url })}
                label="صورة المرفق (اختر من جهازك أو من مكتبة المنتجع) *"
                helperText="يمكنك اختيار صورة من جهازك مباشرة، أو اختيار صورة من مكتبة المنتجع، أو لصق رابط مباشر"
                folder="facilities"
              />

              {/* Dynamic Feature Tags */}
              <div>
                <label className="text-xs text-gray-300 mb-1 block font-medium">
                  النقاط والمميزات (Tags)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddTag()
                      }
                    }}
                    className="input-field text-xs sm:text-sm flex-1"
                    placeholder="أدخل ميزة واضغط إضافة (مثال: ألعاب مائية للأطفال)"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="btn-primary py-2 px-4 text-xs font-bold"
                  >
                    إضافة +
                  </button>
                </div>

                {/* Tag Chips List */}
                <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-xl bg-white/5 border border-white/10">
                  {form.features.length === 0 ? (
                    <span className="text-xs text-gray-500">لا توجد مميزات مضافة بعد. أضف نقطة أعلاه.</span>
                  ) : (
                    form.features.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(idx)}
                          className="hover:text-red-300 transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Privacy Note & CTA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300 mb-1 block font-medium">ملاحظة الشمول / الخصوصية</label>
                  <input
                    type="text"
                    value={form.privacy_note}
                    onChange={(e) => setForm({ ...form, privacy_note: e.target.value })}
                    className="input-field text-xs sm:text-sm"
                    placeholder="مثال: مشمول بكامل الخصوصية"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 mb-1 block font-medium">نص زر الإجراء (CTA)</label>
                  <input
                    type="text"
                    value={form.cta_text}
                    onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
                    className="input-field text-xs sm:text-sm"
                    placeholder="احجز هذه الوحدة"
                  />
                </div>
              </div>

              {/* Active Toggle Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-xs font-bold text-white">تفعيل وظهور المرفق في الصفحة الرئيسية</p>
                  <p className="text-[11px] text-gray-400">عند إلغاء التفعيل، سيتم إخفاء البطاقة من الموقع فوراً</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="glass py-2.5 px-5 text-xs text-gray-300 hover:text-white rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary py-2.5 px-6 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/30"
                >
                  {saving ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>{editingFacility ? 'حفظ التعديلات' : 'نشر المرفق الآن'}</span>
                  )}
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
type Tab = 'overview' | 'cms' | 'media' | 'facilities' | 'bookings' | 'pending' | 'properties' | 'addons' | 'water' | 'ledger' | 'settings'

const AdminPage: React.FC = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showManualBookingModal, setShowManualBookingModal] = useState(false)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [waterOrders, setWaterOrders] = useState<WaterOrder[]>([])
  const [waterSizes, setWaterSizes] = useState<WaterTankerSize[]>(DEFAULT_WATER_SIZES)
  const [facilities, setFacilities] = useState<Facility[]>(DEFAULT_FACILITIES)
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
    const [{ data: b }, { data: s }, { data: p }, { data: a }, { data: wo }, { data: ws }, { data: fac }] = await Promise.all([
      supabase
        .from('bookings')
        .select('*, properties(name), booking_addons(*, addons(*))')
        .order('created_at', { ascending: false }),
      supabase.from('resort_settings').select('*').eq('id', 1).single(),
      supabase.from('properties').select('*').order('name'),
      supabase.from('addons').select('*').order('name'),
      supabase.from('water_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('water_tanker_sizes').select('*').order('display_order', { ascending: true }),
      supabase.from('resort_facilities').select('*').order('display_order', { ascending: true }),
    ])
    if (b) setBookings(b as any)
    if (s) setSettings(s)
    if (p) setProperties(p)
    if (a) setAddons(a)
    if (wo) setWaterOrders(wo as any)
    if (ws && ws.length > 0) setWaterSizes(ws as any)
    else setWaterSizes(DEFAULT_WATER_SIZES)
    if (fac && fac.length > 0) setFacilities(fac as any)
    else setFacilities(DEFAULT_FACILITIES)
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

  const newWaterOrdersCount = useMemo(() => {
    return waterOrders.filter(o => o.status === 'new').length
  }, [waterOrders])

  if (loading && bookings.length === 0) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={32} className="text-emerald-400 animate-spin" />
    </div>
  )

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: <BarChart3 size={16} /> },
    { id: 'cms', label: 'واجهة الموقع والصور 🖼️', icon: <ImageIcon size={16} className="text-emerald-400" /> },
    { id: 'media', label: 'مكتبة الوسائط 📂', icon: <Palmtree size={16} className="text-teal-400" /> },
    { id: 'facilities', label: 'إدارة المرافق 🏡', icon: <Sparkles size={16} className="text-amber-400" /> },
    { id: 'bookings', label: 'جميع الحجوزات', icon: <CalendarCheck size={16} /> },
    { id: 'pending', label: 'بانتظار الإجراء', icon: <Clock size={16} />, badge: allPending.length },
    { id: 'properties', label: 'الوحدات', icon: <Home size={16} /> },
    { id: 'water', label: 'وايتات الماء 💧', icon: <Droplets size={16} className="text-teal-400" />, badge: newWaterOrdersCount },
    { id: 'ledger', label: 'سجل وحسابات الوايت 📊', icon: <BarChart3 size={16} className="text-amber-400" /> },
    { id: 'addons', label: 'الإضافات', icon: <Zap size={16} /> },
    { id: 'settings', label: 'الإعدادات البنكية', icon: <Settings size={16} /> },
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowManualBookingModal(true)}
              className="btn-primary py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
              title="تسجيل حجز جديد لعميل هاتف أو مكتب"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">تسجيل حجز يدوي</span>
              <span className="sm:hidden">حجز يدوي</span>
            </button>

            <button onClick={fetchAll} className="glass py-1.5 px-3 rounded-xl hover:bg-white/10 text-xs text-gray-300 flex items-center gap-1.5">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>تحديث</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs — Horizontal scroll on mobile, wraps on desktop */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 px-1 -mx-2 sm:mx-0 sm:flex-wrap mb-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === t.id
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25 font-bold'
                  : 'bg-slate-900/80 border border-white/10 text-gray-400 hover:text-white hover:bg-white/8'
              }`}
            >
              {t.icon}
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="bg-amber-500 text-black text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none min-w-[18px] text-center">
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

            {/* ── Mobile Cards View (visible on mobile only) ── */}
            <div className="block md:hidden space-y-3">
              {filteredBookings.length === 0 ? (
                <div className="card py-12 text-center text-gray-500 text-sm">
                  لا توجد حجوزات مطابقة لمعايير البحث
                </div>
              ) : (
                filteredBookings.map(b => {
                  const isPending = b.status === 'pending_receipt' || b.status === 'pending_verification'
                  const isCancellable = b.status !== 'cancelled' && b.status !== 'completed'

                  return (
                    <div key={b.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
                      {/* Top: Date + Unit + Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-400">{formatShortDate(b.booking_date)}</span>
                          <span className="text-[11px] text-gray-500">•</span>
                          <span className="text-xs text-gray-400">{b.properties?.name ?? 'المنتجع'}</span>
                        </div>
                        <StatusBadge status={b.status} />
                      </div>

                      {/* Customer & Financial */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-white text-base">{b.customer_name}</h4>
                          <p className="text-xs text-slate-400 font-mono" dir="ltr">{b.customer_phone}</p>
                        </div>
                        <div className="text-left space-y-0.5">
                          <p className="font-bold text-white text-sm">{formatCurrency(b.total_amount)}</p>
                          <p className="text-[11px] text-amber-400 font-medium">عربون: {formatCurrency(b.deposit_amount)}</p>
                        </div>
                      </div>

                      {/* Payment Method */}
                      <div className="bg-slate-950/60 rounded-xl p-2.5 text-xs text-slate-300 flex items-center justify-between">
                        <span>💳 {b.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'نقداً عند الوصول'}</span>
                        <span className="text-[10px] text-gray-500 font-mono">#{b.id.slice(0, 7)}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-white/5">
                        <button
                          onClick={() => setSelectedBookingForDetails(b)}
                          className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 px-2 rounded-xl text-xs font-medium transition-colors"
                        >
                          👁️ تفاصيل
                        </button>

                        {isPending ? (
                          <button
                            onClick={() => setBookingToConfirm(b)}
                            className="flex items-center justify-center gap-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 py-2.5 px-2 rounded-xl text-xs font-medium transition-colors"
                          >
                            ✅ تأكيد
                          </button>
                        ) : (
                          <span />
                        )}

                        {isCancellable ? (
                          <button
                            onClick={() => setBookingToCancel(b)}
                            className="flex items-center justify-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 py-2.5 px-2 rounded-xl text-xs font-medium transition-colors"
                          >
                            ❌ إلغاء
                          </button>
                        ) : (
                          <span />
                        )}

                        <a
                          href={generateWhatsAppLink(b.customer_phone, getBookingWhatsAppMsg(b))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 py-2.5 px-2 rounded-xl text-xs font-medium transition-colors"
                        >
                          💬 واتساب
                        </a>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* ── Desktop Table (hidden on mobile) ── */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/10 bg-[#161b22]/50 shadow-2xl">
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

                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedBookingForDetails(b)}
                                className="glass p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                                title="عرض التفاصيل"
                              >
                                <Info size={15} />
                              </button>

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
            onNavigateToLedger={() => setActiveTab('ledger')}
          />
        )}

        {activeTab === 'ledger' && (
          <WaterLedgerTab
            orders={waterOrders}
            sizes={waterSizes}
            settings={settings}
            showToast={showToast}
            onNavigateToWaterOrders={() => setActiveTab('water')}
          />
        )}

        {activeTab === 'cms' && (
          <WebsiteCmsTab showToast={showToast} />
        )}

        {activeTab === 'media' && (
          <MediaLibraryTab facilities={facilities} showToast={showToast} />
        )}

        {activeTab === 'facilities' && (
          <FacilitiesAdminTab
            facilities={facilities}
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
      {showManualBookingModal && (
        <ManualBookingModal
          properties={properties}
          onClose={() => setShowManualBookingModal(false)}
          onSuccess={fetchAll}
          showToast={showToast}
        />
      )}

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
