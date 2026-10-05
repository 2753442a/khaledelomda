import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Sparkles, ArrowLeft, CheckCircle2 } from 'lucide-react'

export interface Facility {
  id: string
  title: string
  subtitle?: string | null
  badge_text?: string | null
  description: string
  image_url: string
  features: string[]
  privacy_note?: string | null
  cta_text?: string | null
  display_order: number
  is_active: boolean
  created_at?: string
}

export const DEFAULT_FACILITIES: Facility[] = [
  {
    id: 'default-pool',
    title: 'مسبح متدرج وألعاب مائية عائلية (Aqua Park)',
    subtitle: 'انتعاش وخصوصية مطلقة لجميع الأعمار',
    description: 'مسبح بتصميم انسيابي متدرج العمق مع بيرغولا خشبية مظللة وألعاب مائية ممتعة للأطفال، وفلترة آلية متطورة تضمن أعلى معايير النظافة والسلامة.',
    badge_text: 'انتعاش ومرح عائلي 🌊',
    image_url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
    features: ['ألعاب مائية للأطفال', 'بيرغولا خشبية مظللة', 'تعقيم وفلترة دورية', 'خصوصية عائلية كاملة'],
    privacy_note: 'مشمول بكامل الخصوصية',
    cta_text: 'احجز هذه الوحدة',
    display_order: 1,
    is_active: true,
  },
  {
    id: 'default-orchard',
    title: 'بستان النخيل وممرات المشي الطبيعية',
    subtitle: 'هدوء الواحة وسحر الإضاءة المسائية',
    description: 'أشجار نخيل باسقة ومسارات مشي حجرية فسيحة تتسع لحركة المركبات وتتيح لك الاستمتاع بنسيم الطبيعة العليل والتجول الممتع.',
    badge_text: 'طبيعة خلابة وممرات واسعة 🌴',
    image_url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80',
    features: ['نخيل طبيعي مثمر', 'ممر سيارات فسيح', 'إضاءات ليلية ساحرة'],
    privacy_note: 'مشمول بكامل الخصوصية',
    cta_text: 'احجز هذه الوحدة',
    display_order: 2,
    is_active: true,
  },
  {
    id: 'default-lawn',
    title: 'المسطحات الخضراء والحديقة الدائرية',
    subtitle: 'مساحات مفتوحة مصممة للمناسبات الكبرى',
    description: 'مسطح عشب طبيعي دائري رحب ومنسق بعناية، مثالي لتنظيم حفلات الزفاف، التخرج، واللقاءات العائلية الكبرى في الهواء الطلق.',
    badge_text: 'أفراح واحتفالات 🎪',
    image_url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80',
    features: ['عشب طبيعي منسق', 'سعة حفلات رحبة', 'جلسات خارجية راقية'],
    privacy_note: 'مشمول بكامل الخصوصية',
    cta_text: 'احجز هذه الوحدة',
    display_order: 3,
    is_active: true,
  },
  {
    id: 'default-majlis',
    title: 'مجالس الضيافة الملكية VIP',
    subtitle: 'أصالة الكرم وقمة الفخامة المعاصرة',
    description: 'مجلس VIP ملكي راقٍ مجهز بأحدث الديكورات وشاشات العرض الذكية، بالإضافة إلى مجلس أرضي شعبي كبير يعكس أصالة وكرم الضيافة السعودية.',
    badge_text: 'ضيافة وأصالة ☕',
    image_url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80',
    features: ['مجلس VIP ملكي', 'مجلس أرضي كبير', 'تكييف مركزي متكامل', 'شاشات ذكية وصوتيات'],
    privacy_note: 'مشمول بكامل الخصوصية',
    cta_text: 'احجز هذه الوحدة',
    display_order: 4,
    is_active: true,
  },
  {
    id: 'default-scooters',
    title: 'أسطول السكوترات الكهربائية',
    subtitle: 'إضافة ترفيهية مميزة لجولات البستان',
    description: 'أسطول حديث من السكوترات الكهربائية المجهزة بخوذ الأمان، متاح للحجز الإضافي ليمنح ضيوفكم وأطفالكم جولات حرة ممتعة في ممرات البستان.',
    badge_text: 'مغامرة واستكشاف ⚡',
    image_url: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
    features: ['سكوترات حديثة سريعة', 'خوذ وأدوات سلامة', 'حجز إضافي فوري'],
    privacy_note: 'إضافة اختيارية عند الحجز',
    cta_text: 'احجز هذه الوحدة',
    display_order: 5,
    is_active: true,
  },
  {
    id: 'default-suite',
    title: 'جناح الماستر والمطبخ الفندقي المتكامل',
    subtitle: 'أقصى درجات الراحة والتجهيزات المنزلية',
    description: 'غرفة نوم رئيسية مريحة مؤثثة بأسلوب فندقي حديث، مع مطبخ متكامل بجميع أجهزة الطهي، الميكروويف، والثلاجة لتلبية كل احتياجات ضيوفكم.',
    badge_text: 'راحة متكاملة 🍳',
    image_url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
    features: ['سرير ماستر فندقي', 'مطبخ بجميع الأجهزة', 'دورات مياه فندقية'],
    privacy_note: 'مشمول بكامل الخصوصية',
    cta_text: 'احجز هذه الوحدة',
    display_order: 6,
    is_active: true,
  },
]

