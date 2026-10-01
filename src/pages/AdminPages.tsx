import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowLeft, ArrowUpRight, Bell, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, CreditCard, DollarSign, FileImage, Filter, Home, Inbox, LayoutDashboard, LifeBuoy, LogOut, MapPin, Menu, MessageSquareText, Package, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Star, Trash2, Users, WalletCards, Waves, X } from 'lucide-react'
import { Button, Busy, EmptyState, Price, toast } from '../components/ui'
import { useAuth } from '../lib/auth'
import { dateLabel, durationLabel, imageUrl, statusLabel, statusTone, timeLabel, type AddOn, type Booking, type ResortPackage, type ResortSettings, type Unit } from '../lib/models'
import { supabase } from '../lib/supabase'

const adminNav = [
  { to: '/admin', label: 'نظرة عامة', icon: LayoutDashboard, end: true },
  { to: '/admin/bookings', label: 'الحجوزات', icon: CalendarDays },
  { to: '/admin/units', label: 'الاستراحات', icon: Home },
  { to: '/admin/packages', label: 'الباقات', icon: Package },
  { to: '/admin/add-ons', label: 'الخدمات الإضافية', icon: Sparkles },
  { to: '/admin/availability', label: 'التوافر والإغلاق', icon: Clock3 },
  { to: '/admin/coupons', label: 'الكوبونات', icon: DollarSign },
  { to: '/admin/reviews', label: 'التقييمات', icon: Star },
  { to: '/admin/inquiries', label: 'الاستفسارات', icon: Inbox },
  { to: '/admin/customers', label: 'العملاء', icon: Users },
  { to: '/admin/content', label: 'المحتوى والأسئلة', icon: MessageSquareText },
  { to: '/admin/settings', label: 'إعدادات المنتجع', icon: Settings2 },
  { to: '/admin/audit', label: 'سجل التغييرات', icon: Activity },
]

export function AdminGate() {
  const { user, profile, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => setMobileOpen(false), [location.pathname])
  if (loading) return <main className="inner-page"><Busy label="نتحقق من صلاحية الوصول" /></main>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (profile?.role !== 'owner') return <main className="inner-page section-wrap"><EmptyState title="هذه المساحة مخصصة لمالك المنتجع" body="يمكنك العودة إلى تجربة الضيوف أو التواصل مع المالك." action={<Link className="text-link" to="/">العودة للرئيسية <ChevronLeft size={16} /></Link>} /></main>
  const logout = async () => { await signOut(); navigate('/', { replace: true }) }
  return <div className="admin-layout">
    <aside className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="admin-brand"><span className="brand-mark"><i /><i /><i /></span><div><strong>إدارة المنتجع</strong><small>مساحة المالك</small></div><button className="admin-mobile-close" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة"><X /></button></div>
      <nav aria-label="إدارة المنتجع">{adminNav.map(({ to, label, icon: Icon, end }) => <NavLink to={to} end={end} key={to} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={18} /><span>{label}</span></NavLink>)}</nav>
      <div className="admin-sidebar-bottom"><Link to="/" className="view-site-link"><ArrowDownRight size={17} /> عرض واجهة الضيوف</Link><button onClick={logout}><LogOut size={17} /> تسجيل الخروج</button></div>
    </aside>
    {mobileOpen && <button className="admin-scrim" aria-label="إغلاق القائمة" onClick={() => setMobileOpen(false)} />}
    <div className="admin-main"><header className="admin-topbar"><button className="admin-menu-button" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة"><Menu /></button><div><span className="admin-top-eyebrow">لوحة المالك</span><strong>{adminNav.find((item) => item.to === location.pathname)?.label || 'إدارة المنتجع'}</strong></div><div className="admin-top-actions"><Link to="/" target="_blank" className="preview-link">معاينة الواجهة <ArrowUpRight size={15} /></Link><span className="owner-chip"><ShieldCheck size={15} /> مالك المنتجع</span></div></header><div className="admin-content"><Outlet /></div></div>
  </div>
}

