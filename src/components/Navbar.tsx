import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Menu, X, User, LogOut, CalendarCheck, Home,
  Settings, ChevronDown, Shield
} from 'lucide-react'
import AuthModal from './AuthModal'

const Navbar: React.FC = () => {
  const { user, profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

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
              <div className="relative">
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
                  <ChevronDown size={14} className="text-gray-400" />
                </button>
                {dropdownOpen && (
                  <div className="absolute left-0 top-full mt-2 w-48 glass-strong rounded-xl border border-white/10 shadow-2xl overflow-hidden animate-scale-in">
                    <Link
                      to="/my-bookings"
                      className="flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <CalendarCheck size={15} />
                      حجوزاتي
                    </Link>
                    {profile?.role === 'admin' && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2 px-4 py-3 text-sm text-amber-400 hover:bg-white/5 transition-colors"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <Shield size={15} />
                        لوحة التحكم
                      </Link>
                    )}
                    <div className="border-t border-white/8" />
                    <button
                      onClick={() => { signOut(); setDropdownOpen(false) }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut size={15} />
                      تسجيل الخروج
                    </button>
                  </div>
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

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/8 bg-[#161b22] px-4 py-3 space-y-1 animate-fade-in-up">
            <MobileNavLink to="/" label="الرئيسية" onClick={() => setMenuOpen(false)} />
            <MobileNavLink to="/book" label="احجز الآن" onClick={() => setMenuOpen(false)} />
            {user && <MobileNavLink to="/my-bookings" label="حجوزاتي" onClick={() => setMenuOpen(false)} />}
            {profile?.role === 'admin' && (
              <MobileNavLink to="/admin" label="لوحة التحكم" onClick={() => setMenuOpen(false)} />
            )}
          </div>
        )}
      </nav>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
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

const MobileNavLink: React.FC<{ to: string; label: string; onClick: () => void }> = ({ to, label, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className="block px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
  >
    {label}
  </Link>
)

export default Navbar
