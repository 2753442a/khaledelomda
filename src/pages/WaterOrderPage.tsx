import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, generateWhatsAppLink } from '../lib/utils'
import { WaterLocationPicker } from '../components/WaterLocationPicker'
import {
  Droplets, MapPin, Navigation, Phone, User, CheckCircle2,
  AlertCircle, Loader2, MessageCircle, Home, ShieldCheck,
  CreditCard, Banknote, ArrowRight, Sparkles, Clock, Check
} from 'lucide-react'

interface TankerSize {
  id: string
  name: string
  capacity_label: string
  price: number
  is_active: boolean
  display_order: number
}

const DEFAULT_SIZES: TankerSize[] = [
  {
    id: 'default-medium',
    name: 'وايت عايدي (حجم متوسط)',
    capacity_label: '12 طن - 12,000 لتر',
    price: 120,
    is_active: true,
    display_order: 1,
  },
  {
    id: 'default-large',
    name: 'وايت تريلا (حجم كبير)',
    capacity_label: '30 طن - 30,000 لتر',
    price: 250,
    is_active: true,
    display_order: 2,
  },
]

export const WaterOrderPage: React.FC = () => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [sizes, setSizes] = useState<TankerSize[]>([])
  const [selectedSizeId, setSelectedSizeId] = useState<string>('')
  const [loadingSizes, setLoadingSizes] = useState(true)

  // Form fields
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [district, setDistrict] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [tankType, setTankType] = useState<'أرضي' | 'علوي' | 'كلاهما'>('أرضي')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pos_on_delivery' | 'bank_transfer'>('cash')
  const [notes, setNotes] = useState('')

  // Geolocation state (managed partially by WaterLocationPicker)
  const [googleMapsUrl, setGoogleMapsUrl] = useState<string | null>(null)

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [createdOrder, setCreatedOrder] = useState<any | null>(null)

  // Pre-fill user data
  useEffect(() => {
    if (profile) {
      if (profile.full_name) setCustomerName(profile.full_name)
      if (profile.phone) setCustomerPhone(profile.phone)
    }
  }, [profile])

  // Fetch tanker sizes from Supabase
  useEffect(() => {
    const fetchSizes = async () => {
      setLoadingSizes(true)
      try {
        const { data, error } = await supabase
          .from('water_tanker_sizes')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true })

        if (error || !data || data.length === 0) {
          setSizes(DEFAULT_SIZES)
          setSelectedSizeId(DEFAULT_SIZES[0].id)
        } else {
          setSizes(data as TankerSize[])
          setSelectedSizeId(data[0].id)
        }
      } catch (err) {
        setSizes(DEFAULT_SIZES)
        setSelectedSizeId(DEFAULT_SIZES[0].id)
      } finally {
        setLoadingSizes(false)
      }
    }

    fetchSizes()
  }, [])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  // Location callback from WaterLocationPicker (interactive map)
  const handleLocationChange = useCallback(
    (data: { lat: number; lng: number; googleMapsUrl: string; district: string; streetAddress: string }) => {
      setGoogleMapsUrl(data.googleMapsUrl)
      if (data.district && !district) setDistrict(data.district)
      if (data.streetAddress && !streetAddress) setStreetAddress(data.streetAddress)
      showToast('تم تحديد الموقع بنجاح ✅')
    },
    [district, streetAddress]
  )

  const selectedSize = sizes.find(s => s.id === selectedSizeId) || sizes[0]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!selectedSize) {
      setErrorMsg('يرجى اختيار حجم الوايت')
      return
    }

    if (!customerName.trim()) {
      setErrorMsg('يرجى إدخال اسم العميل')
      return
    }

    if (!customerPhone.trim()) {
      setErrorMsg('يرجى إدخال رقم الجوال للتواصل والتوصيل')
      return
    }

    if (!district.trim()) {
      setErrorMsg('يرجى كتابة اسم الحي لتوجيه السائق')
      return
    }

    setSubmitting(true)

    try {
      const orderPayload = {
        customer_id: user?.id || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        tanker_size_id: selectedSize.id.startsWith('default-') ? null : selectedSize.id,
        tanker_size_name: selectedSize.name,
        tanker_price: selectedSize.price,
        district: district.trim(),
        street_address: streetAddress.trim() || null,
        google_maps_url: googleMapsUrl || null,
        tank_type: tankType,
        payment_method: paymentMethod,
        status: 'new' as const,
        notes: notes.trim() || null,
      }

      const { data, error } = await supabase
        .from('water_orders')
        .insert([orderPayload])
        .select()
        .single()

      if (error) {
        // Even if table not created yet in Supabase, create local order object for WhatsApp dispatch
        console.warn('Supabase insert notice:', error)
        setCreatedOrder({
          ...orderPayload,
          id: `WO-${Date.now().toString().slice(-6)}`,
          created_at: new Date().toISOString(),
        })
      } else {
        setCreatedOrder(data)
      }
    } catch (err: any) {
      setCreatedOrder({
        customer_name: customerName,
        customer_phone: customerPhone,
        tanker_size_name: selectedSize.name,
        tanker_price: selectedSize.price,
        district: district,
        street_address: streetAddress,
        google_maps_url: googleMapsUrl,
        tank_type: tankType,
        payment_method: paymentMethod,
        notes: notes,
        id: `WO-${Date.now().toString().slice(-6)}`,
        created_at: new Date().toISOString(),
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Pre-filled WhatsApp message for driver dispatch
  const getWhatsAppMessage = (order: any) => {
    const paymentLabel = order.payment_method === 'cash'
      ? 'نقداً عند التفريغ'
      : order.payment_method === 'pos_on_delivery'
      ? 'شبكة (مدى) عند الوصول'
      : 'تحويل بنكي مسبق'

    return `💧 *طلب وايت ماء حلو جديد* 💧
📋 *تفاصيل الطلب:*
ــــــــــــــــــــــــــــــــــــــــ
👤 *العميل:* ${order.customer_name}
📱 *الجوال:* ${order.customer_phone}
🚚 *حجم الوايت:* ${order.tanker_size_name}
💵 *السعر المطلوب:* ${formatCurrency(order.tanker_price)}
📍 *الحي:* ${order.district}
${order.street_address ? `🏠 *العنوان / الشارع:* ${order.street_address}\n` : ''}🎯 *نوع الخزان:* ${order.tank_type}
💳 *طريقة الدفع:* ${paymentLabel}
${order.google_maps_url ? `🗺️ *رابط الموقع (GPS):*\n${order.google_maps_url}\n` : ''}ــــــــــــــــــــــــــــــــــــــــ
${order.notes ? `📝 *ملاحظات إضافية:* ${order.notes}\nــــــــــــــــــــــــــــــــــــــــ\n` : ''}🌟 نرجو سرعة توجيه الوايت والتوصيل!`
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white pt-20 pb-16 px-4 sm:px-6 lg:px-8 selection:bg-teal-500 selection:text-white">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900 border border-teal-500/40 text-white shadow-2xl text-sm font-semibold flex items-center gap-2 animate-fade-in-up">
          <Droplets size={16} className="text-teal-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb / Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-400 hover:text-emerald-400 transition-colors"
          >
            <ArrowRight size={16} />
            <span>العودة للرئيسية</span>
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-semibold">
            <Clock size={13} />
            <span>توصيل سريع 24/7</span>
          </div>
        </div>

        {/* Hero Header */}
        <div className="relative rounded-3xl overflow-hidden p-6 sm:p-10 mb-8 border border-teal-500/30 bg-gradient-to-br from-teal-950/70 via-slate-950 to-emerald-950/50 shadow-2xl">
          <div className="absolute -top-10 -right-10 w-60 h-60 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-bold">
                <Droplets size={14} />
                <span>مياه عذبة نقية صالحة للشرب والاستخدام</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                طلب وايت ماء حلو <span className="bg-gradient-to-r from-teal-300 via-emerald-300 to-amber-200 bg-clip-text text-transparent">للمنازل والاستراحات</span>
              </h1>
              <p className="text-gray-300 text-xs sm:text-sm max-w-xl leading-relaxed">
                خدمة توصيل فورية على مدار 24 ساعة بأحجام متعددة تناسب جميع الخزانات الأرضية والعلوية، مع دقة في الوصول عبر الموقع الجغرافي المباشر.
              </p>
            </div>

            <div className="flex sm:flex-col gap-2 shrink-0">
              <a
                href={generateWhatsAppLink('0547382222', 'السلام عليكم، أود طلب وايت ماء حلو')}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageCircle size={15} />
                <span>واتساب مباشر</span>
              </a>
              <a
                href="tel:0543034553"
                className="px-4 py-2.5 rounded-xl glass hover:bg-white/10 text-gray-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone size={14} className="text-teal-400" />
                <span dir="ltr">0543034553</span>
              </a>
            </div>
          </div>
        </div>

        {/* Order Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Tanker Size Selection */}
          <div className="card p-6 sm:p-8 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/8">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">اختر حجم وسعة الوايت المطلوبة</h3>
                <p className="text-xs text-gray-400">حدد الحجم المناسب لسعة خزان منزلك أو استراحتك</p>
              </div>
            </div>

            {loadingSizes ? (
              <div className="py-8 flex items-center justify-center">
                <Loader2 size={28} className="text-teal-400 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {sizes.map((size) => {
                  const isSelected = selectedSizeId === size.id
                  return (
                    <div
                      key={size.id}
                      onClick={() => setSelectedSizeId(size.id)}
                      className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all duration-300 flex flex-col justify-between gap-4 ${
                        isSelected
                          ? 'border-teal-400 bg-teal-500/15 shadow-xl shadow-teal-500/10 scale-[1.02]'
                          : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🚚</span>
                            <h4 className="font-bold text-white text-base">{size.name}</h4>
                          </div>
                          <p className="text-xs sm:text-sm text-teal-300 font-medium">
                            السعة: {size.capacity_label}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-teal-400 bg-teal-400 text-slate-950' : 'border-gray-500'
                        }`}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between pt-2 border-t border-white/5">
                        <span className="text-xs text-gray-400">السعر شامل التوصيل:</span>
                        <span className="text-xl font-black text-amber-300">{formatCurrency(size.price)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Step 2: Customer Contact Info */}
          <div className="card p-6 sm:p-8 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/8">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">بيانات التواصل للطلب</h3>
                <p className="text-xs text-gray-400">لتأكيد موعد الوصول والتواصل المباشر مع السائق</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  الاسم الكريم <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="مثال: خالد العبدالله"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="input-field pr-10 min-h-[48px]"
                  />
                  <User size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  رقم الجوال <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="05XXXXXXXX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="input-field pr-10 min-h-[48px] text-right font-mono"
                    dir="ltr"
                  />
                  <Phone size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Location & Geolocation */}
          <div className="card p-6 sm:p-8 border border-white/10 shadow-xl space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/8">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">تحديد موقع التوصيل (Smart GPS)</h3>
                <p className="text-xs text-gray-400">شارك موقعك الجغرافي بنقرة واحدة لضمان سرعة وصول السائق</p>
              </div>
            </div>

            {/* Interactive Map (Leaflet) */}
            <WaterLocationPicker
              onLocationChange={handleLocationChange}
              initialDistrict={district}
              initialStreetAddress={streetAddress}
            />

            {/* District & Street */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  اسم الحي <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: حي الروضة، حي الفاخرية، حي الأفق..."
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="input-field min-h-[48px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  الشارع / رقم المنزل / علامة مميزة (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: شارع الثلاثين، بجوار جامع التقوى، فيلا رقم 12"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="input-field min-h-[48px]"
                />
              </div>
            </div>

            {/* Tank Type Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                نوع الخزان المراد تفريغ الماء فيه:
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['أرضي', 'علوي', 'كلاهما'] as const).map((type) => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setTankType(type)}
                    className={`py-3 px-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                      tankType === type
                        ? 'border-teal-400 bg-teal-500/20 text-teal-300 shadow-md'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                    }`}
                  >
                    خزان {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 4: Payment Method & Notes */}
          <div className="card p-6 sm:p-8 border border-white/10 shadow-xl space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/8">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">طريقة الدفع والملاحظات</h3>
                <p className="text-xs text-gray-400">اختر طريقة الدفع المناسبة لك عند التوصيل</p>
              </div>
            </div>

            {/* Payment Method Radio Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'cash', label: 'نقداً عند التفريغ', icon: <Banknote size={18} className="text-emerald-400" /> },
                { id: 'pos_on_delivery', label: 'شبكة (مدى) عند الوصول', icon: <CreditCard size={18} className="text-blue-400" /> },
                { id: 'bank_transfer', label: 'تحويل بنكي مسبق', icon: <ShieldCheck size={18} className="text-amber-400" /> },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={`cursor-pointer rounded-2xl p-4 border transition-all flex items-center gap-3 ${
                    paymentMethod === m.id
                      ? 'border-teal-400 bg-teal-500/15 text-white shadow-md'
                      : 'border-white/10 bg-white/3 text-gray-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                    {m.icon}
                  </div>
                  <span className="text-xs sm:text-sm font-semibold">{m.label}</span>
                </div>
              ))}
            </div>

            {/* Bank Transfer Info Box */}
            {paymentMethod === 'bank_transfer' && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm space-y-1.5">
                <p className="font-bold text-amber-300">بيانات التحويل البنكي (مصرف الراجحي):</p>
                <p className="text-gray-300">اسم الحساب: خالد العمدة</p>
                <p className="font-mono text-amber-200" dir="ltr">SA0000000000000000000000</p>
                <p className="text-[11px] text-gray-400">يرجى إرسال إشعار التحويل عبر الواتساب فور إرسال الطلب.</p>
              </div>
            )}

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                ملاحظات إضافية للسائق (اختياري)
              </label>
              <textarea
                rows={2}
                placeholder="مثال: الباب الخلفي مفتوح، الاتصال عند الوصول..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm flex items-center gap-2 animate-fade-in-up">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Button & Total Summary Bar */}
          <div className="card p-6 sm:p-7 border border-teal-500/30 bg-slate-900/90 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-right w-full sm:w-auto">
              <span className="text-xs text-gray-400">إجمالي المبلغ المستحق:</span>
              <p className="text-2xl sm:text-3xl font-black text-amber-300">
                {selectedSize ? formatCurrency(selectedSize.price) : '—'}
              </p>
              <p className="text-[11px] text-emerald-400 font-medium">شامل التوصيل والتفريغ بالكامل</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-green-600 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-base shadow-xl shadow-teal-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>جاري تسجيل الطلب...</span>
                </>
              ) : (
                <>
                  <Droplets size={20} />
                  <span>تأكيد وإرسال طلب الوايت 🚚</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Success Modal */}
      {createdOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="card glass-strong max-w-lg w-full p-6 sm:p-8 border border-teal-500/30 shadow-2xl space-y-6 text-center animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-teal-500/20 text-teal-400 mx-auto flex items-center justify-center text-3xl">
              💧
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white">تم استلام طلب الوايت بنجاح!</h3>
              <p className="text-xs sm:text-sm text-gray-300">
                شكراً لثقتكم بنا، تم تسجيل طلبكم وسيقوم السائق بالتواصل معكم فوراً لتفريغ الماء.
              </p>
            </div>

            {/* Order summary box */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/8 text-right text-xs sm:text-sm space-y-2 font-medium">
              <div className="flex justify-between text-gray-400">
                <span>حجم الوايت:</span>
                <span className="text-white font-bold">{createdOrder.tanker_size_name}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>المبلغ:</span>
                <span className="text-amber-400 font-bold">{formatCurrency(createdOrder.tanker_price)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>الحي:</span>
                <span className="text-white">{createdOrder.district}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>نوع الخزان:</span>
                <span className="text-white">خزان {createdOrder.tank_type}</span>
              </div>
              {createdOrder.google_maps_url && (
                <div className="flex justify-between text-gray-400 pt-1 border-t border-white/5">
                  <span>موقع الـ GPS:</span>
                  <span className="text-teal-300 font-mono">تم الربط بنجاح ✅</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <a
                href={generateWhatsAppLink('0547382222', getWhatsAppMessage(createdOrder))}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-green-600/30 transition-all hover:scale-105"
              >
                <MessageCircle size={19} />
                <span>إرسال التفاصيل والموقع للسائق عبر الواتساب</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  setCreatedOrder(null)
                  navigate('/')
                }}
                className="w-full py-3 px-6 rounded-xl glass hover:bg-white/10 text-gray-300 text-xs sm:text-sm font-medium transition-colors"
              >
                العودة للصفحة الرئيسية
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WaterOrderPage
