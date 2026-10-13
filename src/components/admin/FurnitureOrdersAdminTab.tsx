import React, { useState, useMemo } from 'react'
import {
  ShoppingBag, Search, Phone, MessageCircle, MapPin, Truck, Check,
  Clock, X, Trash2, Loader2, Navigation, AlertCircle, Banknote,
  Calendar, CheckCircle2, RefreshCw, ExternalLink, ChevronDown, Package
} from 'lucide-react'
import { supabase, FurnitureOrder } from '../../lib/supabase'
import { formatCurrency, generateWhatsAppLink } from '../../lib/utils'

interface FurnitureOrdersAdminTabProps {
  orders: FurnitureOrder[]
  onRefresh: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export const FurnitureOrdersAdminTab: React.FC<FurnitureOrdersAdminTabProps> = ({
  orders,
  onRefresh,
  showToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled'>('all')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [orderToDelete, setOrderToDelete] = useState<FurnitureOrder | null>(null)

  // Metrics calculation
  const todayStr = new Date().toISOString().split('T')[0]
  const todayOrders = useMemo(() => {
    return orders.filter(o => o.created_at?.startsWith(todayStr))
  }, [orders, todayStr])

  const newOrdersCount = useMemo(() => {
    return orders.filter(o => o.status === 'new').length
  }, [orders])

  const shippingCount = useMemo(() => {
    return orders.filter(o => o.status === 'shipping' || o.status === 'confirmed').length
  }, [orders])

  const totalDeliveredRevenue = useMemo(() => {
    return orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
  }, [orders])

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Status match
      if (statusFilter !== 'all' && o.status !== statusFilter) {
        return false
      }
      // Search match
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const matchName = o.customer_name?.toLowerCase().includes(q)
        const matchPhone = o.customer_phone?.includes(q)
        const matchNumber = o.order_number?.toLowerCase().includes(q)
        const matchCity = o.city?.toLowerCase().includes(q)
        const matchDistrict = o.district?.toLowerCase().includes(q)
        return matchName || matchPhone || matchNumber || matchCity || matchDistrict
      }
      return true
    })
  }, [orders, statusFilter, searchTerm])

  // Handle status update
  const handleUpdateStatus = async (orderId: string, newStatus: FurnitureOrder['status']) => {
    setActionLoadingId(orderId)
    try {
      const { error } = await supabase
        .from('furniture_orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (error) {
        showToast('⚠️ تعذر تحديث حالة الطلب: ' + error.message, 'error')
      } else {
        const labels: Record<string, string> = {
          confirmed: 'تم تأكيد الطلب بنجاح 🔵',
          shipping: 'تم تحويل الطلب لجاري التوصيل 🚚',
          delivered: 'تم تسجيل تسليم الطلب وتحصيل المبلغ 🟢',
          cancelled: 'تم إلغاء الطلب ❌',
          new: 'تمت إعادة الطلب للحالة الجديدة 🟡',
        }
        showToast(labels[newStatus] || 'تم تحديث حالة الطلب بنجاح', 'success')
        onRefresh()
      }
    } catch (err: any) {
      showToast('⚠️ حدث خطأ: ' + err.message, 'error')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Handle delete order
  const handleDeleteOrder = async () => {
    if (!orderToDelete) return
    setActionLoadingId(orderToDelete.id)
    try {
      const { error } = await supabase
        .from('furniture_orders')
        .delete()
        .eq('id', orderToDelete.id)

      if (error) {
        showToast('⚠️ تعذر حذف الطلب: ' + error.message, 'error')
      } else {
        showToast('تم حذف الطلب بنجاح 🗑️', 'success')
        setOrderToDelete(null)
        onRefresh()
      }
    } catch (err: any) {
      showToast('⚠️ حدث خطأ: ' + err.message, 'error')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Format Driver WhatsApp message for dispatch
  const getDriverDispatchMsg = (o: FurnitureOrder) => {
    const paymentLabel = o.payment_method === 'cash'
      ? 'نقداً عند الاستلام'
      : o.payment_method === 'pos_on_delivery'
      ? 'شبكة (مدى) عند الوصول'
      : 'تحويل بنكي مسبق'

    const itemsList = Array.isArray(o.items)
      ? o.items.map((it: any) => `• ${it.name} (العدد: ${it.quantity})`).join('\n')
      : '• طقم كراسي تراثية'

    return `🚚 *توجيه طلب توصيل أثاث تراثي للمندوب / السائق* 🚚\n` +
      `ــــــــــــــــــــــــــــــــــــــــ\n` +
      `📋 *رقم الطلب:* ${o.order_number}\n` +
      `👤 *العميل:* ${o.customer_name}\n` +
      `📱 *الجوال:* ${o.customer_phone}\n` +
      `🪑 *القطع المطلوبة:*\n${itemsList}\n` +
      `💵 *المبلغ المطلوب تحصيله:* ${formatCurrency(o.total_amount)}\n` +
      `💳 *طريقة الدفع:* ${paymentLabel}\n` +
      `📍 *العنوان:* ${o.city} — ${o.district}\n` +
      (o.street_address ? `🏠 *تفاصيل الموقع:* ${o.street_address}\n` : '') +
      (o.google_maps_url ? `🗺️ *رابط اللوكيشن GPS:*\n${o.google_maps_url}\n` : '') +
      (o.notes ? `📝 *ملاحظات العميل:* ${o.notes}\n` : '') +
      `ــــــــــــــــــــــــــــــــــــــــ\n` +
      `🌟 يرجى سرعة التوصيل والتأكيد بعد استلام العميل وتحصيل المبلغ.`
  }

  const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; dot: string }> = {
    new: { label: 'جديد', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30', dot: 'bg-amber-400' },
    confirmed: { label: 'مؤكد', badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30', dot: 'bg-blue-400' },
    shipping: { label: 'جاري التوصيل', badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30', dot: 'bg-purple-400' },
    delivered: { label: 'تم التسليم والدفع', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
    cancelled: { label: 'ملغي', badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30', dot: 'bg-red-400' },
  }

  return (
    <div className="space-y-6">
      {/* ── Section 1: Financial & Operations KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-5">
          <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-blue-500/20 text-blue-400">
            <ShoppingBag size={20} />
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">{todayOrders.length}</p>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">طلبات اليوم</p>
          <p className="text-[11px] text-gray-500 mt-1">جديدة ومكتملة اليوم</p>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-amber-500/20 text-amber-400">
            <Clock size={20} />
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">{newOrdersCount}</p>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">طلبات جديدة</p>
          <p className="text-[11px] text-amber-400 mt-1">بانتظار المراجعة والتأكيد</p>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-purple-500/20 text-purple-400">
            <Truck size={20} />
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">{shippingCount}</p>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">قيد التجهيز والتوصيل</p>
          <p className="text-[11px] text-purple-400 mt-1">مع مندوب أو سائق الشاحنة</p>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-emerald-500/20 text-emerald-400">
            <Banknote size={20} />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-400">{formatCurrency(totalDeliveredRevenue)}</p>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">إجمالي المبيعات المحصلة</p>
          <p className="text-[11px] text-emerald-400/80 mt-1">من الطلبات المسلمة بالكامل</p>
        </div>
      </div>

      {/* ── Section 2: Search, Filters & Toolbar ── */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="ابحث بالاسم، الجوال، رقم الطلب، الحي..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input-field min-h-[42px] text-xs pr-8 pl-3"
            />
            <Search size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs text-gray-400">
              إجمالي المعروض: <strong className="text-white">{filteredOrders.length}</strong> طلب
            </span>
            <button
              onClick={onRefresh}
              className="glass p-2 rounded-xl text-gray-300 hover:text-white"
              title="تحديث القائمة"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'new', label: 'جديد 🟡', count: newOrdersCount },
            { id: 'confirmed', label: 'مؤكد 🔵' },
            { id: 'shipping', label: 'جاري التوصيل 🚚' },
            { id: 'delivered', label: 'تم التسليم 🟢' },
            { id: 'cancelled', label: 'ملغي 🔴' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === f.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950/40'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5'
              }`}
            >
              <span>{f.label}</span>
              {f.count != null && f.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400/30 text-amber-950 font-bold">
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 3: Orders List ── */}
      {filteredOrders.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 flex items-center justify-center text-gray-400">
            <ShoppingBag size={28} />
          </div>
          <p className="text-base font-bold text-white">لا توجد طلبات أثاث مطابقة</p>
          <p className="text-xs text-gray-400">
            {searchTerm || statusFilter !== 'all'
              ? 'جرّب تغيير عبارة البحث أو فلتر الحالة'
              : 'عندما يقوم زوار الموقع بطلب شراء كراسي أو أثاث، ستظهر طلباتهم هنا فوراً.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredOrders.map(order => {
            const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG.new
            const isDelivered = order.status === 'delivered'
            const isCancelled = order.status === 'cancelled'
            const isActionLoading = actionLoadingId === order.id

            return (
              <div
                key={order.id}
                className="card p-4 sm:p-5 border border-white/10 hover:border-amber-500/30 transition-all space-y-4 text-right"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm sm:text-base font-black text-amber-300">
                      #{order.order_number}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConf.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                      {statusConf.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar size={13} />
                    <span>{order.created_at ? new Date(order.created_at).toLocaleDateString('ar-SA') : ''}</span>
                    <span>•</span>
                    <span>{order.created_at ? new Date(order.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                </div>

                {/* Customer & Items Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer & Address Details */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">العميل:</span>
                      <span className="font-bold text-white text-sm">{order.customer_name}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">الجوال:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-200" dir="ltr">{order.customer_phone}</span>
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="glass p-1 rounded-lg text-emerald-400 hover:text-white"
                          title="اتصال بالعميل"
                        >
                          <Phone size={12} />
                        </a>
                        <a
                          href={generateWhatsAppLink(order.customer_phone, `السلام عليكم ${order.customer_name}، بخصوص طلب الأثاث رقم ${order.order_number}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass p-1 rounded-lg text-emerald-400 hover:text-white"
                          title="واتساب العميل"
                        >
                          <MessageCircle size={12} />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">المدينة والحي:</span>
                      <span className="text-gray-200 font-medium">{order.city} — {order.district}</span>
                    </div>

                    {order.street_address && (
                      <div className="flex items-start justify-between">
                        <span className="text-gray-400">تفاصيل الموقع:</span>
                        <span className="text-gray-300 max-w-[240px] text-left">{order.street_address}</span>
                      </div>
                    )}

                    {order.google_maps_url && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-gray-400">موقع GPS:</span>
                        <a
                          href={order.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1 underline"
                        >
                          <Navigation size={12} />
                          <span>فتح الموقع على خرائط Google</span>
                        </a>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-gray-400">طريقة الاستلام:</span>
                      <span className="px-2 py-0.5 rounded-lg bg-white/5 text-gray-300 font-medium">
                        {order.delivery_type === 'delivery' ? 'توصيل للموقع 🚚' : 'استلام من المستودع 🏬'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">طريقة الدفع:</span>
                      <span className="text-gray-200 font-medium">
                        {order.payment_method === 'cash' ? 'نقداً عند الاستلام 💵' : order.payment_method === 'pos_on_delivery' ? 'شبكة (مدى) عند الوصول 💳' : 'تحويل بنكي مسبق 🏦'}
                      </span>
                    </div>

                    {order.notes && (
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                        <strong>ملاحظات:</strong> {order.notes}
                      </div>
                    )}
                  </div>

                  {/* Items List & Price Summary */}
                  <div className="space-y-2.5 bg-black/30 p-3.5 rounded-2xl border border-white/5">
                    <p className="text-xs font-bold text-gray-300 mb-2">الأصناف والقطع المطلوبة:</p>
                    <div className="space-y-2">
                      {Array.isArray(order.items) && order.items.map((it: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2.5 text-xs">
                          {it.image_url ? (
                            <img
                              src={it.image_url}
                              alt={it.name}
                              className="w-10 h-10 rounded-lg object-cover bg-slate-900 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                              <Package size={16} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate">{it.name}</p>
                            <p className="text-[11px] text-gray-400">
                              الكمية: <strong className="text-amber-300">{it.quantity}</strong> × {formatCurrency(it.price)}
                            </p>
                          </div>
                          <div className="text-left font-bold text-gray-200">
                            {formatCurrency((it.price || 0) * (it.quantity || 1))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-bold text-gray-300">المبلغ الإجمالي المستحق:</span>
                      <span className="text-lg font-black text-emerald-400">
                        {formatCurrency(order.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                  {/* Status Changers */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400 ml-1">تحديث الحالة:</span>
                    
                    {order.status !== 'confirmed' && order.status !== 'delivered' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'confirmed')}
                        disabled={isActionLoading}
                        className="py-1.5 px-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1"
                      >
                        <Check size={12} />
                        <span>تأكيد الطلب</span>
                      </button>
                    )}

                    {order.status !== 'shipping' && order.status !== 'delivered' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'shipping')}
                        disabled={isActionLoading}
                        className="py-1.5 px-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1"
                      >
                        <Truck size={12} />
                        <span>جاري التوصيل</span>
                      </button>
                    )}

                    {!isDelivered && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'delivered')}
                        disabled={isActionLoading}
                        className="py-1.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} />
                        <span>تم التسليم والدفع</span>
                      </button>
                    )}

                    {!isCancelled && !isDelivered && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                        disabled={isActionLoading}
                        className="py-1.5 px-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center gap-1"
                      >
                        <X size={12} />
                        <span>إلغاء</span>
                      </button>
                    )}
                  </div>

                  {/* Driver Dispatch & Delete */}
                  <div className="flex items-center gap-2">
                    {/* Send to Driver WhatsApp */}
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(getDriverDispatchMsg(order))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
                      title="إرسال رسالة توجيه الطلب للمندوب / السائق"
                    >
                      <Truck size={14} />
                      <span>توجيه للمندوب 📲</span>
                    </a>

                    <button
                      onClick={() => setOrderToDelete(order)}
                      className="glass p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/20 border border-red-500/20"
                      title="حذف الطلب نهائياً"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="card glass-strong max-w-sm w-full p-6 text-center space-y-4 border border-red-500/30 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">حذف طلب الأثاث؟</h4>
              <p className="text-xs text-gray-300 mt-1">
                هل أنت متأكد من حذف الطلب رقم <strong className="text-amber-300">{orderToDelete.order_number}</strong> نهائياً من النظام؟
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setOrderToDelete(null)}
                className="btn-ghost flex-1 py-2 text-xs"
              >
                تراجع
              </button>
              <button
                onClick={handleDeleteOrder}
                className="btn-danger flex-1 py-2 text-xs font-bold"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FurnitureOrdersAdminTab
