import React, { useState } from 'react'
import {
  Sparkles, Save, Eye, Phone, MessageCircle, Clock,
  MapPin, Check, Loader2, Image as ImageIcon, Star, Users, Calendar
} from 'lucide-react'
import { ResortSettings, useSettings } from '../../contexts/SettingsContext'
import ImageUploader from '../ImageUploader'
import { generateWhatsAppLink } from '../../lib/utils'

interface WebsiteCmsTabProps {
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export const WebsiteCmsTab: React.FC<WebsiteCmsTabProps> = ({ showToast }) => {
  const { settings, updateSettings } = useSettings()
  const [form, setForm] = useState<ResortSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [previewActive, setPreviewActive] = useState(false)

  // Keep form updated if settings change externally
  React.useEffect(() => {
    setForm(settings)
  }, [settings])

  const handleChange = (key: keyof ResortSettings, val: any) => {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await updateSettings(form)
    setSaving(false)
    if (res.success) {
      showToast('تم حفظ وتحديث واجهة الموقع والصور بنجاح ✅ ستظهر التغييرات للزوار فوراً!')
    } else {
      showToast('⚠️ تعذر الحفظ: ' + (res.error || 'خطأ غير متوقع'), 'error')
    }
  }

  return (
    <div className="space-y-8 animate-fade-in text-right">
      {/* Tab Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900/70 border border-emerald-500/20 backdrop-blur-md shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <ImageIcon size={22} />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              إدارة واجهة الموقع والصور الرئيسية (Website CMS)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
            تحكم كامل وسهل في صورة الواجهة (الهيرو)، النصوص البارزة، شارات العرض، أرقام التواصل، والإحصائيات التي تظهر في الصفحة الرئيسية.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewActive(!previewActive)}
            className="glass py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white hover:bg-white/10 flex items-center gap-1.5 transition-all shadow-md"
          >
            <Eye size={16} className="text-teal-400" />
            <span>{previewActive ? 'إخفاء المعاينة' : 'معاينة الواجهة'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary py-2.5 px-6 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>حفظ ونشر التعديلات</span>
          </button>
        </div>
      </div>

      {/* Live Preview Mode (if toggled) */}
      {previewActive && (
        <div className="p-4 sm:p-6 rounded-3xl bg-slate-950 border border-emerald-500/40 shadow-2xl relative overflow-hidden space-y-4 animate-scale-in">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Sparkles size={14} />
              <span>معاينة حية لشاشة الهيرو الرئيسية (Hero Live Preview):</span>
            </span>
            <button
              onClick={() => setPreviewActive(false)}
              className="text-xs text-gray-400 hover:text-white"
            >
              ✕ إغلاق المعاينة
            </button>
          </div>

          <div className="relative rounded-2xl overflow-hidden min-h-[360px] flex flex-col justify-center items-center text-center p-6 text-white border border-white/10 bg-slate-900">
            {/* Background image */}
            <img
              src={form.hero_image_url || 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=2000&q=80'}
              alt="معاينة الهيرو"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-emerald-950/75 to-slate-950" />

            <div className="relative z-10 max-w-2xl space-y-3">
              <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
                {form.hero_badge || '🌴💧 واحة الاسترخاء والمناسبات في قلب الطبيعة'}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                مرحباً بكم في <span className="text-emerald-300">{form.hero_title || 'منتجع وبستان خالد العمدة'}</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-200 line-clamp-3 leading-relaxed">
                {form.hero_subtitle}
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <span className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md">
                  احجز الآن
                </span>
                <span className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold shadow-md">
                  واتساب المالك ({form.contact_whatsapp})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main CMS Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Hero Image Upload from Device */}
        <div className="card p-6 border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/10">
            <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
              <ImageIcon size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">صورة واجهة الهيرو الرئيسية (Hero Background)</h3>
              <p className="text-xs text-gray-400">
                الصورة البانورامية الكبرى التي تظهر خلف عنوان المنتجع في أعلى الصفحة الأولى
              </p>
            </div>
          </div>

          <ImageUploader
            value={form.hero_image_url}
            onChange={(url) => handleChange('hero_image_url', url)}
            label="اختر صورة الواجهة من جهازك (كمبيوتر أو جوال)"
            helperText="يمكنك رفع أي صورة بدقة عالية من جهازك مباشرة، أو اختيار صورة من مكتبة المنتجع، أو لصق رابط مباشر"
            aspectRatio="hero"
            folder="hero"
          />
        </div>

        {/* Section 2: Hero Texts & Headings */}
        <div className="card p-6 border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/10">
            <span className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <Sparkles size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">العناوين والشعارات الترويجية البارزة</h3>
              <p className="text-xs text-gray-400">العناوين الرئيسية والنصوص التي تجذب الزوار في واجهة الموقع</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                اسم المنتجع الرسمي *
              </label>
              <input
                type="text"
                required
                value={form.resort_name}
                onChange={(e) => handleChange('resort_name', e.target.value)}
                className="input-field text-sm font-bold text-white min-h-[46px]"
                placeholder="منتجع وبستان خالد العمدة للاستثمار"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                العنوان البارز في الهيرو (Hero Title) *
              </label>
              <input
                type="text"
                required
                value={form.hero_title}
                onChange={(e) => handleChange('hero_title', e.target.value)}
                className="input-field text-sm font-bold text-emerald-300 min-h-[46px]"
                placeholder="منتجع وبستان خالد العمدة"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              الشارة العلوية المتحركة (Floating Badge)
            </label>
            <input
              type="text"
              value={form.hero_badge}
              onChange={(e) => handleChange('hero_badge', e.target.value)}
              className="input-field text-sm min-h-[46px]"
              placeholder="🌴💧 واحة الاسترخاء والمناسبات في قلب الطبيعة"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              الوصف الترويجي الشامل (Hero Subtitle)
            </label>
            <textarea
              rows={3}
              value={form.hero_subtitle}
              onChange={(e) => handleChange('hero_subtitle', e.target.value)}
              className="input-field text-sm resize-none leading-relaxed"
              placeholder="انغمس في تجربة استثنائية تجمع بين بستان النخيل والمسطحات الخضراء..."
            />
          </div>
        </div>

        {/* Section 3: Key Stats Counters */}
        <div className="card p-6 border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/10">
            <span className="p-2 rounded-xl bg-teal-500/15 text-teal-400">
              <Star size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">إحصائيات الإنجاز والتميز (Hero Stats)</h3>
              <p className="text-xs text-gray-400">البطاقات الرقمية الـ 3 التي تعزز ثقة العملاء في أسفل الهيرو</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <Star size={16} />
                <span>إجمالي المناسبات</span>
              </div>
              <input
                type="text"
                value={form.stats_events}
                onChange={(e) => handleChange('stats_events', e.target.value)}
                className="input-field text-base font-bold text-amber-300"
                placeholder="+200"
              />
              <span className="text-[11px] text-gray-400 block">النص الفرعي: مناسبة ناجحة</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <Users size={16} />
                <span>العملاء السعداء</span>
              </div>
              <input
                type="text"
                value={form.stats_clients}
                onChange={(e) => handleChange('stats_clients', e.target.value)}
                className="input-field text-base font-bold text-emerald-300"
                placeholder="+1000"
              />
              <span className="text-[11px] text-gray-400 block">النص الفرعي: عميل سعيد</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-teal-400 text-xs font-bold">
                <Calendar size={16} />
                <span>أيام التشغيل</span>
              </div>
              <input
                type="text"
                value={form.stats_days}
                onChange={(e) => handleChange('stats_days', e.target.value)}
                className="input-field text-base font-bold text-teal-300"
                placeholder="365"
              />
              <span className="text-[11px] text-gray-400 block">النص الفرعي: يوم في السنة</span>
            </div>
          </div>
        </div>

        {/* Section 4: Contact & Location */}
        <div className="card p-6 border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/10">
            <span className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
              <Phone size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">بيانات التواصل والموقع الجغرافي</h3>
              <p className="text-xs text-gray-400">أرقام الهواتف والواتساب التي يرتبط بها زوار الموقع مباشرة</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                هاتف الاتصال الرئيسي للمنتجع
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={form.contact_phone}
                  onChange={(e) => handleChange('contact_phone', e.target.value)}
                  className="input-field text-sm font-mono text-left pl-3 pr-9 min-h-[46px]"
                  dir="ltr"
                  placeholder="0543034553"
                />
                <Phone size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                رقم واتساب المالك لحجوزات المنتجع
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={form.contact_whatsapp}
                  onChange={(e) => handleChange('contact_whatsapp', e.target.value)}
                  className="input-field text-sm font-mono text-left pl-3 pr-9 min-h-[46px]"
                  dir="ltr"
                  placeholder="0547382222"
                />
                <MessageCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                واتساب خدمة توصيل وايت ماء حلو
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={form.water_contact_whatsapp}
                  onChange={(e) => handleChange('water_contact_whatsapp', e.target.value)}
                  className="input-field text-sm font-mono text-left pl-3 pr-9 min-h-[46px]"
                  dir="ltr"
                  placeholder="0547382222"
                />
                <MessageCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                وصف الموقع الجغرافي للمنتجع
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.location_address}
                  onChange={(e) => handleChange('location_address', e.target.value)}
                  className="input-field text-sm pr-9 min-h-[46px]"
                  placeholder="المملكة العربية السعودية • موقع مميز وسهل الوصول"
                />
                <MapPin size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Floating Save Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setPreviewActive(!previewActive)}
            className="glass py-3 px-6 rounded-2xl text-xs sm:text-sm font-bold text-gray-300 hover:text-white"
          >
            {previewActive ? 'إخفاء المعاينة' : 'معاينة النتيجة'}
          </button>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary py-3.5 px-8 rounded-2xl text-sm font-black flex items-center gap-2 shadow-xl shadow-emerald-900/40"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>جاري الحفظ والنشر...</span>
              </>
            ) : (
              <>
                <Check size={18} />
                <span>حفظ ونشر التعديلات فوراً ✓</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default WebsiteCmsTab