function AdminHeading({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return <div className="admin-page-heading"><div><span className="eyebrow">إدارة المنتجع</span><h1>{title}</h1>{body && <p>{body}</p>}</div>{action}</div>
}

function StatCard({ label, value, icon: Icon, note, tone = '' }: { label: string; value: string | number; icon: typeof Activity; note?: string; tone?: string }) {
  return <article className={`admin-stat ${tone}`}><span className="admin-stat-icon"><Icon size={20} /></span><span className="admin-stat-label">{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>
}

function StatusBadge({ status }: { status: string }) {
  const tone = status in statusTone ? statusTone[status as keyof typeof statusTone] : 'stone'
  const label = status in statusLabel ? statusLabel[status as keyof typeof statusLabel] : status
  return <span className={`status-pill tone-${tone}`}>{label}</span>
}

function Pagination({ page, setPage, pageCount }: { page: number; setPage: (page: number) => void; pageCount: number }) {
  if (pageCount <= 1) return null
  return <div className="pagination"><button disabled={page <= 0} onClick={() => setPage(page - 1)} aria-label="الصفحة السابقة"><ChevronRight size={17} /></button><span>صفحة {page + 1} من {pageCount}</span><button disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} aria-label="الصفحة التالية"><ChevronLeft size={17} /></button></div>
}

export function AdminOverview() {
  const [data, setData] = useState<{ bookings: Booking[]; units: number; reviews: number; inquiries: number; customers: number } | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('bookings').select('*').order('starts_at', { ascending: true }).limit(1000),
      supabase.from('units').select('id', { count: 'exact', head: true }),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('inquiries').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress']),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    ]).then(([bookingResult, unitResult, reviewResult, inquiryResult, customerResult]) => {
      if (!active) return
      if (bookingResult.error) toast('تعذر تحميل ملخص الحجوزات.', 'error')
      setData({ bookings: (bookingResult.data ?? []) as Booking[], units: unitResult.count ?? 0, reviews: reviewResult.count ?? 0, inquiries: inquiryResult.count ?? 0, customers: customerResult.count ?? 0 })
      setLoading(false)
    })
    return () => { active = false }
  }, [])
  if (loading || !data) return <Busy label="نجهّز ملخص المنتجع" />
  const now = Date.now()
  const upcoming = data.bookings.filter((row) => ['pending', 'confirmed'].includes(row.status) && new Date(row.starts_at).getTime() > now)
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Riyadh' }).format(new Date())
  const todayCount = data.bookings.filter((row) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Riyadh' }).format(new Date(row.starts_at)) === today && ['confirmed', 'checked_in'].includes(row.status)).length
  const revenue = data.bookings.filter((row) => row.payment_status === 'paid').reduce((sum, row) => sum + Number(row.total_amount), 0)
  const recent = [...data.bookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6)
  return <div className="admin-page"><div className="admin-welcome"><div><span className="eyebrow">مساء الخير،</span><h1>مساحة واحدة، وتجارب كثيرة.</h1><p>هذا ملخص عمل المنتجع وحجوزاته في مكان واحد.</p></div><span className="welcome-date">{dateLabel(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
    <div className="admin-stat-grid"><StatCard label="حجوزات قادمة" value={upcoming.length} icon={CalendarDays} note="بانتظار الزيارات" tone="green" /><StatCard label="زيارات اليوم" value={todayCount} icon={Clock3} note="مؤكدة أو قيد الزيارة" /><StatCard label="إيرادات مسجلة" value={new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(revenue) + ' ر.س'} icon={DollarSign} note="المدفوعات المؤكدة فقط" tone="sand" /><StatCard label="الاستراحات" value={data.units} icon={Home} note="بما فيها غير المنشورة" /><StatCard label="عملاء" value={data.customers} icon={Users} /><StatCard label="تحتاج متابعة" value={data.reviews + data.inquiries} icon={LifeBuoy} note={`${data.reviews} تقييمات · ${data.inquiries} استفسارات`} tone="rose" /></div>
    <div className="admin-dashboard-grid"><section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">آخر الطلبات</span><h2>الحجوزات الأخيرة</h2></div><Link to="/admin/bookings" className="text-link">كل الحجوزات <ChevronLeft size={15} /></Link></div>{recent.length ? <div className="recent-bookings">{recent.map((row) => <Link to="/admin/bookings" className="recent-booking-row" key={row.id}><span className="recent-booking-date">{new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(row.starts_at))}</span><span className="recent-booking-name"><strong>{row.unit_name_snapshot}</strong><small>#{row.booking_number} · {row.guest_name}</small></span><Price value={row.total_amount} compact /><StatusBadge status={row.status} /></Link>)}</div> : <EmptyState title="لا توجد حجوزات بعد" body="ستظهر طلبات الضيوف هنا." action={<Link to="/admin/units" className="text-link">أضف استراحة <ChevronLeft size={15} /></Link>} />}</section>
      <section className="admin-panel admin-shortcuts"><div className="admin-panel-heading"><div><span className="eyebrow">خطوات سريعة</span><h2>أدر يومك</h2></div><SlidersHorizontal /></div><Link to="/admin/units"><span><Home /></span><div><strong>إضافة استراحة</strong><small>أنشئ مساحة جديدة للضيوف</small></div><ChevronLeft /></Link><Link to="/admin/availability"><span><CalendarDays /></span><div><strong>تحديد فترة إغلاق</strong><small>حدّث التوافر حسب الحاجة</small></div><ChevronLeft /></Link><Link to="/admin/coupons"><span><DollarSign /></span><div><strong>إضافة كوبون</strong><small>أنشئ عرضًا مرتبطًا بحجز</small></div><ChevronLeft /></Link><Link to="/admin/content"><span><MessageSquareText /></span><div><strong>تحديث المحتوى</strong><small>الأسئلة وتجربة الصفحة الرئيسية</small></div><ChevronLeft /></Link></section></div>
  </div>
}

export function AdminBookings() {
  const [rows, setRows] = useState<Booking[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [payment, setPayment] = useState('all')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    let query = supabase.from('bookings').select('*', { count: 'exact' }).order('starts_at', { ascending: false }).range(page * 20, page * 20 + 19)
    if (status !== 'all') query = query.eq('status', status)
    if (payment !== 'all') query = query.eq('payment_status', payment)
    if (search.trim()) {
      const term = search.trim().replace(/[,%()]/g, '')
      query = /^\d+$/.test(term) ? query.or(`guest_name.ilike.%${term}%,guest_phone.ilike.%${term}%,booking_number.eq.${term}`) : query.or(`guest_name.ilike.%${term}%,guest_phone.ilike.%${term}%`)
    }
    query.then(({ data, count, error }) => {
      if (!active) return
      if (error) toast('تعذر تحميل الحجوزات.', 'error')
      setRows((data ?? []) as Booking[])
      setTotal(count ?? 0)
      setLoading(false)
    })
    return () => { active = false }
  }, [page, search, status, payment, refresh])

  const setState = async (row: Booking, nextStatus: string) => {
    if (nextStatus === 'cancelled' && row.payment_status === 'paid') {
      return toast('استرد المبلغ عبر مزود الدفع وسجّل حالته «مسترد» قبل إلغاء الحجز.', 'error')
    }
    if (nextStatus === 'completed' && new Date(row.ends_at) > new Date()) return toast('لا يمكن إكمال حجز قبل انتهاء موعده.', 'error')
    if (nextStatus === 'checked_in' && (new Date(row.starts_at) > new Date() || new Date(row.ends_at) <= new Date())) return toast('تسجيل الوصول متاح خلال وقت الحجز فقط.', 'error')
    if (nextStatus === 'expired' && row.status !== 'pending') return toast('يمكن إنهاء مهلة الحجوزات المعلقة فقط.', 'error')
    if (nextStatus === 'expired' && row.hold_expires_at && new Date(row.hold_expires_at) > new Date()) return toast('لا يمكن إنهاء مهلة نشطة قبل انتهائها.', 'error')
    if (row.payment_status === 'refunded' && ['pending', 'confirmed', 'checked_in', 'completed'].includes(nextStatus)) return toast('لا يمكن إعادة تفعيل حجز تم استرداده.', 'error')
    const { error } = await supabase.rpc('owner_set_booking_status', { p_booking_id: row.id, p_status: nextStatus })
    if (error) toast('تعذر تحديث حالة الحجز.', 'error')
    else { toast('تم تحديث حالة الحجز وإشعار العميل.', 'success'); setRefresh((v) => v + 1) }
  }
  const recordPayment = async (row: Booking) => {
    const bankTransfer = row.payment_method === 'bank_transfer'
    const question = bankTransfer
      ? 'هل تحققت من وصول التحويل في كشف الحساب؟ لا تعتمد على صورة الإيصال وحدها.'
      : 'هل استلمت المبلغ نقدًا بالفعل؟'
    if (!window.confirm(question)) return
    const { error } = await supabase.rpc('record_manual_payment', {
      p_booking_id: row.id,
      p_note: bankTransfer ? 'تحويل بنكي تم التحقق من وصوله' : 'مبلغ نقدي مستلم في المنتجع',
    })
    if (error) toast('تعذر تسجيل الدفعة. تحقق من حالة الحجز أولاً.', 'error')
    else { toast('تم تسجيل الدفعة وتحديث حالة الحجز.', 'success'); setRefresh((v) => v + 1) }
  }
  const recordRefund = async (row: Booking) => {
    if (!window.confirm('سجّل الاسترداد بعد تنفيذه فعليًا خارج التطبيق. هل تم تحويل المبلغ للضيف؟')) return
    const { error } = await supabase.rpc('record_manual_refund', {
      p_booking_id: row.id,
      p_note: 'استرداد يدوي تم تنفيذه خارج التطبيق قبل التسجيل',
    })
    if (error) toast('تعذر تسجيل الاسترداد. قد لا يوجد سجل دفع مطابق.', 'error')
    else { toast('تم تسجيل الاسترداد. يمكنك الآن إلغاء الحجز.', 'success'); setRefresh((v) => v + 1) }
  }
  const pageCount = Math.max(1, Math.ceil(total / 20))
  return <div className="admin-page"><AdminHeading title="الحجوزات" body="ابحث في الطلبات، حدّث حالتها، وتابع الدفع ومعلومات الضيف." /><div className="admin-filterbar"><label className="admin-search"><Search /><input placeholder="رقم الحجز، الاسم، أو الجوال" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} /></label><label className="admin-select"><Filter /><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0) }}><option value="all">كل الحالات</option><option value="pending">بانتظار الإجراء</option><option value="confirmed">مؤكد</option><option value="checked_in">جارٍ الآن</option><option value="completed">مكتمل</option><option value="cancelled">ملغي</option><option value="expired">انتهت المهلة</option></select></label><label className="admin-select"><WalletCards /><select value={payment} onChange={(event) => { setPayment(event.target.value); setPage(0) }}><option value="all">كل المدفوعات</option><option value="unpaid">غير مدفوع</option><option value="processing">قيد المعالجة</option><option value="paid">مدفوع</option><option value="failed">فشل</option><option value="refunded">مسترد</option></select></label></div>
     {loading ? <Busy label="نبحث في الحجوزات" /> : rows.length ? <><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>الحجز والضيف</th><th>الاستراحة والتاريخ</th><th>المبلغ والدفع</th><th>الحالة</th><th>إجراء الحالة</th></tr></thead><tbody>{rows.map((row) => { const canRecordCash = row.payment_method === 'cash' && ['confirmed', 'checked_in', 'completed'].includes(row.status); const canRecordTransfer = row.payment_method === 'bank_transfer' && row.status === 'pending' && Boolean(row.hold_expires_at && new Date(row.hold_expires_at) > new Date()); return <tr key={row.id}><td><strong>#{row.booking_number} · {row.guest_name}</strong><small>{row.guest_phone}</small></td><td><strong>{row.unit_name_snapshot}</strong><small>{dateLabel(row.starts_at)} · {timeLabel(row.starts_at)}</small></td><td><Price value={row.total_amount} compact /><small>{row.payment_method === 'cash' ? 'نقدًا في المنتجع' : row.payment_method === 'bank_transfer' ? 'تحويل بنكي' : 'دفع إلكتروني'} · {row.payment_status === 'paid' ? 'مسجل' : row.payment_status === 'refunded' ? 'مسترد' : 'غير مدفوع'}</small>{row.payment_status !== 'paid' && row.payment_status !== 'refunded' && (canRecordCash || canRecordTransfer) && <button className="table-action" onClick={() => recordPayment(row)}>{canRecordTransfer ? 'تحقق وسجّل التحويل' : 'تسجيل النقد المستلم'}</button>}{row.payment_status === 'paid' && row.payment_method !== 'online' && row.status === 'confirmed' && new Date(row.starts_at) > new Date() && <button className="table-action danger-text" onClick={() => recordRefund(row)}>تسجيل استرداد منفذ</button>}</td><td><StatusBadge status={row.status} /></td><td><select aria-label="تغيير حالة الحجز" className="table-mini-select" value={row.status} onChange={(event) => setState(row, event.target.value)}><option value="pending">بانتظار الإجراء</option><option value="confirmed">مؤكد</option><option value="checked_in">جارٍ الآن</option><option value="completed">مكتمل</option><option value="cancelled">ملغي</option><option value="expired">انتهت المهلة</option></select><Link to={`/bookings/${row.id}`} target="_blank" className="admin-open-link">تفاصيل <ArrowUpRight size={14} /></Link></td></tr> })}</tbody></table></div><Pagination page={page} setPage={setPage} pageCount={pageCount} /></> : <EmptyState title="لا توجد حجوزات مطابقة" body="غيّر عوامل البحث أو التصفية." />}
  </div>
}

export function AdminCustomers() {
  const [rows, setRows] = useState<{ id: string; full_name: string; phone: string; created_at: string }[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    let query = supabase.from('profiles').select('id,full_name,phone,created_at', { count: 'exact' }).eq('role', 'customer').order('created_at', { ascending: false }).range(page * 25, page * 25 + 24)
    if (search.trim()) query = query.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`)
    query.then(({ data, count, error }) => {
      if (!active) return
      if (error) toast('تعذر تحميل قائمة العملاء.', 'error')
      setRows((data ?? []) as typeof rows)
      setTotal(count ?? 0)
      setLoading(false)
    })
    return () => { active = false }
  }, [page, search])
  return <div className="admin-page"><AdminHeading title="العملاء" body="بيانات التواصل الضرورية لمتابعة الحجوزات فقط." /><label className="admin-search standalone"><Search /><input placeholder="ابحث بالاسم أو رقم الجوال" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} /></label>{loading ? <Busy /> : rows.length ? <><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>العميل</th><th>رقم الجوال</th><th>تاريخ الانضمام</th><th>التواصل</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.full_name || 'ضيف'}</strong></td><td dir="ltr">{row.phone}</td><td>{dateLabel(row.created_at, { day: 'numeric', month: 'long', year: 'numeric' })}</td><td><a className="admin-open-link" href={`https://wa.me/${row.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">واتساب <ArrowUpRight size={14} /></a></td></tr>)}</tbody></table></div><Pagination page={page} setPage={setPage} pageCount={Math.ceil(total / 25)} /></> : <EmptyState title="لا يوجد عملاء مطابقون" />}</div>
}

export function AdminReviews() {
  const [rows, setRows] = useState<{ id: string; rating: number; body: string; status: string; created_at: string; customer_id: string; unit_id: string; booking_id: string }[]>([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    let query = supabase.from('reviews').select('*').order('created_at', { ascending: false }).range(0, 49)
    if (filter !== 'all') query = query.eq('status', filter)
    query.then(({ data, error }) => {
      if (!active) return
      if (error) toast('تعذر تحميل التقييمات.', 'error')
      setRows((data ?? []) as typeof rows)
      setLoading(false)
    })
    return () => { active = false }
  }, [filter, refresh])
  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('reviews').update({ status }).eq('id', id)
    if (error) toast('تعذر تحديث التقييم.', 'error')
    else { toast('تم تحديث حالة التقييم.', 'success'); setRefresh((x) => x + 1) }
  }
  return <div className="admin-page"><AdminHeading title="التقييمات" body="كل تقييم مرتبط بحجز مكتمل. راجع المحتوى قبل نشره للضيوف." /><div className="admin-filterbar"><label className="admin-select"><Filter /><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="pending">بانتظار المراجعة</option><option value="published">منشور</option><option value="hidden">مخفي</option><option value="all">الكل</option></select></label></div>{loading ? <Busy /> : rows.length ? <div className="admin-review-list">{rows.map((row) => <article key={row.id}><div className="admin-review-head"><div className="review-stars">{Array.from({ length: row.rating }, (_, index) => <Star key={index} size={14} fill="currentColor" />)}</div><StatusBadge status={row.status} /><small>{dateLabel(row.created_at)}</small></div><p>{row.body || 'لم يكتب الضيف تعليقًا.'}</p><div className="admin-review-actions"><Link to={`/bookings/${row.booking_id}`} target="_blank">عرض الحجز <ArrowUpRight size={14} /></Link><select aria-label="حالة التقييم" value={row.status} onChange={(event) => updateStatus(row.id, event.target.value)}><option value="pending">بانتظار المراجعة</option><option value="published">نشر</option><option value="hidden">إخفاء</option></select></div></article>)}</div> : <EmptyState title="لا توجد تقييمات في هذا القسم" body="عند اكتمال الزيارات سيصل تقييم الضيف إلى هنا." />}</div>
}

export function AdminInquiries() {
  const [rows, setRows] = useState<{ id: string; name: string; phone: string; message: string; status: string; created_at: string }[]>([])
  const [filter, setFilter] = useState('new')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    let query = supabase.from('inquiries').select('*').order('created_at', { ascending: false }).range(0, 99)
    if (filter !== 'all') query = query.eq('status', filter)
    query.then(({ data, error }) => {
      if (!active) return
      if (error) toast('تعذر تحميل الاستفسارات.', 'error')
      setRows((data ?? []) as typeof rows)
      setLoading(false)
    })
    return () => { active = false }
  }, [filter, refresh])
  const status = async (id: string, next: string) => {
    const { error } = await supabase.from('inquiries').update({ status: next }).eq('id', id)
    if (error) toast('تعذر تحديث حالة الاستفسار.', 'error')
    else setRefresh((value) => value + 1)
  }
  return <div className="admin-page"><AdminHeading title="الاستفسارات" body="تابع أسئلة الضيوف وتواصل معهم عبر الرقم الذي تركوه." /><label className="admin-select"><Filter /><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="new">جديد</option><option value="in_progress">قيد المتابعة</option><option value="answered">تم الرد</option><option value="closed">مغلق</option><option value="all">الكل</option></select></label>{loading ? <Busy /> : rows.length ? <div className="inquiry-list">{rows.map((row) => <article key={row.id}><div><StatusBadge status={row.status} /><small>{dateLabel(row.created_at, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</small></div><h3>{row.name}</h3><p>{row.message}</p><div className="inquiry-actions"><a href={`https://wa.me/${row.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`مرحبًا ${row.name}، بخصوص استفسارك للمنتجع:`)}`} target="_blank" rel="noreferrer">رد عبر واتساب <ArrowUpRight size={14} /></a><a href={`tel:${row.phone}`}>اتصال <ArrowUpRight size={14} /></a><select aria-label="تحديث حالة الاستفسار" value={row.status} onChange={(event) => status(row.id, event.target.value)}><option value="new">جديد</option><option value="in_progress">قيد المتابعة</option><option value="answered">تم الرد</option><option value="closed">مغلق</option></select></div></article>)}</div> : <EmptyState title="كل شيء هادئ هنا" body="ستظهر استفسارات الضيوف الجديدة في هذه القائمة." />}</div>
}

function AdminModal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])
  return <div className="admin-modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}><section className="admin-modal" role="dialog" aria-modal="true" aria-label={title}><header><div><span className="eyebrow">إدارة المنتجع</span><h2>{title}</h2></div><button onClick={close} aria-label="إغلاق"><X /></button></header><div className="admin-modal-body">{children}</div></section></div>
}

