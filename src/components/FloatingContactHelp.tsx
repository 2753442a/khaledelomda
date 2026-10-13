import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  MessageCircle, Phone, X, Sparkles, HelpCircle,
  Calendar, Droplets, Armchair, Palmtree, MapPin, ChevronUp
} from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
import { generateWhatsAppLink } from '../lib/utils'

interface SectionContext {
  id: string
  title: string
  subtitle: string
  badge: string
  icon: React.ReactNode
  defaultMessage: string
  quickQuestions: string[]
  whatsappNumber?: string
  phoneNumber?: string
}

export const FloatingContactHelp: React.FC = () => {
  const { settings } = useSettings()
  const location = useLocation()

  const [isOpen, setIsOpen] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState<string>('home')
  const [showBubble, setShowBubble] = useState(true)
  const [hasAnimated, setHasAnimated] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  // Track active section on scroll when on home page ('/')
  useEffect(() => {
    if (location.pathname !== '/') {
      setActiveSectionId(location.pathname)
      // Trigger a gentle attention animation on route change
      setHasAnimated(true)
      setShowBubble(true)
      const timer = setTimeout(() => setHasAnimated(false), 1200)
      return () => clearTimeout(timer)
    }

    const handleScroll = () => {
      const scrollPos = window.scrollY + 250

      const furnitureEl = document.getElementById('furniture')
      const facilitiesEl = document.getElementById('facilities')
      const locationEl = document.getElementById('location')

      if (locationEl && scrollPos >= locationEl.offsetTop) {
        if (activeSectionId !== 'location') {
          setActiveSectionId('location')
          triggerHelpMotion()
        }
      } else if (furnitureEl && scrollPos >= furnitureEl.offsetTop) {
        if (activeSectionId !== 'furniture') {
          setActiveSectionId('furniture')
          triggerHelpMotion()
        }
      } else if (facilitiesEl && scrollPos >= facilitiesEl.offsetTop) {
        if (activeSectionId !== 'facilities') {
          setActiveSectionId('facilities')
          triggerHelpMotion()
        }
      } else {
        if (activeSectionId !== 'home') {
          setActiveSectionId('home')
          triggerHelpMotion()
        }
      }
    }

    const triggerHelpMotion = () => {
      setHasAnimated(true)
      setShowBubble(true)
      setTimeout(() => setHasAnimated(false), 1200)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [location.pathname, activeSectionId])

  // Contextual help data based on current section/route
  const currentContext: SectionContext = useMemo(() => {
    const waPhone = settings?.contact_whatsapp || '0547382222'
    const directPhone = settings?.contact_phone || '0543034553'
    const waterWaPhone = settings?.water_contact_whatsapp || waPhone

    switch (activeSectionId) {
      case '/book':
        return {
          id: 'book',
          title: 'مساعد إتمام وتأكيد الحجز',
          subtitle: 'هل تود المساعدة في اختيار التواريخ أو رفع إيصال الدفع؟',
          badge: 'مساعد الحجز المباشر 📅',
          icon: <Calendar className="text-emerald-400" size={18} />,
          defaultMessage: 'السلام عليكم أبو خالد، أحتاج مساعدة في حجز موعد بالمنتجع.',
          quickQuestions: [
            'هل يمكن معاينة المنتجع قبل الدفع؟',
            'كم قيمة العربون المطلوبة لتثبيت الحجز؟',
            'هل يوجد خصم لحجز أكثر من يوم؟'
          ],
          whatsappNumber: waPhone,
          phoneNumber: directPhone
        }

      case '/water':
        return {
          id: 'water',
          title: 'مساعد خدمة وايت ماء حلو',
          subtitle: 'مساعدة في تحديد موقعك أو الاستفسار عن موعد وصول السائق',
          badge: 'خدمة وايت الماء 💧',
          icon: <Droplets className="text-teal-400" size={18} />,
          defaultMessage: 'السلام عليكم، أود طلب وايت ماء حلو والاستفسار عن موعد التوصيل.',
          quickQuestions: [
            'هل التوصيل متوفر في منطقتي حالياً؟',
            'كم سعة وحجم وايت الماء المتوفر؟',
            'أود إرسال لوكيشن الموقع لتأكيد التوصيل'
          ],
          whatsappNumber: waterWaPhone,
          phoneNumber: directPhone
        }

      case '/furniture':
      case 'furniture':
        return {
          id: 'furniture',
          title: 'مساعد قسم كراسي وأثاث التراث',
          subtitle: 'استفسار عن تفاصيل الكراسي التراثية، الأسعار، أو توصيلها لموقعك',
          badge: 'مساعد كراسي التراث 🪑',
          icon: <Armchair className="text-amber-400" size={18} />,
          defaultMessage: 'السلام عليكم أبو خالد، أود الاستفسار عن كراسي وأثاث التراث والشحن لموقعي.',
          quickQuestions: [
            'هل يمكن تفصيل طقم بمقاسات أو ألوان خاصة؟',
            'هل متوفر شحن وتوصيل للمزارع والاستراحات؟',
            'هل يوجد سعر خاص للكميات الكبيرة؟'
          ],
          whatsappNumber: waPhone,
          phoneNumber: directPhone
        }

      case 'facilities':
        return {
          id: 'facilities',
          title: 'مساعد مرافق وخدمات المنتجع',
          subtitle: 'استفسار عن المسابح، ألعاب الأطفال، أو المجالس وقسم الضيافة',
          badge: 'مساعد مرافق المنتجع 🏊',
          icon: <Palmtree className="text-emerald-400" size={18} />,
          defaultMessage: 'السلام عليكم، أود الاستفسار عن تفاصيل مرافق المنتجع والألعاب المائية.',
          quickQuestions: [
            'كم عمق المسبح وهل مجهز للأطفال؟',
            'كم عدد الأشخاص المسموح به في المناسبات؟',
            'هل تتوفر مسطحات خضراء وجلسات خارجية؟'
          ],
          whatsappNumber: waPhone,
          phoneNumber: directPhone
        }

      case 'location':
        return {
          id: 'location',
          title: 'مساعد الوصول وموقع المنتجع',
          subtitle: 'طلب الموقع الجغرافي المباشر على خرائط Google وتفاصيل الطريق',
          badge: 'مساعد اللوكيشن 📍',
          icon: <MapPin className="text-rose-400" size={18} />,
          defaultMessage: 'السلام عليكم، أرجو تزويدي باللوكيشن المباشر للمنتجع على خرائط جوجل.',
          quickQuestions: [
            'أرسل لي موقع المنتجع عبر خرائط جوجل',
            'هل الطريق ممهد ومناسب لجميع السيارات؟'
          ],
          whatsappNumber: waPhone,
          phoneNumber: directPhone
        }

      case '/my-bookings':
        return {
          id: 'my-bookings',
          title: 'خدمة العملاء ومتابعة الحجوزات',
          subtitle: 'مساعدتك في مراجعة حالة حجزك أو رفع إيصال التحويل',
          badge: 'خدمة العملاء 📋',
          icon: <Calendar className="text-blue-400" size={18} />,
          defaultMessage: 'السلام عليكم، أود المتابعة بخصوص حجز مسجل لديكم في المنتجع.',
          quickQuestions: [
            'كيف أتأكد من اعتماد إيصال التحويل؟',
            'أود تعديل موعد الحجز إذا أمكن'
          ],
          whatsappNumber: waPhone,
          phoneNumber: directPhone
        }

      case '/admin':
        return {
          id: 'admin',
          title: 'الدعم السريع للمالك والإدارة',
          subtitle: 'تواصل مباشر وسريع للدعم الفني وإدارة النظام',
          badge: 'الدعم الإداري 🛡️',
          icon: <HelpCircle className="text-amber-400" size={18} />,
          defaultMessage: 'السلام عليكم، تواصل مباشر من لوحة تحكم منتجع خالد العمدة.',
          quickQuestions: [
            'طلب مساعدة فنية في لوحة التحكم',
            'استفسار عن إعدادات الحساب والتقويم'
          ],
          whatsappNumber: waPhone,
          phoneNumber: directPhone
        }

      default:
        return {
          id: 'home',
          title: 'مساعد الحجز والضيافة',
          subtitle: 'حياك الله! استفسر عن حجز المنتجع، الأسعار، أو الخدمات فوراً',
          badge: 'مساعد الضيافة 🌴',
          icon: <Palmtree className="text-emerald-400" size={18} />,
          defaultMessage: `السلام عليكم أبو خالد، أود الاستفسار عن حجز ${settings?.resort_name || 'منتجع خالد العمدة'}.`,
          quickQuestions: [
            'كم سعر حجز المنتجع لليوم؟',
            'ما هي الأيام المتوفرة في نهاية الأسبوع؟',
            'أود حجز مناسبة خاصة، هل تتوفر تجهيزات؟'
          ],
          whatsappNumber: waPhone,
          phoneNumber: directPhone
        }
    }
  }, [activeSectionId, settings])

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const waTarget = currentContext.whatsappNumber || settings?.contact_whatsapp || '0547382222'
  const phoneTarget = currentContext.phoneNumber || settings?.contact_phone || '0543034553'

  return (
    <div
      ref={popupRef}
      className="fixed left-3.5 sm:left-6 bottom-4 sm:bottom-6 z-40 select-none flex flex-col items-start pb-safe"
    >
      {/* Expanded Help & Contact Card */}
      {isOpen && (
        <div
          className="
            mb-3 w-[calc(100vw-1.75rem)] sm:w-96 max-w-[400px]
            bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30
            rounded-3xl shadow-2xl p-4 sm:p-5 text-right
            animate-scale-in text-white space-y-4
          "
        >
          {/* Card Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-700 flex items-center justify-center text-lg shadow-md">
                  🌴
                </div>
                {/* Live Online Badge */}
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-black text-white">خالد العمدة (أبو خالد)</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    المالك
                  </span>
                </div>
                <p className="text-[11px] text-gray-300">متاح الآن للرد المباشر وخدمتكم</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          {/* Current Section Active Helper Banner */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-800/80 border border-emerald-500/20 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              {currentContext.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{currentContext.title}</p>
              <p className="text-[11px] text-gray-300 leading-tight">{currentContext.subtitle}</p>
            </div>
          </div>

          {/* Direct Actions: WhatsApp + Call */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={generateWhatsAppLink(waTarget, currentContext.defaultMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary py-2.5 px-3 rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
            >
              <MessageCircle size={16} />
              <span>محادثة واتساب</span>
            </a>

            <a
              href={`tel:${phoneTarget}`}
              className="glass py-2.5 px-3 rounded-xl text-xs font-bold text-gray-200 hover:text-white hover:bg-white/10 border border-white/10 flex items-center justify-center gap-2 transition-all"
            >
              <Phone size={15} className="text-amber-400" />
              <span>اتصال هاتفي</span>
            </a>
          </div>

          {/* Quick FAQ / Pre-filled Questions */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
              <Sparkles size={12} className="text-amber-400" />
              <span>استفسارات سريعة (إرسال بنقرة واحدة):</span>
            </p>
            <div className="space-y-1">
              {currentContext.quickQuestions.map((q, idx) => (
                <a
                  key={idx}
                  href={generateWhatsAppLink(
                    waTarget,
                    `السلام عليكم أبو خالد، بخصوص قسم (${currentContext.title}): ${q}`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 rounded-xl bg-white/5 hover:bg-emerald-500/15 border border-white/5 hover:border-emerald-500/30 text-[11px] text-gray-300 hover:text-white transition-all text-right truncate"
                >
                  💬 {q}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Pill & Animated Trigger Button */}
      <div className="flex items-center gap-2">
        {/* Contextual Speech Bubble / Badge */}
        {showBubble && !isOpen && (
          <div
            onClick={() => setIsOpen(true)}
            className={`
              glass px-3 py-1.5 rounded-full border border-emerald-500/40
              bg-slate-900/90 text-white shadow-xl cursor-pointer
              flex items-center gap-1.5 text-xs font-bold transition-all
              hover:scale-105 active:scale-95 group
              ${hasAnimated ? 'ring-2 ring-emerald-400 animate-bounce' : ''}
            `}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] sm:text-xs text-emerald-300 group-hover:text-white transition-colors">
              {currentContext.badge}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowBubble(false)
              }}
              className="text-gray-400 hover:text-white text-[10px] ml-0.5"
              title="إخفاء التلميح"
            >
              ✕
            </button>
          </div>
        )}

        {/* Floating Action Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="تواصل مع المالك للمساعدة"
          className={`
            relative w-13 h-13 sm:w-14 sm:h-14 rounded-2xl
            bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600
            text-white shadow-xl shadow-emerald-950/60
            flex items-center justify-center border-2 border-emerald-400/40
            transition-all duration-300 hover:scale-105 active:scale-95
            ${hasAnimated ? 'scale-110 rotate-6 shadow-emerald-500/50 ring-4 ring-emerald-400/40' : ''}
          `}
        >
          {isOpen ? (
            <ChevronUp size={24} className="rotate-180 transition-transform" />
          ) : (
            <>
              <MessageCircle size={26} className="text-white drop-shadow" />
              {/* Online Green Glow */}
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-full" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default FloatingContactHelp
