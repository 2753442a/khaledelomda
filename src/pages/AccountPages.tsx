import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bell, CalendarDays, Check, ChevronLeft, CircleUserRound, Clock3, Copy, Heart, LockKeyhole, LogOut, MapPin, MessageCircle, ShieldCheck, Star, UserRound, Users, WalletCards } from 'lucide-react'
import { Button, Busy, EmptyState, PageIntro, Price, toast } from '../components/ui'
import { useAuth } from '../lib/auth'
import { dateLabel, imageUrl, placeholderImages, statusLabel, statusTone, timeLabel, type Booking, type ResortSettings, type Unit } from '../lib/models'
import { supabase } from '../lib/supabase'

type BookingRow = Booking & { booking_items?: { id: string; item_name: string; item_type: string; total_price: number }[]; units?: Unit & { unit_media?: { storage_path: string; is_cover: boolean; sort_order: number }[] } }

export function LoginPage() {
  const { user, signIn, signUp, recoverPassword } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/account'
  const [mode, setMode] = useState<'login' | 'signup' | 'recover'>('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { if (user && mode !== 'recover') navigate(next, { replace: true }) }, [user?.id, mode])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'login') {
        await signIn(phone, password)
        navigate(next, { replace: true })
      } else if (mode === 'signup') {
        await signUp(name, phone, password, pin)
        toast('أُنشئ حسابك بأمان. أكمل اختيارك للحجز.', 'success')
        navigate(next, { replace: true })
      } else {
        await recoverPassword(phone, pin, newPassword)
        setMessage('إذا كانت البيانات صحيحة، جرّب تسجيل الدخول بكلمة المرور الجديدة. حفاظًا على خصوصية الحساب لن نكشف نتيجة التحقق هنا.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إكمال الطلب. حاول مرة أخرى.')
    } finally { setBusy(false) }
  }

  return <main className="auth-page section-wrap"><div className="auth-editorial"><span className="eyebrow">مكانك ينتظرك</span><h1>وقتٌ لك،<br /><em>على مهل.</em></h1><p>أنشئ حسابك لتتابع حجوزاتك وتحفظ مساحاتك المفضلة.</p><div className="auth-ornament"><span>خصوصية</span><i /><span>ضيافة</span><i /><span>سكينة</span></div></div><div className="auth-card">
    <div className="auth-tabs">{(['login', 'signup'] as const).map((key) => <button type="button" key={key} className={mode === key ? 'active' : ''} onClick={() => { setMode(key); setMessage('') }}>{key === 'login' ? 'تسجيل الدخول' : 'حساب جديد'}</button>)}</div>
    {mode === 'recover' && <button className="back-link" type="button" onClick={() => { setMode('login'); setMessage('') }}><ChevronLeft size={16} /> العودة لتسجيل الدخول</button>}
    <span className="eyebrow">{mode === 'login' ? 'مرحبًا بعودتك' : mode === 'signup' ? 'بداية سهلة وآمنة' : 'استعادة الوصول'}</span>
    <h2>{mode === 'login' ? 'سجّل دخولك' : mode === 'signup' ? 'أنشئ حسابك' : 'استعد حسابك'}</h2>
    <p className="auth-subtitle">{mode === 'login' ? 'أدخل رقم جوالك وكلمة المرور للمتابعة.' : mode === 'signup' ? 'بياناتك تحفظ بأمان وتستخدم لإدارة حجوزاتك.' : 'أدخل رقم الجوال وPIN الجديد. لن نكشف ما إذا كان الرقم مسجلًا.'}</p>
    <form onSubmit={submit} className="auth-form">
      {mode === 'signup' && <label>الاسم الكامل<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></label>}
      <label>رقم الجوال<input type="tel" inputMode="tel" autoComplete="tel" placeholder="05xxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
      {mode === 'signup' && <label>كلمة المرور<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} required /><small>10 أحرف على الأقل.</small></label>}
      {mode === 'signup' && <label>PIN للاسترداد<input type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} required /><small>أربع أرقام لاستعادة كلمة المرور. لا تشاركه مع أحد.</small></label>}
      {mode === 'login' && <label>كلمة المرور<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>}
      {mode === 'recover' && <><label>PIN من 4 أرقام<input type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} required /></label><label>كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /><small>10 أحرف على الأقل.</small></label></>}
      {message && <p className="form-message" role="status">{message}</p>}
      <Button type="submit" className="button-block" disabled={busy}>{busy ? 'جارٍ التحقق…' : mode === 'login' ? 'دخول آمن' : mode === 'signup' ? 'إنشاء الحساب' : 'تحديث كلمة المرور'} {busy ? null : <ArrowLeft size={16} />}</Button>
    </form>
    {mode === 'login' && <button className="forgot-link" type="button" onClick={() => { setMode('recover'); setPin(''); setMessage('') }}>نسيت كلمة المرور؟ استعدها باستخدام PIN</button>}
    {mode === 'recover' && <div className="security-note"><LockKeyhole size={15} />المحاولات محدودة، وتظهر الرسالة نفسها حمايةً لخصوصية أرقام الجوال.</div>}
  </div></main>
}

