import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  formatArabicDate, formatCurrency, formatShortDate,
  generateWhatsAppLink, STATUS_LABELS, STATUS_CLASSES
} from '../lib/utils'
import {
  BarChart3, CalendarCheck, Clock, Settings, Users, Loader2,
  Check, X, MessageCircle, Trash2, RefreshCw, Plus, Edit3,
  AlertTriangle, Shield, ChevronRight, ChevronLeft, Home,
  CheckCircle2, XCircle, Banknote, Eye
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, parseISO, isSameDay } from 'date-fns'
import { ar } from 'date-fns/locale'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface Booking {
  id: string
  property_id: string
  customer_id: string | null
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
  created_at: string
  properties?: { name: string }
}

interface Settings {
  deposit_percentage: number
  default_check_in_time: string
  default_check_out_time: string
  bank_name: string
  bank_account_name: string
  bank_iban: string
  contact_phone: string
  contact_whatsapp: string
  resort_name: string
}

interface Property {
  id: string
  name: string
  description: string | null
  weekday_price: number
  weekend_price: number
  amenities: string[]
  max_guests: number
  is_active: boolean
}

interface Addon {
  id: string
  name: string
  description: string | null
  price: number
  total_inventory: number
  icon: string
  is_active: boolean
}

// ─────────────────────────────────────────────
// METRICS CARD
// ─────────────────────────────────────────────
const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string }> = ({
  icon, label, value, sub, color = 'emerald'
}) => (
  <div className="card p-5">
    <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-${color}-500/20 text-${color}-400`}>
      {icon}
    </div>
    <p className="text-2xl font-black text-white">{value}</p>
    <p className="text-sm text-gray-400 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
  </div>
)

// ─────────────────────────────────────────────
// ADMIN CALENDAR
// ─────────────────────────────────────────────
const AdminCalendar: React.FC<{ bookings: Booking[]; properties: Property[] }> = ({ bookings, properties }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const rawFirstDay = getDay(startOfMonth(currentMonth))
  const firstDayOfWeek = (rawFirstDay + 1) % 7

  const getBookingsForDay = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd')
    return bookings.filter(b => b.booking_date === key)
  }

  return (
    <div className="card p-5 border border-white/10 shadow-xl">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/8">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="glass p-2.5 rounded-xl hover:bg-white/10" aria-label="الشهر السابق">
          <ChevronRight size={18} />
        </button>
        <h3 className="font-bold text-white text-base">
          {format(currentMonth, 'MMMM yyyy', { locale: ar })}
        </h3>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="glass p-2.5 rounded-xl hover:bg-white/10" aria-label="الشهر القادم">
          <ChevronLeft size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map(d => (
          <div key={d} className="text-center text-xs text-gray-400 font-semibold py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const dayBookings = getBookingsForDay(day)
          const hasConfirmed = dayBookings.some(b => b.status === 'confirmed')
          const hasPending = dayBookings.some(b => ['pending_receipt', 'pending_verification'].includes(b.status))

          return (
            <div key={format(day, 'yyyy-MM-dd')} className={`
              relative min-h-[52px] rounded-lg p-1 text-center border transition-all cursor-pointer hover:bg-white/5
              ${hasConfirmed ? 'border-red-500/40 bg-red-500/10' :
                hasPending ? 'border-amber-500/40 bg-amber-500/10' :
                'border-transparent'}
            `}>
              <span className={`text-sm font-medium ${hasConfirmed ? 'text-red-400' : hasPending ? 'text-amber-400' : 'text-gray-400'}`}>
                {format(day, 'd')}
              </span>
              {dayBookings.slice(0, 2).map((b, i) => (
                <div key={b.id} className={`text-[9px] truncate px-0.5 rounded mt-0.5 leading-tight ${STATUS_CLASSES[b.status]}`}>
                  {b.customer_name.split(' ')[0]}
                </div>
              ))}
              {dayBookings.length > 2 && (
                <div className="text-[9px] text-gray-600">+{dayBookings.length - 2}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// PENDING VERIFICATION CARD
// ─────────────────────────────────────────────
const PendingCard: React.FC<{ booking: Booking; onVerify: (id: string, approved: boolean) => void; loading: boolean }> = ({
  booking, onVerify, loading
}) => {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  useEffect(() => {
    const fetchUrl = async () => {
      if (!booking.payment_receipt_url || booking.payment_receipt_url.startsWith('archived')) return
      const { data } = await supabase.storage.from('receipts').createSignedUrl(booking.payment_receipt_url, 3600)
      if (data) setReceiptUrl(data.signedUrl)
    }
    fetchUrl()
  }, [booking.payment_receipt_url])

  return (
    <div className="card p-4 border border-amber-500/20 animate-fade-in-up">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="font-bold text-white">{booking.customer_name}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLASSES[booking.status]}`}>
              {STATUS_LABELS[booking.status]}
            </span>
          </div>
          <p className="text-sm text-gray-400">{booking.customer_phone}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-emerald-400">{formatCurrency(booking.total_amount)}</p>
          <p className="text-xs text-amber-400">عربون: {formatCurrency(booking.deposit_amount)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-3">
        <span className="text-gray-400">📅 {formatShortDate(booking.booking_date)}</span>
        <span className="text-gray-400">🏡 {booking.properties?.name ?? '—'}</span>
        <span className="text-gray-400">
          💳 {booking.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'نقداً عند الوصول'}
        </span>
      </div>

      {receiptUrl && (
        <div className="mb-3">
          <button
            onClick={() => setShowReceipt(!showReceipt)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
          >
            <Eye size={12} />
            {showReceipt ? 'إخفاء الإيصال' : 'عرض الإيصال'}
          </button>
          {showReceipt && (
            <img src={receiptUrl} alt="إيصال" className="mt-2 max-h-48 rounded-lg object-contain border border-white/10" />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onVerify(booking.id, true)}
          disabled={loading}
          className="btn-primary text-xs py-2 px-3"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}
          تأكيد الحجز ✅
        </button>
        <button
          onClick={() => onVerify(booking.id, false)}
          disabled={loading}
          className="btn-danger text-xs py-2 px-3"
        >
          <X size={13} />
          رفض ❌
        </button>
        <a
          href={generateWhatsAppLink(booking.customer_phone, `السلام عليكم ${booking.customer_name}، بخصوص حجزكم بتاريخ ${formatShortDate(booking.booking_date)}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-xs py-2 px-3"
        >
          <MessageCircle size={13} />
          واتساب 💬
        </a>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SETTINGS TAB
// ─────────────────────────────────────────────
const SettingsTab: React.FC<{ settings: Settings; onSave: (s: Settings) => Promise<void> }> = ({ settings: initial, onSave }) => {
  const [form, setForm] = useState<Settings>(initial)
  const [saving, setSaving] = useState(false)
  const [purging, setPurging] = useState(false)
  const [saved, setSaved] = useState(false)
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null)

  const set = (key: keyof Settings, val: string | number) =>
    setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    await onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  const handlePurge = async () => {
    setPurging(true)
    setPurgeMsg(null)
    const { error } = await supabase.rpc('purge_old_receipts')
    if (error) setPurgeMsg('⚠️ خطأ: ' + error.message)
    else setPurgeMsg('✅ تم تنظيف الإيصالات المنتهية بنجاح')
    setPurging(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><Banknote size={18} className="text-amber-400" /> إعدادات الدفع</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">نسبة العربون (%)</label>
            <input type="number" min={1} max={100} value={form.deposit_percentage}
              onChange={e => set('deposit_percentage', Number(e.target.value))} className="input-field min-h-[48px]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">اسم البنك</label>
            <input type="text" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="input-field min-h-[48px]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">اسم صاحب الحساب</label>
            <input type="text" value={form.bank_account_name} onChange={e => set('bank_account_name', e.target.value)} className="input-field min-h-[48px]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">رقم الآيبان (IBAN)</label>
            <input type="text" value={form.bank_iban} onChange={e => set('bank_iban', e.target.value)} className="input-field min-h-[48px] font-mono text-left" dir="ltr" />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><Clock size={18} className="text-blue-400" /> أوقات الوصول والمغادرة</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">وقت الوصول (Check-in)</label>
            <input type="time" value={form.default_check_in_time} onChange={e => set('default_check_in_time', e.target.value)} className="input-field min-h-[48px]" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">وقت المغادرة (Check-out)</label>
            <input type="time" value={form.default_check_out_time} onChange={e => set('default_check_out_time', e.target.value)} className="input-field min-h-[48px]" dir="ltr" />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><MessageCircle size={18} className="text-green-400" /> معلومات التواصل</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">هاتف التواصل</label>
            <input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="input-field min-h-[48px] text-right font-mono" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">واتساب</label>
            <input type="tel" value={form.contact_whatsapp} onChange={e => set('contact_whatsapp', e.target.value)} className="input-field min-h-[48px] text-right font-mono" dir="ltr" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary min-h-[48px]">
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
          {saved ? 'تم الحفظ ✓' : 'حفظ الإعدادات'}
        </button>
        <button onClick={handlePurge} disabled={purging} className="btn-ghost min-h-[48px] flex items-center gap-2">
          {purging ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          تنظيف الإيصالات المنتهية
        </button>
      </div>

      {purgeMsg && (
        <div className={`p-3 rounded-xl text-sm ${purgeMsg.startsWith('✅') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {purgeMsg}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// PROPERTIES TAB
// ─────────────────────────────────────────────
const PropertiesTab: React.FC<{ properties: Property[]; onRefresh: () => void }> = ({ properties, onRefresh }) => {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', weekday_price: '', weekend_price: '', max_guests: '50', amenities: '' })
  const [saving, setSaving] = useState(false)

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    const data = {
      name: form.name,
      description: form.description,
      weekday_price: Number(form.weekday_price),
      weekend_price: Number(form.weekend_price),
      max_guests: Number(form.max_guests),
      amenities: form.amenities.split('،').map(a => a.trim()).filter(Boolean),
    }

    if (editingId) {
      await supabase.from('properties').update(data).eq('id', editingId)
    } else {
      await supabase.from('properties').insert(data)
    }

    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', description: '', weekday_price: '', weekend_price: '', max_guests: '50', amenities: '' })
    onRefresh()
    setSaving(false)
  }

  const startEdit = (p: Property) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description ?? '',
      weekday_price: String(p.weekday_price),
      weekend_price: String(p.weekend_price),
      max_guests: String(p.max_guests),
      amenities: p.amenities.join('، '),
    })
    setShowForm(true)
  }

  const toggleActive = async (p: Property) => {
    await supabase.from('properties').update({ is_active: !p.is_active }).eq('id', p.id)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white">الوحدات والاستراحات</h3>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', description: '', weekday_price: '', weekend_price: '', max_guests: '50', amenities: '' }) }}
          className="btn-primary text-sm py-2 px-3">
          <Plus size={15} />
          إضافة وحدة
        </button>
      </div>

      {showForm && (
        <div className="card p-5 border border-emerald-500/25 animate-fade-in-up">
          <h4 className="font-bold text-white mb-4">{editingId ? 'تعديل الوحدة' : 'إضافة وحدة جديدة'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">اسم الوحدة *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="input-field min-h-[48px]" placeholder="مثال: الاستراحة الكبيرة" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">الوصف</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="input-field min-h-[72px] resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">سعر الأيام العادية (ر.س)</label>
              <input type="number" value={form.weekday_price} onChange={e => set('weekday_price', e.target.value)} className="input-field min-h-[48px]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">سعر العطل (ر.س)</label>
              <input type="number" value={form.weekend_price} onChange={e => set('weekend_price', e.target.value)} className="input-field min-h-[48px]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">أقصى عدد ضيوف</label>
              <input type="number" value={form.max_guests} onChange={e => set('max_guests', e.target.value)} className="input-field min-h-[48px]" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">المرافق (مفصولة بـ ،)</label>
              <input type="text" value={form.amenities} onChange={e => set('amenities', e.target.value)} className="input-field min-h-[48px]" placeholder="مسبح، مطبخ، مجلس VIP" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="btn-ghost min-h-[48px] text-sm py-2 px-5">إلغاء</button>
            <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary min-h-[48px] text-sm py-2 px-5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editingId ? 'حفظ التعديلات' : 'إضافة'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {properties.map(p => (
          <div key={p.id} className={`card p-4 ${!p.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-white">{p.name}</h4>
                {!p.is_active && <span className="text-xs badge-cancelled px-2 py-0.5 rounded-full">معطّل</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(p)} className="glass p-2 rounded-lg hover:bg-white/10">
                  <Edit3 size={13} />
                </button>
                <button onClick={() => toggleActive(p)} className={`glass p-2 rounded-lg ${p.is_active ? 'hover:bg-red-500/10' : 'hover:bg-emerald-500/10'}`}>
                  {p.is_active ? <XCircle size={13} className="text-red-400" /> : <CheckCircle2 size={13} className="text-emerald-400" />}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
              <span>أيام عادية: <span className="text-white font-medium">{formatCurrency(p.weekday_price)}</span></span>
              <span>عطل: <span className="text-white font-medium">{formatCurrency(p.weekend_price)}</span></span>
              <span>ضيوف: <span className="text-white font-medium">{p.max_guests}</span></span>
            </div>
            {p.amenities.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {p.amenities.map((a, i) => <span key={i} className="text-xs glass px-2 py-0.5 rounded-full text-gray-300">{a}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ADDONS TAB
// ─────────────────────────────────────────────
const AddonsTab: React.FC<{ addons: Addon[]; onRefresh: () => void }> = ({ addons, onRefresh }) => {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', price: '', total_inventory: '1', icon: 'Zap' })
  const [saving, setSaving] = useState(false)

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    const data = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      total_inventory: Number(form.total_inventory),
      icon: form.icon,
    }
    if (editingId) {
      await supabase.from('addons').update(data).eq('id', editingId)
    } else {
      await supabase.from('addons').insert(data)
    }
    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', description: '', price: '', total_inventory: '1', icon: 'Zap' })
    onRefresh()
    setSaving(false)
  }

  const startEdit = (a: Addon) => {
    setEditingId(a.id)
    setForm({ name: a.name, description: a.description ?? '', price: String(a.price), total_inventory: String(a.total_inventory), icon: a.icon })
    setShowForm(true)
  }

  const toggleActive = async (a: Addon) => {
    await supabase.from('addons').update({ is_active: !a.is_active }).eq('id', a.id)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white">الإضافات المتاحة</h3>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', description: '', price: '', total_inventory: '1', icon: 'Zap' }) }}
          className="btn-primary text-sm py-2 px-3">
          <Plus size={15} />
          إضافة
        </button>
      </div>

      {showForm && (
        <div className="card p-5 border border-emerald-500/25 animate-fade-in-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">الاسم *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="input-field min-h-[48px]" placeholder="سكوتر كهربائي" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">السعر (ر.س)</label>
              <input type="number" value={form.price} onChange={e => set('price', e.target.value)} className="input-field min-h-[48px]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">المخزون الكلي</label>
              <input type="number" value={form.total_inventory} onChange={e => set('total_inventory', e.target.value)} className="input-field min-h-[48px]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">الأيقونة</label>
              <input type="text" value={form.icon} onChange={e => set('icon', e.target.value)} className="input-field min-h-[48px]" placeholder="Zap" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="btn-ghost min-h-[48px] text-sm py-2 px-5">إلغاء</button>
            <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary min-h-[48px] text-sm py-2 px-5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editingId ? 'حفظ' : 'إضافة'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {addons.map(a => (
          <div key={a.id} className={`card p-4 flex items-center justify-between ${!a.is_active ? 'opacity-60' : ''}`}>
            <div>
              <p className="font-semibold text-white">{a.name}</p>
              <p className="text-sm text-gray-400">{formatCurrency(a.price)} / قطعة • مخزون: {a.total_inventory}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(a)} className="glass p-2 rounded-lg hover:bg-white/10"><Edit3 size={13} /></button>
              <button onClick={() => toggleActive(a)} className="glass p-2 rounded-lg">
                {a.is_active ? <XCircle size={13} className="text-red-400" /> : <CheckCircle2 size={13} className="text-emerald-400" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN ADMIN PAGE
// ─────────────────────────────────────────────
type Tab = 'overview' | 'pending' | 'bookings' | 'properties' | 'addons' | 'settings'

const AdminPage: React.FC = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [addons, setAddons] = useState<Addon[]>([])
  const [loading, setLoading] = useState(true)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      navigate('/')
    }
  }, [profile])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: b }, { data: s }, { data: p }, { data: a }] = await Promise.all([
      supabase.from('bookings').select('*, properties(name)').order('created_at', { ascending: false }),
      supabase.from('resort_settings').select('*').eq('id', 1).single(),
      supabase.from('properties').select('*').order('name'),
      supabase.from('addons').select('*').order('name'),
    ])
    if (b) setBookings(b)
    if (s) setSettings(s)
    if (p) setProperties(p)
    if (a) setAddons(a)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleVerify = async (id: string, approved: boolean) => {
    setVerifyingId(id)
    await supabase.from('bookings').update({
      status: approved ? 'confirmed' : 'cancelled',
      ...(approved ? {} : { cancellation_reason: 'رُفض من قِبل الإدارة', cancelled_at: new Date().toISOString() }),
    }).eq('id', id)
    await fetchAll()
    setVerifyingId(null)
  }

  const handleSaveSettings = async (s: Settings) => {
    await supabase.from('resort_settings').update(s).eq('id', 1)
    setSettings(s)
  }

  const pending = bookings.filter(b => b.status === 'pending_verification')
  const confirmed = bookings.filter(b => b.status === 'confirmed')
  const totalRevenue = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + b.deposit_amount, 0)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={32} className="text-emerald-400 animate-spin" />
    </div>
  )

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: <BarChart3 size={16} /> },
    { id: 'pending', label: 'بانتظار المراجعة', icon: <Clock size={16} />, badge: pending.length },
    { id: 'bookings', label: 'جميع الحجوزات', icon: <CalendarCheck size={16} /> },
    { id: 'properties', label: 'الوحدات', icon: <Home size={16} /> },
    { id: 'addons', label: 'الإضافات', icon: <Zap size={16} /> },
    { id: 'settings', label: 'الإعدادات', icon: <Settings size={16} /> },
  ]

  return (
    <div className="min-h-screen pt-16">
      {/* Admin top bar */}
      <div className="border-b border-white/8 bg-[#161b22]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2">
          <Shield size={16} className="text-amber-400" />
          <span className="text-sm font-semibold text-amber-400">لوحة تحكم المالك</span>
          <span className="text-gray-600">—</span>
          <span className="text-sm text-gray-400">مرحباً، {profile?.full_name}</span>
          <button onClick={fetchAll} className="mr-auto glass p-1.5 rounded-lg hover:bg-white/10">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto custom-scrollbar pb-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'glass text-gray-400 hover:text-white hover:bg-white/8'
              }`}
            >
              {t.icon}
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="bg-amber-500 text-black text-xs rounded-full px-1.5 py-0.5 font-bold leading-none">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard icon={<Banknote size={20} />} label="إجمالي الإيرادات" value={formatCurrency(totalRevenue)} sub="من العربونات المؤكدة" color="emerald" />
              <MetricCard icon={<CalendarCheck size={20} />} label="حجوزات مؤكدة" value={confirmed.length} color="blue" />
              <MetricCard icon={<Clock size={20} />} label="قيد المراجعة" value={pending.length} color="amber" />
              <MetricCard icon={<Users size={20} />} label="إجمالي الحجوزات" value={bookings.length} color="purple" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-white mb-3">تقويم الحجوزات</h3>
                <AdminCalendar bookings={bookings} properties={properties} />
              </div>
              <div>
                <h3 className="font-bold text-white mb-3">آخر الحجوزات</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                  {bookings.slice(0, 8).map(b => (
                    <div key={b.id} className="card p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-white">{b.customer_name}</p>
                        <p className="text-xs text-gray-500">{formatShortDate(b.booking_date)} • {b.properties?.name ?? '—'}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLASSES[b.status]}`}>
                        {STATUS_LABELS[b.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <div>
            <h3 className="font-bold text-white mb-4">
              الحجوزات بانتظار المراجعة
              {pending.length > 0 && <span className="mr-2 text-amber-400">({pending.length})</span>}
            </h3>
            {pending.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد حجوزات بانتظار المراجعة</p>
              </div>
            ) : (
              <div className="space-y-4 max-w-2xl">
                {pending.map(b => (
                  <PendingCard
                    key={b.id}
                    booking={b}
                    onVerify={handleVerify}
                    loading={verifyingId === b.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'bookings' && (
          <div>
            <h3 className="font-bold text-white mb-4">جميع الحجوزات ({bookings.length})</h3>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    {['العميل', 'الوحدة', 'التاريخ', 'الإجمالي', 'العربون', 'الحالة', ''].map(h => (
                      <th key={h} className="text-right px-4 py-3 text-xs text-gray-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{b.customer_name}</p>
                        <p className="text-xs text-gray-500">{b.customer_phone}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{b.properties?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-300">{formatShortDate(b.booking_date)}</td>
                      <td className="px-4 py-3 font-medium text-white">{formatCurrency(b.total_amount)}</td>
                      <td className="px-4 py-3 text-amber-400">{formatCurrency(b.deposit_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLASSES[b.status]}`}>
                          {STATUS_LABELS[b.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={generateWhatsAppLink(b.customer_phone, `السلام عليكم ${b.customer_name}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass p-1.5 rounded-lg inline-flex hover:bg-white/10"
                        >
                          <MessageCircle size={13} className="text-green-400" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'properties' && (
          <PropertiesTab properties={properties} onRefresh={fetchAll} />
        )}

        {activeTab === 'addons' && (
          <AddonsTab addons={addons} onRefresh={fetchAll} />
        )}

        {activeTab === 'settings' && settings && (
          <SettingsTab settings={settings} onSave={handleSaveSettings} />
        )}
      </div>
    </div>
  )
}

// need to fix missing import
const Zap: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

export default AdminPage
