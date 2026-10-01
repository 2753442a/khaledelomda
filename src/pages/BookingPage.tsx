import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, CreditCard, LockKeyhole, ShieldCheck, Users, WalletCards } from 'lucide-react'
import { Button, Busy, EmptyState, PageIntro, Price, toast } from '../components/ui'
import { useAuth } from '../lib/auth'
import { dateLabel, durationLabel, imageUrl, placeholderImages, type AddOn, type ResortPackage, type ResortSettings, type Unit } from '../lib/models'
import { supabase, supabaseConfigured } from '../lib/supabase'

type BusyInterval = { starts_at: string; ends_at: string; kind: 'booked' | 'closed' }
type Quote = { unit_amount: number; package_amount: number; addons_amount: number; discount_amount: number; total_amount: number; currency: string; requestKey: string }

const ksaDate = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Riyadh' }).format(date)
const dateAtNoon = (value: string) => new Date(`${value}T12:00:00Z`)
const minutes = (time: string) => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute }
const timeValue = (value: number) => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

function slotStart(date: string, time: string) { return new Date(`${date}T${time}:00+03:00`) }

function slotChoices(pkg: ResortPackage | null) {
  if (!pkg) return []
  const first = minutes(pkg.start_window_start)
  const last = minutes(pkg.start_window_end)
  const values: string[] = []
  for (let cursor = first; cursor <= last; cursor += 30) values.push(timeValue(cursor))
  return values
}

function overlap(start: Date, end: Date, block: BusyInterval) {
  return start < new Date(block.ends_at) && end > new Date(block.starts_at)
}

function messageForBookingError(message: string) {
  if (/public preview is read.only/i.test(message)) return 'هذه معاينة تجريبية للعرض فقط؛ لا يمكن إنشاء حجوزات فعلية منها.'
  if (/overlap|conflict|not available/i.test(message)) return 'هذا الموعد حُجز للتو أو لم يعد متاحًا. اختر وقتًا آخر.'
  if (/closed/i.test(message)) return 'هذا الوقت مغلق من قبل المنتجع. اختر وقتًا آخر.'
  if (/coupon/i.test(message)) return 'الكوبون غير صالح أو انتهى رصيده أو لا ينطبق على هذا الحجز.'
  if (/expired/i.test(message)) return 'انتهت مهلة الحجز. ابدأ طلبًا جديدًا للتحقق من التوفر.'
  if (/capacity|guest/i.test(message)) return 'عدد الضيوف يتجاوز سعة الاستراحة.'
  if (/package|duration/i.test(message)) return 'تغيّرت تفاصيل الباقة. حدّث الصفحة وحاول مرة أخرى.'
  if (/terms/i.test(message)) return 'يجب الموافقة على الشروط قبل المتابعة.'
  return 'تعذر إتمام الحجز. راجع اختياراتك أو حاول مجددًا.'
}

function Calendar({ value, onChange, intervals, pkg, unitId }: { value: string; onChange: (value: string) => void; intervals: BusyInterval[]; pkg: ResortPackage | null; unitId: string }) {
  const today = ksaDate(new Date())
  const [viewMonth, setViewMonth] = useState(() => dateAtNoon(value || today).getUTCMonth())
  const [viewYear, setViewYear] = useState(() => dateAtNoon(value || today).getUTCFullYear())
  const monthStart = new Date(Date.UTC(viewYear, viewMonth, 1))
  const firstDay = monthStart.getUTCDay()
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate()
  const monthLabel = new Intl.DateTimeFormat('ar-SA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthStart)
  const timeOptions = slotChoices(pkg)

  const canBookDate = (day: number) => {
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return timeOptions.some((time) => {
      const start = slotStart(key, time)
      const end = new Date(start.getTime() + (pkg?.duration_minutes ?? 0) * 60_000)
      return start > new Date() && !intervals.some((interval) => overlap(start, end, interval))
    })
  }

  const moveMonth = (direction: number) => {
    const changed = new Date(Date.UTC(viewYear, viewMonth + direction, 1))
    if (changed.getTime() < new Date(Date.UTC(new Date(today).getUTCFullYear(), new Date(today).getUTCMonth(), 1)).getTime()) return
    if ((changed.getTime() - Date.UTC(new Date(today).getUTCFullYear(), new Date(today).getUTCMonth(), 1)) / 86400000 > 90) return
    setViewMonth(changed.getUTCMonth())
    setViewYear(changed.getUTCFullYear())
  }

  return <div className="calendar-widget" data-unit={unitId}>
    <div className="calendar-head"><button type="button" aria-label="الشهر السابق" onClick={() => moveMonth(-1)}><ChevronRight size={18} /></button><strong>{monthLabel}</strong><button type="button" aria-label="الشهر التالي" onClick={() => moveMonth(1)}><ChevronLeft size={18} /></button></div>
    <div className="calendar-grid calendar-weekdays">{['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid calendar-days">{Array.from({ length: firstDay }, (_, index) => <span className="calendar-blank" key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const available = canBookDate(day)
      const isPast = key < today
      const isSelected = key === value
      return <button type="button" key={key} disabled={!available || isPast || !pkg} className={`${isSelected ? 'selected' : ''} ${available && !isPast ? 'available' : ''}`} aria-pressed={isSelected} aria-label={`${day} ${monthLabel}${available ? '، متاح' : '، غير متاح'}`} onClick={() => onChange(key)}>{day}{available && !isPast && <i />}</button>
    })}</div>
    <div className="calendar-legend"><span><i className="legend-dot available-dot" />متاح</span><span><i className="legend-dot" />غير متاح</span></div>
  </div>
}

