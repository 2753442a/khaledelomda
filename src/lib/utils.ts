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

export function formatTime(timeStr: string): string {
  // timeStr like "15:30:00" → "3:30 م"
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'م' : 'ص'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export function isWeekendDay(date: Date): boolean {
  const day = date.getDay()
  return day === 4 || day === 5 || day === 6 // Thursday, Friday, Saturday = Saudi weekend / peak rates
}

export function getCheckInDateTime(date: Date, checkInTime: string): Date {
  const [h, m] = checkInTime.split(':').map(Number)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d
}

export function getCheckOutDateTime(date: Date, checkOutTime: string): Date {
  const [h, m] = checkOutTime.split(':').map(Number)
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

export function buildBookingWhatsAppMessage(params: {
  propertyName: string
  customerName: string
  date: string
  checkIn: string
  checkOut: string
  totalAmount: number
  depositAmount: number
  paymentMethod: string
}): string {
  return `🌴 *منتجع وبستان خالد العمدة*

📋 *تفاصيل الحجز الجديد:*
━━━━━━━━━━━━━━━━━━━
👤 الاسم: ${params.customerName}
🏡 الوحدة: ${params.propertyName}
📅 التاريخ: ${params.date}
⏰ الوصول: ${params.checkIn}
⏰ المغادرة: ${params.checkOut}
━━━━━━━━━━━━━━━━━━━
💰 الإجمالي: ${formatCurrency(params.totalAmount)}
💳 العربون: ${formatCurrency(params.depositAmount)}
🔄 طريقة الدفع: ${params.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 'نقداً عند الوصول'}
━━━━━━━━━━━━━━━━━━━
شكراً لحجزكم معنا 🌟`
}

export const STATUS_LABELS: Record<string, string> = {
  pending_receipt: 'بانتظار الإيصال',
  pending_verification: 'قيد المراجعة',
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
