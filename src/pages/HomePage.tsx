import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Phone, MessageCircle, MapPin, Star, Users, CalendarCheck } from 'lucide-react'
import { generateWhatsAppLink } from '../lib/utils'

const FACILITIES = [
  { icon: '🌴', title: 'بستان نخيل', desc: 'بستان نخيل طبيعي رحب مع ممر سيارات واسع' },
  { icon: '🏊', title: 'مسبح مائي', desc: 'مسبح مع بيرغولا خشبية وألعاب مائية للأطفال' },
  { icon: '🌿', title: 'حديقة عشب', desc: 'حديقة دائرية واسعة بأرضية عشب طبيعي' },
  { icon: '🛋️', title: 'مجلس VIP', desc: 'مجلس VIP فاخر ومجلس أرضي كبير للمناسبات' },
  { icon: '🍳', title: 'مطبخ كامل', desc: 'مطبخ مجهز بالكامل وغرفة نوم ماستر' },
  { icon: '🛴', title: 'سكوترات كهربائية', desc: 'سكوترات كهربائية حصرية للنزلاء' },
  { icon: '🎡', title: 'ملعب أطفال جاف', desc: 'أراجيح ومراجيح وألعاب متنوعة للأطفال' },
  { icon: '🎊', title: 'قاعة مناسبات', desc: 'مناسبات وأفراح وتجمعات عائلية' },
]

const STATS = [
  { icon: <Star size={20} />, value: '+200', label: 'مناسبة ناجحة' },
  { icon: <Users size={20} />, value: '+1000', label: 'عميل سعيد' },
  { icon: <CalendarCheck size={20} />, value: '365', label: 'يوم في السنة' },
]

const HeroSection: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const particles: { x: number; y: number; r: number; vx: number; vy: number; alpha: number }[] = []
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.5 + 0.2,
      })
    }

    let raf: number
    const animate = () => {
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
        ctx.fillStyle = `rgba(45, 154, 84, ${p.alpha})`
        ctx.fill()
      })
      raf = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden bg-hero-gradient">
      {/* Animated canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" />

      {/* Glow orbs */}
      <div className="absolute top-20 right-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Content */}
      <div className="relative flex-1 flex flex-col items-center justify-center text-center px-4 pt-20 pb-12">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-6 animate-fade-in-up border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-emerald-400 font-medium">متاح للحجز الآن</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          منتجع وبستان
          <br />
          <span className="text-gradient-gold">خالد العمدة</span>
        </h1>
        <p className="text-base sm:text-lg text-gray-400 mb-2 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          للاستثمار
        </p>
        <p className="text-gray-300 text-base sm:text-lg max-w-lg mx-auto mb-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          🎊 أفراح • مناسبات • إيجار يومي
          <br />
          <span className="text-gray-400 text-sm">تجربة فريدة في قلب الطبيعة مع أفخم المرافق</span>
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <Link to="/book" className="btn-primary text-base px-6 py-3 animate-pulse-glow">
            <CalendarCheck size={18} />
            احجز الآن
          </Link>
          <a
            href={generateWhatsAppLink('0547382222', 'السلام عليكم، أود الاستفسار عن المنتجع')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold text-base px-6 py-3"
          >
            <MessageCircle size={18} />
            واتساب
          </a>
          <a href="tel:0543034553" className="btn-ghost text-base px-6 py-3">
            <Phone size={18} />
            اتصل بنا
          </a>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-12 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          {STATS.map((s, i) => (
            <div key={i} className="flex items-center gap-3 glass px-4 py-3 rounded-xl">
              <div className="text-emerald-400">{s.icon}</div>
              <div className="text-right">
                <p className="text-xl font-black text-white">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="relative flex justify-center pb-8 animate-float">
        <div className="w-6 h-10 rounded-full border-2 border-emerald-500/40 flex items-start justify-center pt-1.5">
          <div className="w-1 h-3 bg-emerald-400 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  )
}

const FacilitiesSection: React.FC = () => (
  <section className="py-20 px-4 max-w-7xl mx-auto">
    <div className="text-center mb-12">
      <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
        مرافق <span className="text-gradient-green">المنتجع</span>
      </h2>
      <p className="text-gray-400 max-w-lg mx-auto">
        كل ما تحتاجه لقضاء وقت لا يُنسى مع عائلتك وأحبائك
      </p>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {FACILITIES.map((f, i) => (
        <div
          key={i}
          className="card p-4 text-center hover:border-emerald-500/30 group cursor-default"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{f.icon}</div>
          <h3 className="text-sm font-bold text-white mb-1">{f.title}</h3>
          <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
        </div>
      ))}
    </div>
  </section>
)

const ContactSection: React.FC = () => (
  <section className="py-16 px-4">
    <div className="max-w-2xl mx-auto">
      <div className="card glass-strong p-8 text-center border border-emerald-500/20">
        <div className="text-4xl mb-4">📞</div>
        <h2 className="text-2xl font-black text-white mb-2">تواصل معنا</h2>
        <p className="text-gray-400 mb-6">نحن هنا لمساعدتك في الاختيار والحجز</p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="tel:0543034553"
            className="btn-ghost px-6 py-3"
          >
            <Phone size={16} />
            0543034553
          </a>
          <a
            href={generateWhatsAppLink('0547382222', 'السلام عليكم، أود الاستفسار عن حجز المنتجع')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold px-6 py-3"
          >
            <MessageCircle size={16} />
            واتساب: 0547382222
          </a>
        </div>
        <div className="mt-4 flex items-center justify-center gap-1.5 text-sm text-gray-500">
          <MapPin size={14} />
          <span>المملكة العربية السعودية</span>
        </div>
      </div>
    </div>
  </section>
)

const HomePage: React.FC = () => (
  <main>
    <HeroSection />
    <FacilitiesSection />
    <ContactSection />
    <footer className="py-6 text-center text-sm text-gray-500 border-t border-white/8">
      © {new Date().getFullYear()} منتجع وبستان خالد العمدة للاستثمار — جميع الحقوق محفوظة
    </footer>
  </main>
)

export default HomePage
