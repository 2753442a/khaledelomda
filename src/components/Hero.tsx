import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, MessageCircle, Phone, Star, Users, Calendar } from 'lucide-react'
import { generateWhatsAppLink } from '../lib/utils'
import { useSettings } from '../contexts/SettingsContext'

export const Hero: React.FC = () => {
  const { settings } = useSettings()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const stats = [
    { icon: <Star size={22} className="text-amber-300" />, value: settings.stats_events || '+200', label: 'مناسبة ناجحة' },
    { icon: <Users size={22} className="text-emerald-300" />, value: settings.stats_clients || '+1000', label: 'عميل سعيد' },
    { icon: <Calendar size={22} className="text-teal-300" />, value: settings.stats_days || '365', label: 'يوم في السنة' },
  ]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number

    const handleResize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    // Ambient floating particles with subtle emerald and water cyan glow
    const particles: { x: number; y: number; r: number; vx: number; vy: number; alpha: number; color: string }[] = []
    const colors = ['rgba(45, 212, 191, ', 'rgba(52, 211, 153, ', 'rgba(251, 191, 36, ']

    for (let i = 0; i < 45; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2.2 + 0.8,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -Math.random() * 0.4 - 0.1, // gently rising
        alpha: Math.random() * 0.5 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `${p.color}${p.alpha})`
        ctx.shadowBlur = 8
        ctx.shadowColor = `${p.color}0.8)`
        ctx.fill()
      })
      animationFrameId = requestAnimationFrame(render)
    }
    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <section className="relative min-h-[92vh] sm:min-h-screen flex flex-col justify-between overflow-hidden bg-slate-950 text-white">
      {/* ── Base Layer: Resort Background Image Chosen by Admin ── */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src={settings.hero_image_url || 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=2000&q=80'}
          alt={`${settings.resort_name} - واجهة المنتجع`}
          className="w-full h-full object-cover object-center select-none scale-105 animate-pulse-glow"
          style={{ animationDuration: '10s' }}
          loading="eager"
        />

        {/* ── Overlay Gradient: Rich Emerald & Deep Slate for Maximum Contrast ── */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-emerald-950/75 to-slate-950 z-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/30 via-slate-950/70 to-slate-950" />
      </div>

      {/* ── Atmospheric Glow Spheres ── */}
      <div className="absolute top-12 right-6 sm:right-16 w-80 sm:w-96 h-80 sm:h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none z-[1]" />
      <div className="absolute bottom-24 left-6 sm:left-16 w-80 sm:w-96 h-80 sm:h-96 bg-teal-400/15 rounded-full blur-3xl pointer-events-none z-[1]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none z-[1]" />

      {/* ── Subtle Floating Canvas Fireflies ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-60 pointer-events-none z-[2]"
      />

      {/* ── Hero Foreground Content ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 pt-28 sm:pt-36 pb-12 max-w-5xl mx-auto w-full">
        {/* Floating Badge */}
        <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full mb-6 border border-emerald-500/40 bg-emerald-950/60 backdrop-blur-md shadow-lg shadow-emerald-950/50 text-emerald-300 text-xs sm:text-sm font-semibold animate-fade-in-up">
          <span>{settings.hero_badge || '🌴💧 واحة الاسترخاء والمناسبات في قلب الطبيعة'}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
        </div>

        {/* Dynamic Title with Emerald-to-Gold Luxury Gradient */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black mb-6 leading-tight tracking-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <span className="block text-xl sm:text-2xl lg:text-3xl text-emerald-300/90 font-bold mb-2">
            مرحباً بكم في
          </span>
          <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-200 bg-clip-text text-transparent drop-shadow-md">
            {settings.hero_title || 'منتجع وبستان خالد العمدة'}
          </span>
          <span className="block text-sm sm:text-lg text-amber-300/90 font-semibold mt-2.5 tracking-wide">
            للاستثمار • إيجار يومي ومناسبات فاخرة
          </span>
        </h1>

        {/* Subtitle Description */}
        <p className="text-gray-200 text-sm sm:text-lg max-w-2xl mx-auto mb-9 leading-relaxed font-normal animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          {settings.hero_subtitle || 'انغمس في تجربة استثنائية تجمع بين بستان النخيل والمسطحات الخضراء، والمسبح الفيروزي والألعاب المائية، ومجالس الضيافة الملكية في خصوصية تامة تلبي كافة تطلعاتكم.'}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-4 w-full animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {/* Primary Booking Button with Radiant Emerald Gradient & Hover Pulse */}
          <Link
            to="/book"
            className="relative group overflow-hidden px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm sm:text-base shadow-xl shadow-emerald-900/50 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5 min-w-[160px]"
          >
            <span className="absolute inset-0 w-full h-full bg-white/20 group-hover:translate-x-full transition-transform duration-700 ease-in-out -translate-x-full" />
            <CalendarCheck size={19} className="text-emerald-200 group-hover:rotate-6 transition-transform" />
            <span>احجز الآن</span>
            <span className="flex h-2 w-2 relative mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-200" />
            </span>
          </Link>

          {/* Luxury Amber Gold WhatsApp Button */}
          <a
            href={generateWhatsAppLink(settings.contact_whatsapp || '0547382222', `السلام عليكم، أود الاستفسار عن حجز ${settings.resort_name}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 sm:px-7 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-bold text-sm sm:text-base shadow-xl shadow-amber-900/30 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 min-w-[150px]"
          >
            <MessageCircle size={19} className="text-slate-950" />
            <span>واتساب المالك</span>
          </a>

          {/* Direct Phone Call Button */}
          <a
            href={`tel:${settings.contact_phone || '0543034553'}`}
            className="px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl glass hover:bg-white/10 text-white font-medium text-sm sm:text-base border border-white/15 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
          >
            <Phone size={17} className="text-emerald-400" />
            <span dir="ltr">{settings.contact_phone || '0543034553'}</span>
          </a>
        </div>

        {/* Refined Frosted Emerald Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 w-full max-w-3xl mt-10 sm:mt-12 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          {stats.map((s, i) => (
            <div
              key={i}
              className="bg-emerald-950/40 border border-emerald-500/20 backdrop-blur-md hover:border-emerald-400/40 transition-all duration-300 hover:-translate-y-1 shadow-lg shadow-emerald-950/50 p-4 rounded-2xl flex items-center justify-between text-right"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                {s.icon}
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">{s.value}</p>
                <p className="text-xs sm:text-sm text-emerald-300/80 font-medium">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Organic Water Wave Divider transitioning into Facilities ── */}
      <div className="relative w-full overflow-hidden leading-none z-20 -mb-1">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="relative block w-full h-12 sm:h-20 text-[#0d1117] fill-current"
        >
          <path d="M0,0 C150,90 350,-40 500,45 C650,130 900,10 1200,40 L1200,120 L0,120 Z" />
        </svg>
      </div>
    </section>
  )
}

export default Hero
