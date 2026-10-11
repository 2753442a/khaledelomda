import React, { useState } from 'react'
import {
  CalendarCheck, X, User, Phone, Calendar, Banknote,
  Clock, CheckCircle, Loader2, Home, Sparkles
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'

interface Property {
  id: string
  name: string
  weekday_price: number
  weekend_price: number
}

interface ManualBookingModalProps {
  properties: Property[]
  onClose: () => void
  onSuccess: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export const ManualBookingModal: React.FC<ManualBookingModalProps> = ({
  properties,
  onClose,
  onSuccess,
  showToast,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10)
  const defaultProperty = properties[0]

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [bookingDate, setBookingDate] = useState(todayStr)
  const [propertyId, setPropertyId] = useState(defaultProperty?.id || '')
  const [totalAmount, setTotalAmount] = useState(String(defaultProperty?.weekday_price || 3500))
  const [depositAmount, setDepositAmount] = useState(String(Math.ceil((defaultProperty?.weekday_price || 3500) * 0.25)))
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash_on_arrival'>('bank_transfer')
  const [status, setStatus] = useState<'confirmed' | 'pending_verification' | 'pending_receipt'>('confirmed')
  const [checkInTime, setCheckInTime] = useState('15:30')
  const [checkOutTime, setCheckOutTime] = useState('11:30')
  const [submitting, setSubmitting] = useState(false)

  // Adjust total price based on selected property
  const handlePropertyChange = (newPropId: string) => {
    setPropertyId(newPropId)
    const selected = properties.find(p => p.id === newPropId)
    if (selected) {
      setTotalAmount(String(selected.weekday_price))
      setDepositAmount(String(Math.ceil(selected.weekday_price * 0.25)))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim()) {
      showToast('يرجى إدخال اسم العميل', 'error')
      return
    }
    if (!customerPhone.trim()) {
      showToast('يرجى إدخال رقم جوال العميل', 'error')
      return
    }
    if (!propertyId) {
      showToast('يرجى اختيار الوحدة المراد حجزها', 'error')
      return
    }

    setSubmitting(true)
    try {
      const checkInISO = `${bookingDate}T${checkInTime}:00Z`
      const checkOutDate = new Date(bookingDate)
      checkOutDate.setDate(checkOutDate.getDate() + 1)
      const nextDayStr = checkOutDate.toISOString().slice(0, 10)
      const checkOutISO = `${nextDayStr}T${checkOutTime}:00Z`

      const payload = {
        property_id: propertyId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        booking_date: bookingDate,
        check_in: checkInISO,
        check_out: checkOutISO,
        total_amount: Number(totalAmount) || 0,
        deposit_amount: Number(depositAmount) || 0,
        payment_method: paymentMethod,
        status,
      }

      const { error } = await supabase.from('bookings').insert([payload])
      if (error) {
        if (error.message?.includes('unique_property_date')) {
          showToast('⚠️ هذا التاريخ محجوز مسبقاً لهذه الوحدة! اختر تاريخاً آخر.', 'error')
        } else {
          showToast('⚠️ تعذر تسجيل الحجز: ' + error.message, 'error')
        }
        return
      }

      showToast('تم تسجيل الحجز بنجاح وحجز التاريخ في التقويم فوراً ✅')
      onSuccess()
      onClose()
    } catch (err: any) {
      showToast('⚠️ حدث خطأ: ' + (err.message || 'غير متوقع'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in text-right">
      <div className="card glass-strong max-w-xl w-full max-h-[92vh] overflow-y-auto custom-scrollbar p-6 border border-emerald-500/30 shadow-2xl space-y-5 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <CalendarCheck size={20} />
            </span>
            <div>
              <h3 className="font-bold text-white text-base">تسجيل حجز مباشر من الإدارة</h3>
              <p className="text-[11px] text-gray-400">للحجوزات الواردة بالهاتف أو المكتب لحجز وتجميد التاريخ فوراً</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="glass p-1.5 rounded-lg text-gray-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">اسم العميل *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="مثال: فهد القحطاني"
                  className="input-field min-h-[44px] text-xs sm:text-sm pl-3 pr-8"
                />
                <User size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">رقم الجوال *</label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="input-field min-h-[44px] text-xs sm:text-sm font-mono pl-3 pr-8"
                  dir="ltr"
                />
                <Phone size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Date & Property */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">تاريخ الحجز *</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={bookingDate}
                  onChange={e => setBookingDate(e.target.value)}
                  className="input-field min-h-[44px] text-xs sm:text-sm pl-3 pr-8 cursor-pointer"
                />
                <Calendar size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">الوحدة / الاستراحة *</label>
              <select
                value={propertyId}
                onChange={e => handlePropertyChange(e.target.value)}
                className="input-field min-h-[44px] text-xs sm:text-sm bg-slate-900 cursor-pointer"
              >
                {properties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing & Deposit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">إجمالي المبلغ (ر.س)</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min={0}
                  value={totalAmount}
                  onChange={e => setTotalAmount(e.target.value)}
                  className="input-field min-h-[44px] text-xs sm:text-sm font-bold text-amber-300 pl-3 pr-8"
                />
                <Banknote size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">مبلغ العربون المستلم (ر.س)</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  className="input-field min-h-[44px] text-xs sm:text-sm font-bold text-emerald-400 pl-3 pr-8"
                />
                <Banknote size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Payment Method & Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">طريقة الدفع</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                className="input-field min-h-[44px] text-xs sm:text-sm bg-slate-900 cursor-pointer"
              >
                <option value="bank_transfer">تحويل بنكي 🏦</option>
                <option value="cash_on_arrival">نقداً عند الوصول 💵</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">حالة الحجز فور الإضافة</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="input-field min-h-[44px] text-xs sm:text-sm bg-slate-900 cursor-pointer font-bold"
              >
                <option value="confirmed">مؤكد فوراً (اعتماد العربون) ✅</option>
                <option value="pending_verification">بانتظار التحقق من التحويل ⏳</option>
                <option value="pending_receipt">بانتظار إرسال الإيصال 📄</option>
              </select>
            </div>
          </div>

          {/* Check-in / Check-out times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">وقت الوصول</label>
              <input
                type="time"
                value={checkInTime}
                onChange={e => setCheckInTime(e.target.value)}
                className="input-field min-h-[44px] text-xs sm:text-sm font-mono text-center"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">وقت المغادرة</label>
              <input
                type="time"
                value={checkOutTime}
                onChange={e => setCheckOutTime(e.target.value)}
                className="input-field min-h-[44px] text-xs sm:text-sm font-mono text-center"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost w-1/3 py-2.5 text-xs font-medium"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-2/3 py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>جاري تسجيل الحجز...</span>
                </>
              ) : (
                <>
                  <CalendarCheck size={16} />
                  <span>تأكيد وتسجيل الحجز في التقويم</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ManualBookingModal