function BookingCard({ booking, onRefresh }: { booking: BookingRow; onRefresh: () => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const image = booking.units?.unit_media?.sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)[0]?.storage_path
  const canCancel = ['pending', 'confirmed'].includes(booking.status) && new Date(booking.starts_at) > new Date() && booking.payment_status !== 'paid'
  const expiredHold = booking.status === 'pending' && booking.hold_expires_at && new Date(booking.hold_expires_at) <= new Date()
  const cancel = async () => {
    if (!window.confirm('هل تريد إلغاء هذا الحجز؟ تُطبق سياسة الإلغاء المعروضة في الشروط.')) return
    setBusy(true)
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: booking.id })
    setBusy(false)
    if (error) toast(/window has passed/i.test(error.message) ? 'انتهت مهلة الإلغاء وفق السياسة.' : 'تعذر إلغاء الحجز. تواصل مع المنتجع.', 'error')
    else { toast('تم إلغاء الحجز.', 'success'); onRefresh() }
  }
  return <article className="booking-card"><img src={imageUrl(image, placeholderImages.unit)} alt={booking.unit_name_snapshot} /><div className="booking-card-content"><div className="booking-card-head"><div><span className="eyebrow">رقم الحجز {booking.booking_number}</span><h3>{booking.unit_name_snapshot}</h3></div><span className={`status-pill tone-${statusTone[booking.status]}`}>{expiredHold ? 'انتهت مهلة التأكيد' : statusLabel[booking.status]}</span></div><div className="booking-meta"><span><CalendarDays size={15} />{dateLabel(booking.starts_at)}</span><span><Clock3 size={15} />{timeLabel(booking.starts_at)} – {timeLabel(booking.ends_at)}</span><span><Users size={15} />{booking.guest_count} ضيوف</span></div><div className="booking-card-bottom"><Price value={booking.total_amount} /><div className="booking-card-actions"><Button variant="ghost" onClick={() => navigate(`/bookings/${booking.id}`)}>عرض التفاصيل <ChevronLeft size={15} /></Button>{canCancel && !expiredHold && <Button variant="ghost" disabled={busy} onClick={cancel}>{busy ? 'جارٍ الإلغاء…' : 'إلغاء الحجز'}</Button>}</div></div></div></article>
}