type UnitFormData = {
  id?: string
  slug: string
  name: string
  short_description: string
  description: string
  max_guests: string
  area_sqm: string
  bedrooms: string
  bathrooms: string
  base_price: string
  has_pool: boolean
  published: boolean
  amenities: string[]
}

const emptyUnitForm: UnitFormData = { slug: '', name: '', short_description: '', description: '', max_guests: '8', area_sqm: '', bedrooms: '0', bathrooms: '1', base_price: '0', has_pool: false, published: false, amenities: [] }
const toUnitForm = (unit: Omit<Unit, 'unit_amenities'> & { unit_amenities?: { amenity_id?: string }[] }): UnitFormData => ({
  id: unit.id, slug: unit.slug, name: unit.name, short_description: unit.short_description, description: unit.description,
  max_guests: String(unit.max_guests), area_sqm: unit.area_sqm ? String(unit.area_sqm) : '', bedrooms: String(unit.bedrooms), bathrooms: String(unit.bathrooms), base_price: String(unit.base_price),
  has_pool: unit.has_pool, published: unit.published, amenities: unit.unit_amenities?.map((item) => item.amenity_id).filter((id): id is string => Boolean(id)) ?? [],
})

async function uploadImage(file: File, folder: string) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 25 * 1024 * 1024) throw new Error('اختر صورة JPG أو PNG أو WebP أو AVIF أقل من 25 ميغابايت.')
  const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'webp'
  const path = `${folder}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('resort-media').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })
  if (error) throw error
  return path
}

export function AdminUnits() {
  const [rows, setRows] = useState<(Unit & { unit_media?: { id: string; storage_path: string; is_cover: boolean; sort_order: number }[]; unit_amenities?: { amenity_id: string; amenities: { id: string; name: string } }[] })[]>([])
  const [amenities, setAmenities] = useState<{ id: string; name: string; icon: string }[]>([])
  const [form, setForm] = useState<UnitFormData | null>(null)
  const [newAmenities, setNewAmenities] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [coverIndex, setCoverIndex] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const load = () => {
    setLoading(true)
    Promise.all([
      supabase.from('units').select('*,unit_media(*),unit_amenities(amenity_id,amenities(id,name))').order('sort_order').order('name'),
      supabase.from('amenities').select('id,name,icon').order('sort_order').order('name'),
    ]).then(([unitsResult, amenitiesResult]) => {
      if (unitsResult.error || amenitiesResult.error) toast('تعذر تحميل الاستراحات أو المرافق.', 'error')
      setRows((unitsResult.data ?? []) as unknown as typeof rows)
      setAmenities((amenitiesResult.data ?? []) as typeof amenities)
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [refresh])
  const visible = rows.filter((row) => row.name.toLocaleLowerCase('ar').includes(search.toLocaleLowerCase('ar')))
  const close = () => { setForm(null); setFiles([]); setNewAmenities('') }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form || form.name.trim().length < 2 || !form.slug.trim() || Number(form.max_guests) < 1 || Number(form.base_price) < 0) return toast('راجع الاسم والرابط والسعة والسعر.', 'error')
    setSaving(true)
    try {
      const values = { slug: form.slug.trim().toLowerCase(), name: form.name.trim(), short_description: form.short_description.trim(), description: form.description.trim(), max_guests: Number(form.max_guests), area_sqm: form.area_sqm ? Number(form.area_sqm) : null, bedrooms: Number(form.bedrooms), bathrooms: Number(form.bathrooms), base_price: Number(form.base_price), has_pool: form.has_pool, published: form.published }
      const result = form.id
        ? await supabase.from('units').update(values).eq('id', form.id).select('id').single()
        : await supabase.from('units').insert(values).select('id').single()
      if (result.error || !result.data) throw result.error || new Error('تعذر حفظ الاستراحة.')
      const id = result.data.id as string
      const additionalNames = newAmenities.split(/[،,\n]/).map((name) => name.trim()).filter(Boolean)
      let amenityIds = [...form.amenities]
      if (additionalNames.length) {
        const { data: created, error } = await supabase.from('amenities').upsert([...new Set(additionalNames)].map((name) => ({ name, icon: 'sparkles' })), { onConflict: 'name' }).select('id')
        if (error) throw error
        amenityIds = [...new Set([...amenityIds, ...(created ?? []).map((row) => row.id as string)])]
      }
      const { error: clearError } = await supabase.from('unit_amenities').delete().eq('unit_id', id)
      if (clearError) throw clearError
      if (amenityIds.length) {
        const { error } = await supabase.from('unit_amenities').insert(amenityIds.map((amenity_id) => ({ unit_id: id, amenity_id })))
        if (error) throw error
      }
      for (const [index, file] of files.entries()) {
        const path = await uploadImage(file, `units/${id}`)
        const { error } = await supabase.from('unit_media').insert({ unit_id: id, storage_path: path, alt_text: form.name, sort_order: index, is_cover: index === coverIndex })
        if (error) throw error
      }
      toast(form.id ? 'تم تحديث الاستراحة.' : 'تمت إضافة الاستراحة.', 'success')
      close()
      setRefresh((value) => value + 1)
    } catch (error) { toast(error instanceof Error ? error.message : 'تعذر حفظ الاستراحة.', 'error') }
    finally { setSaving(false) }
  }
  const deactivate = async (unit: Unit) => {
    if (!window.confirm(`إيقاف عرض «${unit.name}»؟ تبقى الحجوزات السابقة محفوظة.`)) return
    const { error } = await supabase.from('units').update({ published: false }).eq('id', unit.id)
    if (error) toast('تعذر إيقاف الاستراحة.', 'error')
    else { toast('أوقفت الاستراحة عن العرض.', 'success'); setRefresh((value) => value + 1) }
  }
  return <div className="admin-page"><AdminHeading title="الاستراحات" body="أضف المساحات والصور والسعة والمرافق. إيقاف العرض لا يحذف الحجوزات السابقة." action={<Button onClick={() => { setForm({ ...emptyUnitForm }); setFiles([]) }}><Plus size={16} /> استراحة جديدة</Button>} /><label className="admin-search standalone"><Search /><input placeholder="ابحث باسم الاستراحة" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    {loading ? <Busy /> : rows.length ? <div className="admin-entity-list">{visible.map((unit) => <article key={unit.id}><div className="entity-thumb">{unit.unit_media?.[0] ? <img src={imageUrl(unit.unit_media.find((item) => item.is_cover)?.storage_path || unit.unit_media[0].storage_path)} alt="" /> : <FileImage />}</div><div className="entity-copy"><div><h3>{unit.name}</h3><span className={`entity-state ${unit.published ? 'live' : ''}`}>{unit.published ? 'معروضة للضيوف' : 'غير منشورة'}</span></div><p>{unit.short_description || 'لا يوجد وصف مختصر'}</p><div className="entity-tags"><span><Users size={14} />{unit.max_guests} ضيوف</span><span><Price value={unit.base_price} compact /></span><span>{unit.has_pool ? <><Waves size={14} /> مسبح</> : 'بدون مسبح'}</span><span>{unit.unit_media?.length ?? 0} صور</span></div></div><div className="entity-actions"><button onClick={() => { setForm(toUnitForm(unit)); setFiles([]); setCoverIndex(0) }}>تعديل</button>{unit.published && <button className="danger-text" onClick={() => deactivate(unit)}>إيقاف العرض</button>}</div></article>)}</div> : <EmptyState title="أضف أول استراحة" body="يمكنك إضافة الصور والسعة والسعر والمرافق، ثم نشرها للضيوف." action={<Button onClick={() => setForm({ ...emptyUnitForm })}><Plus size={16} /> إضافة استراحة</Button>} />}
    {form && <AdminModal title={form.id ? 'تعديل الاستراحة' : 'استراحة جديدة'} close={close}><form className="admin-form" onSubmit={save}><div className="admin-form-grid"><label>اسم الاستراحة<input value={form.name} onChange={(event) => { const name = event.target.value; setForm({ ...form, name, slug: form.id ? form.slug : name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-') }) }} required /></label><label>الرابط (slug)<input dir="ltr" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required /></label><label className="wide">وصف قصير<input maxLength={180} value={form.short_description} onChange={(event) => setForm({ ...form, short_description: event.target.value })} /></label><label className="wide">وصف تفصيلي<textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>الحد الأعلى للضيوف<input type="number" min="1" value={form.max_guests} onChange={(event) => setForm({ ...form, max_guests: event.target.value })} required /></label><label>المساحة بالمتر المربع<input type="number" min="1" step="0.5" value={form.area_sqm} onChange={(event) => setForm({ ...form, area_sqm: event.target.value })} /></label><label>غرف النوم<input type="number" min="0" value={form.bedrooms} onChange={(event) => setForm({ ...form, bedrooms: event.target.value })} /></label><label>دورات المياه<input type="number" min="0" value={form.bathrooms} onChange={(event) => setForm({ ...form, bathrooms: event.target.value })} /></label><label>قيمة الاستراحة الأساسية (ر.س)<input type="number" min="0" step="0.01" value={form.base_price} onChange={(event) => setForm({ ...form, base_price: event.target.value })} required /></label></div>
      <div className="admin-switch-row"><label><input type="checkbox" checked={form.has_pool} onChange={(event) => setForm({ ...form, has_pool: event.target.checked })} /><span className="switch-ui" /><span>يوجد مسبح</span></label><label><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /><span className="switch-ui" /><span>عرض الاستراحة للضيوف</span></label></div>
      <fieldset className="admin-fieldset"><legend>المرافق</legend><div className="checkbox-chip-list">{amenities.map((item) => <label key={item.id} className={form.amenities.includes(item.id) ? 'selected' : ''}><input type="checkbox" checked={form.amenities.includes(item.id)} onChange={() => setForm({ ...form, amenities: form.amenities.includes(item.id) ? form.amenities.filter((id) => id !== item.id) : [...form.amenities, item.id] })} />{item.name}</label>)}</div><label>أضف مرافق أخرى<input value={newAmenities} onChange={(event) => setNewAmenities(event.target.value)} placeholder="افصل بين الأسماء بفاصلة" /></label></fieldset>
      <label className="file-drop"><FileImage /><span><strong>صور الاستراحة</strong><small>JPG أو PNG أو WebP · حتى 25MB للصورة</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { const selected = Array.from(event.target.files ?? []); setFiles(selected); setCoverIndex(0) }} /></label>{files.length > 0 && <div className="file-preview-row">{files.map((file, index) => <button type="button" className={coverIndex === index ? 'cover-selected' : ''} key={`${file.name}-${index}`} onClick={() => setCoverIndex(index)}><img src={URL.createObjectURL(file)} alt={file.name} /><span>{coverIndex === index ? 'صورة الغلاف' : 'اختيار كغلاف'}</span></button>)}</div>}
      <div className="admin-modal-actions"><Button type="button" variant="ghost" onClick={close}>إلغاء</Button><Button type="submit" disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ الاستراحة'} <Check size={16} /></Button></div></form></AdminModal>}
  </div>
}

type PackageFormData = { id?: string; name: string; description: string; duration_minutes: string; start_window_start: string; start_window_end: string; price: string; active: boolean; units: string[]; features: string }
const emptyPackageForm: PackageFormData = { name: '', description: '', duration_minutes: '240', start_window_start: '10:00', start_window_end: '20:00', price: '0', active: true, units: [], features: '' }

export function AdminPackages() {
  const [rows, setRows] = useState<(ResortPackage & { package_units?: { unit_id: string }[] })[]>([])
  const [units, setUnits] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState<PackageFormData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('packages').select('*,package_units(unit_id),package_features(*)').order('sort_order').order('name'),
      supabase.from('units').select('id,name').order('name'),
    ]).then(([packageResult, unitResult]) => {
      if (!active) return
      setRows((packageResult.data ?? []) as unknown as typeof rows)
      setUnits((unitResult.data ?? []) as typeof units)
      if (packageResult.error) toast('تعذر تحميل الباقات.', 'error')
      setLoading(false)
    })
    return () => { active = false }
  }, [refresh])
  const close = () => setForm(null)
  const edit = (row?: typeof rows[number]) => setForm(row ? { id: row.id, name: row.name, description: row.description, duration_minutes: String(row.duration_minutes), start_window_start: row.start_window_start.slice(0, 5), start_window_end: row.start_window_end.slice(0, 5), price: String(row.price), active: row.active, units: row.package_units?.map((item) => item.unit_id) ?? [], features: row.package_features?.sort((a, b) => a.sort_order - b.sort_order).map((item) => item.feature).join('\n') ?? '' } : { ...emptyPackageForm })
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form || !form.units.length) return toast('اربط الباقة باستراحة واحدة على الأقل.', 'error')
    setSaving(true)
    try {
      const values = { name: form.name.trim(), description: form.description.trim(), duration_minutes: Number(form.duration_minutes), start_window_start: form.start_window_start, start_window_end: form.start_window_end, price: Number(form.price), active: form.active }
      const result = form.id ? await supabase.from('packages').update(values).eq('id', form.id).select('id').single() : await supabase.from('packages').insert(values).select('id').single()
      if (result.error || !result.data) throw result.error || new Error('تعذر حفظ الباقة.')
      const id = result.data.id as string
      const [clearUnits, clearFeatures] = await Promise.all([supabase.from('package_units').delete().eq('package_id', id), supabase.from('package_features').delete().eq('package_id', id)])
      if (clearUnits.error || clearFeatures.error) throw clearUnits.error || clearFeatures.error
      const featureNames = form.features.split('\n').map((item) => item.trim()).filter(Boolean)
      const [unitResult, featureResult] = await Promise.all([
        supabase.from('package_units').insert(form.units.map((unit_id) => ({ package_id: id, unit_id }))),
        featureNames.length ? supabase.from('package_features').insert(featureNames.map((feature, sort_order) => ({ package_id: id, feature, sort_order }))) : Promise.resolve({ error: null }),
      ])
      if (unitResult.error || featureResult.error) throw unitResult.error || featureResult.error
      toast(form.id ? 'تم تحديث الباقة.' : 'تمت إضافة الباقة.', 'success')
      close(); setRefresh((value) => value + 1)
    } catch (error) { toast(error instanceof Error ? error.message : 'تعذر حفظ الباقة.', 'error') }
    finally { setSaving(false) }
  }
  const toggleActive = async (row: ResortPackage) => {
    const { error } = await supabase.from('packages').update({ active: !row.active }).eq('id', row.id)
    if (error) toast('تعذر تحديث الباقة.', 'error')
    else setRefresh((value) => value + 1)
  }
  return <div className="admin-page"><AdminHeading title="الباقات" body="أنشئ مددًا وأسعارًا مختلفة، واربط كل باقة بالاستراحات المناسبة." action={<Button onClick={() => edit()}><Plus size={16} /> باقة جديدة</Button>} />{loading ? <Busy /> : rows.length ? <div className="admin-entity-list">{rows.map((row) => <article key={row.id}><div className="entity-thumb package-thumb"><Package /></div><div className="entity-copy"><div><h3>{row.name}</h3><span className={`entity-state ${row.active ? 'live' : ''}`}>{row.active ? 'مفعّلة' : 'متوقفة'}</span></div><p>{row.description || 'لا يوجد وصف للباقة.'}</p><div className="entity-tags"><span><Clock3 size={14} />{durationLabel(row.duration_minutes)}</span><span><Price value={row.price} compact /></span><span>{row.package_units?.length ?? 0} استراحات</span></div></div><div className="entity-actions"><button onClick={() => edit(row)}>تعديل</button><button onClick={() => toggleActive(row)}>{row.active ? 'تعطيل' : 'تفعيل'}</button></div></article>)}</div> : <EmptyState title="أنشئ أول باقة" body="اربط الباقة باستراحة أو أكثر وحدد المدة وساعات البداية والسعر." action={<Button onClick={() => edit()}><Plus size={16} /> إضافة باقة</Button>} />}
    {form && <AdminModal title={form.id ? 'تعديل الباقة' : 'باقة جديدة'} close={close}><form className="admin-form" onSubmit={save}><div className="admin-form-grid"><label>اسم الباقة<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>السعر (ر.س)<input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label><label className="wide">الوصف<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>مدة الحجز بالدقائق<input type="number" min="30" max="1440" step="30" value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })} required /></label><label>بداية نافذة الحجز<input type="time" value={form.start_window_start} onChange={(event) => setForm({ ...form, start_window_start: event.target.value })} required /></label><label>نهاية نافذة البداية<input type="time" value={form.start_window_end} onChange={(event) => setForm({ ...form, start_window_end: event.target.value })} required /></label><label className="wide">المميزات · كل ميزة في سطر<textarea rows={4} value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} placeholder="مثال: خصوصية تامة&#10;جلسة خارجية" /></label></div><fieldset className="admin-fieldset"><legend>الاستراحات المرتبطة</legend><div className="checkbox-chip-list">{units.map((unit) => <label className={form.units.includes(unit.id) ? 'selected' : ''} key={unit.id}><input type="checkbox" checked={form.units.includes(unit.id)} onChange={() => setForm({ ...form, units: form.units.includes(unit.id) ? form.units.filter((id) => id !== unit.id) : [...form.units, unit.id] })} />{unit.name}</label>)}</div>{!units.length && <small>أضف استراحة قبل إنشاء الباقة.</small>}</fieldset><div className="admin-switch-row"><label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span className="switch-ui" /><span>الباقة متاحة للحجز</span></label></div><div className="admin-modal-actions"><Button type="button" variant="ghost" onClick={close}>إلغاء</Button><Button disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ الباقة'} <Check size={16} /></Button></div></form></AdminModal>}
  </div>
}

type AddOnForm = { id?: string; name: string; description: string; price: string; active: boolean; required: boolean; units: string[]; packages: string[] }
const emptyAddOnForm: AddOnForm = { name: '', description: '', price: '0', active: true, required: false, units: [], packages: [] }

export function AdminAddOns() {
  const [rows, setRows] = useState<(AddOn & { unit_add_ons?: { unit_id: string }[]; package_add_ons?: { package_id: string }[] })[]>([])
  const [units, setUnits] = useState<{ id: string; name: string }[]>([])
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState<AddOnForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('add_ons').select('*,unit_add_ons(unit_id),package_add_ons(package_id)').order('sort_order').order('name'),
      supabase.from('units').select('id,name').order('name'),
      supabase.from('packages').select('id,name').order('name'),
    ]).then(([addOnResult, unitResult, packageResult]) => {
      if (!active) return
      if (addOnResult.error) toast('تعذر تحميل الخدمات الإضافية.', 'error')
      setRows((addOnResult.data ?? []) as unknown as typeof rows)
      setUnits((unitResult.data ?? []) as typeof units)
      setPackages((packageResult.data ?? []) as typeof packages)
      setLoading(false)
    })
    return () => { active = false }
  }, [refresh])
  const edit = (row?: typeof rows[number]) => setForm(row ? { id: row.id, name: row.name, description: row.description, price: String(row.price), active: row.active, required: row.required, units: row.unit_add_ons?.map((item) => item.unit_id) ?? [], packages: row.package_add_ons?.map((item) => item.package_id) ?? [] } : { ...emptyAddOnForm })
  const close = () => setForm(null)
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form || !form.units.length) return toast('اختر استراحة واحدة على الأقل لهذه الخدمة.', 'error')
    setSaving(true)
    try {
      const values = { name: form.name.trim(), description: form.description.trim(), price: Number(form.price), active: form.active, required: form.required }
      const result = form.id ? await supabase.from('add_ons').update(values).eq('id', form.id).select('id').single() : await supabase.from('add_ons').insert(values).select('id').single()
      if (result.error || !result.data) throw result.error || new Error('تعذر حفظ الخدمة.')
      const id = result.data.id as string
      const [oldUnits, oldPackages] = await Promise.all([supabase.from('unit_add_ons').delete().eq('add_on_id', id), supabase.from('package_add_ons').delete().eq('add_on_id', id)])
      if (oldUnits.error || oldPackages.error) throw oldUnits.error || oldPackages.error
      const [unitResult, packageResult] = await Promise.all([
        supabase.from('unit_add_ons').insert(form.units.map((unit_id) => ({ add_on_id: id, unit_id }))),
        form.packages.length ? supabase.from('package_add_ons').insert(form.packages.map((package_id) => ({ add_on_id: id, package_id }))) : Promise.resolve({ error: null }),
      ])
      if (unitResult.error || packageResult.error) throw unitResult.error || packageResult.error
      toast(form.id ? 'تم تحديث الخدمة.' : 'تمت إضافة الخدمة.', 'success')
      close(); setRefresh((value) => value + 1)
    } catch (error) { toast(error instanceof Error ? error.message : 'تعذر حفظ الخدمة.', 'error') }
    finally { setSaving(false) }
  }
  const toggle = async (row: AddOn) => {
    const { error } = await supabase.from('add_ons').update({ active: !row.active }).eq('id', row.id)
    if (error) toast('تعذر تحديث الخدمة.', 'error')
    else setRefresh((value) => value + 1)
  }
  return <div className="admin-page"><AdminHeading title="الخدمات الإضافية" body="أنشئ إضافات اختيارية أو مطلوبة، واربطها بالاستراحات والباقات المناسبة." action={<Button onClick={() => edit()}><Plus size={16} /> خدمة جديدة</Button>} />{loading ? <Busy /> : rows.length ? <div className="admin-entity-list">{rows.map((row) => <article key={row.id}><div className="entity-thumb package-thumb"><Sparkles /></div><div className="entity-copy"><div><h3>{row.name}</h3><span className={`entity-state ${row.active ? 'live' : ''}`}>{row.active ? 'متاحة' : 'متوقفة'}</span>{row.required && <span className="required-label">مطلوبة</span>}</div><p>{row.description || 'لا يوجد وصف للخدمة.'}</p><div className="entity-tags"><span><Price value={row.price} compact /></span><span>{row.unit_add_ons?.length ?? 0} استراحات</span><span>{row.package_add_ons?.length ? `${row.package_add_ons.length} باقات` : 'كل الباقات المرتبطة'}</span></div></div><div className="entity-actions"><button onClick={() => edit(row)}>تعديل</button><button onClick={() => toggle(row)}>{row.active ? 'تعطيل' : 'تفعيل'}</button></div></article>)}</div> : <EmptyState title="أضف خدمة مميزة" body="اربط خدمة مثل الضيافة أو تجهيز المناسبات بالاستراحات والباقات المناسبة." action={<Button onClick={() => edit()}><Plus size={16} /> إضافة خدمة</Button>} />}
    {form && <AdminModal title={form.id ? 'تعديل خدمة' : 'خدمة جديدة'} close={close}><form className="admin-form" onSubmit={save}><div className="admin-form-grid"><label>اسم الخدمة<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>السعر (ر.س)<input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label><label className="wide">الوصف<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div><fieldset className="admin-fieldset"><legend>الاستراحات المتاحة</legend><div className="checkbox-chip-list">{units.map((unit) => <label className={form.units.includes(unit.id) ? 'selected' : ''} key={unit.id}><input type="checkbox" checked={form.units.includes(unit.id)} onChange={() => setForm({ ...form, units: form.units.includes(unit.id) ? form.units.filter((id) => id !== unit.id) : [...form.units, unit.id] })} />{unit.name}</label>)}</div></fieldset><fieldset className="admin-fieldset"><legend>الباقات المتاحة · اتركها فارغة لإتاحتها مع كل باقة</legend><div className="checkbox-chip-list">{packages.map((pkg) => <label className={form.packages.includes(pkg.id) ? 'selected' : ''} key={pkg.id}><input type="checkbox" checked={form.packages.includes(pkg.id)} onChange={() => setForm({ ...form, packages: form.packages.includes(pkg.id) ? form.packages.filter((id) => id !== pkg.id) : [...form.packages, pkg.id] })} />{pkg.name}</label>)}</div></fieldset><div className="admin-switch-row"><label><input type="checkbox" checked={form.required} onChange={(event) => setForm({ ...form, required: event.target.checked })} /><span className="switch-ui" /><span>الخدمة مطلوبة</span></label><label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span className="switch-ui" /><span>الخدمة متاحة</span></label></div><div className="admin-modal-actions"><Button type="button" variant="ghost" onClick={close}>إلغاء</Button><Button disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ الخدمة'} <Check size={16} /></Button></div></form></AdminModal>}
  </div>
}

type AvailabilityBlock = { id: string; unit_id: string; starts_at: string; ends_at: string; reason: string; units: { name: string } }

export function AdminAvailability() {
  const [units, setUnits] = useState<{ id: string; name: string }[]>([])
  const [rows, setRows] = useState<AvailabilityBlock[]>([])
  const [unitId, setUnitId] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [startsTime, setStartsTime] = useState('10:00')
  const [endsOn, setEndsOn] = useState('')
  const [endsTime, setEndsTime] = useState('22:00')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('units').select('id,name').order('name'),
      supabase.from('availability_blocks').select('*,units(name)').gte('ends_at', new Date().toISOString()).order('starts_at').limit(100),
    ]).then(([unitResult, blockResult]) => {
      if (!active) return
      const unitRows = (unitResult.data ?? []) as typeof units
      setUnits(unitRows)
      setUnitId((current) => current || unitRows[0]?.id || '')
      setRows((blockResult.data ?? []) as unknown as AvailabilityBlock[])
      if (blockResult.error) toast('تعذر تحميل فترات الإغلاق.', 'error')
      setLoading(false)
    })
    return () => { active = false }
  }, [refresh])
  const addBlock = async (event: FormEvent) => {
    event.preventDefault()
    const starts_at = new Date(`${startsOn}T${startsTime}:00+03:00`).toISOString()
    const ends_at = new Date(`${endsOn}T${endsTime}:00+03:00`).toISOString()
    if (!unitId || !startsOn || !endsOn || new Date(ends_at) <= new Date(starts_at)) return toast('حدد استراحة ونطاقًا زمنيًا صحيحًا.', 'error')
    setSaving(true)
    const { error } = await supabase.from('availability_blocks').insert({ unit_id: unitId, starts_at, ends_at, reason: reason.trim() })
    setSaving(false)
    if (error) return toast(/overlap/i.test(error.message) ? 'يتعارض الإغلاق مع حجز مؤكد. لا يمكن إغلاق الموعد.' : 'تعذر إضافة فترة الإغلاق.', 'error')
    toast('تم تحديث التوافر وإغلاق الفترة.', 'success')
    setReason(''); setRefresh((value) => value + 1)
  }
  const remove = async (row: AvailabilityBlock) => {
    if (!window.confirm('إزالة فترة الإغلاق وإتاحة الموعد للحجز؟')) return
    const { error } = await supabase.from('availability_blocks').delete().eq('id', row.id)
    if (error) toast('تعذر إزالة فترة الإغلاق.', 'error')
    else setRefresh((value) => value + 1)
  }
  return <div className="admin-page"><AdminHeading title="التوافر والإغلاق" body="أغلق موعدًا أو فترة صيانة. يمنع النظام إغلاق موعد يتعارض مع حجز نشط." /><div className="availability-admin-grid"><form className="admin-panel availability-form" onSubmit={addBlock}><div className="admin-panel-heading"><div><span className="eyebrow">تحديث التقويم</span><h2>إضافة فترة مغلقة</h2></div><CalendarDays /></div><label>الاستراحة<select value={unitId} onChange={(event) => setUnitId(event.target.value)} required><option value="">اختر الاستراحة</option>{units.map((unit) => <option value={unit.id} key={unit.id}>{unit.name}</option>)}</select></label><div className="admin-form-grid"><label>من تاريخ<input type="date" value={startsOn} onChange={(event) => { setStartsOn(event.target.value); if (!endsOn) setEndsOn(event.target.value) }} required /></label><label>وقت البداية<input type="time" value={startsTime} onChange={(event) => setStartsTime(event.target.value)} required /></label><label>إلى تاريخ<input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} required /></label><label>وقت النهاية<input type="time" value={endsTime} onChange={(event) => setEndsTime(event.target.value)} required /></label></div><label>ملاحظة داخلية<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="صيانة، حجز خاص…" /></label><Button disabled={saving || !units.length}>{saving ? 'جارٍ الحفظ…' : 'إغلاق الفترة'} <Check size={15} /></Button></form><section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">الفترات القادمة</span><h2>الإغلاق النشط</h2></div><span>{rows.length}</span></div>{loading ? <Busy /> : rows.length ? <div className="block-list">{rows.map((row) => <article key={row.id}><div className="block-icon"><CalendarDays /></div><div><strong>{row.units?.name || 'استراحة'}</strong><span>{dateLabel(row.starts_at)} · {timeLabel(row.starts_at)} – {dateLabel(row.ends_at)} · {timeLabel(row.ends_at)}</span>{row.reason && <small>{row.reason}</small>}</div><button aria-label="إزالة الإغلاق" onClick={() => remove(row)}><Trash2 size={16} /></button></article>)}</div> : <EmptyState title="لا توجد فترات إغلاق قادمة" body="كل الأوقات ستظل متاحة وفق الباقات والحجوزات." />}</section></div></div>
}

type CouponRow = { id: string; code: string; discount_type: 'percent' | 'fixed'; discount_value: number; minimum_amount: number; max_uses: number | null; used_count: number; starts_at: string | null; ends_at: string | null; active: boolean; unit_id: string | null; package_id: string | null }
type CouponForm = { id?: string; code: string; discount_type: 'percent' | 'fixed'; discount_value: string; minimum_amount: string; max_uses: string; starts_at: string; ends_at: string; active: boolean; unit_id: string; package_id: string }
const emptyCoupon: CouponForm = { code: '', discount_type: 'percent', discount_value: '10', minimum_amount: '0', max_uses: '', starts_at: '', ends_at: '', active: true, unit_id: '', package_id: '' }

export function AdminCoupons() {
  const [rows, setRows] = useState<CouponRow[]>([])
  const [units, setUnits] = useState<{ id: string; name: string }[]>([])
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState<CouponForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      supabase.from('units').select('id,name').order('name'),
      supabase.from('packages').select('id,name').order('name'),
    ]).then(([couponResult, unitResult, packageResult]) => {
      if (!active) return
      if (couponResult.error) toast('تعذر تحميل الكوبونات.', 'error')
      setRows((couponResult.data ?? []) as CouponRow[])
      setUnits((unitResult.data ?? []) as typeof units)
      setPackages((packageResult.data ?? []) as typeof packages)
      setLoading(false)
    })
    return () => { active = false }
  }, [refresh])
  const edit = (row?: CouponRow) => setForm(row ? { id: row.id, code: row.code, discount_type: row.discount_type, discount_value: String(row.discount_value), minimum_amount: String(row.minimum_amount), max_uses: row.max_uses ? String(row.max_uses) : '', starts_at: row.starts_at?.slice(0, 16) ?? '', ends_at: row.ends_at?.slice(0, 16) ?? '', active: row.active, unit_id: row.unit_id ?? '', package_id: row.package_id ?? '' } : { ...emptyCoupon })
  const close = () => setForm(null)
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form) return
    if (Number(form.discount_value) <= 0 || Number(form.minimum_amount) < 0 || form.discount_type === 'percent' && Number(form.discount_value) > 100) return toast('راجع قيمة الخصم والحد الأدنى.', 'error')
    setSaving(true)
    const values = { code: form.code.trim().toUpperCase(), discount_type: form.discount_type, discount_value: Number(form.discount_value), minimum_amount: Number(form.minimum_amount), max_uses: form.max_uses ? Number(form.max_uses) : null, starts_at: form.starts_at ? new Date(`${form.starts_at}+03:00`).toISOString() : null, ends_at: form.ends_at ? new Date(`${form.ends_at}+03:00`).toISOString() : null, active: form.active, unit_id: form.unit_id || null, package_id: form.package_id || null }
    const result = form.id ? await supabase.from('coupons').update(values).eq('id', form.id) : await supabase.from('coupons').insert(values)
    setSaving(false)
    if (result.error) return toast('تعذر حفظ الكوبون. قد يكون الرمز مستخدمًا بالفعل.', 'error')
    toast(form.id ? 'تم تحديث الكوبون.' : 'تم إنشاء الكوبون.', 'success'); close(); setRefresh((value) => value + 1)
  }
  const toggle = async (row: CouponRow) => {
    const { error } = await supabase.from('coupons').update({ active: !row.active }).eq('id', row.id)
    if (error) toast('تعذر تحديث الكوبون.', 'error')
    else setRefresh((value) => value + 1)
  }
  return <div className="admin-page"><AdminHeading title="الكوبونات والعروض" body="خصومات بقيمة أو نسبة مع صلاحية وحد استخدام وربط اختياري باستراحة أو باقة." action={<Button onClick={() => edit()}><Plus size={16} /> كوبون جديد</Button>} />{loading ? <Busy /> : rows.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>الرمز</th><th>الخصم</th><th>الاستخدام</th><th>الصلاحية</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong className="coupon-code">{row.code}</strong><small>{row.unit_id ? 'على استراحة محددة' : row.package_id ? 'على باقة محددة' : 'كل الحجوزات'}</small></td><td>{row.discount_type === 'percent' ? `${row.discount_value}%` : <Price value={row.discount_value} compact />}<small>حد أدنى {new Intl.NumberFormat('ar-SA').format(row.minimum_amount)} ر.س</small></td><td>{row.used_count}{row.max_uses ? ` / ${row.max_uses}` : ' / غير محدود'}</td><td>{row.ends_at ? dateLabel(row.ends_at, { day: 'numeric', month: 'short', year: 'numeric' }) : 'بدون انتهاء'}</td><td><span className={`entity-state ${row.active ? 'live' : ''}`}>{row.active ? 'فعال' : 'متوقف'}</span></td><td><button className="table-action" onClick={() => edit(row)}>تعديل</button><button className="table-action" onClick={() => toggle(row)}>{row.active ? 'تعطيل' : 'تفعيل'}</button></td></tr>)}</tbody></table></div> : <EmptyState title="لا توجد كوبونات فعالة" body="أنشئ أول رمز خصم وسيطبق الخادم شروطه عند إنشاء الحجز." action={<Button onClick={() => edit()}><Plus size={16} /> إنشاء كوبون</Button>} />}
    {form && <AdminModal title={form.id ? 'تعديل الكوبون' : 'كوبون جديد'} close={close}><form className="admin-form" onSubmit={save}><div className="admin-form-grid"><label>رمز الكوبون<input dir="ltr" autoCapitalize="characters" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} minLength={3} required /></label><label>نوع الخصم<select value={form.discount_type} onChange={(event) => setForm({ ...form, discount_type: event.target.value as CouponForm['discount_type'] })}><option value="percent">نسبة مئوية</option><option value="fixed">مبلغ ثابت (ر.س)</option></select></label><label>قيمة الخصم<input type="number" min="0.01" max={form.discount_type === 'percent' ? 100 : undefined} step="0.01" value={form.discount_value} onChange={(event) => setForm({ ...form, discount_value: event.target.value })} required /></label><label>الحد الأدنى للحجز (ر.س)<input type="number" min="0" step="0.01" value={form.minimum_amount} onChange={(event) => setForm({ ...form, minimum_amount: event.target.value })} /></label><label>عدد مرات الاستخدام<input type="number" min="1" value={form.max_uses} onChange={(event) => setForm({ ...form, max_uses: event.target.value })} placeholder="بدون حد" /></label><label>تاريخ البداية<input type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label><label>تاريخ النهاية<input type="datetime-local" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></label><label>استراحة محددة<select value={form.unit_id} onChange={(event) => setForm({ ...form, unit_id: event.target.value, package_id: '' })}><option value="">كل الاستراحات</option>{units.map((unit) => <option value={unit.id} key={unit.id}>{unit.name}</option>)}</select></label><label>باقة محددة<select value={form.package_id} onChange={(event) => setForm({ ...form, package_id: event.target.value, unit_id: '' })}><option value="">كل الباقات</option>{packages.map((pkg) => <option value={pkg.id} key={pkg.id}>{pkg.name}</option>)}</select></label></div><div className="admin-switch-row"><label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span className="switch-ui" /><span>الكوبون فعال</span></label></div><div className="admin-modal-actions"><Button type="button" variant="ghost" onClick={close}>إلغاء</Button><Button disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ الكوبون'} <Check size={16} /></Button></div></form></AdminModal>}
  </div>
}

type FaqRow = { id: string; question: string; answer: string; published: boolean; sort_order: number }

export function AdminContent() {
  const [faqs, setFaqs] = useState<FaqRow[]>([])
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    supabase.from('faq_entries').select('*').order('sort_order').order('created_at').then(({ data, error }) => {
      if (!active) return
      if (error) toast('تعذر تحميل الأسئلة الشائعة.', 'error')
      setFaqs((data ?? []) as FaqRow[])
      setLoading(false)
    })
    return () => { active = false }
  }, [refresh])
  const saveFaq = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const values = { question: question.trim(), answer: answer.trim(), published: true }
    const result = editing ? await supabase.from('faq_entries').update(values).eq('id', editing) : await supabase.from('faq_entries').insert(values)
    setSaving(false)
    if (result.error) return toast('تعذر حفظ السؤال.', 'error')
    toast(editing ? 'تم تحديث السؤال.' : 'تمت إضافة السؤال.', 'success')
    setQuestion(''); setAnswer(''); setEditing(null); setRefresh((value) => value + 1)
  }
  const toggleFaq = async (row: FaqRow) => {
    const { error } = await supabase.from('faq_entries').update({ published: !row.published }).eq('id', row.id)
    if (error) toast('تعذر تحديث السؤال.', 'error')
    else setRefresh((value) => value + 1)
  }
  const deleteFaq = async (row: FaqRow) => {
    if (!window.confirm(`حذف السؤال «${row.question}»؟`)) return
    const { error } = await supabase.from('faq_entries').delete().eq('id', row.id)
    if (error) toast('تعذر حذف السؤال.', 'error')
    else setRefresh((value) => value + 1)
  }
  const broadcast = async (event: FormEvent) => {
    event.preventDefault()
    if (!window.confirm('سيظهر هذا التنبيه لجميع حسابات العملاء داخل التطبيق. متابعة؟')) return
    setSaving(true)
    const { data: customers, error: profileError } = await supabase.from('profiles').select('id').eq('role', 'customer').range(0, 9999)
    if (profileError) { setSaving(false); return toast('تعذر جلب قائمة العملاء.', 'error') }
    const recipients = (customers ?? []).map((row) => ({ customer_id: row.id, title: announcementTitle.trim(), body: announcementBody.trim(), kind: 'offer' }))
    for (let i = 0; i < recipients.length; i += 200) {
      const { error } = await supabase.from('notifications').insert(recipients.slice(i, i + 200))
      if (error) { setSaving(false); return toast('توقف إرسال التنبيه. راجع سجل التغييرات قبل إعادة المحاولة.', 'error') }
    }
    setSaving(false); setAnnouncementTitle(''); setAnnouncementBody('')
    toast(`تم إرسال التنبيه داخل التطبيق إلى ${recipients.length} حساب.`, 'success')
  }
  return <div className="admin-page"><AdminHeading title="المحتوى والأسئلة" body="أدر الأسئلة الظاهرة للضيوف وأرسل إشعارات مهمة داخل التطبيق." /><div className="admin-content-grid"><section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">تظهر في الصفحة الرئيسية</span><h2>الأسئلة الشائعة</h2></div><CircleHelp /></div><form className="inline-create-form" onSubmit={saveFaq}><label>السؤال<input value={question} onChange={(event) => setQuestion(event.target.value)} minLength={5} required /></label><label>الإجابة<textarea rows={3} value={answer} onChange={(event) => setAnswer(event.target.value)} minLength={5} required /></label><div className="inline-form-actions">{editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setQuestion(''); setAnswer('') }}>إلغاء التعديل</Button>}<Button disabled={saving}>{saving ? 'جارٍ الحفظ…' : editing ? 'تحديث السؤال' : 'إضافة سؤال'} <Plus size={15} /></Button></div></form>{loading ? <Busy /> : faqs.length ? <div className="faq-admin-list">{faqs.map((row) => <article key={row.id}><div><strong>{row.question}</strong><p>{row.answer}</p></div><span className={`entity-state ${row.published ? 'live' : ''}`}>{row.published ? 'منشور' : 'مخفي'}</span><div className="entity-actions"><button onClick={() => { setEditing(row.id); setQuestion(row.question); setAnswer(row.answer) }}>تعديل</button><button onClick={() => toggleFaq(row)}>{row.published ? 'إخفاء' : 'نشر'}</button><button className="danger-text" onClick={() => deleteFaq(row)}>حذف</button></div></article>)}</div> : <EmptyState title="لا توجد أسئلة بعد" body="أضف إجابات مختصرة عن الحجز والوصول وسياسات المنتجع." />}</section>
      <div className="admin-side-stack"><section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">إشعارات داخل التطبيق</span><h2>تنبيه للعملاء</h2></div><Bell /></div><p className="admin-help-copy">يرسل هذا الإشعار إلى مركز التنبيهات لجميع العملاء. لا يرسل SMS أو Push خارجيًا.</p><form className="inline-create-form" onSubmit={broadcast}><label>العنوان<input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} maxLength={100} required /></label><label>التفاصيل<textarea rows={4} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} maxLength={1000} required /></label><Button disabled={saving}>{saving ? 'جارٍ الإرسال…' : 'إرسال التنبيه'} <ArrowLeft size={15} /></Button></form></section><section className="admin-note-panel"><ShieldCheck /><div><strong>محتوى واضح، وتجربة آمنة</strong><p>لا تُضف معلومات تشغيلية أو شروطًا غير معتمدة. سيظهر المحتوى المنشور مباشرة للضيوف.</p></div></section></div></div></div>
}

export function AdminSettings() {
  const [form, setForm] = useState<ResortSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hero, setHero] = useState<File | null>(null)
  const [logo, setLogo] = useState<File | null>(null)
  useEffect(() => {
    let active = true
    supabase.from('resort_settings').select('*').eq('id', true).maybeSingle().then(({ data, error }) => {
      if (!active) return
      if (error) toast('تعذر تحميل إعدادات المنتجع.', 'error')
      setForm(data as ResortSettings | null)
      setLoading(false)
    })
    return () => { active = false }
  }, [])
  const change = <K extends keyof ResortSettings>(key: K, value: ResortSettings[K]) => setForm((current) => current ? { ...current, [key]: value } : current)
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    try {
      let heroPath = form.hero_path
      let logoPath = form.logo_path
      if (hero) heroPath = await uploadImage(hero, 'brand')
      if (logo) logoPath = await uploadImage(logo, 'brand')
      const values = { ...form, id: true, hero_path: heroPath, logo_path: logoPath, latitude: form.latitude === null ? null : Number(form.latitude), longitude: form.longitude === null ? null : Number(form.longitude), bank_transfer_hold_hours: Number(form.bank_transfer_hold_hours), online_payments_enabled: false }
      const { error } = await supabase.from('resort_settings').update(values).eq('id', true)
      if (error) throw error
      setHero(null); setLogo(null); setForm({ ...form, hero_path: heroPath, logo_path: logoPath })
      toast('حُفظت إعدادات المنتجع ومحتواه.', 'success')
    } catch (error) { toast(error instanceof Error ? error.message : 'تعذر حفظ الإعدادات.', 'error') }
    finally { setSaving(false) }
  }
  const field = (key: keyof ResortSettings, label: string, options: { multiline?: boolean; wide?: boolean; type?: string; placeholder?: string } = {}) => <label className={options.wide ? 'wide' : ''}>{label}{options.multiline ? <textarea rows={4} value={String(form?.[key] ?? '')} onChange={(event) => change(key, event.target.value as ResortSettings[typeof key])} /> : <input type={options.type ?? 'text'} placeholder={options.placeholder} value={String(form?.[key] ?? '')} onChange={(event) => change(key, event.target.value as ResortSettings[typeof key])} />}</label>
  if (loading || !form) return <div className="admin-page"><AdminHeading title="إعدادات المنتجع" body="بيانات التواصل والسياسات والمحتوى العام." />{loading ? <Busy /> : <EmptyState title="تعذر قراءة الإعدادات" body="طبّق ترحيل قاعدة البيانات ثم أعد تحميل الصفحة." />}</div>
  return <div className="admin-page"><AdminHeading title="إعدادات المنتجع" body="تظهر هذه المعلومات للضيوف في الواجهة العامة ورسائل الحجز." /><form className="admin-settings-form" onSubmit={save}><section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">الهوية والمحتوى</span><h2>صوت المنتجع</h2></div><Sparkles /></div><div className="admin-form-grid">{field('name', 'اسم المنتجع')}{field('tagline', 'العبارة التعريفية')}{field('about', 'نبذة عن التجربة', { multiline: true, wide: true })}<label className="wide">الصورة الرئيسية<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setHero(event.target.files?.[0] ?? null)} /><small>{form.hero_path ? `الصورة الحالية: ${form.hero_path.split('/').pop()}` : 'لم تُرفع صورة رئيسية بعد.'}</small></label><label className="wide">الشعار<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setLogo(event.target.files?.[0] ?? null)} /><small>{form.logo_path ? `الشعار الحالي: ${form.logo_path.split('/').pop()}` : 'يمكنك إضافة شعار المنتجع.'}</small></label></div></section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">تواصل وموقع</span><h2>نحن قريبون منك</h2></div><MapPin /></div><div className="admin-form-grid">{field('phone', 'رقم الهاتف', { type: 'tel' })}{field('whatsapp', 'واتساب بصيغة دولية', { type: 'tel', placeholder: '9665xxxxxxxx' })}{field('email', 'البريد الإلكتروني', { type: 'email' })}{field('address', 'العنوان', { wide: true })}{field('latitude', 'خط العرض', { type: 'number' })}{field('longitude', 'خط الطول', { type: 'number' })}{field('map_url', 'رابط الخريطة', { wide: true, placeholder: 'https://maps.app.goo.gl/...' })}{field('instagram_url', 'حساب إنستغرام', { wide: true })}</div></section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">السياسات المعتمدة</span><h2>وضوح قبل الحجز</h2></div><ShieldCheck /></div><div className="admin-form-grid">{field('cancellation_hours', 'مهلة الإلغاء بالساعات', { type: 'number' })}{field('cancellation_policy', 'سياسة الإلغاء', { multiline: true })}{field('refund_policy', 'سياسة الاسترداد', { multiline: true })}{field('late_policy', 'التأخير وتعليمات الزيارة', { multiline: true })}{field('arrival_instructions', 'تعليمات الوصول', { multiline: true, wide: true })}{field('terms', 'الشروط والأحكام', { multiline: true, wide: true })}{field('privacy_policy', 'سياسة الخصوصية', { multiline: true, wide: true })}</div></section>
     <section className="admin-panel"><div className="admin-panel-heading"><div><span className="eyebrow">وسائل الدفع</span><h2>خيارات دفع واضحة</h2></div><CreditCard /></div><div className="admin-switch-row payment-switches"><label><input type="checkbox" checked={form.cash_enabled} onChange={(event) => change('cash_enabled', event.target.checked)} /><span className="switch-ui" /><span>السماح بالدفع نقدًا في المنتجع</span></label><label><input type="checkbox" checked={form.bank_transfer_enabled} onChange={(event) => { if (event.target.checked && (!form.bank_name.trim() || !form.bank_beneficiary.trim() || !form.bank_iban.trim())) return toast('أدخل اسم البنك والمستفيد والآيبان قبل تفعيل التحويل.', 'error'); change('bank_transfer_enabled', event.target.checked) }} /><span className="switch-ui" /><span>السماح بالتحويل البنكي</span></label></div><div className="admin-form-grid">{field('bank_name', 'اسم البنك')}{field('bank_beneficiary', 'اسم المستفيد')}{field('bank_iban', 'رقم الآيبان', { wide: true, placeholder: 'SA…' })}{field('bank_transfer_hold_hours', 'مهلة التحويل بالساعات', { type: 'number', placeholder: '24' })}</div><p className="admin-help-copy">تظل حجوزات التحويل معلّقة حتى تطابق الدفعة مع كشف الحساب. سجّلها من الحجوزات بعد التحقق الفعلي. الدفع الإلكتروني داخل الموقع متوقف ولا يمكن تفعيله من هذه الصفحة.</p><label className="admin-demo-toggle"><input type="checkbox" checked={form.demo_mode} onChange={(event) => change('demo_mode', event.target.checked)} /><span>وضع المعاينة للبيانات التجريبية (يمنع الحجوزات والاستفسارات)</span></label></section>
    <div className="settings-save-row"><span>العملة: الريال السعودي · التوقيت: Asia/Riyadh</span><Button disabled={saving}>{saving ? 'جارٍ حفظ الإعدادات…' : 'حفظ كل التغييرات'} <Check size={16} /></Button></div></form></div>
}

export function AdminAudit() {
  const [rows, setRows] = useState<{ id: number; actor_id: string | null; action: string; table_name: string; record_id: string; created_at: string }[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * 30, page * 30 + 29).then(({ data, error, count }) => {
      if (!active) return
      if (error) toast('تعذر تحميل سجل التغييرات.', 'error')
      setRows((data ?? []) as typeof rows)
      setPageCount(Math.max(1, Math.ceil((count ?? 0) / 30)))
      setLoading(false)
    })
    return () => { active = false }
  }, [page])
  const [pageCount, setPageCount] = useState(1)
  const labels: Record<string, string> = { resort_settings: 'إعدادات المنتجع', units: 'الاستراحات', packages: 'الباقات', add_ons: 'الخدمات الإضافية', bookings: 'الحجوزات', availability_blocks: 'التوافر', coupons: 'الكوبونات', reviews: 'التقييمات', inquiries: 'الاستفسارات', faq_entries: 'الأسئلة الشائعة' }
  return <div className="admin-page"><AdminHeading title="سجل التغييرات" body="سجل تدقيقي غير قابل للتعديل، يحفظ نوع التغيير وسجله دون نسخ بيانات العملاء إلى السجل." />{loading ? <Busy /> : rows.length ? <><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>التغيير</th><th>المساحة</th><th>معرّف السجل</th><th>المنفّذ</th><th>التاريخ</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><span className={`audit-action action-${row.action}`}>{row.action === 'insert' ? 'إضافة' : row.action === 'update' ? 'تعديل' : 'حذف'}</span></td><td>{labels[row.table_name] || row.table_name}</td><td><code>{row.record_id}</code></td><td>{row.actor_id ? `${row.actor_id.slice(0, 8)}…` : 'نظام'}</td><td>{dateLabel(row.created_at, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td></tr>)}</tbody></table></div><Pagination page={page} setPage={setPage} pageCount={pageCount} /></> : <EmptyState title="لا توجد تغييرات مسجلة بعد" body="ستظهر تعديلات بيانات المنتجع والإدارة هنا." />}</div>
}
