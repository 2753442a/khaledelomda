import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Edit3, Trash2, CheckCircle2, XCircle, Eye, EyeOff,
  Armchair, DollarSign, Tag, Image as ImageIcon, Sparkles,
  Package, AlertTriangle, Loader2, Copy, Check
} from 'lucide-react'
import { supabase, HeritageFurniture } from '../../lib/supabase'
import ImageUploader from '../ImageUploader'

interface HeritageFurnitureAdminTabProps {
  showToast: (msg: string, type?: 'success' | 'error') => void
}

export const INITIAL_HERITAGE_FURNITURE: HeritageFurniture[] = [
  {
    id: 'heritage-chair-set-1',
    name: 'طقم كراسي خيزران تراثي ريفي (4 كراسي)',
    category: 'كراسي',
    description: 'طقم كراسي تراثية فاخرة مصنوعة يدوياً بحرفية عالية من الخيزران والخشب الطبيعي المتين، مع مساند أذرع مريحة ومقاعد قماشية أنيقة باللون الأزرق والأبيض. مصممة لتضفي رونقاً تراثياً أصيلاً على حدائق المزارع، الاستراحات، والبيوت الريفية.',
    price: 850,
    discount_price: 750,
    image_url: '/images/heritage-chair.jpg',
    features: ['صناعة يدوية عالية المتانة', 'خيزران وخشب طبيعي معالج', 'وسائد قماشية كلاسيكية مريحة', 'مناسب للمزارع والحدائق الخارجية', 'خفيف الوزن وسهل النقل والتخزين'],
    in_stock: true,
    stock_quantity: 8,
    display_order: 1,
    is_active: true,
  },
]

const CATEGORIES = ['كراسي', 'طاولات', 'أطقم جلسات', 'إكسسوارات وديكور']

