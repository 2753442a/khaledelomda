import React, { useState, useRef } from 'react'
import {
  Upload, Image as ImageIcon, Link as LinkIcon, Sparkles,
  Check, X, Loader2, Eye, RefreshCw, Trash2
} from 'lucide-react'
import {
  uploadImageToSupabase, PRESET_RESORT_IMAGES,
  formatBytes, PresetImage
} from '../lib/imageUpload'

interface ImageUploaderProps {
  value: string
  onChange: (url: string) => void
  label?: string
  helperText?: string
  aspectRatio?: 'hero' | 'card' | 'square'
  folder?: string
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  label = 'صورة المرفق أو الواجهة',
  helperText = 'يمكنك اختيار صورة من جهازك، أو اختيار صورة من مكتبة المنتجع، أو لصق رابط مباشر',
  aspectRatio = 'card',
  folder = 'resort',
}) => {
  const [activeTab, setActiveTab] = useState<'device' | 'presets' | 'url'>('device')
  const [uploading, setUploading] = useState(false)
  const [compressInfo, setCompressInfo] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState(value && !value.startsWith('data:') ? value : '')
  const [showZoomModal, setShowZoomModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setCompressInfo(null)

    try {
      const result = await uploadImageToSupabase(file, 'resort-media', folder)
      onChange(result.url)
      setCompressInfo(
        `تم تحسين الصورة بنجاح (${formatBytes(result.size)}) • ${
          result.source === 'storage' ? 'محفوظة في التخزين السحابي' : 'جاهزة للحفظ الفوري'
        }`
      )
    } catch (err: any) {
      console.error('Upload failed:', err)
      alert('تعذر معالجة الصورة، يرجى المحاولة مرة أخرى.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSelectPreset = (preset: PresetImage) => {
    onChange(preset.url)
    setCompressInfo(`تم اختيار صورة من المكتبة: ${preset.title}`)
  }

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim())
      setCompressInfo('تم تطبيق رابط الصورة المباشر')
    }
  }

  const handleClearImage = () => {
    onChange('')
    setUrlInput('')
    setCompressInfo(null)
  }

  const getPreviewHeight = () => {
    if (aspectRatio === 'hero') return 'h-48 sm:h-56'
    if (aspectRatio === 'square') return 'h-40 sm:h-48'
    return 'h-40 sm:h-44'
  }

  return (
    <div className="space-y-3 text-right">
      {/* Label and Helper Text */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
            <ImageIcon size={16} className="text-emerald-400" />
            <span>{label}</span>
          </label>
          {value && (
            <button
              type="button"
              onClick={handleClearImage}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 size={13} />
              <span>إزالة الصورة</span>
            </button>
          )}
        </div>
        {helperText && <p className="text-[11px] text-gray-400 mt-0.5">{helperText}</p>}
      </div>

      {/* Current Image Live Preview */}
      {value ? (
        <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 bg-black/50 shadow-xl group">
          <div className={`${getPreviewHeight()} w-full relative overflow-hidden bg-slate-950`}>
            <img
              src={value}
              alt="معاينة الصورة المحددة"
              className="w-full h-full object-cover object-center select-none transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

            {/* Top Badges */}
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/75 backdrop-blur-md text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shadow-md">
                <Check size={12} className="text-emerald-400" />
                <span>صورة معتمدة</span>
              </span>
              {value.startsWith('data:') ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  ملف جهاز محلي
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  رابط سحابي
                </span>
              )}
            </div>

            {/* Action Buttons Overlay */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowZoomModal(true)}
                className="glass py-1.5 px-3 rounded-xl text-xs text-white hover:bg-white/20 flex items-center gap-1.5 shadow-md"
              >
                <Eye size={13} />
                <span>عرض بالحجم الكامل</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="py-1.5 px-3 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 flex items-center gap-1.5 shadow-lg transition-all"
              >
                {uploading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                <span>تغيير من الجهاز</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Compression & Status Notice */}
      {compressInfo && (
        <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <Check size={14} className="shrink-0 text-emerald-400" />
          <span>{compressInfo}</span>
        </div>
      )}

      {/* Tabs Selector: Device Upload vs Preset Gallery vs Direct URL */}
      <div className="bg-slate-900/80 p-1 rounded-2xl border border-white/10 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('device')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'device'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Upload size={14} />
          <span>من الجهاز 📱💻</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'presets'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Sparkles size={14} />
          <span>مكتبة المنتجع 🌴</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'url'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <LinkIcon size={14} />
          <span>رابط مباشر 🔗</span>
        </button>
      </div>

      {/* Hidden File Input for Device Selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg,image/heic"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Tab 1: Device Upload Zone */}
      {activeTab === 'device' && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/30 rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 group shadow-inner"
        >
          <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            {uploading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <Upload size={24} />
            )}
          </div>
          <p className="text-sm font-bold text-white mb-1">
            {uploading ? 'جاري ضغط ومعالجة الصورة من جهازك...' : 'اضغط لاختيار صورة من جهازك (كمبيوتر أو جوال)'}
          </p>
          <p className="text-xs text-gray-400">
            يدعم صور الكاميرا والاستديو (JPG, PNG, WEBP) — يتم تحسين الحجم تلقائياً لتسريع التصفح
          </p>
        </div>
      )}

      {/* Tab 2: Preset Library Gallery */}
      {activeTab === 'presets' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto custom-scrollbar p-1">
            {PRESET_RESORT_IMAGES.map((preset) => {
              const isSelected = value === preset.url
              return (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`group relative rounded-xl overflow-hidden cursor-pointer border transition-all ${
                    isSelected
                      ? 'border-emerald-400 ring-2 ring-emerald-400/50 scale-[1.02]'
                      : 'border-white/10 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="h-24 w-full bg-slate-950 overflow-hidden">
                    <img
                      src={preset.url}
                      alt={preset.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                  </div>

                  <div className="absolute bottom-1.5 inset-x-1.5">
                    <p className="text-[11px] font-bold text-white truncate text-right">
                      {preset.title}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-gray-400 text-center">
            اختر أي صورة عالية الجودة من تصوير المنتجع بنقرة واحدة
          </p>
        </div>
      )}

      {/* Tab 3: Direct URL Input */}
      {activeTab === 'url' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://example.com/resort-photo.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="input-field text-xs sm:text-sm flex-1 font-mono text-left"
              dir="ltr"
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              className="btn-primary py-2 px-4 text-xs font-bold whitespace-nowrap"
            >
              تطبيق الرابط
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            الصق رابط صورة مباشر من الإنترنت أو من خدمة تخزين سحابية خارجية
          </p>
        </div>
      )}

      {/* Zoom Fullscreen Modal */}
      {showZoomModal && (
        <div
          onClick={() => setShowZoomModal(false)}
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
                onClick={() => setShowZoomModal(false)}
                className="glass p-1.5 rounded-xl text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-auto max-h-[80vh] p-2 flex items-center justify-center bg-black/50">
              <img
                src={value}
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

export default ImageUploader