export function BookingsPage() {
  const { user, loading: authLoading } = useAuth()
  const [rows, setRows] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    if (!user) { setLoading(false); return }
    let active = true
    supabase.from('bookings').select('*,units(name,slug,unit_media(storage_path,is_cover,sort_order))').eq('customer_id', user.id).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (!active) return
      if (error) toast('تعذر تحميل حجوزاتك.', 'error')
      setRows((data ?? []) as unknown as BookingRow[])
      setLoading(false)
    })
    return () => { active = false }
  }, [user?.id, refresh])

  if (authLoading) return <main className="inner-page"><Busy /></main>
  if (!user) return <Navigate to="/login?next=/bookings" replace />
  const today = Date.now()
  const tabs = [
    { id: 'upcoming', label: 'القادمة', filter: (row: BookingRow) => ['pending', 'confirmed'].includes(row.status) && new Date(row.ends_at).getTime() >= today },
    { id: 'current', label: 'الحالية', filter: (row: BookingRow) => row.status === 'checked_in' },
    { id: 'past', label: 'السابقة', filter: (row: BookingRow) => ['completed'].includes(row.status) || (['confirmed', 'pending'].includes(row.status) && new Date(row.ends_at).getTime() < today) },
    { id: 'cancelled', label: 'الملغاة', filter: (row: BookingRow) => ['cancelled', 'expired'].includes(row.status) },
  ]
  const active = tabs.find((item) => item.id === tab)!
  const visible = rows.filter(active.filter)
  return <main className="inner-page section-wrap account-page"><PageIntro eyebrow="مساحتك الشخصية" title="حجوزاتي" body="تابع تفاصيل زياراتك، وتواصل معنا إن احتجت أي مساعدة." /><div className="account-tabs">{tabs.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}<small>{rows.filter(item.filter).length}</small></button>)}</div>{loading ? <Busy label="نحمّل حجوزاتك" /> : visible.length ? <div className="booking-list">{visible.map((row) => <BookingCard key={row.id} booking={row} onRefresh={() => setRefresh((value) => value + 1)} />)}</div> : <EmptyState title={tab === 'upcoming' ? 'لا توجد حجوزات قادمة' : `لا توجد حجوزات ${active.label}`} body="حين تحجز استراحة، ستجد كل تفاصيلها هنا." action={<Link to="/units" className="text-link">اكتشف الاستراحات <ChevronLeft size={16} /></Link>} />}</main>
}