function MoyasarForm({ bookingId, amount, bookingNumber, onError }: { bookingId: string; amount: number; bookingNumber: string; onError: (message: string) => void }) {
  const publishableKey = import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY
  const [ready, setReady] = useState(false)
  const callbackUrl = `${window.location.origin}/#/payment/result?booking_id=${encodeURIComponent(bookingId)}`

  useEffect(() => {
    if (!publishableKey) { onError('الدفع الإلكتروني غير مهيأ؛ اختر الدفع في الموقع أو تواصل مع المنتجع.'); return }
    let active = true
    const styleId = 'moyasar-theme'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('link')
      style.id = styleId
      style.rel = 'stylesheet'
      style.href = 'https://cdn.moyasar.com/mpf/1.14.0/moyasar.css'
      document.head.appendChild(style)
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-moyasar]')
    const init = () => {
      if (!active || !window.Moyasar) return
      try {
        window.Moyasar.init({
          element: '#moyasar-form', amount: Math.round(amount * 100), currency: 'SAR',
          description: `حجز المنتجع رقم ${bookingNumber}`, publishable_api_key: publishableKey,
          callback_url: callbackUrl, methods: ['creditcard'], language: 'ar',
          metadata: { booking_id: bookingId },
        })
        setReady(true)
      } catch { onError('تعذر فتح نموذج الدفع. تواصل مع المنتجع أو اختر الدفع في الموقع.') }
    }
    if (existing && window.Moyasar) init()
    else if (existing) existing.addEventListener('load', init, { once: true })
    else {
      const script = document.createElement('script')
      script.src = 'https://cdn.moyasar.com/mpf/1.14.0/moyasar.js'
      script.async = true
      script.dataset.moyasar = 'true'
      script.onload = init
      script.onerror = () => onError('تعذر تحميل بوابة الدفع. اختر الدفع في الموقع أو حاول لاحقًا.')
      document.body.appendChild(script)
    }
    return () => { active = false }
  }, [publishableKey, amount, bookingId, bookingNumber, callbackUrl, onError])

  return <div className="payment-form-wrap"><p>أدخل بيانات بطاقتك داخل نموذج Moyasar الآمن. بيانات البطاقة لا تمر عبر خادم المنتجع.</p><div id="moyasar-form" className="mysr-form" />{!ready && <div className="payment-form-loading"><Busy label="نجهّز نموذج الدفع الآمن" /></div>}<div className="payment-secure-note"><LockKeyhole size={15} /> دفع آمن مشفّر عبر Moyasar</div></div>
}

