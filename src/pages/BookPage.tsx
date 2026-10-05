import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import BookingCalendar from '../components/BookingCalendar'
import AuthModal from '../components/AuthModal'
import {
  formatArabicDate, formatTime, formatCurrency, getPriceForDate,
  generateWhatsAppLink, buildBookingWhatsAppMessage
} from '../lib/utils'
import { compressReceiptImage, formatFileSize } from '../lib/imageCompression'
import {
  Zap, Plus, Minus, Upload, Check, MessageCircle,
  ChevronDown, ChevronUp, AlertTriangle, Loader2, X, Info, LogIn
} from 'lucide-react'
import { format, addDays } from 'date-fns'

interface Settings {
  deposit_percentage: number
  default_check_in_time: string
  default_check_out_time: string
  bank_name: string
  bank_account_name: string
  bank_iban: string
}

interface Property {
  id: string
  name: string
  description: string
  weekday_price: number
  weekend_price: number
  amenities: string[]
  max_guests: number
}

interface Addon {
  id: string
  name: string
  description: string
  price: number
  total_inventory: number
  icon: string
  is_active: boolean
}

interface AddonSelection {
  addon: Addon
  quantity: number
  available: number
}

const BookPage: React.FC = () => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [settings, setSettings] = useState<Settings | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [addonSelections, setAddonSelections] = useState<Record<string, AddonSelection>>({})
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash_on_arrival'>('bank_transfer')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: s }, { data: p }, { data: a }] = await Promise.all([
        supabase.from('resort_settings').select('*').eq('id', 1).single(),
        supabase.from('properties').select('*').eq('is_active', true).order('name'),
        supabase.from('addons').select('*').eq('is_active', true),
      ])
      if (s) setSettings(s)
      if (p) { setProperties(p); if (p.length === 1) setSelectedProperty(p[0]) }
      if (a) setAddons(a)
    }
    load()
  }, [])

  // Fetch addon availability for selected date
  useEffect(() => {
    if (!selectedDate || addons.length === 0) return
    const dateStr = format(selectedDate, 'yyyy-MM-dd')

    const fetchAvailability = async () => {
      const { data: existingBookings } = await supabase
        .from('booking_addons')
        .select('addon_id, quantity, bookings!inner(booking_date, status)')
        .eq('bookings.booking_date', dateStr)
        .in('bookings.status', ['confirmed', 'pending_receipt', 'pending_verification'])

      const usedMap: Record<string, number> = {}
      if (existingBookings) {
        existingBookings.forEach((row: any) => {
          usedMap[row.addon_id] = (usedMap[row.addon_id] ?? 0) + row.quantity
        })
      }

      const newSelections: Record<string, AddonSelection> = {}
      addons.forEach(addon => {
        const used = usedMap[addon.id] ?? 0
        const available = Math.max(0, addon.total_inventory - used)
        newSelections[addon.id] = {
          addon,
          quantity: Math.min(addonSelections[addon.id]?.quantity ?? 0, available),
          available,
        }
      })
      setAddonSelections(newSelections)
    }
    fetchAvailability()
  }, [selectedDate, addons])

  const basePrice = selectedDate && selectedProperty
    ? getPriceForDate(selectedDate, selectedProperty.weekday_price, selectedProperty.weekend_price)
    : 0
  const addonsTotal = Object.values(addonSelections).reduce(
    (sum, sel) => sum + sel.quantity * sel.addon.price, 0
  )
  const totalAmount = basePrice + addonsTotal
  const depositAmount = settings ? Math.ceil(totalAmount * (settings.deposit_percentage / 100)) : 0
  const remaining = totalAmount - depositAmount

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCompressing(true)
    try {
      const compressed = await compressReceiptImage(file)
      setReceiptFile(compressed)
      const url = URL.createObjectURL(compressed)
      setReceiptPreview(url)
    } catch {
      setError('فشل في معالجة الصورة، حاول مرة أخرى')
    }
    setCompressing(false)
  }

  const handleSubmit = async () => {
    if (!user || !profile) { setError('يجب تسجيل الدخول أولاً'); return }
    if (!selectedProperty || !selectedDate || !settings) return

    if (profile.is_blacklisted) { setError('حسابك موقوف. تواصل مع الإدارة.'); return }

    // Flagged customers must pay via bank transfer
    if (profile.is_flagged && paymentMethod === 'cash_on_arrival') {
      setError('بسبب سجل الإلغاءات، يجب الدفع الكامل بالتحويل البنكي')
      return
    }

    if (paymentMethod === 'bank_transfer' && !receiptFile) {
      setError('يجب رفع إيصال التحويل البنكي')
      return
    }

    setSubmitting(true)
    setError(null)

    const checkInDt = new Date(selectedDate)
    const [cih, cim] = settings.default_check_in_time.split(':').map(Number)
    checkInDt.setHours(cih, cim, 0, 0)

    const checkOutDt = addDays(new Date(selectedDate), 1)
    const [coh, com] = settings.default_check_out_time.split(':').map(Number)
    checkOutDt.setHours(coh, com, 0, 0)

    try {
      // 1. Create booking
      const { data: booking, error: bookingErr } = await supabase
        .from('bookings')
        .insert({
          property_id: selectedProperty.id,
          customer_id: user.id,
          customer_name: profile.full_name,
          customer_phone: profile.phone,
          booking_date: format(selectedDate, 'yyyy-MM-dd'),
          check_in: checkInDt.toISOString(),
          check_out: checkOutDt.toISOString(),
          total_amount: totalAmount,
          deposit_amount: depositAmount,
          payment_method: paymentMethod,
          status: paymentMethod === 'bank_transfer' ? 'pending_receipt' : 'pending_receipt',
        })
        .select()
        .single()

      if (bookingErr) {
        if (bookingErr.code === '23505') {
          setError('هذا التاريخ محجوز بالفعل، الرجاء اختيار تاريخ آخر')
        } else {
          setError(bookingErr.message)
        }
        setSubmitting(false)
        return
      }

      // 2. Insert addon bookings
      const addonRows = Object.values(addonSelections)
        .filter(s => s.quantity > 0)
        .map(s => ({
          booking_id: booking.id,
          addon_id: s.addon.id,
          quantity: s.quantity,
          unit_price: s.addon.price,
        }))

      if (addonRows.length > 0) {
        await supabase.from('booking_addons').insert(addonRows)
      }

      // 3. Upload receipt if bank transfer
      let receiptUrl: string | null = null
      if (paymentMethod === 'bank_transfer' && receiptFile) {
        const path = `${booking.id}/receipt.webp`
        const { error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(path, receiptFile, { contentType: 'image/webp', upsert: true })

        if (!uploadErr) {
          receiptUrl = path
          await supabase
            .from('bookings')
            .update({ payment_receipt_url: path, status: 'pending_verification' })
            .eq('id', booking.id)
        }
      }

      setBookingId(booking.id)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message ?? 'حدث خطأ، حاول مرة أخرى')
    }
    setSubmitting(false)
  }

  const adjustAddon = (addonId: string, delta: number) => {
    setAddonSelections(prev => {
      const sel = prev[addonId]
      if (!sel) return prev
      const newQty = Math.min(Math.max(0, sel.quantity + delta), sel.available)
      return { ...prev, [addonId]: { ...sel, quantity: newQty } }
    })
  }

  const getIconComponent = (iconName: string) => {
    if (iconName === 'Zap') return <Zap size={20} />
    return <span>{iconName}</span>
  }

  if (success && bookingId && settings && selectedProperty && selectedDate) {
    const waMsg = buildBookingWhatsAppMessage({
      propertyName: selectedProperty.name,
      customerName: profile?.full_name ?? '',
      date: formatArabicDate(selectedDate),
      checkIn: formatTime(settings.default_check_in_time),
      checkOut: formatTime(settings.default_check_out_time),
      totalAmount,
      depositAmount,
      paymentMethod,
    })

    return (
      <div className="min-h-screen flex items-center justify-center p-4 pt-20">
        <div className="max-w-md w-full animate-scale-in">
          <div className="card glass-strong p-8 text-center border border-emerald-500/30">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">تم استلام حجزك! 🎉</h2>
            <p className="text-gray-400 mb-6">
              {paymentMethod === 'bank_transfer'
                ? 'سيتم مراجعة إيصال التحويل وتأكيد الحجز خلال ساعات'
                : 'سيتم التواصل معك لتأكيد الحجز ودفع العربون'}
            </p>
            <div className="bg-white/4 rounded-xl p-4 mb-6 text-right space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-emerald-400 font-bold">{formatCurrency(totalAmount)}</span>
                <span className="text-gray-400">الإجمالي</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-400 font-bold">{formatCurrency(depositAmount)}</span>
                <span className="text-gray-400">العربون ({settings.deposit_percentage}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300 font-bold">{formatCurrency(remaining)}</span>
                <span className="text-gray-400">المتبقي</span>
              </div>
            </div>
            <a
              href={generateWhatsAppLink('0547382222', waMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold w-full mb-3"
            >
              <MessageCircle size={18} />
              إرسال التأكيد عبر واتساب
            </a>
            <button onClick={() => navigate('/my-bookings')} className="btn-ghost w-full">
              عرض حجوزاتي
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white mb-2">احجز استراحتك</h1>
          <p className="text-gray-400">اختر الوحدة والتاريخ المناسب لك</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === s ? 'bg-emerald-500 text-white' :
                step > s ? 'bg-emerald-500/30 text-emerald-400' :
                'bg-white/10 text-gray-500'
              }`}>
                {step > s ? <Check size={14} /> : s}
              </div>
              {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-emerald-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Property Selection */}
            <div className="card p-5">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold flex items-center justify-center">1</span>
                اختر الوحدة
              </h2>
              <div className="space-y-3">
                {properties.map(p => (
                  <div
                    key={p.id}
                    onClick={() => { setSelectedProperty(p); setSelectedDate(null) }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedProperty?.id === p.id
                        ? 'border-emerald-500/60 bg-emerald-500/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-white">{p.name}</h3>
                      <div className="text-right">
                        <span className="text-emerald-400 font-bold text-sm">{formatCurrency(p.weekday_price)}</span>
                        <span className="text-gray-500 text-xs"> / أيام عادية</span>
                      </div>
                    </div>
                    {p.description && <p className="text-gray-400 text-sm">{p.description}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.amenities.slice(0, 5).map((a, i) => (
                        <span key={i} className="text-xs glass px-2 py-0.5 rounded-full text-gray-300">{a}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2: Date Selection */}
            {selectedProperty && (
              <div className="animate-fade-in-up">
                <div className="card p-5">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold flex items-center justify-center">2</span>
                    اختر التاريخ
                  </h2>
                  <BookingCalendar
                    propertyId={selectedProperty.id}
                    weekdayPrice={selectedProperty.weekday_price}
                    weekendPrice={selectedProperty.weekend_price}
                    onDateSelect={setSelectedDate}
                    selectedDate={selectedDate}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Addons */}
            {selectedDate && addons.length > 0 && (
              <div className="animate-fade-in-up card p-5">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold flex items-center justify-center">3</span>
                  إضافات اختيارية
                </h2>
                <div className="space-y-3">
                  {Object.values(addonSelections).map(({ addon, quantity, available }) => (
                    <div key={addon.id} className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400">
                          {getIconComponent(addon.icon)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{addon.name}</p>
                          <p className="text-xs text-gray-400">
                            {formatCurrency(addon.price)} / قطعة
                            {available === 0 ? (
                              <span className="text-red-400 mr-2">— غير متاح</span>
                            ) : (
                              <span className="text-gray-500 mr-2">— متاح: {available}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => adjustAddon(addon.id, -1)}
                          disabled={quantity === 0}
                          className="w-10 h-10 rounded-xl glass flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          aria-label="تقليل الكمية"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-8 text-center text-white font-bold text-base">{quantity}</span>
                        <button
                          onClick={() => adjustAddon(addon.id, 1)}
                          disabled={quantity >= available}
                          className="w-10 h-10 rounded-xl glass flex items-center justify-center hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          aria-label="زيادة الكمية"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Method */}
            {selectedDate && settings && (
              <div className="animate-fade-in-up card p-5">
                <h2 className="text-lg font-bold text-white mb-4">طريقة الدفع</h2>

                {profile?.is_flagged && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex gap-2 text-sm text-amber-300">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>بسبب سجل الإلغاءات، يجب الدفع الكامل بالتحويل البنكي</span>
                  </div>
                )}

                <div className="space-y-3 mb-4">
                  <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'bank_transfer' ? 'border-emerald-500/50 bg-emerald-500/8' : 'border-white/10 hover:border-white/20'
                  }`}>
                    <input
                      type="radio"
                      name="payment"
                      value="bank_transfer"
                      checked={paymentMethod === 'bank_transfer'}
                      onChange={() => setPaymentMethod('bank_transfer')}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-semibold text-white">تحويل بنكي</p>
                      <p className="text-sm text-gray-400">حول العربون وارفع الإيصال</p>
                      {paymentMethod === 'bank_transfer' && (
                        <div className="mt-3 p-3 rounded-lg bg-white/5 text-sm space-y-1">
                          <p className="text-gray-300">🏦 البنك: <span className="text-white font-medium">{settings.bank_name}</span></p>
                          <p className="text-gray-300">👤 المستفيد: <span className="text-white font-medium">{settings.bank_account_name}</span></p>
                          <p className="text-gray-300 font-mono" dir="ltr">IBAN: {settings.bank_iban}</p>
                        </div>
                      )}
                    </div>
                  </label>

                  {!profile?.is_flagged && (
                    <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === 'cash_on_arrival' ? 'border-amber-500/50 bg-amber-500/8' : 'border-white/10 hover:border-white/20'
                    }`}>
                      <input
                        type="radio"
                        name="payment"
                        value="cash_on_arrival"
                        checked={paymentMethod === 'cash_on_arrival'}
                        onChange={() => setPaymentMethod('cash_on_arrival')}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-semibold text-white">نقداً عند الوصول</p>
                        <p className="text-sm text-gray-400">ادفع عند وصولك (يتطلب تحويل العربون مسبقاً)</p>
                      </div>
                    </label>
                  )}
                </div>

                {/* Receipt Upload */}
                {paymentMethod === 'bank_transfer' && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">رفع إيصال التحويل</p>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                        receiptPreview ? 'border-emerald-500/40' : 'border-white/15 hover:border-white/30'
                      }`}
                    >
                      {compressing ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 size={24} className="text-emerald-400 animate-spin" />
                          <p className="text-sm text-gray-400">جاري ضغط الصورة...</p>
                        </div>
                      ) : receiptPreview ? (
                        <div className="flex flex-col items-center gap-2">
                          <img src={receiptPreview} alt="إيصال" className="max-h-32 rounded-lg object-contain" />
                          <p className="text-xs text-emerald-400">
                            ✓ تم التحميل • {receiptFile && formatFileSize(receiptFile.size)}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload size={24} className="text-gray-500" />
                          <p className="text-sm text-gray-400">اضغط لرفع إيصال التحويل</p>
                          <p className="text-xs text-gray-600">PNG، JPG، WebP — يُضغط تلقائياً</p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleReceiptUpload}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-20">
              <h3 className="font-bold text-white mb-4">ملخص الحجز</h3>

              {!selectedProperty && (
                <p className="text-sm text-gray-500 text-center py-4">اختر وحدة أولاً</p>
              )}

              {selectedProperty && (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{selectedProperty.name}</span>
                    <span className="text-white font-medium">{selectedDate ? formatCurrency(basePrice) : '—'}</span>
                  </div>

                  {selectedDate && (
                    <div className="text-xs text-gray-500 -mt-2">
                      {formatArabicDate(selectedDate)}
                    </div>
                  )}

                  {addonsTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">الإضافات</span>
                      <span className="text-amber-400 font-medium">+{formatCurrency(addonsTotal)}</span>
                    </div>
                  )}

                  {selectedDate && (
                    <>
                      <div className="divider" />
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">الإجمالي</span>
                        <span className="text-white font-bold">{formatCurrency(totalAmount)}</span>
                      </div>

                      {settings && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">العربون ({settings.deposit_percentage}%)</span>
                            <span className="text-amber-400 font-bold">{formatCurrency(depositAmount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">المتبقي</span>
                            <span className="text-gray-300 font-bold">{formatCurrency(remaining)}</span>
                          </div>

                          <div className="text-xs text-gray-500 p-2 rounded-lg bg-white/3 flex gap-1.5">
                            <Info size={12} className="flex-shrink-0 mt-0.5" />
                            <span>العربون غير مسترد في حالة الإلغاء</span>
                          </div>

                          {settings && (
                            <div className="text-xs text-gray-500 space-y-1">
                              <div>⏰ الوصول: <span className="text-gray-300">{formatTime(settings.default_check_in_time)}</span></div>
                              <div>⏰ المغادرة: <span className="text-gray-300">{formatTime(settings.default_check_out_time)} (اليوم التالي)</span></div>
                            </div>
                          )}
                        </>
                      )}

                      {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex gap-2">
                          <X size={12} className="flex-shrink-0 mt-0.5" />
                          {error}
                        </div>
                      )}

                      {!user ? (
                        <button
                          onClick={() => setAuthModalOpen(true)}
                          className="btn-primary w-full min-h-[48px] text-base font-bold shadow-lg shadow-emerald-600/30"
                        >
                          <LogIn size={18} />
                          سجّل الدخول للحجز
                        </button>
                      ) : (
                        <button
                          onClick={handleSubmit}
                          disabled={submitting}
                          className="btn-primary w-full min-h-[48px] text-base font-bold shadow-lg shadow-emerald-600/30"
                        >
                          {submitting ? (
                            <><Loader2 size={18} className="animate-spin" /> جاري الحجز...</>
                          ) : 'تأكيد الحجز'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  )
}

export default BookPage