const QUICK_AMENITIES = [
  { icon: '🏊‍♂️', title: 'مسبح وألعاب مائية' },
  { icon: '🌴', title: 'بستان نخيل طبيعي' },
  { icon: '🌿', title: 'مسطحات عشب للمناسبات' },
  { icon: '🛋️', title: 'مجالس VIP وأرضية' },
  { icon: '🛴', title: 'سكوترات كهربائية' },
  { icon: '🎪', title: 'تجهيزات حفلات وأفراح' },
  { icon: '🍳', title: 'مطبخ كامل وثلاجة' },
  { icon: '🚗', title: 'مواقف سيارات واسعة' },
  { icon: '🔒', title: 'خصوصية عائلية تامة' },
]

export const Facilities: React.FC = () => {
  const [facilities, setFacilities] = useState<Facility[]>(DEFAULT_FACILITIES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const { data, error } = await supabase
          .from('resort_facilities')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true })

        if (!error && data && data.length > 0) {
          setFacilities(data as Facility[])
        } else {
          setFacilities(DEFAULT_FACILITIES)
        }
      } catch (err) {
        setFacilities(DEFAULT_FACILITIES)
      } finally {
        setLoading(false)
      }
    }

    fetchFacilities()
  }, [])

  // Bento column span mapping pattern: 2, 1, 1, 2, 1, 2
  const getColSpan = (index: number) => {
    const pattern = [
      'lg:col-span-2',
      'lg:col-span-1',
      'lg:col-span-1',
      'lg:col-span-2',
      'lg:col-span-1',
      'lg:col-span-2',
    ]
    return pattern[index % pattern.length]
  }

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-white">
      {/* ── Section Header ── */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-xs sm:text-sm font-semibold">
          <Sparkles size={15} />
          <span>مرافق متكاملة تفوق التوقعات</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 tracking-tight leading-tight">
          استكشف مرافق <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">الواحة والمنتجع</span>
        </h2>
        <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
          صُممت كل زاوية في منتجع وبستان خالد العمدة لتمنحكم مزيجاً نادراً من الراحة الفندقية، والمرح المائي، والهدوء الطبيعي بين أحضان النخيل.
        </p>
      </div>

      {/* ── Bento Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {facilities.map((facility, index) => {
          const colSpan = getColSpan(index)
          const tags = Array.isArray(facility.features) ? facility.features : []

          return (
            <div
              key={facility.id}
              className={`${colSpan} relative rounded-3xl overflow-hidden group border border-white/10 hover:border-emerald-500/40 transition-all duration-500 shadow-2xl bg-slate-900/60 flex flex-col justify-end min-h-[380px] sm:min-h-[420px]`}
            >
              {/* Background Photographic Layer with Zoom on Hover */}
              <div className="absolute inset-0 z-0 overflow-hidden">
                <img
                  src={facility.image_url}
                  alt={facility.title}
                  className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700 ease-out select-none"
                  loading="lazy"
                />
                {/* Progressive Ambient Dark Gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/20" />
                <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors duration-500" />
              </div>

              {/* Top Floating Badge */}
              {facility.badge_text && (
                <div className="absolute top-4 right-4 z-10">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/15 bg-slate-950/70 backdrop-blur-md text-emerald-300 text-xs font-semibold shadow-md">
                    <span>{facility.badge_text}</span>
                  </div>
                </div>
              )}

              {/* Card Content Foreground */}
              <div className="relative z-10 p-6 sm:p-7 flex flex-col gap-3">
                <div className="space-y-1">
                  <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-emerald-300 transition-colors leading-snug">
                    {facility.title}
                  </h3>
                  {facility.subtitle && (
                    <p className="text-xs sm:text-sm text-emerald-400/90 font-medium">
                      {facility.subtitle}
                    </p>
                  )}
                </div>

                <p className="text-gray-300 text-xs sm:text-sm leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                  {facility.description}
                </p>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[11px] sm:text-xs px-2.5 py-1 rounded-lg bg-white/10 text-gray-200 border border-white/5 backdrop-blur-sm"
                      >
                        <CheckCircle2 size={11} className="text-emerald-400" />
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Action Link */}
                <div className="pt-2 flex items-center justify-between border-t border-white/10 mt-1">
                  <span className="text-xs text-gray-400">
                    {facility.privacy_note || 'مشمول بكامل الخصوصية'}
                  </span>
                  <Link
                    to="/book"
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-400 hover:text-emerald-300 group/link transition-colors"
                  >
                    <span>{facility.cta_text || 'احجز هذه الوحدة'}</span>
                    <ArrowLeft size={14} className="group-hover/link:-translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Quick Amenities Strip ── */}
      <div className="mt-14 sm:mt-16 p-6 sm:p-8 rounded-3xl bg-emerald-950/30 border border-emerald-500/20 backdrop-blur-md shadow-xl">
        <h4 className="text-center text-sm sm:text-base font-bold text-white mb-6 flex items-center justify-center gap-2">
          <span>✨ ميزات الراحة والرفاهية المشمولة في المنتجع</span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 text-center">
          {QUICK_AMENITIES.map((am, i) => (
            <div
              key={i}
              className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all duration-300 flex flex-col items-center justify-center gap-1.5"
            >
              <span className="text-2xl">{am.icon}</span>
              <span className="text-xs font-semibold text-gray-200">{am.title}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Facilities
