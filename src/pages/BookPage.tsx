import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import BookingCalendar from '../components/BookingCalendar'
import AuthModal from '../components/AuthModal'
import {
  formatArabicDate, formatTime, formatCurrency, getPriceForDate,
  generateWhatsAppLink, buildBookingWhatsAppMessage,
  formatCheckInTime, formatCheckOutTime
} from '../lib/utils'
import { compressReceiptImage, formatFileSize } from '../lib/imageCompression'
import {
  Zap, Plus, Minus, Upload, Check, MessageCircle,
  ChevronDown, ChevronUp, AlertTriangle, Loader2, X, Info, LogIn,
  Eye, Image as ImageIcon, ChevronLeft, ChevronRight, Camera
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
  cover_image?: string | null
  images?: string[]
}

interface Addon {
  id: string
  name: string
  description: string
  price: number
  total_inventory: number
  icon: string
  image_url?: string | null
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
  const [galleryProperty, setGalleryProperty] = useState<Property | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [previewAddon, setPreviewAddon] = useState<Addon | null>(null)
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
    const checkInStr = (settings.default_check_in_time === '03:00:00' || settings.default_check_in_time === '03:00' || !settings.default_check_in_time) ? '15:30' : settings.default_check_in_time
    const [cih, cim] = checkInStr.split(':').map(Number)
    checkInDt.setHours(cih, cim, 0, 0)

    const checkOutDt = addDays(new Date(selectedDate), 1)
    const checkOutStr = (settings.default_check_out_time === '03:00:00' || settings.default_check_out_time === '03:00' || !settings.default_check_out_time) ? '11:30' : settings.default_check_out_time
    let [coh, com] = checkOutStr.split(':').map(Number)
    if (coh === 3 && com === 0) { coh = 11; com = 30 }
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
    const addonsListText = Object.values(addonSelections)
      .filter(s => s.quantity > 0)
      .map(s => `${s.addon.name} × ${s.quantity} (${formatCurrency(s.addon.price * s.quantity)})`)
      .join('، ')

