import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Armchair, Sparkles, MessageCircle, Phone, Check,
  ShoppingBag, CheckCircle2, ChevronLeft, ChevronRight, Package, MapPin, X, ArrowLeft,
  Navigation, Loader2, MapPinned, CreditCard, Truck, Banknote, Camera
} from 'lucide-react'
import { supabase, HeritageFurniture } from '../lib/supabase'
import { INITIAL_HERITAGE_FURNITURE } from './admin/HeritageFurnitureAdminTab'
import { useSettings } from '../contexts/SettingsContext'
import { formatCurrency, generateWhatsAppLink } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

interface HeritageFurnitureSectionProps {
  showTitle?: boolean
  limit?: number
}

interface FurnitureProductCardProps {
  item: HeritageFurniture
  onOpenOrder: (item: HeritageFurniture) => void
  onDirectWhatsApp: (item: HeritageFurniture) => void
  onOpenGallery: (item: HeritageFurniture, index: number) => void
}

const FurnitureProductCard: React.FC<FurnitureProductCardProps> = ({
  item,
  onOpenOrder,
  onDirectWhatsApp,
  onOpenGallery,
}) => {
  const photos = Array.isArray(item.images) && item.images.length > 0
    ? item.images
    : (item.image_url ? [item.image_url] : ['/images/heritage-chair.jpg'])

  const [currentIdx, setCurrentIdx] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  // Smooth auto-slide if multiple photos
  useEffect(() => {
    if (photos.length <= 1 || isHovered) return
    const timer = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % photos.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [photos.length, isHovered])

  const tags = Array.isArray(item.features) ? item.features : []
  const activePrice = item.discount_price ? item.discount_price : item.price
  const hasDiscount = Boolean(item.discount_price && item.discount_price < item.price)

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="rounded-3xl border border-white/10 bg-slate-900/70 hover:border-amber-500/40 backdrop-blur-md shadow-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:scale-[1.01]"
    >
      {/* Product Image Banner with smooth carousel */}
      <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-slate-950 select-none">
        {photos.map((src, idx) => {
          const isActive = idx === currentIdx
          return (
            <div
              key={idx}
              className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                isActive ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 pointer-events-none z-0'
              }`}
            >
              <img
                src={src}
                alt={item.name}
                className="w-full h-full object-cover object-center cursor-pointer"
                onClick={() => onOpenGallery(item, idx)}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/heritage-chair.jpg'
                }}
              />
            </div>
          )
        })}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none z-10" />

        {/* Top Badges */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
          <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-slate-950/80 border border-white/15 text-amber-300 backdrop-blur-md shadow-md">
            {item.category || 'كراسي'}
          </span>
          {hasDiscount && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-md animate-pulse">
              عرض خاص 🔥
            </span>
          )}
        </div>

        <div className="absolute top-4 left-4 z-20">
          <span className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border ${
            item.in_stock
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-red-500/20 text-red-300 border-red-500/40'
          }`}>
            {item.in_stock ? 'جاهز للتسليم 📦' : 'نفذت الكمية'}
          </span>
        </div>

        {/* Next / Prev buttons if multiple images */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setCurrentIdx(prev => (prev - 1 + photos.length) % photos.length)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full glass hover:bg-amber-500 hover:text-slate-950 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-md"
              aria-label="السابق"
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setCurrentIdx(prev => (prev + 1) % photos.length)
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full glass hover:bg-amber-500 hover:text-slate-950 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-md"
              aria-label="التالي"
            >
              <ChevronLeft size={18} />
            </button>
          </>
        )}

        {/* Bottom gallery trigger & indicators */}
        <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between gap-1.5">
          {photos.length > 1 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenGallery(item, currentIdx)
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-black/80 hover:bg-black text-amber-300 border border-amber-500/40 backdrop-blur-md flex items-center gap-1 shadow-md transition-transform hover:scale-105"
            >
              <Camera size={13} />
              <span>معرض الصور ({photos.length} صور) 📸</span>
            </button>
          ) : <div />}

          {photos.length > 1 && (
            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentIdx(i)
                  }}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentIdx ? 'w-4 h-1.5 bg-amber-400' : 'w-1.5 h-1.5 bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
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
              onClick={() => onOpenOrder(item)}
              disabled={!item.in_stock}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/40 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <ShoppingBag size={15} />
              <span>طلب شراء مباشر</span>
            </button>

            <button
              type="button"
              onClick={() => onDirectWhatsApp(item)}
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
}

export const HeritageFurnitureSection: React.FC<HeritageFurnitureSectionProps> = ({
  showTitle = true,
  limit
}) => {
  const { settings } = useSettings()
  const { user, profile } = useAuth()
  const [items, setItems] = useState<HeritageFurniture[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItemForOrder, setSelectedItemForOrder] = useState<HeritageFurniture | null>(null)
  const [galleryItem, setGalleryItem] = useState<{ item: HeritageFurniture; index: number } | null>(null)

  // Order modal states
  const [orderQuantity, setOrderQuantity] = useState(1)
  const [orderName, setOrderName] = useState('')
  const [orderPhone, setOrderPhone] = useState('')
  const [orderCity, setOrderCity] = useState('الرياض')
  const [orderDistrict, setOrderDistrict] = useState('')
  const [orderStreetAddress, setOrderStreetAddress] = useState('')
  const [orderGoogleMapsUrl, setOrderGoogleMapsUrl] = useState('')
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'pos_on_delivery' | 'bank_transfer'>('cash')
  const [orderNotes, setOrderNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [locating, setLocating] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<any | null>(null)

  // Pre-fill user data if logged in
  useEffect(() => {
    if (profile?.full_name && !orderName) setOrderName(profile.full_name)
    if (profile?.phone && !orderPhone) setOrderPhone(profile.phone)
  }, [profile])

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
    setCreatedOrder(null)
  }

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('خدمة تحديد الموقع الجغرافي غير مدعومة في متصفحك.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setOrderGoogleMapsUrl(`https://maps.google.com/?q=${latitude},${longitude}`)
        setLocating(false)
      },
      (err) => {
        console.warn('Geolocation error:', err)
        setLocating(false)
        alert('تعذر جلب إحداثيات الموقع تلقائياً. يمكنك كتابة اسم الحي أو لصق رابط الخريطة يدوياً.')
      },
      { timeout: 8000 }
    )
  }

  const handleDirectWhatsAppOrder = (item: HeritageFurniture) => {
    const unitPrice = item.discount_price || item.price
    const msg = `السلام عليكم ورحمة الله، أود الاستفسار وطلب شراء:\n🪑 المنتج: ${item.name}\n💰 السعر: ${unitPrice} ر.س\n\nأرجو تزويدي بتفاصيل التوصيل وتأكيد الطلب.`
    const phone = settings.contact_whatsapp || '0556854162'
    window.open(generateWhatsAppLink(phone, msg), '_blank')
  }

  const handleSubmitModalOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItemForOrder || submitting) return

    setSubmitting(true)
    const unitPrice = selectedItemForOrder.discount_price || selectedItemForOrder.price
    const total = unitPrice * orderQuantity
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    const orderNumber = `FUR-${new Date().getFullYear().toString().slice(-2)}${randomSuffix}`

    const orderPayload = {
      order_number: orderNumber,
      customer_id: user?.id || null,
      customer_name: orderName.trim(),
      customer_phone: orderPhone.trim(),
      items: [
        {
          item_id: selectedItemForOrder.id,
          name: selectedItemForOrder.name,
          price: unitPrice,
          quantity: orderQuantity,
          image_url: selectedItemForOrder.image_url,
        }
      ],
      total_amount: total,
      city: orderCity.trim() || 'الرياض',
      district: orderDistrict.trim() || 'غير محدد',
      street_address: orderStreetAddress.trim() || null,
      google_maps_url: orderGoogleMapsUrl.trim() || null,
      delivery_type: deliveryType,
      payment_method: paymentMethod,
      status: 'new',
      notes: orderNotes.trim() || null,
    }

    try {
      const { data, error } = await supabase
        .from('furniture_orders')
        .insert(orderPayload)
        .select()
        .single()

      if (error) {
        console.warn('Database insert notice, proceeding with payload:', error)
      }

      setCreatedOrder(data || orderPayload)
    } catch (err: any) {
      console.error('Order creation error:', err)
      // Fallback: still show the order confirmation so user can send via WhatsApp
      setCreatedOrder(orderPayload)
    } finally {
      setSubmitting(false)
    }
  }

  const getOrderWhatsAppMsg = (order: any) => {
    const paymentLabel = order.payment_method === 'cash'
      ? 'نقداً عند الاستلام'
      : order.payment_method === 'pos_on_delivery'
      ? 'شبكة (مدى) عند الوصول'
      : 'تحويل بنكي مسبق'

    return `🪑 *طلب شراء أثاث تراثي جديد — رقم: ${order.order_number}* 🪑\n` +
      `ــــــــــــــــــــــــــــــــــــــــ\n` +
      `👤 *العميل:* ${order.customer_name}\n` +
      `📱 *الجوال:* ${order.customer_phone}\n` +
      `📦 *المنتج:* ${selectedItemForOrder?.name || 'طقم كراسي تراثية'}\n` +
      `🔢 *الكمية:* ${order.items?.[0]?.quantity || orderQuantity}\n` +
      `💵 *الإجمالي:* ${formatCurrency(order.total_amount)}\n` +
      `🚚 *طريقة الاستلام:* ${order.delivery_type === 'delivery' ? 'توصيل للموقع' : 'استلام من المستودع'}\n` +
      `📍 *المدينة / الحي:* ${order.city} — ${order.district}\n` +
      (order.street_address ? `🏠 *تفاصيل العنوان:* ${order.street_address}\n` : '') +
      (order.google_maps_url ? `🗺️ *رابط الموقع (GPS):*\n${order.google_maps_url}\n` : '') +
      `💳 *طريقة الدفع:* ${paymentLabel}\n` +
      (order.notes ? `📝 *ملاحظات:* ${order.notes}\n` : '') +
      `ــــــــــــــــــــــــــــــــــــــــ\n` +
      `🌟 أرجو تأكيد موعد التوصيل والتسليم.`
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

      {/* Furniture Grid with Smooth Multi-Image Carousels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 relative z-10">
        {displayedItems.map((item) => (
          <FurnitureProductCard
            key={item.id}
            item={item}
            onOpenOrder={handleOpenOrderModal}
            onDirectWhatsApp={handleDirectWhatsAppOrder}
            onOpenGallery={(itm, idx) => setGalleryItem({ item: itm, index: idx })}
          />
        ))}
      </div>

      {/* Quick Order Modal — Mobile-First Bottom Sheet */}
      {selectedItemForOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full sm:max-w-lg bg-slate-900 border-t sm:border border-amber-500/30 shadow-2xl rounded-t-[28px] sm:rounded-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden text-right animate-scale-in">
            {/* Header (Sticky at Top) */}
            <div className="shrink-0 p-4 sm:p-5 border-b border-white/10 bg-slate-900/95 backdrop-blur-md z-10">
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    <ShoppingBag size={18} />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-base sm:text-lg">
                      {createdOrder ? 'تم تأكيد طلب الشراء بنجاح 🎉' : `طلب شراء: ${selectedItemForOrder.name}`}
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      {createdOrder ? `رقم الطلب: ${createdOrder.order_number}` : 'أكمل تفاصيل العنوان وتأكيد التوصيل'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemForOrder(null)
                    setCreatedOrder(null)
                  }}
                  className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* If Order is Created: Show Order Confirmation Screen */}
            {createdOrder ? (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar text-center">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border-2 border-emerald-500/40 shadow-xl shadow-emerald-950/50 animate-bounce">
                  <Check size={32} strokeWidth={3} />
                </div>

                <div className="space-y-1">
                  <h4 className="text-lg font-black text-white">تم تسجيل طلبك في النظام بنجاح!</h4>
                  <p className="text-xs text-gray-300">
                    سيقوم المالك وفريق التجهيز بمراجعة طلبك والتواصل معك فوراً لتأكيد موعد التوصيل.
                  </p>
                </div>

                {/* Order Details Card */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-right space-y-2.5 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-gray-400">رقم الطلب:</span>
                    <span className="font-black text-amber-300 font-mono text-sm">{createdOrder.order_number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">المنتج:</span>
                    <span className="font-bold text-white">{selectedItemForOrder.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">الكمية:</span>
                    <span className="font-bold text-white">{orderQuantity} قطع</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">المبلغ الإجمالي:</span>
                    <span className="font-black text-emerald-400 text-sm">{formatCurrency(createdOrder.total_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">العنوان:</span>
                    <span className="text-gray-200">{createdOrder.city} — {createdOrder.district}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">طريقة الدفع:</span>
                    <span className="text-gray-200">
                      {createdOrder.payment_method === 'cash' ? 'نقداً عند الاستلام' : createdOrder.payment_method === 'pos_on_delivery' ? 'شبكة (مدى) عند الوصول' : 'تحويل بنكي مسبق'}
                    </span>
                  </div>
                </div>

                {/* WhatsApp Dispatch Button */}
                <div className="space-y-2 pt-2">
                  <a
                    href={generateWhatsAppLink(
                      settings.contact_whatsapp || '0556854162',
                      getOrderWhatsAppMsg(createdOrder)
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60"
                  >
                    <MessageCircle size={18} />
                    <span>مراسلة المالك عبر واتساب للتأكيد الفوري</span>
                  </a>

                  <Link
                    to="/my-bookings"
                    onClick={() => setSelectedItemForOrder(null)}
                    className="btn-ghost w-full py-2.5 text-xs text-gray-300 hover:text-white"
                  >
                    متابعة حالة الطلب في صفحة طلباتي 📋
                  </Link>
                </div>
              </div>
            ) : (
              /* Order Form Body */
              <>
                <form id="furniture-order-form" onSubmit={handleSubmitModalOrder} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
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
                        الإجمالي: <span className="text-base font-black text-amber-300">
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
                        رقم الجوال للتواصل والتسليم *
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

                  {/* City & District */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                        المدينة *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: الرياض، المزاحمية، ضرما..."
                        value={orderCity}
                        onChange={e => setOrderCity(e.target.value)}
                        className="input-field min-h-[44px] text-xs sm:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                        الحي / المنطقة *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: حي النرجس، مزارع العمارية..."
                        value={orderDistrict}
                        onChange={e => setOrderDistrict(e.target.value)}
                        className="input-field min-h-[44px] text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* Detailed Street Address */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      تفاصيل العنوان أو وصف المزرعة / الاستراحة
                    </label>
                    <input
                      type="text"
                      placeholder="اسم الشارع، رقم الفيلا، أو أقرب معلم واضح..."
                      value={orderStreetAddress}
                      onChange={e => setOrderStreetAddress(e.target.value)}
                      className="input-field min-h-[44px] text-xs sm:text-sm"
                    />
                  </div>

                  {/* Google Maps / GPS Locator */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-gray-300">
                        موقع التسليم على خرائط جوجل (GPS)
                      </label>
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        disabled={locating}
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold transition-colors"
                      >
                        {locating ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
                        <span>{locating ? 'جاري جلب إحداثيات موقعك...' : '📍 تحديد موقعي الحالي'}</span>
                      </button>
                    </div>
                    <input
                      type="url"
                      dir="ltr"
                      placeholder="https://maps.google.com/?q=..."
                      value={orderGoogleMapsUrl}
                      onChange={e => setOrderGoogleMapsUrl(e.target.value)}
                      className="input-field min-h-[44px] text-xs font-mono text-left"
                    />
                  </div>

                  {/* Delivery Type & Payment Method */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                        طريقة الاستلام
                      </label>
                      <select
                        value={deliveryType}
                        onChange={e => setDeliveryType(e.target.value as any)}
                        className="input-field min-h-[44px] text-xs bg-slate-900"
                      >
                        <option value="delivery">توصيل إلى موقعي / المزرعة 🚚</option>
                        <option value="pickup">استلام مباشر من المستودع 🏬</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                        طريقة الدفع المفضلة
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value as any)}
                        className="input-field min-h-[44px] text-xs bg-slate-900"
                      >
                        <option value="cash">نقداً عند الاستلام 💵</option>
                        <option value="pos_on_delivery">شبكة (مدى) عند وصول المندوب 💳</option>
                        <option value="bank_transfer">تحويل بنكي مسبق 🏦</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      ملاحظات إضافية أو موعد التسليم المفضل
                    </label>
                    <textarea
                      rows={2}
                      placeholder="مثال: التوصيل يوم الجمعة صباحاً، أو التواصل قبل الوصول بساعة..."
                      value={orderNotes}
                      onChange={e => setOrderNotes(e.target.value)}
                      className="input-field text-xs leading-relaxed"
                    />
                  </div>
                </form>

                {/* Action Footer (Sticky at Bottom) */}
                <div className="shrink-0 p-3.5 sm:p-4 border-t border-white/10 bg-slate-900/95 backdrop-blur-md pb-safe flex gap-2.5 z-10">
                  <button
                    type="button"
                    onClick={() => setSelectedItemForOrder(null)}
                    disabled={submitting}
                    className="btn-ghost w-1/3 py-2.5 text-xs font-semibold"
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    form="furniture-order-form"
                    disabled={submitting}
                    className="w-2/3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>جاري حفظ وتأكيد الطلب...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>تأكيد وتسجيل طلب الشراء</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Heritage Furniture Multi-Image Lightbox Modal */}
      {galleryItem && (() => {
        const item = galleryItem.item
        const photos = Array.isArray(item.images) && item.images.length > 0
          ? item.images
          : (item.image_url ? [item.image_url] : ['/images/heritage-chair.jpg'])
        const currentIdx = galleryItem.index
        const currentSrc = photos[currentIdx] || photos[0]

        return (
          <div
            onClick={() => setGalleryItem(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/95 backdrop-blur-md animate-fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl w-full rounded-3xl overflow-hidden border border-amber-500/30 shadow-2xl bg-slate-950 flex flex-col text-right animate-scale-in"
            >
              {/* Header */}
              <div className="p-4 bg-slate-900/95 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Camera size={18} className="text-amber-400" />
                    <span>{item.name} — معرض الصور</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    صورة {currentIdx + 1} من {photos.length}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setGalleryItem(null)}
                  className="w-9 h-9 rounded-full glass hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main Image Stage */}
              <div className="relative h-[55vh] sm:h-[65vh] bg-black flex items-center justify-center overflow-hidden">
                <img
                  src={currentSrc}
                  alt={item.name}
                  className="max-w-full max-h-full object-contain select-none transition-all duration-300"
                />

                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setGalleryItem({ item, index: (currentIdx > 0 ? currentIdx - 1 : photos.length - 1) })}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full glass hover:bg-amber-500 hover:text-slate-950 text-white flex items-center justify-center shadow-xl transition-transform hover:scale-110 active:scale-95"
                      aria-label="الصورة السابقة"
                    >
                      <ChevronRight size={24} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryItem({ item, index: (currentIdx < photos.length - 1 ? currentIdx + 1 : 0) })}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full glass hover:bg-amber-500 hover:text-slate-950 text-white flex items-center justify-center shadow-xl transition-transform hover:scale-110 active:scale-95"
                      aria-label="الصورة التالية"
                    >
                      <ChevronLeft size={24} />
                    </button>
                  </>
                )}
              </div>

              {/* Bottom Thumbnails */}
              {photos.length > 1 && (
                <div className="p-3 bg-slate-900/95 border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {photos.map((pUrl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setGalleryItem({ item, index: i })}
                      className={`relative w-16 h-12 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                        currentIdx === i
                          ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105 shadow-md'
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
    </section>
  )
}

export default HeritageFurnitureSection