export function BookingPage() {
  const { unitId } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [unit, setUnit] = useState<Unit | null>(null)
  const [packages, setPackages] = useState<ResortPackage[]>([])
  const [addons, setAddons] = useState<AddOn[]>([])
  const [settings, setSettings] = useState<ResortSettings | null>(null)
  const [busyIntervals, setBusyIntervals] = useState<BusyInterval[]>([])
  const [selectedPackage, setSelectedPackage] = useState('')
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [date, setDate] = useState(ksaDate(new Date()))
  const [startTime, setStartTime] = useState('')
  const [guests, setGuests] = useState(2)
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState('')
  const [savedQuote, setSavedQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const quoteRequest = useRef(0)
  const submitLock = useRef(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'online'>('cash')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [booking, setBooking] = useState<{ id: string; booking_number: number; total_amount: number } | null>(null)
  const [paymentError, setPaymentError] = useState('')

  useEffect(() => {
    let active = true
    if (!unitId || !supabaseConfigured) { setLoading(false); return }
    const load = async () => {
      const [unitResult, settingsResult] = await Promise.all([
        supabase.from('units').select('*').eq('id', unitId).eq('published', true).maybeSingle(),
        supabase.from('resort_settings').select('*').eq('id', true).maybeSingle(),
      ])
      if (!active) return
      setUnit(unitResult.data as Unit | null)
      const loadedSettings = settingsResult.data as ResortSettings | null
      setSettings(loadedSettings)
      if (loadedSettings && !loadedSettings.cash_enabled && loadedSettings.bank_transfer_enabled) setPaymentMethod('bank_transfer')
      const [packageResult, addonResult] = await Promise.all([
        supabase.from('packages').select('*,package_features(*),package_units!inner(unit_id)').eq('active', true).eq('package_units.unit_id', unitId).order('sort_order'),
        supabase.from('add_ons').select('*,unit_add_ons!inner(unit_id),package_add_ons(package_id)').eq('active', true).eq('unit_add_ons.unit_id', unitId).order('sort_order'),
      ])
      if (!active) return
      const packageRows = (packageResult.data ?? []) as unknown as ResortPackage[]
      const addonRows = (addonResult.data ?? []) as unknown as AddOn[]
      setPackages(packageRows)
      setAddons(addonRows)
      setSelectedPackage(packageRows[0]?.id ?? '')
      setSelectedAddons(addonRows.filter((item) => item.required).map((item) => item.id))
      if (unitResult.error || packageResult.error) toast('تعذر تحميل خيارات الحجز.', 'error')
    }
    load().catch(() => toast('تعذر تحميل خيارات الحجز.', 'error')).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [unitId])

  const pkg = packages.find((item) => item.id === selectedPackage) ?? null
  const quoteRequestKey = [unitId ?? '', pkg?.id ?? '', selectedAddons.join(','), coupon].join('|')
  const quote = savedQuote?.requestKey === quoteRequestKey ? savedQuote : null
  const availableAddons = useMemo(() => addons.filter((item) => !item.package_add_ons?.length || item.package_add_ons.some((row) => row.package_id === selectedPackage)), [addons, selectedPackage])
  const visibleSlots = useMemo(() => slotChoices(pkg).filter((time) => {
    if (!date || !pkg) return false
    const start = slotStart(date, time)
    const end = new Date(start.getTime() + pkg.duration_minutes * 60_000)
    return start > new Date() && !busyIntervals.some((interval) => overlap(start, end, interval))
  }), [pkg, date, busyIntervals])

  useEffect(() => {
    if (!unitId || !date || !supabaseConfigured) return
    const current = dateAtNoon(date)
    const monthStart = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
    supabase.rpc('get_unit_availability', { p_unit_id: unitId, p_from: monthStart, p_to: monthEnd })
      .then(({ data, error }) => {
        if (error) toast('تعذر تحديث مواعيد التوفر.', 'error')
        else setBusyIntervals((data ?? []) as BusyInterval[])
      })
  }, [unitId, date])

  useEffect(() => {
    const requestId = ++quoteRequest.current
    if (!unitId || !pkg || !supabaseConfigured) { setSavedQuote(null); setQuoteLoading(false); return }
    setQuoteLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('get_booking_quote', {
          p_unit_id: unitId, p_package_id: pkg.id, p_add_on_ids: selectedAddons, p_coupon_code: coupon || null,
        })
        if (requestId !== quoteRequest.current) return
        if (error) { setSavedQuote(null); if (coupon) toast('الكوبون غير صالح أو لا ينطبق على اختياراتك.', 'error'); return }
        setSavedQuote({ ...(data as Omit<Quote, 'requestKey'>), requestKey: quoteRequestKey })
      } catch {
        if (requestId === quoteRequest.current) {
          setSavedQuote(null)
          toast('تعذر تحديث السعر. تحقق من الاتصال وحاول مجددًا.', 'error')
        }
      } finally {
        if (requestId === quoteRequest.current) setQuoteLoading(false)
      }
    }, 280)
    return () => {
      window.clearTimeout(timer)
      if (requestId === quoteRequest.current) quoteRequest.current++
    }
  }, [unitId, pkg?.id, selectedAddons.join(','), coupon])

  const toggleAddon = (addon: AddOn) => setSelectedAddons((current) => current.includes(addon.id) ? current.filter((id) => id !== addon.id) : [...current, addon.id])
  const applyCoupon = () => { setCoupon(couponInput.trim().toUpperCase()); if (!couponInput.trim()) toast('اكتب رمز الكوبون أولاً.', 'error') }
  const submitBooking = async () => {
    if (submitLock.current) return
    if (!user) return navigate(`/login?next=${encodeURIComponent(location.pathname)}`)
    if (!pkg || !date || !startTime || !termsAccepted || !quote || quoteLoading) return toast('أكمل التاريخ والوقت والباقة والموافقة على الشروط وانتظر تحديث السعر.', 'error')
    if (paymentMethod === 'online' && quote.total_amount <= 0) return toast('لا يمكن تنفيذ دفع إلكتروني بقيمة صفر. اختر الدفع في المنتجع.', 'error')
    if (paymentMethod === 'online' && !import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY) return toast('الدفع الإلكتروني غير مهيأ بعد. اختر الدفع في الموقع.', 'error')
    submitLock.current = true
    setSubmitting(true)
    try {
      const start = slotStart(date, startTime)
      const end = new Date(start.getTime() + pkg.duration_minutes * 60_000)
      const { data, error } = await supabase.rpc('create_booking_with_terms', {
        p_unit_id: unitId,
        p_package_id: pkg.id,
        p_starts_at: start.toISOString(),
        p_ends_at: end.toISOString(),
        p_guest_count: guests,
        p_terms_accepted: termsAccepted,
        p_terms_text: `${settings?.terms ?? ''}\n\n${settings?.cancellation_policy ?? ''}`,
        p_add_on_ids: selectedAddons,
        p_coupon_code: coupon || null,
        p_payment_method: paymentMethod,
      })
      if (error || !data) {
        toast(messageForBookingError(error?.message ?? ''), 'error')
        return
      }
      if (paymentMethod === 'cash' || paymentMethod === 'bank_transfer') {
        navigate(`/bookings/${data}`)
        return
      }
      const { data: row, error: bookingError } = await supabase.from('bookings').select('id,booking_number,total_amount').eq('id', data).single()
      if (bookingError || !row) {
        toast('تم إنشاء طلب الحجز، لكن تعذر فتح خطوة الدفع. راجع حجوزاتك قبل بدء طلب آخر.', 'error')
        navigate(`/bookings/${data}`)
        return
      }
      setBooking(row as { id: string; booking_number: number; total_amount: number })
      window.scrollTo({ top: document.querySelector('.booking-panel')?.getBoundingClientRect().top ?? 0, behavior: 'smooth' })
    } catch {
      toast('تعذر تأكيد استجابة الخادم. راجع حجوزاتك قبل إعادة المحاولة لتجنب إنشاء طلب مكرر.', 'error')
      navigate('/bookings')
    } finally {
      setSubmitting(false)
      submitLock.current = false
    }
  }

  if (loading) return <main className="inner-page"><Busy label="نجهّز نموذج الحجز" /></main>
  if (!unit) return <main className="inner-page section-wrap"><EmptyState title="الاستراحة غير متاحة" body="تحقق من الرابط أو اختر مساحة أخرى." action={<Link className="text-link" to="/units">استعراض الاستراحات <ChevronLeft size={16} /></Link>} /></main>
  if (!packages.length) return <main className="inner-page section-wrap"><PageIntro eyebrow="الحجز" title="لا توجد باقات متاحة بعد" body="سيضيف المنتجع باقاته قريبًا. يمكنك إرسال استفسار عن هذه الاستراحة." /><Link to={`/inquiry?unit_id=${unit.id}`} className="button button-primary">إرسال استفسار <ArrowLeft size={16} /></Link></main>

  return <main className="inner-page section-wrap booking-page">
    <PageIntro eyebrow="خطوة نحو وقت أجمل" title="أكمل تفاصيل حجزك" body={`اختيارك لـ ${unit.name}. سنعرض السعر النهائي قبل إنشاء الحجز.`} />
    {!user && <div className="login-required"><ShieldCheck size={19} /><div><strong>تحتاج إلى تسجيل الدخول قبل التأكيد</strong><span>يمكنك استكشاف التواريخ والخيارات أولاً، ثم تسجيل الدخول للمتابعة.</span></div><Link to={`/login?next=${encodeURIComponent(window.location.pathname)}`} className="text-link">تسجيل الدخول <ChevronLeft size={16} /></Link></div>}
    <div className="booking-layout"><div className="booking-main">
      <section className="booking-step"><div className="step-heading"><span>01</span><div><h2>اختر الباقة</h2><p>مدة الحجز ووقت البداية المسموح موضحان لكل خيار.</p></div></div><div className="package-choice-list">{packages.map((item) => <label className={`package-choice ${selectedPackage === item.id ? 'selected' : ''}`} key={item.id}><input type="radio" name="package" value={item.id} checked={selectedPackage === item.id} onChange={() => { setSelectedPackage(item.id); setStartTime(''); setSelectedAddons(addons.filter((addon) => addon.required && (!addon.package_add_ons?.length || addon.package_add_ons.some((row) => row.package_id === item.id))).map((addon) => addon.id)) }} /><span className="radio-ui" /><span className="package-choice-copy"><strong>{item.name}</strong><small>{durationLabel(item.duration_minutes)} · بداية من {item.start_window_start.slice(0, 5)} إلى {item.start_window_end.slice(0, 5)}</small>{item.description && <em>{item.description}</em>}</span><Price value={item.price} /></label>)}</div></section>
      <section className="booking-step"><div className="step-heading"><span>02</span><div><h2>حدّد اليوم والوقت</h2><p>التوفر يتحدث من قاعدة بيانات المنتجع مباشرة.</p></div></div><Calendar value={date} onChange={(value) => { setDate(value); setStartTime('') }} intervals={busyIntervals} pkg={pkg} unitId={unit.id} /><div className="time-choice-heading"><strong>الأوقات المتاحة</strong>{date && <span>{dateLabel(slotStart(date, '12:00').toISOString())}</span>}</div>{visibleSlots.length ? <div className="time-slot-list">{visibleSlots.map((time) => <button type="button" key={time} className={startTime === time ? 'selected' : ''} aria-pressed={startTime === time} onClick={() => setStartTime(time)}>{new Intl.DateTimeFormat('ar-SA', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(slotStart(date, time))}</button>)}</div> : <div className="no-slots"><Clock3 size={17} />لا توجد أوقات متاحة في هذا اليوم. اختر تاريخًا آخر.</div>}</section>
      <section className="booking-step"><div className="step-heading"><span>03</span><div><h2>من يرافقك؟</h2><p>الحد الأعلى لهذه الاستراحة {unit.max_guests} ضيوف.</p></div></div><div className="guest-counter"><div><Users /><div><strong>عدد الضيوف</strong><small>يشمل الأطفال</small></div></div><div className="counter-controls"><button type="button" disabled={guests <= 1} aria-label="تقليل عدد الضيوف" onClick={() => setGuests((count) => Math.max(1, count - 1))}>−</button><strong>{guests}</strong><button type="button" disabled={guests >= unit.max_guests} aria-label="زيادة عدد الضيوف" onClick={() => setGuests((count) => Math.min(unit.max_guests, count + 1))}>+</button></div></div></section>
      {availableAddons.length > 0 && <section className="booking-step"><div className="step-heading"><span>04</span><div><h2>أضف لمستك الخاصة</h2><p>تُضاف الخدمات المختارة إلى السعر النهائي قبل التأكيد.</p></div></div><div className="booking-addons">{availableAddons.map((addon) => <label key={addon.id} className={`booking-addon ${selectedAddons.includes(addon.id) ? 'checked' : ''}`}><input type="checkbox" checked={selectedAddons.includes(addon.id)} disabled={addon.required} onChange={() => toggleAddon(addon)} /><span className="check-ui"><Check size={13} /></span><span className="addon-copy"><strong>{addon.name}{addon.required && <small className="required-label">مطلوبة</small>}</strong><small>{addon.description}</small></span><Price value={addon.price} compact /></label>)}</div></section>}
      <section className="booking-step"><div className="step-heading"><span>05</span><div><h2>طريقة الدفع</h2><p>لا تُحصّل أي مبالغ داخل الموقع. يُعتمد الدفع بعد استلامه وتسجيله.</p></div></div><div className="payment-choice-list">{settings?.cash_enabled && <label className={`payment-choice ${paymentMethod === 'cash' ? 'selected' : ''}`}><input type="radio" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} /><span className="payment-choice-icon"><WalletCards /></span><span><strong>نقدًا في المنتجع</strong><small>يُسجّل المبلغ بعد استلامه عند الوصول.</small></span></label>}{settings?.bank_transfer_enabled && <label className={`payment-choice ${paymentMethod === 'bank_transfer' ? 'selected' : ''}`}><input type="radio" name="payment" value="bank_transfer" checked={paymentMethod === 'bank_transfer'} onChange={() => setPaymentMethod('bank_transfer')} /><span className="payment-choice-icon"><CreditCard /></span><span><strong>تحويل بنكي</strong><small>يبقى الطلب بانتظار التحقق من التحويل.</small></span></label>}{!settings?.cash_enabled && !settings?.bank_transfer_enabled && <div className="no-payment"><WalletCards size={18} />طرق الدفع غير متاحة حاليًا. تواصل مع المنتجع.</div>}</div>{paymentMethod === 'bank_transfer' && settings?.bank_transfer_enabled && <div className="transfer-instructions"><strong>بيانات التحويل</strong><span>{settings.bank_name} · المستفيد: {settings.bank_beneficiary}</span><b dir="ltr">{settings.bank_iban}</b><small>يُحجز الموعد لمدة {settings.bank_transfer_hold_hours} ساعة. لن يتأكد الحجز حتى يتحقق المنتجع من وصول المبلغ.</small></div>}{settings?.demo_mode && <div className="demo-notice">وضع المعاينة: بيانات العرض تجريبية، وإنشاء الحجز متوقف.</div>}</section>
    </div>
    <aside className="booking-panel"><div className="booking-panel-image"><img src={imageUrl(null, placeholderImages.unit)} alt="مساحة المنتجع" /><span>{unit.name}</span></div>{booking ? <div className="booking-panel-content payment-confirm-panel"><div className="payment-pending-icon"><CreditCard /></div><span className="eyebrow">خطوة الدفع الأخيرة</span><h3>حجزك رقم {booking.booking_number} بانتظار الدفع</h3><p>الموعد محجوز مؤقتًا لمدة 15 دقيقة. أكمل الدفع لتأكيده.</p><div className="quote-line quote-total"><span>المبلغ المطلوب</span><Price value={booking.total_amount} /></div>{paymentError && <div className="inline-error">{paymentError}</div>}<MoyasarForm bookingId={booking.id} amount={booking.total_amount} bookingNumber={String(booking.booking_number)} onError={setPaymentError} /></div> : <div className="booking-panel-content"><span className="eyebrow">ملخص السعر</span><h3>كل التفاصيل<br />أمامك بوضوح.</h3><div className="booking-date-summary"><CalendarDays size={17} /><span>{date && startTime ? `${dateLabel(slotStart(date, startTime).toISOString())} · ${startTime}` : 'اختر التاريخ والوقت'}</span></div><div className="coupon-box"><label htmlFor="coupon-code">لديك كوبون؟</label><div><input id="coupon-code" value={couponInput} onChange={(event) => setCouponInput(event.target.value)} placeholder="أدخل الرمز" /><Button type="button" variant="outline" onClick={applyCoupon}>تطبيق</Button></div>{coupon && <small className="coupon-active">تمت إضافة الرمز {coupon}. يُحتسب الخصم من الخادم.</small>}</div><div className="price-breakdown">{quote ? <><div className="quote-line"><span>قيمة الاستراحة</span><span>{new Intl.NumberFormat('ar-SA').format(quote.unit_amount)} ر.س</span></div><div className="quote-line"><span>الباقة · {pkg?.name}</span><span>{new Intl.NumberFormat('ar-SA').format(quote.package_amount)} ر.س</span></div>{quote.addons_amount > 0 && <div className="quote-line"><span>الخدمات الإضافية</span><span>{new Intl.NumberFormat('ar-SA').format(quote.addons_amount)} ر.س</span></div>}{quote.discount_amount > 0 && <div className="quote-line discount-line"><span>خصم الكوبون</span><span>−{new Intl.NumberFormat('ar-SA').format(quote.discount_amount)} ر.س</span></div>}<div className="quote-line quote-total"><span>الإجمالي · شامل التفاصيل أعلاه</span><Price value={quote.total_amount} /></div></> : <div className="quote-wait">{quoteLoading ? 'نحدّث السعر…' : 'اختر الباقة لعرض السعر النهائي'}</div>}</div><label className="terms-check"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span className="check-ui"><Check size={13} /></span><span>قرأت وأوافق على <Link to="/policies/terms" target="_blank">الشروط وسياسة الإلغاء</Link></span></label><Button className="button-block booking-submit" disabled={submitting || !startTime || !termsAccepted || !quote || (!settings?.cash_enabled && !settings?.bank_transfer_enabled)} onClick={submitBooking}>{submitting ? 'جارٍ إنشاء الطلب…' : paymentMethod === 'bank_transfer' ? 'إرسال طلب التحويل' : 'تأكيد الحجز'} {submitting ? null : <ArrowLeft size={17} />}</Button><div className="booking-safety"><ShieldCheck size={15} />التوفر والسعر يعاد التحقق منهما عند التأكيد</div><Link to={`/inquiry?unit_id=${unit.id}`} className="booking-help">لديك سؤال عن الحجز؟ أرسل استفسارك</Link></div>}</aside></div>
  </main>
}