    const waMsg = buildBookingWhatsAppMessage({
      customerName: profile?.full_name ?? 'العميل',
      customerPhone: profile?.phone ?? '',
      propertyName: selectedProperty.name,
      date: selectedDate,
      checkIn: settings.default_check_in_time,
      checkOut: settings.default_check_out_time,
      addonsListText,
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
                اختر الوحدة والاستراحة
              </h2>
              <div className="space-y-4">
                {properties.map(p => {
                  const photo = p.cover_image || (p.images && p.images[0]) || ''
                  const allImgs = Array.isArray(p.images) && p.images.length > 0 ? p.images : (photo ? [photo] : [])
                  const isSelected = selectedProperty?.id === p.id

                  return (
                    <div
                      key={p.id}
                      onClick={() => { setSelectedProperty(p); setSelectedDate(null) }}
                      className={`rounded-2xl border cursor-pointer transition-all overflow-hidden ${
                        isSelected
                          ? 'border-emerald-500/80 bg-emerald-500/10 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/30'
                          : 'border-white/10 hover:border-white/20 bg-slate-900/60'
                      }`}
                    >
                      {photo && (
                        <div className="relative h-48 sm:h-56 w-full bg-slate-950 overflow-hidden group">
                          <img
                            src={photo}
                            alt={p.name}
                            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80'
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                          {/* Gallery View Button */}
                          {allImgs.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setGalleryProperty(p)
                                setGalleryIndex(0)
                              }}
                              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl text-xs font-bold bg-black/80 hover:bg-black text-emerald-300 border border-emerald-500/40 backdrop-blur-md flex items-center gap-1.5 shadow-lg transition-transform hover:scale-105 active:scale-95"
                            >
                              <Camera size={14} />
                              <span>معرض الصور ({allImgs.length} صور) 📸</span>
                            </button>
                          )}

                          {isSelected && (
                            <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-slate-950 shadow-md flex items-center gap-1">
                              <Check size={13} />
                              تم الاختيار
                            </div>
                          )}
                        </div>
                      )}

                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-white text-base sm:text-lg">{p.name}</h3>
                          <div className="text-right">
                            <span className="text-emerald-400 font-bold text-base">{formatCurrency(p.weekday_price)}</span>
                            <span className="text-gray-400 text-xs"> / أيام عادية</span>
                          </div>
                        </div>

                        {p.description && <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">{p.description}</p>}

                        {/* Thumbnails preview strip */}
                        {allImgs.length > 1 && (
                          <div className="flex items-center gap-2 pt-1 overflow-x-auto no-scrollbar">
                            {allImgs.map((img, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setGalleryProperty(p)
                                  setGalleryIndex(i)
                                }}
                                className="w-12 h-10 rounded-lg overflow-hidden border border-white/10 hover:border-emerald-400/50 flex-shrink-0 transition-transform hover:scale-105"
                              >
                                <img src={img} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                            <span className="text-[11px] text-emerald-400 font-semibold flex-shrink-0">
                              + انقر لتكبير الصور
                            </span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                          <div className="flex flex-wrap gap-1.5">
                            {p.amenities.slice(0, 5).map((a, i) => (
                              <span key={i} className="text-xs glass px-2.5 py-0.5 rounded-full text-gray-300">{a}</span>
                            ))}
                          </div>
                          <span className="text-xs text-amber-300/90 font-medium">
                            عطل الأسبوع: {formatCurrency(p.weekend_price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
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
                    <div key={addon.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/4 border border-white/8 hover:border-white/15 transition-all">
                      <div className="flex items-center gap-3">
                        {addon.image_url ? (
                          <div
                            onClick={() => setPreviewAddon(addon)}
                            className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-950 border border-white/15 cursor-pointer group flex-shrink-0"
                            title="انقر لمعاينة صورة الإضافة"
                          >
                            <img src={addon.image_url} alt={addon.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                              <Eye size={14} className="text-white drop-shadow opacity-80 group-hover:opacity-100" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 flex-shrink-0">
                            {getIconComponent(addon.icon)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white">{addon.name}</p>
                            {addon.image_url && (
                              <button
                                type="button"
                                onClick={() => setPreviewAddon(addon)}
                                className="text-[11px] text-teal-300 hover:text-teal-200 underline flex items-center gap-0.5"
                              >
                                معاينة الصورة
                              </button>
                            )}
                          </div>
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
                            <div className="text-xs text-gray-400 space-y-1.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400">⏰ وقت الوصول:</span>
                                <span className="text-emerald-400 font-bold">{formatCheckInTime(settings.default_check_in_time)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400">⏰ وقت المغادرة:</span>
                                <span className="text-emerald-400 font-bold">{formatCheckOutTime(settings.default_check_out_time)} (اليوم التالي)</span>
                              </div>
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

      {/* Property Multi-Image Lightbox Modal */}
      {galleryProperty && (() => {
        const photos = Array.isArray(galleryProperty.images) && galleryProperty.images.length > 0
          ? galleryProperty.images
          : (galleryProperty.cover_image ? [galleryProperty.cover_image] : [])
        const currentPhoto = photos[galleryIndex] || photos[0]

        return (
          <div
            onClick={() => setGalleryProperty(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl w-full rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-slate-950 flex flex-col"
            >
              {/* Header */}
              <div className="p-4 bg-slate-900/90 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Camera size={18} className="text-emerald-400" />
                    <span>{galleryProperty.name} — معرض الصور</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    صورة {galleryIndex + 1} من {photos.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGalleryProperty(null)}
                  className="glass p-2 rounded-xl text-gray-300 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main Image Display with Navigation Arrows */}
              <div className="relative h-[50vh] sm:h-[65vh] bg-black flex items-center justify-center overflow-hidden">
                <img
                  src={currentPhoto}
                  alt={galleryProperty.name}
                  className="max-w-full max-h-full object-contain select-none"
                />

                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setGalleryIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full glass hover:bg-white/20 text-white flex items-center justify-center shadow-xl transition-transform hover:scale-110 active:scale-95"
                      aria-label="الصورة السابقة"
                    >
                      <ChevronRight size={22} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0))}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full glass hover:bg-white/20 text-white flex items-center justify-center shadow-xl transition-transform hover:scale-110 active:scale-95"
                      aria-label="الصورة التالية"
                    >
                      <ChevronLeft size={22} />
                    </button>
                  </>
                )}
              </div>

              {/* Bottom Thumbnails Strip */}
              {photos.length > 1 && (
                <div className="p-3 bg-slate-900/90 border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {photos.map((pUrl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setGalleryIndex(i)}
                      className={`relative w-16 h-12 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                        galleryIndex === i
                          ? 'border-emerald-400 ring-2 ring-emerald-400/30 scale-105'
                          : 'border-white/10 hover:border-white/30 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={pUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Addon Preview Lightbox Modal */}
      {previewAddon && (
        <div
          onClick={() => setPreviewAddon(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-slate-950 flex flex-col animate-scale-in"
          >
            <div className="relative h-64 w-full bg-slate-900 overflow-hidden">
              <img
                src={previewAddon.image_url || ''}
                alt={previewAddon.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
              <button
                type="button"
                onClick={() => setPreviewAddon(null)}
                className="absolute top-3 left-3 glass p-2 rounded-xl text-white hover:bg-black/60 shadow-lg"
              >
                <X size={18} />
              </button>
              <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950 shadow-md">
                معاينة الإضافة
              </div>
            </div>

            <div className="p-5 space-y-3 text-right">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white">{previewAddon.name}</h3>
                <span className="text-emerald-400 font-black text-lg">{formatCurrency(previewAddon.price)}</span>
              </div>
              {previewAddon.description && (
                <p className="text-sm text-gray-300 leading-relaxed">{previewAddon.description}</p>
              )}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewAddon(null)}
                  className="btn-primary w-full py-2.5 text-sm font-bold"
                >
                  إغلاق المعاينة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  )
}

export default BookPage
