import { format, addDays, isWeekend, parseISO } from 'date-fns'
import { ar } from 'date-fns/locale'

export function formatArabicDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'EEEE، d MMMM yyyy', { locale: ar })
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy')
}

/**
 * Robust 12-hour Arabic time formatter with strict operational safeguards
 * Automatically normalizes invalid check-out times (e.g. 03:00 AM -> 11:30 AM)
 */
export function formatTime(timeStr?: string | Date | null): string {
  if (!timeStr) return '—'

  let h = 0
  let m = 0

  if (timeStr instanceof Date) {
    h = timeStr.getHours()
    m = timeStr.getMinutes()
  } else if (typeof timeStr === 'string') {
    if (timeStr.includes('T')) {
      const d = new Date(timeStr)
      if (!isNaN(d.getTime())) {
        h = d.getHours()
        m = d.getMinutes()
      }
    } else {
      const parts = timeStr.split(':').map(Number)
      if (!isNaN(parts[0])) h = parts[0]
      if (!isNaN(parts[1])) m = parts[1]
    }
  }

  // Business Logic Guard: 03:00 AM is never an operational checkout/checkin time
  if (h === 3 && m === 0) {
    h = 11
    m = 30
  }

  const period = h >= 12 ? 'م' : 'ص'
  const hour12 = h % 12 || 12
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
}

export function formatCheckInTime(time?: string | Date | null): string {
  if (!time) return '03:30 م'
  let h = -1, m = -1
  if (time instanceof Date) {
    h = time.getHours()
    m = time.getMinutes()
  } else if (typeof time === 'string') {
    if (time.includes('T')) {
      const d = new Date(time)
      if (!isNaN(d.getTime())) { h = d.getHours(); m = d.getMinutes() }
    } else {
      const parts = time.split(':').map(Number)
      if (!isNaN(parts[0])) h = parts[0]
      if (!isNaN(parts[1])) m = parts[1]
    }
  }
  // Check-in safeguard: default to 03:30 PM if empty, midnight, 3 AM, or invalid
  if (h === 0 || h === 3 || h === -1) return '03:30 م'
  const period = h >= 12 ? 'م' : 'ص'
  const hour12 = h % 12 || 12
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
}

export function formatCheckOutTime(time?: string | Date | null): string {
  if (!time) return '11:30 ص'
  let h = -1, m = -1
  if (time instanceof Date) {
    h = time.getHours()
    m = time.getMinutes()
  } else if (typeof time === 'string') {
    if (time.includes('T')) {
      const d = new Date(time)
      if (!isNaN(d.getTime())) { h = d.getHours(); m = d.getMinutes() }
    } else {
      const parts = time.split(':').map(Number)
      if (!isNaN(parts[0])) h = parts[0]
      if (!isNaN(parts[1])) m = parts[1]
    }
  }
  // Check-out safeguard: default to 11:30 AM if empty, midnight, 3 AM, or invalid
  if (h === 0 || h === 3 || h === -1) return '11:30 ص'
  const period = h >= 12 ? 'م' : 'ص'
  const hour12 = h % 12 || 12
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
}

export function isWeekendDay(date: Date): boolean {
  const day = date.getDay()
  return day === 4 || day === 5 || day === 6 // Thursday, Friday, Saturday = Saudi weekend / peak rates
}

export function getCheckInDateTime(date: Date, checkInTime: string): Date {
  const [h, m] = (checkInTime || '15:30').split(':').map(Number)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d
}

export function getCheckOutDateTime(date: Date, checkOutTime: string): Date {
  let [h, m] = (checkOutTime || '11:30').split(':').map(Number)
  if (h === 3 && m === 0) { h = 11; m = 30 }
  const d = addDays(new Date(date), 1)
  d.setHours(h, m, 0, 0)
  return d
}

export function getPriceForDate(date: Date, weekdayPrice: number, weekendPrice: number): number {
  return isWeekendDay(date) ? weekendPrice : weekdayPrice
}

export function formatCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} ر.س`
}

export function generateWhatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/^0/, '966').replace(/\D/g, '')
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`
}

/**
 * Standardized WhatsApp Booking Message Template
 * Includes Addons, formatted operational times, and clean professional emojis
 */
export function buildBookingWhatsAppMessage(params: {
  customerName: string
  customerPhone?: string
  propertyName: string
  date: string | Date
  checkIn?: string | Date | null
  checkOut?: string | Date | null
  addonsListText?: string
  totalAmount: number
  depositAmount: number
  paymentMethod: string
}): string {
  const formattedDate = typeof params.date === 'string' && !params.date.includes(' ')
    ? formatArabicDate(params.date)
    : String(params.date)

  const checkInTime = formatCheckInTime(params.checkIn)
  const checkOutTime = `${formatCheckOutTime(params.checkOut)} (اليوم التالي)`
  const paymentMethodLabel = params.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 'نقداً عند الوصول'

  return `🌴 *منتجع وبستان خالد العمدة للاستثمار* 🌴
تفاصيل طلب الحجز:
📋 ــــــــــــــــــــــــــــــــــــــــ
👤 *الاسم:* ${params.customerName}
${params.customerPhone ? `📱 *الجوال:* ${params.customerPhone}\n` : ''}🏡 *الوحدة:* ${params.propertyName}
📅 *التاريخ:* ${formattedDate}
⏰ *الوصول:* ${checkInTime}
⏰ *المغادرة:* ${checkOutTime}
${params.addonsListText ? `⚡ *الإضافات:* ${params.addonsListText}\n` : ''}ــــــــــــــــــــــــــــــــــــــــ
💵 *الإجمالي:* ${Math.round(params.totalAmount).toLocaleString('en-US')} ر.س
💳 *العربون المطلـوب:* ${Math.round(params.depositAmount).toLocaleString('en-US')} ر.س
🔘 *طريقة الدفع:* ${paymentMethodLabel}
ــــــــــــــــــــــــــــــــــــــــ
🌟 نسعد بخدمتكم وتأكيد حجزكم!`
}

export const STATUS_LABELS: Record<string, string> = {
  pending_receipt: 'بانتظار الإيصال',
  pending_verification: 'بانتظار المراجعة',
  confirmed: 'مؤكد',
  cancelled: 'ملغي',
  completed: 'مكتمل',
  expired: 'منتهي',
}

export const STATUS_CLASSES: Record<string, string> = {
  pending_receipt: 'badge-pending',
  pending_verification: 'badge-pending',
  confirmed: 'badge-confirmed',
  cancelled: 'badge-cancelled',
  completed: 'badge-completed',
  expired: 'badge-expired',
}
