import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarCheck, Camera, Check, ChevronLeft, ChevronRight,
  Sparkles, Maximize2, X, Star, ShieldCheck, Heart
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/utils'

export interface PropertyItem {
  id: string
  name: string
  description: string
  weekday_price: number
  weekend_price: number
  cover_image?: string | null
  images?: string[]
  amenities: string[]
  max_guests?: number
}

const FALLBACK_PROPERTY: PropertyItem = {
  id: 'property-default-1',
  name: 'فئة رقم 1',
  weekday_price: 750,
  weekend_price: 750,
  description: 'مجلس مكيف- شاشة تلفزيون - مطبخ متكامل ثلاجة فرن اغراض طبخ كاملة - 3 دورات مياة خارجية - 2 العاب أطفال - مسبح خاص للبالغين - مسبح + العاب مائية للاطفال - مسطحات خضراء مع الكراسي و الطاولات - عريش تراثي + غرفة خارجية مكيفة + مطبخ بوفية متكامل - 3 مظلات موقف سيارات - بيت شعر + مشب نار',
  cover_image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
  images: [
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
  ],
  amenities: [
    'مجلس مكيف',
    'شاشة تلفزيون',
    'مطبخ متكامل',
    '3 دورات مياة',
    'مسبح خاص للبالغين',
    'مسبح وألعاب مائية للأطفال',
    'مسطحات خضراء',
    'عريش تراثي',
    'بيت شعر ومشب نار',
    '3 مظلات سيارات'
  ]
}