export function BookingDetailsPage() {
  const { bookingId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<BookingRow | null>(null)
  const [settings, setSettings] = useState<ResortSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [hasReview, setHasReview] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!user || !bookingId) { setLoading(false); return }
    let active = true
    Promise.all([
      supabase.from('bookings').select('*,booking_items(*),units(name,slug,unit_media(storage_path,is_cover,sort_order))').eq('id', bookingId).maybeSingle(),
      supabase.from('resort_settings').select('*').eq('id', true).maybeSingle(),
      supabase.from('reviews').select('id').eq('booking_id', bookingId).maybeSingle(),
    ]).then(([bookingResult, settingsResult, reviewResult]) => {
      if (!active) return
      setBooking(bookingResult.data as unknown as BookingRow | null)
      setSettings(settingsResult.data as ResortSettings | null)
      setHasReview(Boolean(reviewResult.data))
      setLoading(false)
    })
    return () => { active = false }
  }, [user?.id, bookingId])

  const share = async () => {
    if (!booking) return
    const value = `حجز رقم ${booking.booking_number} · ${booking.unit_name_snapshot} · ${dateLabel(booking.starts_at)}`
    try { if (navigator.share) await navigator.share({ title: 'تفاصيل حجزي', text: value, url: window.location.href }); else { await navigator.clipboard.writeText(value); toast('نُسخت تفاصيل الحجز.', 'success') } } catch { /* visitor cancelled share */ }
  }
  const cancel = async () => {
    if (!booking || !window.confirm('هل تريد إلغاء هذا الحجز؟')) return
    setBusy(true)
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: booking.id })
    setBusy(false)
    if (error) return toast('تعذر إلغاء الحجز وفق السياسة الحالية.', 'error')
    toast('تم إلغاء الحجز.', 'success')
    navigate('/bookings')
  }
  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!booking) return
    setBusy(true)
    const { error } = await supabase.rpc('submit_review', { p_booking_id: booking.id, p_rating: rating, p_body: reviewText.trim() })
    setBusy(false)
    if (error) return toast('لا يمكن إرسال التقييم قبل اكتمال الحجز أو إذا أرسلت تقييمًا مسبقًا.', 'error')
    setHasReview(true)
    setReviewOpen(false)
    toast('شكرًا لمشاركة تجربتك. سيظهر التقييم بعد المراجعة.', 'success')
  }

  if (!user) return <Navigate to={`/login?next=/bookings/${bookingId}`} replace />
  if (loading) return <main className="inner-page"><Busy label="نفتح تفاصيل حجزك" /></main>
  if (!booking) return <main className="inner-page section-wrap"><EmptyState title="لم نعثر على الحجز" body="قد لا تملك صلاحية الوصول إلى هذا الحجز." action={<Link className="text-link" to="/bookings">العودة للحجوزات <ChevronLeft size={16} /></Link>} /></main>

  const hero = booking.units?.unit_media?.sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)[0]?.storage_path
  const mapUrl = settings?.map_url || (settings?.latitude && settings.longitude ? `https://maps.google.com/?q=${settings.latitude},${settings.longitude}` : '')
  return <main className="inner-page section-wrap booking-details-page"><div className="booking-confirm-hero"><div><span className="eyebrow">{booking.status === 'confirmed' ? 'تم تأكيد الحجز' : statusLabel[booking.status]}</span><h1>{booking.status === 'confirmed' ? 'ننتظرك بكل ترحاب.' : 'تفاصيل حجزك.'}</h1><p>احتفظ بهذه الصفحة للرجوع إلى تفاصيل زيارتك في أي وقت.</p></div><span className="confirm-check"><Check size={25} /></span></div>
    <div className="digital-ticket"><div className="ticket-image"><img src={imageUrl(hero, placeholderImages.unit)} alt={booking.unit_name_snapshot} /><span>{booking.unit_name_snapshot}</span></div><div className="ticket-body"><div className="ticket-number"><span>رقم الحجز</span><strong>#{booking.booking_number}</strong><button aria-label="نسخ رقم الحجز" onClick={async () => { await navigator.clipboard.writeText(String(booking.booking_number)); toast('نُسخ رقم الحجز.', 'success') }}><Copy size={15} /></button></div><span className={`status-pill tone-${statusTone[booking.status]}`}>{statusLabel[booking.status]}</span><div className="ticket-details"><div><CalendarDays /><span>التاريخ</span><strong>{dateLabel(booking.starts_at)}</strong></div><div><Clock3 /><span>الوقت</span><strong>{timeLabel(booking.starts_at)} – {timeLabel(booking.ends_at)}</strong></div><div><Users /><span>عدد الضيوف</span><strong>{booking.guest_count} أشخاص</strong></div><div><WalletCards /><span>طريقة الدفع</span><strong>{booking.payment_method === 'cash' ? 'نقدًا في المنتجع' : booking.payment_method === 'bank_transfer' ? 'تحويل بنكي' : booking.payment_status === 'paid' ? 'مدفوع إلكترونيًا' : 'الدفع الإلكتروني'}</strong></div></div><div className="ticket-lines">{booking.booking_items?.map((item) => <div key={item.id}><span>{item.item_name}</span><span>{new Intl.NumberFormat('ar-SA').format(item.total_price)} ر.س</span></div>)}{booking.discount_amount > 0 && <div className="discount-line"><span>الخصم</span><span>−{new Intl.NumberFormat('ar-SA').format(booking.discount_amount)} ر.س</span></div>}<div className="ticket-total"><strong>الإجمالي</strong><Price value={booking.total_amount} /></div></div><div className="ticket-actions"><Button variant="outline" onClick={share}><Copy size={15} /> مشاركة أو نسخ</Button>{mapUrl && <a className="button button-primary" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={16} /> الاتجاهات</a>}{settings?.whatsapp && <a className="button button-ghost" href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`استفسار عن الحجز رقم ${booking.booking_number}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> التواصل</a>}</div></div></div>
    <div className="booking-after-grid">{booking.payment_method === 'bank_transfer' && booking.payment_status !== 'paid' && <article className="after-card"><WalletCards /><div><h3>بيانات التحويل البنكي</h3><p>{settings?.bank_name || 'اسم البنك'} · المستفيد: {settings?.bank_beneficiary || 'اسم المستفيد'}</p><p className="bank-iban" dir="ltr">{settings?.bank_iban || 'تواصل مع المنتجع لمعرفة الآيبان'}</p><p>اكتب رقم الحجز #{booking.booking_number} في وصف التحويل، ثم أرسل الإيصال للمنتجع. لن يتأكد الحجز حتى يطابق المالك التحويل مع كشف الحساب.</p>{booking.hold_expires_at && <small>تنتهي مهلة الحجز: {dateLabel(booking.hold_expires_at, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</small>}</div></article>}<article className="after-card"><ShieldCheck /><div><h3>تعليمات الوصول</h3><p>{settings?.arrival_instructions || 'ستظهر تعليمات الوصول هنا بعد أن يضيفها المنتجع. يمكنك التواصل معنا عند الحاجة.'}</p></div></article><article className="after-card"><LockKeyhole /><div><h3>شروط الحجز</h3><p>{settings?.late_policy || settings?.cancellation_policy || 'يرجى مراجعة الشروط وسياسة الإلغاء قبل موعد زيارتك.'}</p><Link to="/policies/terms">قراءة الشروط <ChevronLeft size={15} /></Link></div></article></div>
    <div className="booking-details-actions">{booking.status === 'completed' && !hasReview && <Button onClick={() => setReviewOpen((open) => !open)}><Star size={16} /> قيّم تجربتك</Button>}{['pending', 'confirmed'].includes(booking.status) && new Date(booking.starts_at) > new Date() && ['cash', 'bank_transfer'].includes(booking.payment_method) && booking.payment_status !== 'paid' && <Button variant="outline" disabled={busy} onClick={cancel}>{busy ? 'جارٍ الإلغاء…' : 'إلغاء الحجز'}</Button>}<Link className="button button-ghost" to="/units">احجز مرة أخرى <ArrowLeft size={16} /></Link></div>
    {reviewOpen && <form className="review-form" onSubmit={submitReview}><h3>كيف كانت زيارتك؟</h3><div className="rating-choice" aria-label="التقييم من نجمة إلى خمس نجوم">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} aria-label={`${value} نجوم`} aria-pressed={rating === value} onClick={() => setRating(value)}><Star fill={rating >= value ? 'currentColor' : 'none'} /></button>)}</div><label>شاركنا انطباعك<textarea rows={4} maxLength={2000} value={reviewText} onChange={(event) => setReviewText(event.target.value)} /></label><Button disabled={busy}>{busy ? 'جارٍ الإرسال…' : 'إرسال التقييم'} <ArrowLeft size={15} /></Button></form>}
  </main>
}