export const HeritageFurnitureAdminTab: React.FC<HeritageFurnitureAdminTabProps> = ({ showToast }) => {
  const [items, setItems] = useState<HeritageFurniture[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<HeritageFurniture | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)

  const [form, setForm] = useState({
    name: '',
    category: 'كراسي',
    description: '',
    price: '',
    discount_price: '',
    image_url: '/images/heritage-chair.jpg',
    features: [] as string[],
    in_stock: true,
    stock_quantity: '10',
    display_order: '1',
    is_active: true,
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('heritage_furniture')
        .select('*')
        .order('display_order', { ascending: true })

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          setNeedsMigration(true)
          setItems(INITIAL_HERITAGE_FURNITURE)
        } else {
          showToast('⚠️ خطأ في جلب بيانات الأثاث: ' + error.message, 'error')
        }
      } else if (data) {
        setNeedsMigration(false)
        setItems(data as HeritageFurniture[])
      }
    } catch (err: any) {
      console.warn('Heritage furniture fetch error:', err)
      setItems(INITIAL_HERITAGE_FURNITURE)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const openCreateModal = () => {
    setEditingItem(null)
    setTagInput('')
    setForm({
      name: '',
      category: 'كراسي',
      description: '',
      price: '',
      discount_price: '',
      image_url: '/images/heritage-chair.jpg',
      features: ['صناعة يدوية عالية المتانة', 'خيزران وخشب طبيعي معالج', 'مناسب للمزارع والحدائق'],
      in_stock: true,
      stock_quantity: '10',
      display_order: String(items.length + 1),
      is_active: true,
    })
    setShowModal(true)
  }

  const openEditModal = (item: HeritageFurniture) => {
    setEditingItem(item)
    setTagInput('')
    setForm({
      name: item.name,
      category: item.category || 'كراسي',
      description: item.description,
      price: String(item.price),
      discount_price: item.discount_price ? String(item.discount_price) : '',
      image_url: item.image_url,
      features: Array.isArray(item.features) ? [...item.features] : [],
      in_stock: item.in_stock ?? true,
      stock_quantity: String(item.stock_quantity ?? 10),
      display_order: String(item.display_order ?? 1),
      is_active: item.is_active ?? true,
    })
    setShowModal(true)
  }

  const handleAddTag = () => {
    const val = tagInput.trim()
    if (!val) return
    if (!form.features.includes(val)) {
      setForm(prev => ({ ...prev, features: [...prev.features, val] }))
    }
    setTagInput('')
  }

  const handleRemoveTag = (index: number) => {
    setForm(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }))
  }

  const handleToggleActive = async (item: HeritageFurniture) => {
    setTogglingId(item.id)
    try {
      const { error } = await supabase
        .from('heritage_furniture')
        .update({ is_active: !item.is_active })
        .eq('id', item.id)

      if (error) {
        showToast('⚠️ تعذر تحديث حالة العرض: ' + error.message, 'error')
      } else {
        showToast(item.is_active ? 'تم إخفاء المنتج من المتجر 👁️' : 'تم تفعيل وإظهار المنتج في المتجر ✅')
        fetchItems()
      }
    } catch (e: any) {
      showToast('⚠️ خطأ في الاتصال', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  const handleToggleStock = async (item: HeritageFurniture) => {
    setTogglingId(item.id)
    try {
      const { error } = await supabase
        .from('heritage_furniture')
        .update({ in_stock: !item.in_stock })
        .eq('id', item.id)

      if (error) {
        showToast('⚠️ تعذر تحديث حالة التوفر: ' + error.message, 'error')
      } else {
        showToast(item.in_stock ? 'تم تعليم المنتج كـ (نفذت الكمية) 📦' : 'تم تفعيل توفر المنتج للشراء ✅')
        fetchItems()
      }
    } catch (e: any) {
      showToast('⚠️ خطأ في الاتصال', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (item: HeritageFurniture) => {
    if (!window.confirm(`هل أنت متأكد من حذف منتج "${item.name}" نهائياً من المتجر؟`)) return
    setDeletingId(item.id)
    try {
      const { error } = await supabase
        .from('heritage_furniture')
        .delete()
        .eq('id', item.id)

      if (error) {
        showToast('⚠️ تعذر حذف المنتج: ' + error.message, 'error')
      } else {
        showToast('تم حذف المنتج بنجاح 🗑️')
        fetchItems()
      }
    } catch (e: any) {
      showToast('⚠️ خطأ في الحذف: ' + e.message, 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      showToast('يرجى إدخال اسم القطعة / المنتج', 'error')
      return
    }
    if (!form.price || Number(form.price) <= 0) {
      showToast('يرجى تحديد السعر بشكل صحيح', 'error')
      return
    }
    if (!form.image_url.trim()) {
      showToast('يرجى تحديد صورة للمنتج', 'error')
      return
    }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      price: Number(form.price),
      discount_price: form.discount_price ? Number(form.discount_price) : null,
      image_url: form.image_url.trim(),
      features: form.features,
      in_stock: form.in_stock,
      stock_quantity: parseInt(form.stock_quantity, 10) || 0,
      display_order: parseInt(form.display_order, 10) || 1,
      is_active: form.is_active,
    }

    try {
      if (editingItem && !editingItem.id.startsWith('heritage-chair-set-1')) {
        const { error } = await supabase
          .from('heritage_furniture')
          .update(payload)
          .eq('id', editingItem.id)

        if (error) throw error
        showToast('تم تحديث بيانات المنتج بنجاح ✅')
      } else {
        const { error } = await supabase
          .from('heritage_furniture')
          .insert([payload])

        if (error) throw error
        showToast('تم إضافة ونشر القطعة التراثية في المتجر بنجاح ✅')
      }
      setShowModal(false)
      fetchItems()
    } catch (err: any) {
      showToast('⚠️ تعذر حفظ المنتج: ' + (err.message || 'خطأ غير متوقع'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const activeCount = items.filter(i => i.is_active).length
  const inStockCount = items.filter(i => i.in_stock).length

  return (
    <div className="space-y-6 text-right animate-fade-in">
      {/* Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900/70 border border-amber-500/20 backdrop-blur-md shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Armchair size={22} />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              قسم بيع الكراسي والأثاث التراثي 🪑
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
            تحكم كامل في إضافة، تعديل، حذف، وتحديد أسعار الكراسي التراثية، الطاولات، وأطقم الجلسات الريفية المعروضة للزوار للطلب والشراء.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-emerald-400 font-bold">{activeCount}</span>
            <span className="text-gray-400">معروض للزوار</span>
            <span className="text-gray-600">•</span>
            <span className="text-amber-300 font-bold">{inStockCount}</span>
            <span className="text-gray-400">متوفر بالمستودع</span>
          </div>

          <button
            onClick={openCreateModal}
            className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 whitespace-nowrap"
          >
            <Plus size={16} />
            <span>إضافة كرسي / قطعة جديدة</span>
          </button>
        </div>
      </div>

      {/* Migration Notice if table not created yet in Supabase */}
      {needsMigration && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <span>
              قاعدة بيانات جدول الكراسي التراثية جاهزة في ملف الترحيل <code className="bg-black/40 px-2 py-0.5 rounded text-amber-300">heritage_furniture_migration.sql</code>. يتم الآن عرض المنتج التجريبي بسلاسة.
            </span>
          </div>
        </div>
      )}

      {/* Items Grid or Empty State */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="text-amber-400 animate-spin" />
          <span className="text-xs text-gray-400 font-medium">جاري تحميل قطع الأثاث التراثي...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center border-dashed border-white/10 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto text-3xl">
            🪑
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">لا توجد قطع أثاث تراثية مضافة حالياً</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
              يمكنك البدء بإضافة كراسي تراثية، طاولات، أو أطقم جلسات لعرضها للزوار مع تحديد الأسعار والصور ونشرها فوراً.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="btn-primary py-2.5 px-5 text-xs font-bold inline-flex items-center gap-2"
          >
            <Plus size={16} />
            <span>إضافة أول قطعة أثاث الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => {
            const tags = Array.isArray(item.features) ? item.features : []
            return (
              <div
                key={item.id}
                className={`rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col justify-between ${
                  item.is_active
                    ? 'bg-slate-900/80 border-white/10 hover:border-amber-500/40 shadow-xl'
                    : 'bg-slate-950/40 border-white/5 opacity-70 hover:opacity-100'
                }`}
              >
                {/* Image Banner */}
                <div className="relative h-56 w-full overflow-hidden bg-slate-950 group">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover object-center select-none group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      if (target.dataset.fallbackApplied) return
                      target.dataset.fallbackApplied = 'true'
                      target.src = '/images/heritage-chair.jpg'
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                  {/* Category Pill */}
                  <div className="absolute top-3.5 right-3.5">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-950/80 border border-white/15 text-amber-300 backdrop-blur-md shadow-md">
                      {item.category || 'كراسي'}
                    </span>
                  </div>

                  {/* Stock & Active Status */}
                  <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-md ${
                        item.in_stock
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border-red-500/40'
                      }`}
                    >
                      {item.in_stock ? `متوفر (${item.stock_quantity ?? 10})` : 'نفذت الكمية'}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-md ${
                        item.is_active
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                          : 'bg-gray-500/20 text-gray-400 border-gray-500/40'
                      }`}
                    >
                      {item.is_active ? 'معروض' : 'مخفي'}
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                        {item.name}
                      </h3>
                      <div className="text-left shrink-0">
                        <div className="text-lg font-black text-amber-300">
                          {item.discount_price ? item.discount_price : item.price} ر.س
                        </div>
                        {item.discount_price && item.discount_price < item.price && (
                          <div className="text-xs text-gray-500 line-through">
                            {item.price} ر.س
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-gray-300 leading-relaxed line-clamp-3">
                      {item.description}
                    </p>

                    {/* Features Tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-gray-300 border border-white/5"
                          >
                            <CheckCircle2 size={10} className="text-amber-400" />
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Toolbar */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleActive(item)}
                        disabled={togglingId === item.id}
                        className={`p-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                          item.is_active
                            ? 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                        }`}
                        title={item.is_active ? 'إخفاء من المتجر' : 'إظهار في المتجر'}
                      >
                        {item.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>{item.is_active ? 'إخفاء' : 'إظهار'}</span>
                      </button>

                      <button
                        onClick={() => handleToggleStock(item)}
                        disabled={togglingId === item.id}
                        className={`p-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                          item.in_stock
                            ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                            : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                        }`}
                        title={item.in_stock ? 'تعليم كنفذت الكمية' : 'تفعيل التوفر'}
                      >
                        <Package size={14} />
                        <span>{item.in_stock ? 'متوفر' : 'غير متوفر'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(item)}
                        className="glass p-2 rounded-xl text-teal-300 hover:text-white hover:bg-teal-500/20 border border-teal-500/20 transition-colors"
                        title="تعديل بيانات وسعر القطعة"
                      >
                        <Edit3 size={15} />
                      </button>

                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="glass p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                        title="حذف القطعة نهائياً"
                      >
                        {deletingId === item.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Modal — Mobile First Bottom Sheet */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full sm:max-w-2xl bg-slate-900 border-t sm:border border-amber-500/30 shadow-2xl rounded-t-[28px] sm:rounded-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden text-right animate-scale-in">
            {/* Header (Sticky at Top) */}
            <div className="shrink-0 p-4 sm:p-5 border-b border-white/10 bg-slate-900/95 backdrop-blur-md z-10">
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    <Armchair size={18} />
                  </span>
                  <h3 className="font-bold text-white text-base sm:text-lg">
                    {editingItem ? 'تعديل بيانات وتسعير القطعة التراثية' : 'إضافة قطعة أثاث تراثية جديدة للمتجر'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form id="heritage-furniture-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    اسم القطعة / المنتج *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: طقم كراسي خيزران تراثي ريفي"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="input-field min-h-[46px] text-sm font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    التصنيف
                  </label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="input-field min-h-[46px] text-sm bg-slate-900"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  الوصف التفصيلي والمميزات *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="اكتب وصفاً جذاباً للقطعة: نوع الخشب، وسائد الجلوس، الاستخدامات المناسبة..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="input-field text-xs sm:text-sm leading-relaxed"
                />
              </div>

              {/* Pricing & Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    السعر الأساسي (ر.س) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="850"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="input-field min-h-[44px] text-sm font-bold text-amber-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    سعر العرض / الخصم (اختياري)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="750"
                    value={form.discount_price}
                    onChange={e => setForm(f => ({ ...f, discount_price: e.target.value }))}
                    className="input-field min-h-[44px] text-sm font-bold text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    الكمية المتوفرة
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.stock_quantity}
                    onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))}
                    className="input-field min-h-[44px] text-sm"
                  />
                </div>
              </div>

              {/* Image Selection & Quick Preset */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-300">
                    صورة القطعة التراثية *
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, image_url: '/images/heritage-chair.jpg' }))}
                    className="text-xs text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
                  >
                    <span>استخدام صورة الكراسي التراثية المرفقة</span>
                  </button>
                </div>

                <ImageUploader
                  value={form.image_url}
                  onChange={(url) => setForm(f => ({ ...f, image_url: url }))}
                  label="اختر صورة للقطعة من جهازك أو الصق رابط مباشر"
                  helperText="يمكنك رفع صورة عالية الدقة للكراسي أو الطاولة"
                  aspectRatio="card"
                  folder="furniture"
                />
              </div>

              {/* Tags / Features */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  المواصفات والوسوم (مثال: خيزران طبيعي، مقاوم للعوامل الجوية)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
                    placeholder="اكتب الميزة واضغط إضافة"
                    className="input-field min-h-[42px] text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="glass px-4 py-2 text-xs font-bold text-emerald-300 rounded-xl hover:bg-emerald-500/20 border border-emerald-500/30"
                  >
                    + إضافة
                  </button>
                </div>
                {form.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {form.features.map((feat, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300"
                      >
                        <span>{feat}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(idx)}
                          className="text-amber-400/70 hover:text-red-400 text-xs px-1"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Switches & Display Order */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="furn_in_stock"
                    checked={form.in_stock}
                    onChange={e => setForm(f => ({ ...f, in_stock: e.target.checked }))}
                    className="w-4 h-4 rounded text-emerald-500"
                  />
                  <label htmlFor="furn_in_stock" className="text-xs text-gray-300 cursor-pointer">
                    متوفر للشراء فوراً
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="furn_is_active"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded text-teal-500"
                  />
                  <label htmlFor="furn_is_active" className="text-xs text-gray-300 cursor-pointer">
                    إظهار في متجر الموقع
                  </label>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400 whitespace-nowrap">الترتيب:</label>
                    <input
                      type="number"
                      min={1}
                      value={form.display_order}
                      onChange={e => setForm(f => ({ ...f, display_order: e.target.value }))}
                      className="input-field min-h-[36px] text-xs py-1 px-2"
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* Action Footer (Sticky at Bottom) */}
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-white/10 bg-slate-900/95 backdrop-blur-md pb-safe flex gap-3 z-10">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-ghost w-1/3 py-2.5 text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="heritage-furniture-form"
                disabled={saving}
                className="btn-primary w-2/3 py-2.5 text-xs font-bold shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : editingItem ? (
                  'حفظ تعديلات القطعة'
                ) : (
                  'نشر القطعة بالمتجر الآن'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HeritageFurnitureAdminTab
