import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Armchair, ShieldCheck, Truck, Sparkles, Clock, MessageCircle } from 'lucide-react'
import HeritageFurnitureSection from '../components/HeritageFurnitureSection'
import { useSettings } from '../contexts/SettingsContext'
import { generateWhatsAppLink } from '../lib/utils'

export const HeritageFurniturePage: React.FC = () => {
  const { settings } = useSettings()

  return (
    <div className="min-h-screen pt-20 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-right">
      {/* Top Breadcrumb & Trust Banner */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowRight size={16} />
          <span>العودة للرئيسية</span>
        </Link>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
          <Sparkles size={13} />
          <span>أثاث تراثي أصيل ومضمون</span>
        </div>
      </div>

      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden p-6 sm:p-12 mb-12 border border-amber-500/30 bg-gradient-to-br from-amber-950/60 via-slate-950 to-emerald-950/40 shadow-2xl">
        <div className="absolute -top-16 -right-16 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <Armchair size={15} />
            <span>متجر أثاث وجلسات ريفية وتراثية</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            كراسي وطاولات <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-300 bg-clip-text text-transparent">الخيزران والخشب التراثي</span>
          </h1>

          <p className="text-gray-300 text-xs sm:text-base leading-relaxed max-w-2xl">
            قطع أثاث يدوية فريدة مصممة لتجمع بين متانة الخيزران الطبيعي وراحة الجلوس الطويل في حدائق المزارع، الشاليهات، والبيوت الريفية، مع إمكانية التوصيل السريع لجميع المواقع.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <a
              href={generateWhatsAppLink(settings.contact_whatsapp || '0556854162', 'السلام عليكم، أود الاستفسار عن كراسي وأثاث التراث')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-950/40 transition-transform active:scale-95"
            >
              <MessageCircle size={16} />
              <span>مراسلة واتساب للاستفسارات</span>
            </a>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="relative z-10 pt-8 mt-8 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-amber-400 shrink-0" />
            <span>خامات طبيعية متينة معالجة لمقاومة الشمس والرطوبة</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-emerald-400 shrink-0" />
            <span>إمكانية التوصيل المباشر للمزرعة أو الاستراحة</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-teal-400 shrink-0" />
            <span>تصاميم تناسب الفلل والمناسبات والجلسات العائلية</span>
          </div>
        </div>
      </div>

      {/* Main Furniture Catalog */}
      <HeritageFurnitureSection showTitle={false} />
    </div>
  )
}

export default HeritageFurniturePage
