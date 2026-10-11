import React, { useState } from 'react'
import {
  Upload, Image as ImageIcon, Copy, Check, Eye, X,
  Sparkles, ExternalLink, RefreshCw, Loader2, Folder
} from 'lucide-react'
import { PRESET_RESORT_IMAGES, uploadImageToSupabase, formatBytes } from '../../lib/imageUpload'
import { useSettings } from '../../contexts/SettingsContext'
import { Facility } from '../Facilities'

interface MediaLibraryTabProps {
  facilities: Facility[]
  showToast: (msg: string, type?: 'success' | 'error') => void
}

interface MediaItem {
  id: string
  title: string
  url: string
  source: 'hero' | 'facility' | 'preset' | 'uploaded'
  tag: string
}

export const MediaLibraryTab: React.FC<MediaLibraryTabProps> = ({ facilities, showToast }) => {
  const { settings, updateSettings } = useSettings()
  const [uploadedItems, setUploadedItems] = useState<MediaItem[]>([])
  const [filterSource, setFilterSource] = useState<string>('all')
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Aggregate all images currently in the system
  const allMedia: MediaItem[] = React.useMemo(() => {
    const list: MediaItem[] = []

    // 1. Current Hero Image
    if (settings.hero_image_url) {
      list.push({
        id: 'hero-current',
        title: 'صورة واجهة الهيرو الحالية',
        url: settings.hero_image_url,
        source: 'hero',
        tag: 'صورة الواجهة',
      })
    }

    // 2. Facilities images
    facilities.forEach((f, idx) => {
      if (f.image_url) {
        list.push({
          id: `facility-${f.id || idx}`,
          title: f.title,
          url: f.image_url,
          source: 'facility',
          tag: 'مرفق منتجع',
        })
      }
    })

    // 3. Newly uploaded images in this session
    list.push(...uploadedItems)

    // 4. Presets
    PRESET_RESORT_IMAGES.forEach((p) => {
      if (!list.some(item => item.url === p.url)) {
        list.push({
          id: `preset-${p.id}`,
          title: p.title,
          url: p.url,
          source: 'preset',
          tag: 'مكتبة المنتجع',
        })
      }
    })

    return list
  }, [settings.hero_image_url, facilities, uploadedItems])

  const filteredMedia = React.useMemo(() => {
    if (filterSource === 'all') return allMedia
    return allMedia.filter(m => m.source === filterSource)
  }, [allMedia, filterSource])

  const handleDeviceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const res = await uploadImageToSupabase(file, 'resort-media', 'gallery')
      const newItem: MediaItem = {
        id: `upload-${Date.now()}`,
        title: file.name.replace(/\.[^.]+$/, '') || 'صورة مرفوعة من الجهاز',
        url: res.url,
        source: 'uploaded',
        tag: `مرفوعة حديثاً (${formatBytes(res.size)})`,
      }
      setUploadedItems(prev => [newItem, ...prev])
      showToast('تم رفع الصورة بنجاح وإضافتها للمكتبة ✓')
    } catch (err: any) {
      showToast('⚠️ تعذر رفع الصورة من الجهاز: ' + (err.message || 'خطأ غير معروف'), 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCopyLink = async (item: MediaItem) => {
    try {
      await navigator.clipboard.writeText(item.url)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 2500)
      showToast('تم نسخ رابط الصورة إلى الحافظة بنجاح 📋')
    } catch (_) {
      showToast('تعذر النسخ تلقائياً', 'error')
    }
  }

  const handleSetAsHero = async (item: MediaItem) => {
    const res = await updateSettings({ hero_image_url: item.url })
    if (res.success) {
      showToast('تم اعتماد هذه الصورة كخلفية رئيسية لواجهة الموقع (Hero) فوراً! 🌟')
    } else {
      showToast('تعذر تحديث صورة الهيرو', 'error')
    }
  }

  return (
    <div className="space-y-6 text-right animate-fade-in">
      {/* Header & Upload Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900/70 border border-teal-500/20 backdrop-blur-md shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <Folder size={22} />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              مكتبة وسائط وصور المنتجع (Media Library)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-300">
            مركز شامل لرفع صور جديدة من جهازك، معاينة جميع صور الموقع الحالية، ونسخ روابطها أو استخدامها كخلفية للهيرو.
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleDeviceUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary py-3 px-5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xl shadow-teal-500/20 whitespace-nowrap"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>جاري معالجة الصورة...</span>
              </>
            ) : (
              <>
                <Upload size={16} />
                <span>رفع صورة جديدة من الجهاز 📁</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {[
          { id: 'all', label: `جميع الصور (${allMedia.length})` },
          { id: 'hero', label: 'واجهة الهيرو' },
          { id: 'facility', label: 'مرافق المنتجع' },
          { id: 'uploaded', label: 'مرفوعة من الجهاز' },
          { id: 'preset', label: 'مكتبة التصوير الجاهزة' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterSource(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              filterSource === tab.id
                ? 'bg-teal-500 text-slate-950 font-bold shadow-lg shadow-teal-500/20'
                : 'bg-slate-900/80 border border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Images Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredMedia.map(item => {
          const isHero = settings.hero_image_url === item.url
          return (
            <div
              key={item.id}
              className="card overflow-hidden border border-white/10 hover:border-teal-500/40 transition-all duration-300 group flex flex-col justify-between bg-slate-900/70"
            >
              {/* Image Thumbnail */}
              <div className="relative h-44 w-full bg-slate-950 overflow-hidden cursor-pointer" onClick={() => setZoomUrl(item.url)}>
                <img
                  src={item.url}
                  alt={item.title}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 select-none"
                  loading="lazy"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                {/* Top Badge */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/80 backdrop-blur-md text-teal-300 border border-teal-500/30">
                    {item.tag}
                  </span>
                </div>

                {isHero && (
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 shadow-md">
                      خلفية الهيرو الحالية ⭐
                    </span>
                  </div>
                )}
              </div>

              {/* Card Footer Details */}
              <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                    {item.title}
                  </h4>
                  <p className="text-[10px] text-gray-500 font-mono truncate" dir="ltr">
                    {item.url.slice(0, 35)}...
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(item)}
                    className="flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold glass text-gray-300 hover:text-white flex items-center justify-center gap-1 transition-colors"
                    title="نسخ رابط الصورة"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-300">تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>نسخ الرابط</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetAsHero(item)}
                    disabled={isHero}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all ${
                      isHero
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-default'
                        : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
                    }`}
                    title="تعيين كصورة الواجهة الرئيسية"
                  >
                    {isHero ? 'مستخدمة' : 'تعيين كهيرو'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Zoom Modal */}
      {zoomUrl && (
        <div
          onClick={() => setZoomUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-slate-950 flex flex-col"
          >
            <div className="p-3 bg-slate-900/90 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs text-gray-300 font-medium">معاينة الصورة بالحجم الطبيعي</span>
              <button
                type="button"
                onClick={() => setZoomUrl(null)}
                className="glass p-1.5 rounded-xl text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-auto max-h-[80vh] p-2 flex items-center justify-center bg-black/50">
              <img
                src={zoomUrl}
                alt="معاينة كاملة"
                className="max-w-full max-h-[75vh] object-contain rounded-xl select-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MediaLibraryTab