export function PaymentResultPage() {
  const [search] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'checking' | 'paid' | 'failed'>('checking')
  const [message, setMessage] = useState('')
  const bookingId = search.get('booking_id')
  const paymentId = search.get('payment_id') || search.get('id')

  useEffect(() => {
    if (!user) { setStatus('failed'); setMessage('سجّل الدخول للحساب الذي أنشأ الحجز حتى نتحقق من الدفع.'); return }
    if (!bookingId || !paymentId) { setStatus('failed'); setMessage('لم تصلنا بيانات الدفع كاملة. تواصل مع المنتجع قبل إعادة المحاولة.'); return }
    let active = true
    supabase.functions.invoke('verify-payment', { body: { booking_id: bookingId, payment_id: paymentId } }).then(({ data, error }) => {
      if (!active) return
      if (error || data?.status !== 'paid') { setStatus('failed'); setMessage(data?.error || 'لم يكتمل الدفع. تحقق من حسابك قبل بدء محاولة جديدة.') }
      else { setStatus('paid'); setMessage('تم التحقق من الدفع وتأكيد حجزك.') }
    }).catch(() => {
      if (active) { setStatus('failed'); setMessage('تعذر التحقق من الدفع الآن. لا تبدأ محاولة جديدة قبل مراجعة الحجز والتواصل مع المنتجع.') }
    })
    return () => { active = false }
  }, [bookingId, paymentId, user?.id])

  return <main className="inner-page section-wrap payment-result-page"><div className={`payment-result-card ${status}`}>
    {status === 'checking' ? <Busy label="نتحقق من نتيجة الدفع من Moyasar" /> : <><span className="result-symbol">{status === 'paid' ? <Check size={30} /> : <ShieldCheck size={30} />}</span><span className="eyebrow">{status === 'paid' ? 'اكتمل الدفع' : 'حالة الدفع'}</span><h1>{status === 'paid' ? 'حجزك تأكّد.' : 'نحتاج إلى مراجعة النتيجة.'}</h1><p>{message}</p><div className="result-actions"><Button onClick={() => navigate(bookingId ? `/bookings/${bookingId}` : '/bookings')}>عرض تفاصيل الحجز <ArrowLeft size={16} /></Button><Link to="/inquiry" className="button button-outline">التواصل مع المنتجع</Link></div></>}
  </div></main>
}
