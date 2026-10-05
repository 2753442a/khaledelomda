import React from 'react'
import { Link } from 'react-router-dom'
import { Phone, MessageCircle, MapPin, CalendarCheck, Sparkles, Clock, ShieldCheck } from 'lucide-react'
import { Hero } from '../components/Hero'
import { Facilities } from '../components/Facilities'
import { generateWhatsAppLink } from '../lib/utils'

const ContactSection: React.FC = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 text-center border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 via-slate-950 to-slate-950 backdrop-blur-xl shadow-2xl">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs sm:text-sm font-semibold">
            <Sparkles size={14} />
            <span>خدمة الضيافة والاستفسارات على مدار الساعة</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            هل تخطط لمناسبتك القادمة أو لعطلة استجمام؟
          </h2>

          <p className="text-gray-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            نسعد بخدمتكم وتوفير كافة الترتيبات لحفلاتكم ومناسباتكم الخاصة في منتجع وبستان خالد العمدة. تواصلوا معنا مباشرة وسنكون بخدمتكم في كل خطوة.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center items-center gap-3.5 sm:gap-4 pt-2">
            <Link
              to="/book"
              className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm sm:text-base shadow-xl shadow-emerald-900/40 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <CalendarCheck size={18} />
              <span>احجز تاريخك الآن</span>
            </Link>

            <a
              href={generateWhatsAppLink('0547382222', 'السلام عليكم، أود الاستفسار عن حجز منتجع وبستان خالد العمدة')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-bold text-sm sm:text-base shadow-xl shadow-amber-900/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <MessageCircle size={18} />
              <span>مراسلة واتساب: 0547382222</span>
            </a>

            <a
              href="tel:0543034553"
              className="px-6 py-3.5 rounded-2xl glass hover:bg-white/10 text-white font-medium text-sm sm:text-base border border-white/15 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Phone size={17} className="text-emerald-400" />
              <span dir="ltr">0543034553</span>
            </a>
          </div>

          {/* Location and Trust Badges */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-gray-400 border-t border-white/10 mt-6">
            <div className="flex items-center gap-1.5 text-gray-300">
              <MapPin size={15} className="text-emerald-400" />
              <span>المملكة العربية السعودية • موقع مميز وسهل الوصول</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-300">
              <Clock size={15} className="text-teal-400" />
              <span>الوصول: 03:30 م • المغادرة: 11:30 ص</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-300">
              <ShieldCheck size={15} className="text-amber-400" />
              <span>خصوصية تامة وحجز مؤكد وفوري</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const HomePage: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#0d1117] text-white selection:bg-emerald-500 selection:text-white">
      <Hero />
      <Facilities />
      <ContactSection />

      {/* Luxury Footer */}
      <footer className="py-8 px-4 border-t border-white/8 bg-slate-950/80 text-center text-xs sm:text-sm text-gray-400 space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-4 text-gray-300 font-medium">
          <Link to="/" className="hover:text-emerald-400 transition-colors">الرئيسية</Link>
          <span>•</span>
          <Link to="/book" className="hover:text-emerald-400 transition-colors">احجز الآن</Link>
          <span>•</span>
          <Link to="/my-bookings" className="hover:text-emerald-400 transition-colors">حجوزاتي</Link>
          <span>•</span>
          <Link to="/admin" className="hover:text-emerald-400 transition-colors">لوحة الإدارة</Link>
        </div>
        <p className="text-gray-500">
          © {new Date().getFullYear()} منتجع وبستان خالد العمدة للاستثمار — واحة الفخامة والاستجمام الطبيعي
        </p>
      </footer>
    </main>
  )
}

export default HomePage
