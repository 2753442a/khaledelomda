import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Menu, X, User, LogOut, CalendarCheck, Home,
  Settings, ChevronDown, Shield, Droplets
} from 'lucide-react'
import AuthModal from './AuthModal'
import ErrorBoundary from './ErrorBoundary'

const Navbar: React.FC = () => {
  const { user, profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const location = useLocation()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isActive = (path: string) => location.pathname === path

  // Close dropdown when route changes
  useEffect(() => {
    setDropdownOpen(false)
    setMenuOpen(false)
  }, [location.pathname])

  // Close dropdown on outside click (desktop)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // Lock body scroll when mobile menu or dropdown is open
  useEffect(() => {
    if (menuOpen || dropdownOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [menuOpen, dropdownOpen])

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 glass-strong border-b border-white/8">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center shadow-lg">
              <span className="text-white text-lg">🌴</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-white leading-tight">منتجع خالد العمدة</p>
              <p className="text-xs text-emerald-400 leading-tight">للاستثمار</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink to="/" label="الرئيسية" icon={<Home size={15} />} active={isActive('/')} />
            <NavLink to="/book" label="احجز الآن" icon={<CalendarCheck size={15} />} active={isActive('/book')} />
            <NavLink to="/water" label="وايت ماء حلو 💧" icon={<Droplets size={15} className="text-teal-400" />} active={isActive('/water')} />
            {user && (
              <NavLink to="/my-bookings" label="حجوزاتي" icon={<CalendarCheck size={15} />} active={isActive('/my-bookings')} />
            )}
            {profile?.role === 'admin' && (
              <NavLink to="/admin" label="لوحة التحكم" icon={<Shield size={15} />} active={isActive('/admin')} />
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 glass px-3 py-2 rounded-xl hover:border-emerald-500/40 transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {profile?.full_name?.[0] ?? 'م'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-300 hidden sm:block">{profile?.full_name?.split(' ')[0]}</span>
                  {profile?.is_flagged && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="حساب مُحذَّر" />
                  )}
                  <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* User Dropdown Menu — Opaque with dark backdrop on mobile */}
                {dropdownOpen && (
                  <>
                    {/* Dark overlay backdrop (mobile & desktop) */}
                    <div
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                      onClick={() => setDropdownOpen(false)}
                    />

                    {/* Menu panel */}
                    <div className="
                      fixed left-4 right-4 bottom-auto top-20 z-50
                      sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-2 sm:w-52 sm:bottom-auto
                      bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden
                      animate-scale-in
                    ">
                      {/* Profile header (mobile only) */}
                      <div className="sm:hidden px-4 py-3 border-b border-slate-700/60 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                          <span className="text-white text-sm font-bold">
                            {profile?.full_name?.[0] ?? 'م'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{profile?.full_name || 'مستخدم'}</p>
                          <p className="text-[11px] text-gray-400 font-mono" dir="ltr">{profile?.phone || ''}</p>
                        </div>
                      </div>

                      <Link
                        to="/my-bookings"
                        className="flex items-center gap-3 px-4 min-h-[48px] text-sm text-gray-200 hover:bg-white/8 hover:text-white transition-colors"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <CalendarCheck size={17} className="text-emerald-400" />
                        حجوزاتي
                      </Link>
                      {profile?.role === 'admin' && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-3 px-4 min-h-[48px] text-sm text-amber-400 hover:bg-white/8 transition-colors"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <Shield size={17} />
                          لوحة التحكم
                        </Link>
                      )}
                      <div className="border-t border-slate-700/60" />
                      <button
                        onClick={() => { signOut(); setDropdownOpen(false) }}
                        className="w-full flex items-center gap-3 px-4 min-h-[48px] text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut size={17} />
                        تسجيل الخروج
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="btn-primary text-sm py-2 px-4"
              >
                <User size={15} />
                دخول / تسجيل
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden glass p-2 rounded-xl"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Slide-In Drawer */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-slate-950 border-l border-white/10 z-50 shadow-2xl md:hidden animate-slide-in-right">
            {/* Drawer Header */}
            <div className="h-16 px-5 flex items-center justify-between border-b border-white/8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center">
                  <span className="text-white text-sm">🌴</span>
                </div>
                <span className="text-sm font-bold text-white">القائمة</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="glass p-2 rounded-xl text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Links */}
            <div className="p-4 space-y-1">
              <MobileNavLink to="/" label="الرئيسية" icon={<Home size={17} />} onClick={() => setMenuOpen(false)} active={isActive('/')} />
              <MobileNavLink to="/book" label="احجز الآن" icon={<CalendarCheck size={17} />} onClick={() => setMenuOpen(false)} active={isActive('/book')} />
              <MobileNavLink to="/water" label="وايت ماء حلو 💧" icon={<Droplets size={17} className="text-teal-400" />} onClick={() => setMenuOpen(false)} active={isActive('/water')} />
              {user && <MobileNavLink to="/my-bookings" label="حجوزاتي" icon={<CalendarCheck size={17} />} onClick={() => setMenuOpen(false)} active={isActive('/my-bookings')} />}
              {profile?.role === 'admin' && (
                <MobileNavLink to="/admin" label="لوحة التحكم" icon={<Shield size={17} className="text-amber-400" />} onClick={() => setMenuOpen(false)} active={isActive('/admin')} />
              )}
            </div>

            {/* Drawer Footer */}
            {user && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{profile?.full_name?.[0] ?? 'م'}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{profile?.full_name || 'مستخدم'}</p>
                    <p className="text-[11px] text-gray-500 font-mono" dir="ltr">{profile?.phone}</p>
                  </div>
                </div>
                <button
                  onClick={() => { signOut(); setMenuOpen(false) }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                >
                  <LogOut size={15} />
                  تسجيل الخروج
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <ErrorBoundary fallbackTitle="عذراً، حدث خطأ غير متوقع أثناء تحميل هذه النافذة.">
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </ErrorBoundary>
    </>
  )
}

const NavLink: React.FC<{ to: string; label: string; icon: React.ReactNode; active: boolean }> = ({ to, label, icon, active }) => (
  <Link
    to={to}
    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      active
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon}
    {label}
  </Link>
)

const MobileNavLink: React.FC<{ to: string; label: string; icon: React.ReactNode; onClick: () => void; active: boolean }> = ({ to, label, icon, onClick, active }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center gap-3 px-4 min-h-[48px] rounded-xl text-sm font-medium transition-all ${
      active
        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
        : 'text-gray-300 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon}
    {label}
  </Link>
)

export default Navbar