export function FavoritesPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<{ unit_id: string; units: Unit }[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    if (!user) { setLoading(false); return }
    let active = true
    supabase.from('favorites').select('unit_id,units(*)').eq('customer_id', user.id).then(({ data, error }) => {
      if (!active) return
      if (error) toast('تعذر تحميل المفضلة.', 'error')
      setRows((data ?? []) as unknown as typeof rows)
      setLoading(false)
    })
    return () => { active = false }
  }, [user?.id, refresh])
  if (!user) return <Navigate to="/login?next=/account/favorites" replace />
  return <main className="inner-page section-wrap account-page"><PageIntro eyebrow="مساحات قريبة منك" title="مفضلتك" body="المساحات التي حفظتها للعودة إليها لاحقًا." />{loading ? <Busy /> : rows.length ? <div className="unit-grid favorites-grid">{rows.map(({ unit_id, units: unit }) => unit && <article className="favorite-tile" key={unit_id}><Link to={`/units/${unit.slug}`}><img src={imageUrl((unit as Unit & { unit_media?: { storage_path: string; is_cover?: boolean }[] }).unit_media?.find((photo) => photo.is_cover)?.storage_path)} alt={unit.name} /><h3>{unit.name}</h3><span>{unit.short_description}</span></Link><button className="text-link" onClick={async () => { const { error } = await supabase.from('favorites').delete().eq('unit_id', unit_id).eq('customer_id', user.id); if (error) toast('تعذر حذف المفضلة.', 'error'); else { toast('أزيلت من المفضلة.', 'success'); setRefresh((n) => n + 1) } }}>إزالة <Heart size={15} /></button></article>)}</div> : <EmptyState title="مساحاتك المحفوظة ستظهر هنا" body="اضغط على القلب في أي استراحة لتضيفها إلى المفضلة." action={<Link to="/units" className="text-link">اكتشف الاستراحات <ChevronLeft size={16} /></Link>} />}</main>
}

