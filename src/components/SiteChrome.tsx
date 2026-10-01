import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Bell, CalendarDays, ChevronLeft, House, LogIn, Menu, Settings2, Sparkles, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabaseConfigured, supabase } from '../lib/supabase'
import { imageUrl, type ResortSettings } from '../lib/models'

const links = [
  { to: '/', label: 'الرئيسية', icon: House },
  { to: '/units', label: 'الاستراحات', icon: Sparkles },
  { to: '/bookings', label: 'حجوزاتي', icon: CalendarDays },
]

export function SiteHeader() {
  const { profile, user } = useAuth()
  const [settings, setSettings] = useState<ResortSettings | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.from('resort_settings').select('*').eq('id', true).maybeSingle()
      .then(({ data }) => setSettings(data as ResortSettings | null))
  }, [])

  useEffect(() => setMenuOpen(false), [location.pathname])

  const brand = <Link to="/" className="brand" aria-label="العودة للرئيسية">
    {settings?.logo_path ? <img className="brand-logo" src={imageUrl(settings.logo_path)} alt="" /> : <span className="brand-mark"><i /><i /><i /></span>}
    <span><strong>{settings?.name || 'منتجع و استراحة خالد العمدة'}</strong><small>ضيافة بطابع سعودي</small></span>
  </Link>

  return <>
    {settings?.demo_mode && <div className="setup-notice demo-preview-notice">معاينة تجريبية: الأسماء والأسعار للعرض فقط، ولا تُنشأ منها حجوزات فعلية.</div>}
    <header className="site-header">
      <div className="header-inner">
        {brand}
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="التنقل الرئيسي">
          {links.slice(0, 2).map(({ to, label }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>)}
          <a href="/#experience">تجربة المنتجع</a>
          <a href="/#contact">التواصل</a>
          {user && <NavLink to="/bookings" className={({ isActive }) => isActive ? 'active' : ''}>حجوزاتي</NavLink>}
        </nav>
        <div className="header-actions">
          {user ? <>
            <Link to="/notifications" className="header-icon" aria-label="الإشعارات"><Bell size={19} /></Link>
            {profile?.role === 'owner' && <Link to="/admin" className="owner-link"><Settings2 size={15} /> لوحة المالك</Link>}
            <Link to="/account" className="avatar-link">{profile?.full_name?.trim()?.slice(0, 1) || 'ح'}</Link>
          </> : <Link to="/login" className="login-link"><LogIn size={17} /> دخول الحساب</Link>}
          <Link to="/units" className="button button-primary header-book">احجز إقامتك <ChevronLeft size={16} /></Link>
        </div>
        <button className="menu-toggle" aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
      </div>
    </header>
    <nav className="mobile-dock" aria-label="تنقل الهاتف">
      <NavLink to="/" end><House /><span>الرئيسية</span></NavLink>
      <NavLink to="/units"><Sparkles /><span>الاستراحات</span></NavLink>
      <NavLink to={user ? '/bookings' : '/login'}><CalendarDays /><span>حجوزاتي</span></NavLink>
      <NavLink to={user ? '/account' : '/login'}><span className="dock-profile">{user ? (profile?.full_name?.slice(0, 1) || 'ح') : <LogIn size={17} />}</span><span>حسابي</span></NavLink>
    </nav>
  </>
}

export function SiteFooter({ settings: suppliedSettings }: { settings?: ResortSettings | null }) {
  const [loadedSettings, setLoadedSettings] = useState<ResortSettings | null>(null)
  useEffect(() => {
    if (!suppliedSettings && supabaseConfigured) {
      supabase.from('resort_settings').select('*').eq('id', true).maybeSingle()
        .then(({ data }) => setLoadedSettings(data as ResortSettings | null))
    }
  }, [suppliedSettings])
  const settings = suppliedSettings ?? loadedSettings
  return <footer className="site-footer" id="contact">
    <div className="footer-main">
      <div className="footer-brand"><span className="brand-mark"><i /><i /><i /></span><div><strong>{settings?.name || 'منتجع و استراحة خالد العمدة'}</strong><span>رفاهية هادئة، وضيافة من القلب.</span></div></div>
      <div className="footer-contact"><span className="eyebrow">يسعدنا تواصلك</span><p>{settings?.address || 'سيُضاف موقع المنتجع قريبًا'}</p><div className="footer-links">
        {settings?.phone && <a href={`tel:${settings.phone}`}>{settings.phone}</a>}
        {settings?.whatsapp && <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">واتساب</a>}
        {settings?.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noreferrer">إنستغرام</a>}
        {!settings?.phone && !settings?.whatsapp && <span>تواصل معنا من خلال نموذج الاستفسار</span>}
      </div></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} {settings?.name || 'منتجع و استراحة خالد العمدة'}. جميع الحقوق محفوظة.</span><div><Link to="/policies/terms">الشروط والأحكام</Link><Link to="/policies/privacy">الخصوصية</Link><Link to="/policies/cancellation">الإلغاء</Link><Link to="/policies/refund">الاسترداد</Link><Link to="/policies/arrival">تعليمات الزيارة</Link><Link to="/inquiry">إرسال استفسار</Link></div></div>
    </div>
  </footer>
}

export function SetupNotice() {
  if (supabaseConfigured) return null
  return <div className="setup-notice"><span>المعاينة جاهزة، لكن يلزم إضافة مفتاح Supabase العام لتفعيل الحسابات والحجز.</span><Link to="/setup">خطوات الإعداد <ChevronLeft size={14} /></Link></div>
}

export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [pathname])
  return null
}
