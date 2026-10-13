import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { supabase, FurnitureOrder } from '../lib/supabase'
import {
  formatArabicDate, formatCurrency, formatTime,
  generateWhatsAppLink, STATUS_LABELS, STATUS_CLASSES
} from '../lib/utils'
import {
  MessageCircle, AlertTriangle, X, Loader2, RefreshCw, Clock,
  CheckCircle2, Droplets, CalendarCheck, MapPin, Truck, ChevronRight,
  ShoppingBag, Armchair, ExternalLink, Navigation
} from 'lucide-react'
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

interface WaterOrder {
  id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string
  tanker_size_name: string
  tanker_price: number
  district: string
  street_address: string | null
  google_maps_url: string | null
  tank_type: string
  payment_method: string
  status: 'new' | 'dispatched' | 'delivered' | 'cancelled'
  notes: string | null
  created_at: string
}

const WATER_STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  new: { label: 'طلب جديد ⏳', badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
  dispatched: { label: 'جاري التوصيل 🚚', badgeClass: 'bg-teal-500/15 text-teal-300 border border-teal-500/30' },
  delivered: { label: 'تم التوصيل بنجاح ✅', badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
  cancelled: { label: 'ملغي ❌', badgeClass: 'bg-red-500/15 text-red-400 border border-red-500/30' },
}

const FURNITURE_STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  new: { label: 'طلب جديد ⏳', badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
  confirmed: { label: 'تم الاعتماد والتجهيز 🔵', badgeClass: 'bg-blue-500/15 text-blue-300 border border-blue-500/30' },
  shipping: { label: 'جاري الشحن والتوصيل 🚚', badgeClass: 'bg-purple-500/15 text-purple-300 border border-purple-500/30' },
  delivered: { label: 'تم الاستلام بنجاح ✅', badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
  cancelled: { label: 'ملغي ❌', badgeClass: 'bg-red-500/15 text-red-400 border border-red-500/30' },
}

const MyBookingsPage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth()
  const { settings } = useSettings()

  const [activeTab, setActiveTab] = useState<'bookings' | 'water' | 'furniture'>('bookings')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [waterOrders, setWaterOrders] = useState<WaterOrder[]>([])
  const [furnitureOrders, setFurnitureOrders] = useState<FurnitureOrder[]>([])
  const [loading, setLoading] = useState(true)

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

  const fetchBookings = useCallback(async () => {
    if (!user) return
    try {
      const cleanPhone = profile?.phone?.replace(/[^0-9]/g, '') || ''
      const normalizedPhone = cleanPhone.startsWith('966') ? '0' + cleanPhone.slice(3) : cleanPhone

      let query = supabase
        .from('bookings')
        .select('*, properties(name)')
        .order('booking_date', { ascending: false })

      if (normalizedPhone) {
        query = query.or(`customer_id.eq.${user.id},customer_phone.eq.${normalizedPhone},customer_phone.eq.${cleanPhone}`)
      } else {
        query = query.eq('customer_id', user.id)
      }

      const { data } = await query
      if (data) setBookings(data as any)
    } catch (e) {
      console.error('Error fetching bookings:', e)
    }
  }, [user, profile])

  const fetchWaterOrders = useCallback(async () => {
    if (!user) return
    try {
      const cleanPhone = profile?.phone?.replace(/[^0-9]/g, '') || ''
      const normalizedPhone = cleanPhone.startsWith('966') ? '0' + cleanPhone.slice(3) : cleanPhone

      let query = supabase
        .from('water_orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (normalizedPhone) {
        query = query.or(`customer_id.eq.${user.id},customer_phone.eq.${normalizedPhone},customer_phone.eq.${cleanPhone}`)
      } else {
        query = query.eq('customer_id', user.id)
      }

      const { data } = await query
      if (data) setWaterOrders(data as any)
    } catch (e) {
      console.error('Error fetching water orders:', e)
    }
  }, [user, profile])

  const fetchFurnitureOrders = useCallback(async () => {
    if (!user) return
    try {
      const cleanPhone = profile?.phone?.replace(/[^0-9]/g, '') || ''
      const normalizedPhone = cleanPhone.startsWith('966') ? '0' + cleanPhone.slice(3) : cleanPhone

      let query = supabase
        .from('furniture_orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (normalizedPhone) {
        query = query.or(`customer_id.eq.${user.id},customer_phone.eq.${normalizedPhone},customer_phone.eq.${cleanPhone}`)
      } else {
        query = query.eq('customer_id', user.id)
      }

      const { data } = await query
      if (data) setFurnitureOrders(data as FurnitureOrder[])
    } catch (e) {
      console.error('Error fetching furniture orders:', e)
    }
  }, [user, profile])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchBookings(), fetchWaterOrders(), fetchFurnitureOrders()])
    setLoading(false)
  }, [fetchBookings, fetchWaterOrders, fetchFurnitureOrders])

  useEffect(() => {
    if (user) {
      refreshAll()
    }
  }, [user, refreshAll])

  // Real-time synchronization
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`user-sync-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'water_orders' }, () => {
        fetchWaterOrders()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'furniture_orders' }, () => {
        fetchFurnitureOrders()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchBookings, fetchWaterOrders, fetchFurnitureOrders])

  // Check if booking date is today or in the past
  const isPastOrToday = (bookingDate: string) => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const bDate = new Date(bookingDate)
      bDate.setHours(0, 0, 0, 0)
      return bDate <= today
    } catch {
      return false
    }
  }

  // Customers can directly cancel pending bookings only (before admin confirmation)
  // Confirmed bookings require contacting administration to protect resort operations
  const canDirectCancel = (b: Booking) => {
    if (isPastOrToday(b.booking_date)) return false
    return ['pending_receipt', 'pending_verification'].includes(b.status)
  }

  const isConfirmedBooking = (b: Booking) => b.status === 'confirmed' && !isPastOrToday(b.booking_date)

  const handleCancel = async () => {
    if (!cancelModal || !profile) return
    // Guard against cancelling confirmed or past bookings directly
    if (!canDirectCancel(cancelModal)) {
      setCancelModal(null)
      return
    }
    setCancelLoading(true)

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: cancelReason || 'ألغى العميل الحجز المعلق',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', cancelModal.id)

    if (!error) {
      const newCount = (profile.cancellation_count ?? 0) + 1
      const updates: any = { cancellation_count: newCount }
      if (newCount >= 2) updates.is_flagged = true

      try {
        await supabase.from('profiles').update(updates).eq('id', user!.id)
      } catch (_) {}

      await refreshProfile()
      await fetchBookings()
      setCancelModal(null)
      setCancelReason('')
    }
    setCancelLoading(false)
  }

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
        <div className="text-center card glass p-8 max-w-md mx-4">
          <CalendarCheck size={40} className="text-emerald-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">عرض سجل الحجوزات والطلبات</h2>
          <p className="text-gray-400 text-sm mb-4">يجب تسجيل الدخول برقم الجوال لعرض حجوزاتك ومتابعة طلباتك</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">حجوزاتي وطلباتي</h1>
            <p className="text-sm text-gray-400 mt-0.5">سجل جميع حجوزات المنتجع وطلبات وايت الماء الحلو</p>
          </div>
          <button
            onClick={refreshAll}
            className="glass p-2.5 rounded-xl hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
            title="تحديث البيانات"
          >
            <RefreshCw size={17} />
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
              <><CheckCircle2 size={16} /> عميل مميز في {settings.resort_name} — شكراً لثقتك بنا</>
            )}
          </div>
        )}

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10 mb-6">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`py-2.5 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
              activeTab === 'bookings'
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-950/40'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CalendarCheck size={15} />
            <span className="truncate">حجوزاتي ({bookings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('water')}
            className={`py-2.5 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
              activeTab === 'water'
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 shadow-lg shadow-teal-950/40'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Droplets size={15} />
            <span className="truncate">وايت ماء ({waterOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('furniture')}
            className={`py-2.5 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
              activeTab === 'furniture'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-950/40'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShoppingBag size={15} />
            <span className="truncate">أثاث تراث ({furnitureOrders.length})</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="text-emerald-400 animate-spin" />
          </div>
        ) : activeTab === 'bookings' ? (
          // ── RESORT BOOKINGS TAB ──
          bookings.length === 0 ? (
            <div className="text-center py-16 card glass p-8">
              <div className="text-5xl mb-4">🌴</div>
              <h3 className="text-lg font-bold text-white mb-1">لا توجد حجوزات منتجع مسجلة</h3>
              <p className="text-gray-400 text-sm mb-5">اختر موعدك المفضل واستمتع بأروع إقامة عائلية</p>
              <a href="/book" className="btn-primary inline-flex items-center gap-2 py-2.5 px-6">
                <CalendarCheck size={16} />
                <span>احجز الآن</span>
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map(b => (
                <div key={b.id} className="card p-5 animate-fade-in-up border border-white/10 hover:border-emerald-500/30 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-white text-base">{b.properties?.name ?? 'المنتجع الكامل'}</h3>
                      <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{formatArabicDate(parseISO(b.booking_date))}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold ${STATUS_CLASSES[b.status]}`}>
                      {getStatusIcon(b.status)}
                      {STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div className="glass p-2.5 rounded-xl border border-white/5">
                      <p className="text-gray-400 text-xs mb-0.5">إجمالي المبلغ</p>
                      <p className="font-bold text-white">{formatCurrency(b.total_amount)}</p>
                    </div>
                    <div className="glass p-2.5 rounded-xl border border-white/5">
                      <p className="text-gray-400 text-xs mb-0.5">العربون المدفوع</p>
                      <p className="font-bold text-amber-400">{formatCurrency(b.deposit_amount)}</p>
                    </div>
                  </div>

                  {b.status === 'pending_receipt' && (
                    <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                      <Clock size={14} className="shrink-0" />
                      <span>بانتظار إرفاق الإيصال البنكي لتأكيد الحجز</span>
                    </div>
                  )}

                  {b.cancellation_reason && (
                    <div className="mb-3 text-xs text-gray-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
                      سبب الإلغاء: {b.cancellation_reason}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                    {canDirectCancel(b) && (
                      <button
                        onClick={() => setCancelModal(b)}
                        className="btn-danger text-xs py-2 px-3.5 rounded-xl"
                      >
                        <X size={13} />
                        <span>إلغاء الحجز</span>
                      </button>
                    )}

                    {isConfirmedBooking(b) && (
                      <a
                        href={generateWhatsAppLink(
                          settings.contact_whatsapp || '0547382222',
                          `السلام عليكم، أود طلب إلغاء أو تعديل الحجز المؤكد رقم: ${b.id.slice(0, 8)} بتاريخ ${b.booking_date} (الاسم: ${b.customer_name})`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/40"
                        title="الحجوزات المؤكدة تتطلب التنسيق المباشر مع إدارة المنتجع"
                      >
                        <AlertTriangle size={13} className="text-amber-400" />
                        <span>طلب إلغاء الحجز عبر الإدارة</span>
                      </a>
                    )}

                    <a
                      href={generateWhatsAppLink(settings.contact_whatsapp || '0547382222', `السلام عليكم، لدي استفسار بخصوص حجز رقم: ${b.id.slice(0, 8)} بتاريخ ${b.booking_date}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5"
                    >
                      <MessageCircle size={14} className="text-emerald-400" />
                      <span>تواصل مع الإدارة</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'water' ? (
          // ── WATER ORDERS TAB ──
          waterOrders.length === 0 ? (
            <div className="text-center py-16 card glass p-8">
              <div className="text-5xl mb-4">💧</div>
              <h3 className="text-lg font-bold text-white mb-1">لا توجد طلبات وايت ماء حلو مسجلة</h3>
              <p className="text-gray-400 text-sm mb-5">نوفر لكم مياه عذبة نقية مع خدمة التوصيل السريع للمنازل والاستراحات</p>
              <a href="/water" className="btn-primary inline-flex items-center gap-2 py-2.5 px-6">
                <Droplets size={16} />
                <span>اطلب وايت الآن</span>
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {waterOrders.map(wo => {
                const conf = WATER_STATUS_CONFIG[wo.status] || {
                  label: wo.status,
                  badgeClass: 'bg-white/10 text-gray-300 border border-white/10',
                }
                return (
                  <div key={wo.id} className="card p-5 animate-fade-in-up border border-teal-500/20 hover:border-teal-500/40 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base">🚚</span>
                          <h3 className="font-bold text-white text-base">{wo.tanker_size_name}</h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <MapPin size={12} className="text-teal-400" />
                          <span>حي {wo.district}</span>
                          {wo.street_address && <span>• {wo.street_address}</span>}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${conf.badgeClass}`}>
                        {conf.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                      <div className="glass p-2.5 rounded-xl border border-white/5">
                        <p className="text-gray-400 text-xs mb-0.5">المبلغ</p>
                        <p className="font-bold text-amber-300">{formatCurrency(wo.tanker_price)}</p>
                      </div>
                      <div className="glass p-2.5 rounded-xl border border-white/5">
                        <p className="text-gray-400 text-xs mb-0.5">نوع الخزان</p>
                        <p className="font-bold text-white text-xs sm:text-sm">خزان {wo.tank_type}</p>
                      </div>
                    </div>

                    {wo.notes && (
                      <div className="mb-3 text-xs text-gray-400 bg-white/5 p-2.5 rounded-xl">
                        ملاحظات السائق: {wo.notes}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                      <a
                        href={generateWhatsAppLink(
                          settings.water_contact_whatsapp || settings.contact_whatsapp || '0547382222',
                          `السلام عليكم، أود الاستفسار عن طلب الوايت رقم: ${wo.id.slice(0, 8)} (${wo.tanker_size_name}) للحي: ${wo.district}`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5"
                      >
                        <MessageCircle size={14} className="text-teal-400" />
                        <span>متابعة مع السائق / الإدارة</span>
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          // ── HERITAGE FURNITURE ORDERS TAB ──
          furnitureOrders.length === 0 ? (
            <div className="text-center py-16 card glass p-8">
              <div className="text-5xl mb-4">🪑</div>
              <h3 className="text-lg font-bold text-white mb-1">لا توجد طلبات أثاث مسجلة</h3>
              <p className="text-gray-400 text-sm mb-5">تصفح تشكيلة كراسي وأطقم الخيزران التراثي واطلب التوصيل لموقعك مباشرة</p>
              <a href="/#heritage-furniture" className="btn-primary inline-flex items-center gap-2 py-2.5 px-6">
                <ShoppingBag size={16} />
                <span>تصفح أثاث التراث</span>
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {furnitureOrders.map(fo => {
                const conf = FURNITURE_STATUS_CONFIG[fo.status] || {
                  label: fo.status,
                  badgeClass: 'bg-white/10 text-gray-300 border border-white/10',
                }
                return (
                  <div key={fo.id} className="card p-5 animate-fade-in-up border border-amber-500/20 hover:border-amber-500/40 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base">🪑</span>
                          <h3 className="font-bold text-white text-base">طلب أثاث: {fo.order_number}</h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <MapPin size={12} className="text-amber-400" />
                          <span>{fo.city} • {fo.district}</span>
                          {fo.street_address && <span>• {fo.street_address}</span>}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${conf.badgeClass}`}>
                        {conf.label}
                      </span>
                    </div>

                    {/* Items List */}
                    <div className="space-y-2 mb-4 bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-xs font-bold text-gray-400 mb-1">المنتجات المطلوبة:</p>
                      {fo.items && fo.items.length > 0 ? (
                        fo.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="text-gray-200">{it.name} <span className="text-amber-400 font-bold">× {it.quantity}</span></span>
                            <span className="font-bold text-amber-300">{formatCurrency(it.price * it.quantity)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400">عناصر الطلب</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                      <div className="glass p-2.5 rounded-xl border border-white/5">
                        <p className="text-gray-400 text-xs mb-0.5">المبلغ الإجمالي</p>
                        <p className="font-bold text-amber-300">{formatCurrency(fo.total_amount)}</p>
                      </div>
                      <div className="glass p-2.5 rounded-xl border border-white/5">
                        <p className="text-gray-400 text-xs mb-0.5">طريقة الاستلام والدفع</p>
                        <p className="font-bold text-white text-xs sm:text-sm">
                          {fo.delivery_type === 'pickup' ? 'استلام مستودع' : 'توصيل'} • {fo.payment_method === 'cash' ? 'كاش' : fo.payment_method === 'pos_on_delivery' ? 'شبكة' : 'تحويل'}
                        </p>
                      </div>
                    </div>

                    {fo.notes && (
                      <div className="mb-3 text-xs text-gray-400 bg-white/5 p-2.5 rounded-xl">
                        ملاحظات العميل: {fo.notes}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                      {fo.google_maps_url && (
                        <a
                          href={fo.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 text-blue-400"
                        >
                          <Navigation size={13} />
                          <span>عرض موقع التوصيل الخريطة</span>
                        </a>
                      )}

                      <a
                        href={generateWhatsAppLink(
                          settings.contact_whatsapp || '0547382222',
                          `السلام عليكم، أود الاستفسار عن طلب الأثاث التراثي رقم: ${fo.order_number} (الاسم: ${fo.customer_name})`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 text-emerald-400"
                      >
                        <MessageCircle size={14} />
                        <span>متابعة الطلب مع الإدارة</span>
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pb-safe">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setCancelModal(null)} />
          <div className="relative w-full max-w-md animate-scale-in card glass-strong p-6 sm:p-7 border border-white/15 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-3">تأكيد إلغاء الحجز</h3>

            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 mb-4 text-sm text-red-200 flex gap-2.5">
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-400" />
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