export function NotificationsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<{ id: string; title: string; body: string; kind: string; created_at: string; read_at: string | null; booking_id: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const load = () => {
    if (!user) { setLoading(false); return }
    supabase.from('notifications').select('*').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(50).then(({ data, error }) => {
      if (error) toast('تعذر تحميل الإشعارات.', 'error')
      setRows((data ?? []) as typeof rows)
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [user?.id])
  if (!user) return <Navigate to="/login?next=/notifications" replace />
  const markRead = async (id: string) => {
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('customer_id', user.id)
    if (error) toast('تعذر تحديث الإشعار.', 'error')
    else setRows((current) => current.map((row) => row.id === id ? { ...row, read_at: new Date().toISOString() } : row))
  }
  return <main className="inner-page section-wrap account-page"><PageIntro eyebrow="كل جديد في مكان واحد" title="الإشعارات" body="تحديثات الحجوزات والتنبيهات المهمة من المنتجع." />{loading ? <Busy /> : rows.length ? <div className="notification-list">{rows.map((item) => <article className={!item.read_at ? 'unread' : ''} key={item.id}><span className="notification-icon"><Bell size={18} /></span><div><strong>{item.title}</strong><p>{item.body}</p><small>{dateLabel(item.created_at, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</small></div><div className="notification-actions">{item.booking_id && <Link to={`/bookings/${item.booking_id}`}>الحجز <ChevronLeft size={14} /></Link>}{!item.read_at && <button onClick={() => markRead(item.id)}>تحديد كمقروء</button>}</div></article>)}</div> : <EmptyState title="لا توجد إشعارات بعد" body="ستجد هنا تحديثات حالة الحجوزات وأي تنبيهات من المنتجع." />}</main>
}

export function AccountPage() {
  const { user, profile, loading, signOut, updateName, changePin, changePassword } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setName(profile?.full_name ?? ''), [profile?.full_name])
  if (loading) return <main className="inner-page"><Busy /></main>
  if (!user) return <Navigate to="/login?next=/account" replace />

  const run = async (action: () => Promise<void>, success: string, reset?: () => void) => {
    setBusy(true)
    try { await action(); toast(success, 'success'); reset?.() } catch (error) { toast(error instanceof Error ? error.message : 'تعذر حفظ التغييرات.', 'error') } finally { setBusy(false) }
  }
  const logout = async () => {
    try { await signOut(); navigate('/', { replace: true }); toast('تم تسجيل الخروج بأمان.', 'success') } catch { toast('تعذر تسجيل الخروج.', 'error') }
  }
  return <main className="inner-page section-wrap account-page"><PageIntro eyebrow="كل ما يخص زيارتك" title="حسابي" body="حدّث بياناتك وأدر حجوزاتك وتفضيلاتك بأمان." />
    <div className="account-overview"><span className="account-avatar"><UserRound /></span><div><span className="eyebrow">أهلاً بك</span><h2>{profile?.full_name || user.user_metadata?.full_name || 'ضيفنا العزيز'}</h2><span>{profile?.phone || user.phone}</span></div>{profile?.role === 'owner' && <Link to="/admin" className="button button-outline">لوحة المالك <ChevronLeft size={15} /></Link>}</div>
    <div className="account-dashboard-grid"><div className="account-main-column">
      <section className="account-card"><div className="account-card-head"><CircleUserRound /><div><h3>البيانات الشخصية</h3><p>رقم الجوال مرتبط بحساب الدخول، ويمكن تعديله من مزود المصادقة.</p></div></div><form onSubmit={(event) => { event.preventDefault(); void run(() => updateName(name), 'تم تحديث الاسم.') }}><label>الاسم<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} required /></label><label>رقم الجوال<input value={profile?.phone || user.phone || ''} readOnly dir="ltr" /><small>لأمان الحساب، تعديل الرقم يتطلب عملية تحقق مستقلة.</small></label><Button disabled={busy || name.trim() === profile?.full_name}>حفظ الاسم <Check size={15} /></Button></form></section>
      <section className="account-card"><div className="account-card-head"><LockKeyhole /><div><h3>الأمان وكلمة المرور</h3><p>اختر كلمة مرور فريدة لا تستخدمها في خدمات أخرى.</p></div></div><form onSubmit={(event) => { event.preventDefault(); void run(() => changePassword(password), 'تم تغيير كلمة المرور.', () => setPassword('')) }}><label>كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required /><small>10 أحرف على الأقل. ستظل جلسة حسابك الحالية صالحة.</small></label><Button variant="outline" disabled={busy || password.length < 10}>تغيير كلمة المرور <LockKeyhole size={15} /></Button></form><form className="pin-update-form" onSubmit={(event) => { event.preventDefault(); void run(() => changePin(pin), 'تم تحديث PIN بشكل آمن.', () => setPin('')) }}><label>تعيين PIN للاسترداد<input type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} required /><small>أربع أرقام، لا تُشاركها. تحفظ بصيغة مجزأة ولا يمكن قراءتها.</small></label><Button variant="outline" disabled={busy || pin.length !== 4}>تحديث PIN <ShieldCheck size={15} /></Button></form></section>
    </div><aside className="account-quicklinks"><Link to="/bookings"><CalendarDays /><span><strong>حجوزاتي</strong><small>تابع المواعيد والتفاصيل</small></span><ChevronLeft /></Link><Link to="/account/favorites"><Heart /><span><strong>مفضلتي</strong><small>المساحات التي حفظتها</small></span><ChevronLeft /></Link><Link to="/notifications"><Bell /><span><strong>الإشعارات</strong><small>آخر التحديثات والتنبيهات</small></span><ChevronLeft /></Link><Link to="/policies/terms"><ShieldCheck /><span><strong>الشروط والسياسات</strong><small>قبل وأثناء الزيارة</small></span><ChevronLeft /></Link><Link to="/inquiry"><MessageCircle /><span><strong>تواصل معنا</strong><small>نحن قريبون لمساعدتك</small></span><ChevronLeft /></Link><button className="logout-link" onClick={logout}><LogOut /><span><strong>تسجيل الخروج</strong><small>إنهاء جلستك على هذا الجهاز</small></span><ChevronLeft /></button></aside></div>
  </main>
}

export function OwnerSetupPage() {
  const { user } = useAuth()
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  if (!user) return <Navigate to="/login?next=/owner-setup" replace />
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const { error } = await supabase.functions.invoke('bootstrap-owner', { headers: { 'x-bootstrap-secret': secret }, body: {} })
    setBusy(false)
    if (error) return toast('تعذر التهيئة. تأكد من السر وأن هذه أول مرة تهيّئ فيها مالكًا.', 'error')
    setDone(true)
    toast('اكتمل تهيئة حساب المالك.', 'success')
    window.setTimeout(() => window.location.assign('/#/admin'), 900)
  }
  return <main className="inner-page section-wrap owner-setup-page"><div className="form-card"><span className="eyebrow">تهيئة آمنة لمرة واحدة</span><h1>{done ? 'أصبحت مدير المنتجع.' : 'تعيين حساب المالك'}</h1><p>تسمح هذه الخطوة لأول حساب موثّق بأن يدير المنتجع. استخدم السر المؤقت المضاف إلى أسرار Edge Functions، ثم احذفه بعد النجاح.</p>{done ? <Busy label="نفتح لوحة المالك" /> : <form onSubmit={submit}><label>سر التهيئة<input type="password" autoComplete="off" value={secret} onChange={(event) => setSecret(event.target.value)} required /></label><div className="security-note"><LockKeyhole size={15} />لا تُرسل السر إلا بعد تسجيل دخولك. قاعدة البيانات تسمح بمالك أول واحد فقط.</div><Button className="button-block" disabled={busy}>{busy ? 'جارٍ التحقق…' : 'تهيئة حسابي كمالك'} <ArrowLeft size={16} /></Button></form>}</div></main>
}