export const PropertyShowcaseCard: React.FC = () => {
  const [properties, setProperties] = useState<PropertyItem[]>([])
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null)
  const [currentImgIndex, setCurrentImgIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const thumbnailScrollRef = useRef<HTMLDivElement>(null)

  // Fetch properties from Supabase
  useEffect(() => {
    const fetchProps = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('is_active', true)
          .order('name')

        if (!error && data && data.length > 0) {
          setProperties(data)
          setSelectedProperty(data[0])
        } else {
          setProperties([FALLBACK_PROPERTY])
          setSelectedProperty(FALLBACK_PROPERTY)
        }
      } catch (e) {
        setProperties([FALLBACK_PROPERTY])
        setSelectedProperty(FALLBACK_PROPERTY)
      }
    }
    fetchProps()
  }, [])

  const property = selectedProperty || properties[0] || FALLBACK_PROPERTY
  const photos = Array.isArray(property.images) && property.images.length > 0
    ? property.images
    : (property.cover_image ? [property.cover_image] : [])

  // Smooth Auto-Play Transition (cycles smoothly every 3.5s)
  useEffect(() => {
    if (photos.length <= 1 || isPaused || lightboxOpen) return

    const timer = setInterval(() => {
      setCurrentImgIndex(prev => (prev + 1) % photos.length)
    }, 3800)

    return () => clearInterval(timer)
  }, [photos.length, isPaused, lightboxOpen])

  // Scroll active thumbnail into view smoothly
  useEffect(() => {
    if (!thumbnailScrollRef.current) return
    const container = thumbnailScrollRef.current
    const activeThumb = container.children[currentImgIndex] as HTMLElement
    if (activeThumb) {
      const scrollLeft = activeThumb.offsetLeft - container.offsetWidth / 2 + activeThumb.offsetWidth / 2
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
    }
  }, [currentImgIndex])

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentImgIndex(prev => (prev + 1) % photos.length)
  }

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentImgIndex(prev => (prev - 1 + photos.length) % photos.length)
  }

  const openLightboxAt = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  return (
    <>
      <div className="w-full text-right">
        {/* Main Step Container */}
        <div className="rounded-3xl border border-emerald-500/30 bg-[#0c141d]/90 backdrop-blur-xl shadow-2xl p-4 sm:p-6 transition-all duration-300 hover:border-emerald-500/50">
          {/* Header Step 1 */}
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-black flex items-center justify-center border border-emerald-500/40 shadow-sm">
                1
              </span>
              <span>اختر الوحدة والاستراحة</span>
            </h2>

            {properties.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {properties.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProperty(p)
                      setCurrentImgIndex(0)
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      selectedProperty?.id === p.id
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'glass text-gray-300 hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Unit Card with Smooth Motion Slider */}
          <div
            className="rounded-2xl border border-emerald-500/50 bg-slate-900/80 shadow-xl shadow-emerald-950/30 ring-1 ring-emerald-500/30 overflow-hidden transition-all duration-300"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Top Image Banner with Ultra-Smooth Animated Slide Transitions */}
            <div className="relative h-60 sm:h-80 md:h-96 w-full bg-slate-950 overflow-hidden group select-none">
              {/* Stacked Images with Smooth Crossfade & Subtle Zoom Animation */}
              {photos.map((src, idx) => {
                const isActive = idx === currentImgIndex
                return (
                  <div
                    key={idx}
                    className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                      isActive
                        ? 'opacity-100 scale-100 z-10'
                        : 'opacity-0 scale-105 pointer-events-none z-0'
                    }`}
                  >
                    <img
                      src={src}
                      alt={`${property.name} - صورة ${idx + 1}`}
                      className="w-full h-full object-cover object-center cursor-pointer"
                      onClick={() => openLightboxAt(idx)}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_PROPERTY.cover_image!
                      }}
                    />
                  </div>
                )
              })}

              {/* Gradient Vignette Overlays for Maximum Contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-black/40 pointer-events-none z-10" />

              {/* Top Badges */}
              <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-2">
                <div className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-slate-950 shadow-lg flex items-center gap-1.5 animate-fade-in">
                  <Check size={14} className="stroke-[3]" />
                  <span>تم الاختيار</span>
                </div>
              </div>

              {/* Photo Counter Pill (Top Right) */}
              {photos.length > 1 && (
                <div className="absolute top-3.5 right-3.5 z-20 px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/70 text-emerald-300 border border-emerald-500/30 backdrop-blur-md shadow-md">
                  {currentImgIndex + 1} / {photos.length}
                </div>
              )}

              {/* Slider Arrows (Smooth on hover or touch) */}
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevPhoto}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full glass hover:bg-emerald-500 hover:text-slate-950 text-white flex items-center justify-center shadow-xl border border-white/20 transition-all duration-300 hover:scale-110 active:scale-95 group/arrow"
                    aria-label="الصورة السابقة"
                  >
                    <ChevronRight size={22} className="group-hover/arrow:scale-110 transition-transform" />
                  </button>

                  <button
                    type="button"
                    onClick={handleNextPhoto}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full glass hover:bg-emerald-500 hover:text-slate-950 text-white flex items-center justify-center shadow-xl border border-white/20 transition-all duration-300 hover:scale-110 active:scale-95 group/arrow"
                    aria-label="الصورة التالية"
                  >
                    <ChevronLeft size={22} className="group-hover/arrow:scale-110 transition-transform" />
                  </button>
                </>
              )}

              {/* Bottom Actions on Image: Gallery Modal Trigger & Auto-Play Indicator */}
              <div className="absolute bottom-3 inset-x-3.5 z-20 flex items-center justify-between gap-2">
                {photos.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openLightboxAt(currentImgIndex)
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-black/85 hover:bg-black text-emerald-300 border border-emerald-500/50 backdrop-blur-md flex items-center gap-1.5 shadow-xl transition-all hover:scale-105 active:scale-95"
                  >
                    <Camera size={15} />
                    <span>معرض الصور ({photos.length} صور) 📸</span>
                  </button>
                )}

                {/* Animated Indicator Dots */}
                {photos.length > 1 && (
                  <div className="hidden sm:flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                    {photos.slice(0, 10).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCurrentImgIndex(i)
                        }}
                        className={`transition-all duration-300 rounded-full ${
                          i === currentImgIndex
                            ? 'w-5 h-1.5 bg-emerald-400'
                            : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/80'
                        }`}
                        title={`الانتقال للصورة ${i + 1}`}
                      />
                    ))}
                    {photos.length > 10 && (
                      <span className="text-[10px] text-gray-400">+{photos.length - 10}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Card Body with Detailed Property Specifications */}
            <div className="p-4 sm:p-6 space-y-4 text-right">
              {/* Title & Price Header */}
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    {property.name}
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    جاهزة للاستقبال 🌟
                  </span>
                </div>

                <div className="text-left">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                    {formatCurrency(property.weekday_price)}
                  </span>
                  <span className="text-gray-400 text-xs sm:text-sm font-medium mr-1.5">
                    / أيام عادية
                  </span>
                </div>
              </div>

              {/* Description */}
              {property.description && (
                <p className="text-gray-300 text-xs sm:text-sm leading-relaxed font-normal bg-white/[0.02] p-3 rounded-xl border border-white/5">
                  {property.description}
                </p>
              )}

              {/* Smooth Thumbnails Strip */}
              {photos.length > 1 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                      <span>✨ استعراض سريع لصور الوحدة (تتحرك تلقائياً أو انقر للتبديل):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => openLightboxAt(currentImgIndex)}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-bold"
                    >
                      تكبير كامل الصور 🔍
                    </button>
                  </div>

                  <div
                    ref={thumbnailScrollRef}
                    className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth"
                  >
                    {photos.map((img, i) => {
                      const isCurrent = currentImgIndex === i
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setCurrentImgIndex(i)}
                          className={`relative w-14 sm:w-16 h-11 sm:h-12 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all duration-300 ${
                            isCurrent
                              ? 'border-emerald-400 scale-105 shadow-md shadow-emerald-500/40 ring-2 ring-emerald-400/40'
                              : 'border-white/10 opacity-70 hover:opacity-100 hover:border-emerald-400/50'
                          }`}
                        >
                          <img
                            src={img}
                            alt=""
                            className="w-full h-full object-cover select-none"
                            loading="lazy"
                          />
                          {isCurrent && (
                            <span className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Amenities and Weekend Price Footer */}
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {(property.amenities || []).map((amenity, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-gray-300 font-medium hover:border-emerald-500/30 hover:text-white transition-colors"
                    >
                      ✓ {amenity}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0">
                  <span className="text-xs sm:text-sm text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                    عطل الأسبوع: {formatCurrency(property.weekend_price)}
                  </span>

                  <Link
                    to={`/book?propertyId=${property.id}`}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-900/50 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                  >
                    <CalendarCheck size={16} />
                    <span>احجز الآن بهذه الفئة</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Luxury Full-Screen Gallery Modal (Lightbox) */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/95 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-5xl w-full rounded-3xl overflow-hidden border border-emerald-500/30 shadow-2xl bg-slate-950 flex flex-col text-right animate-scale-in"
          >
            {/* Header */}
            <div className="p-4 bg-slate-900/95 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Camera size={18} className="text-emerald-400" />
                  <span>{property.name} — معرض الصور الكامل</span>
                </h3>
                <p className="text-xs text-gray-400">
                  صورة {lightboxIndex + 1} من {photos.length}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="w-9 h-9 rounded-full glass hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                title="إغلاق المعرض"
              >
                <X size={18} />
              </button>
            </div>

            {/* Main Stage with smooth transitions */}
            <div className="relative h-[55vh] sm:h-[70vh] bg-black flex items-center justify-center overflow-hidden">
              <img
                src={photos[lightboxIndex]}
                alt={`${property.name} - ${lightboxIndex + 1}`}
                className="max-w-full max-h-full object-contain select-none transition-all duration-300"
              />

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass hover:bg-emerald-500 hover:text-slate-950 text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95"
                    aria-label="الصورة السابقة"
                  >
                    <ChevronRight size={26} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setLightboxIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass hover:bg-emerald-500 hover:text-slate-950 text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95"
                    aria-label="الصورة التالية"
                  >
                    <ChevronLeft size={26} />
                  </button>
                </>
              )}
            </div>

            {/* Bottom Strip */}
            {photos.length > 1 && (
              <div className="p-3 bg-slate-900/95 border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
                {photos.map((pUrl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className={`relative w-16 h-12 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                      lightboxIndex === i
                        ? 'border-emerald-400 ring-2 ring-emerald-400/40 scale-105 shadow-md'
                        : 'border-white/10 hover:border-white/40 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={pUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default PropertyShowcaseCard
