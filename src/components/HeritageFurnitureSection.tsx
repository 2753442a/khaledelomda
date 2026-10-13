import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Armchair, Sparkles, MessageCircle, Phone, Check,
  ShoppingBag, CheckCircle2, ChevronLeft, Package, MapPin, X, ArrowLeft
} from 'lucide-react'
import { supabase, HeritageFurniture } from '../lib/supabase'
import { INITIAL_HERITAGE_FURNITURE } from './admin/HeritageFurnitureAdminTab'
import { useSettings } from '../contexts/SettingsContext'
import { formatCurrency, generateWhatsAppLink } from '../lib/utils'

interface HeritageFurnitureSectionProps {
  showTitle?: boolean
  limit?: number
}

export const HeritageFurnitureSection: React.FC<HeritageFurnitureSectionProps> = ({
  showTitle = true,
  limit
}) => {
  const { settings } = useSettings()
  const [items, setItems] = useState<HeritageFurniture[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItemForOrder, setSelectedItemForOrder] = useState<HeritageFurniture | null>(null)

  // Order modal states
  const [orderQuantity, setOrderQuantity] = useState(1)
  const [orderName, setOrderName] = useState('')
  const [orderPhone, setOrderPhone] = useState('')
  const [orderAddress, setOrderAddress] = useState('')
  const [orderNotes, setOrderNotes] = useState('')

  useEffect(() => {
    const fetchFurniture = async () => {
      try {
        const { data, error } = await supabase
          .from('heritage_furniture')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true })

        if (!error && data) {
          setItems(data as HeritageFurniture[])
        } else if (error) {
          // If table not migrated yet, fallback smoothly to the seeded item
          if (error.code === '42P01' || error.message.includes('does not exist')) {
            setItems(INITIAL_HERITAGE_FURNITURE)
          }
        }
      } catch (err) {
        setItems(INITIAL_HERITAGE_FURNITURE)
      } finally {
        setLoading(false)
      }
    }

    fetchFurniture()
  }, [])

  // If no items are active, hide section gracefully
  if (loading) return null
  if (items.length === 0) return null

  const displayedItems = limit ? items.slice(0, limit) : items

  const handleOpenOrderModal = (item: HeritageFurniture) => {
    setSelectedItemForOrder(item)
    setOrderQuantity(1)
  }

  const handleDirectWhatsAppOrder = (item: HeritageFurniture) => {
    const unitPrice = item.discount_price || item.price
    const msg = `السلام عليكم ورحمة الله، أود الاستفسار وطلب شراء:\n🪑 المنتج: ${item.name}\n💰 السعر: ${unitPrice} ر.س\n\nأرجو تزويدي بتفاصيل التوصيل وتأكيد الطلب.`
    const phone = settings.contact_whatsapp || '0556854162'
    window.open(generateWhatsAppLink(phone, msg), '_blank')
  }

  const handleSubmitModalOrder = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItemForOrder) return
    const unitPrice = selectedItemForOrder.discount_price || selectedItemForOrder.price
    const total = unitPrice * orderQuantity

    const msg = `السلام عليكم ورحمة الله، طلب شراء أثاث تراثي جديد عبر الموقع:\n\n` +
      `🪑 المنتج: ${selectedItemForOrder.name}\n` +
      `📦 الكمية: ${orderQuantity}\n` +
      `💵 إجمالي القيمة: ${total} ر.س\n` +
      `👤 العميل: ${orderName.trim()}\n` +
      `📱 الجوال: ${orderPhone.trim()}\n` +
      (orderAddress ? `📍 العنوان / المدينة: ${orderAddress.trim()}\n` : '') +
      (orderNotes ? `📝 ملاحظات: ${orderNotes.trim()}\n` : '')

    const phone = settings.contact_whatsapp || '0556854162'
    window.open(generateWhatsAppLink(phone, msg), '_blank')
    setSelectedItemForOrder(null)
  }

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-white">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Section Header */}
      {showTitle && (
        <div className="text-center max-w-3xl mx-auto mb-16 relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 text-amber-300 text-xs sm:text-sm font-semibold shadow-lg">
            <Sparkles size={15} />
            <span>صناعة يدوية أصيلة • للمزارع والحدائق والاستراحات</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            قسم كراسي وجلسات <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-300 bg-clip-text text-transparent">التراث الريفي 🪑</span>
          </h2>

          <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
            أضف لمسة من الفخامة التراثية إلى جلستك أو مزرعتك بقطع خشبية وخيزران متينة ومريحة مصنوعة بحرفية يدوية عالية تناسب الجلسات الخارجية والداخلية.
          </p>
        </div>
      )}

      {/* Furniture Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 relative z-10">
        {displayedItems.map((item) => {
          const tags = Array.isArray(item.features) ? item.features : []
          const activePrice = item.discount_price ? item.discount_price : item.price
          const hasDiscount = Boolean(item.discount_price && item.discount_price < item.price)

          return (
            <div
              key={item.id}
              className="rounded-3xl border border-white/10 bg-slate-900/70 hover:border-amber-500/40 backdrop-blur-md shadow-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:scale-[1.01]"
            >
              {/* Product Image Banner */}
              <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-slate-950">
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 select-none"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    if (target.dataset.fallbackApplied) return
                    target.dataset.fallbackApplied = 'true'
                    target.src = '/images/heritage-chair.jpg'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                {/* Top Badges */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-slate-950/80 border border-white/15 text-amber-300 backdrop-blur-md shadow-md">
                    {item.category || 'كراسي'}
                  </span>
                  {hasDiscount && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-md animate-pulse">
                      عرض خاص 🔥
                    </span>
                  )}
                </div>

                <div className="absolute top-4 left-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border ${
                    item.in_stock
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}>
                    {item.in_stock ? 'جاهز للتسليم 📦' : 'نفذت الكمية'}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg sm:text-xl font-bold text-white leading-snug">
                      {item.name}
                    </h3>
                  </div>

                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed line-clamp-3">
                    {item.description}
                  </p>

                  {/* Feature chips */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        >
                          <CheckCircle2 size={11} className="text-amber-400" />
                          <span>{t}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price and Order Buttons */}
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-400 font-medium">السعر:</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-amber-300">
                        {formatCurrency(activePrice)}
                      </span>
                      {hasDiscount && (
                        <span className="text-xs text-gray-500 line-through">
                          {formatCurrency(item.price)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenOrderModal(item)}
                      disabled={!item.in_stock}
                      className="py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/40 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <ShoppingBag size={15} />
                      <span>طلب شراء مباشر</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDirectWhatsAppOrder(item)}
                      className="py-3 px-3 rounded-xl glass hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <MessageCircle size={15} className="text-emerald-400" />
                      <span>واتساب المالك</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Order Modal */}
      {selectedItemForOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="card glass-strong max-w-lg w-full p-6 sm:p-7 border border-amber-500/30 shadow-2xl space-y-5 animate-scale-in my-8 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <ShoppingBag size={18} />
                </span>
                <h3 className="font-bold text-white text-base sm:text-lg">
                  طلب شراء: {selectedItemForOrder.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForOrder(null)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Summary Banner */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <img
                src={selectedItemForOrder.image_url}
                alt={selectedItemForOrder.name}
                className="w-16 h-16 rounded-xl object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/heritage-chair.jpg'
                }}
              />
              <div className="space-y-1 flex-1">
                <p className="text-xs font-bold text-white">{selectedItemForOrder.name}</p>
                <p className="text-xs text-amber-300 font-black">
                  سعر الحبة: {formatCurrency(selectedItemForOrder.discount_price || selectedItemForOrder.price)}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitModalOrder} className="space-y-4">
              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  العدد / الكمية المطلوبة
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-white/15 rounded-xl overflow-hidden bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setOrderQuantity(q => Math.max(1, q - 1))}
                      className="px-3.5 py-2 text-base font-bold text-gray-300 hover:bg-white/10"
                    >
                      -
                    </button>
                    <span className="px-4 py-2 text-sm font-bold text-amber-300">
                      {orderQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOrderQuantity(q => q + 1)}
                      className="px-3.5 py-2 text-base font-bold text-gray-300 hover:bg-white/10"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-xs text-gray-400">
                    الإجمالي: <span className="text-sm font-black text-amber-300">
                      {formatCurrency((selectedItemForOrder.discount_price || selectedItemForOrder.price) * orderQuantity)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    الاسم الكريم *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="الاسم الثلاثي"
                    value={orderName}
                    onChange={e => setOrderName(e.target.value)}
                    className="input-field min-h-[44px] text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    رقم الجوال للتواصل *
                  </label>
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    placeholder="05XXXXXXXX"
                    value={orderPhone}
                    onChange={e => setOrderPhone(e.target.value)}
                    className="input-field min-h-[44px] text-xs sm:text-sm text-left font-mono"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  المدينة / الحي أو موقع المزرعة
                </label>
                <input
                  type="text"
                  placeholder="مثال: الرياض - حي النرجس أو مزرعة العمارية"
                  value={orderAddress}
                  onChange={e => setOrderAddress(e.target.value)}
                  className="input-field min-h-[44px] text-xs sm:text-sm"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  أي ملاحظات أو طلبات خاصة؟
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: الاستلام خلال عطلة نهاية الأسبوع أو موعد معين"
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  className="input-field text-xs leading-relaxed"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedItemForOrder(null)}
                  className="btn-ghost w-1/3 py-2.5 text-xs font-semibold"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="w-2/3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
                >
                  <MessageCircle size={16} />
                  <span>إرسال وتأكيد الطلب عبر واتساب</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default HeritageFurnitureSection
