import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowLeft, Bath, BedDouble, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Heart, Images, MapPin, Maximize, MessageCircle, Search, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Star, Users, Waves, X } from 'lucide-react'
import { Button, Busy, EmptyState, PageIntro, Price, toast } from '../components/ui'
import { useAuth } from '../lib/auth'
import { dateLabel, durationLabel, imageUrl, isSaudiMobile, normalizePhone, placeholderImages, type AddOn, type ResortPackage, type ResortSettings, type Unit } from '../lib/models'
import { supabase, supabaseConfigured } from '../lib/supabase'

type UnitData = Unit & { unit_media: NonNullable<Unit['unit_media']>; unit_amenities: NonNullable<Unit['unit_amenities']> }

async function fetchUnits() {
  const { data, error } = await supabase.from('units').select('*,unit_media(*),unit_amenities(amenities(*))').eq('published', true).order('sort_order')
  if (error) throw error
  return (data ?? []) as unknown as UnitData[]
}

function CoverImage({ unit, className = '' }: { unit: UnitData; className?: string }) {
  const cover = [...(unit.unit_media ?? [])].sort((a, b) => Number(Boolean(b.is_cover)) - Number(Boolean(a.is_cover)) || a.sort_order - b.sort_order)[0]
  return <img className={className} src={imageUrl(cover?.storage_path, placeholderImages.unit)} alt={cover?.alt_text || unit.name} loading="lazy" onError={(event) => {
    const fallback = new URL(placeholderImages.unit, window.location.origin).href
    if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback
  }} />
}

function FavoriteButton({ unitId, className = '' }: { unitId: string; className?: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [favorite, setFavorite] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    if (user) supabase.from('favorites').select('unit_id').eq('unit_id', unitId).maybeSingle().then(({ data }) => active && setFavorite(Boolean(data)))
    else setFavorite(false)
    return () => { active = false }
  }, [unitId, user?.id])
  const toggle = async () => {
    if (!user) return navigate('/login?next=/account/favorites')
    setBusy(true)
    const result = favorite
      ? await supabase.from('favorites').delete().eq('unit_id', unitId).eq('customer_id', user.id)
      : await supabase.from('favorites').insert({ unit_id: unitId, customer_id: user.id })
    setBusy(false)
    if (result.error) return toast('تعذر تحديث المفضلة، حاول مرة أخرى.', 'error')
    setFavorite(!favorite)
    toast(favorite ? 'أزيلت من مفضلتك' : 'أضيفت إلى مفضلتك', 'success')
  }
  return <button type="button" className={`favorite-button ${favorite ? 'is-favorite' : ''} ${className}`} aria-label={favorite ? 'إزالة من المفضلة' : 'أضف إلى المفضلة'} aria-pressed={favorite} disabled={busy} onClick={toggle}><Heart size={18} fill={favorite ? 'currentColor' : 'none'} /></button>
}

function UnitCard({ unit, index = 0 }: { unit: UnitData; index?: number }) {
  const amenities = unit.unit_amenities?.map((item) => item.amenities).filter(Boolean).slice(0, 3) ?? []
  return <article className={`unit-card reveal delay-${Math.min(index % 3, 2)}`}>
    <Link to={`/units/${unit.slug}`} className="unit-card-image"><CoverImage unit={unit} /><span className="image-index">{String(index + 1).padStart(2, '0')} <i /> استراحة</span></Link>
    <FavoriteButton unitId={unit.id} className="unit-card-heart" />
    <div className="unit-card-body">
      <div className="unit-card-title"><div><span className="eyebrow">مساحة خاصة بك</span><h3><Link to={`/units/${unit.slug}`}>{unit.name}</Link></h3></div><span className="capacity"><Users size={15} /> حتى {unit.max_guests}</span></div>
      <p className="unit-card-desc">{unit.short_description || 'تفاصيل هذه الاستراحة وتجربتها ستجدها هنا.'}</p>
      <div className="amenity-list">{amenities.map((amenity) => <span key={amenity.id}><Sparkles size={13} />{amenity.name}</span>)}{unit.has_pool && <span><Waves size={14} />مسبح</span>}</div>
      <div className="unit-card-foot"><div><small>تبدأ إضافة الاستراحة من</small><Price value={unit.base_price} compact /></div><Link className="text-link" to={`/units/${unit.slug}`}>التفاصيل <ChevronLeft size={16} /></Link></div>
    </div>
  </article>
}

export function HomePage() {
  const [settings, setSettings] = useState<ResortSettings | null>(null)
  const [units, setUnits] = useState<UnitData[]>([])
  const [packages, setPackages] = useState<ResortPackage[]>([])
  const [faqs, setFaqs] = useState<{ id: string; question: string; answer: string }[]>([])
  const [reviews, setReviews] = useState<{ id: string; rating: number; body: string; created_at: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!supabaseConfigured) { setLoading(false); return }
    Promise.all([
      supabase.from('resort_settings').select('*').eq('id', true).maybeSingle(),
      fetchUnits(),
      supabase.from('packages').select('*,package_features(*),package_units!inner(unit_id)').eq('active', true).order('sort_order'),
      supabase.from('faq_entries').select('id,question,answer').eq('published', true).order('sort_order'),
      supabase.from('reviews').select('id,rating,body,created_at').eq('status', 'published').order('created_at', { ascending: false }).limit(3),
    ]).then(([settingResult, unitResult, packageResult, faqResult, reviewResult]) => {
      if (!active) return
      setSettings(settingResult.data as ResortSettings | null)
      setUnits(unitResult)
      setPackages((packageResult.data ?? []) as unknown as ResortPackage[])
      setFaqs((faqResult.data ?? []) as typeof faqs)
      setReviews((reviewResult.data ?? []) as typeof reviews)
    }).catch(() => { if (active) toast('تعذر تحميل محتوى المنتجع. تحقق من اتصال الشبكة.', 'error') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return <>
    <section className="hero-section" style={{ backgroundImage: `linear-gradient(90deg, rgba(11,31,26,.03) 0%, rgba(12,31,27,.14) 46%, rgba(11,31,26,.63) 100%), linear-gradient(0deg, rgba(11,31,26,.3), transparent 45%), url("${imageUrl(settings?.hero_path, placeholderImages.hero)}")` }}>
      <div className="hero-content">
        <span className="hero-kicker"><span className="kicker-line" /> ضيافة سعودية، بتفاصيل تلامس الحواس</span>
        <h1>{settings?.name || 'مكانٌ يليق<br/>بهدوئك'.split('<br/>').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h1>
        <p>{settings?.tagline || 'اترك إيقاع اليوم خلفك. هنا تبدأ لحظاتك الأجمل بين الماء والخضرة ودفء الضيافة.'}</p>
        <div className="hero-actions"><Link to="/units" className="button button-light">اكتشف الاستراحات <ArrowLeft size={17} /></Link><a href="#experience" className="hero-secondary">تعرّف على التجربة <ArrowDownLeft size={17} /></a></div>
      </div>
      <div className="hero-caption"><span>إقامة على إيقاعك</span><span className="caption-line" /><span>المملكة العربية السعودية</span></div>
      <a className="hero-scroll" href="#experience"><span>اكتشف أكثر</span><ArrowDownLeft size={15} /></a>
      <div className="hero-number">01 <span>/</span> 04</div>
    </section>

    <main>
      <section className="welcome-section section-wrap" id="experience">
        <div className="welcome-index"><span>01</span><i /></div>
        <div className="welcome-copy"><span className="eyebrow">أهلاً بك في {settings?.name || 'وجهتك الخاصة'}</span><h2>ليست استراحة فحسب،<br /><em>بل مساحة لتعود إلى نفسك.</em></h2><p>{settings?.about || 'صممنا هذه التجربة لتمنح وقتك معنى مختلفًا؛ خصوصية تامة، تفاصيل مدروسة، ومساحات تتنفس فيها على مهل.'}</p><Link to="/units" className="text-link">تصفّح المساحات <ChevronLeft size={16} /></Link></div>
        <div className="welcome-aside"><div className="welcome-stamp"><span>رفاهية</span><b>بهدوء</b><i /></div><p>لحظات بسيطة،<br />تبقى في الذاكرة طويلًا.</p></div>
      </section>

      <section className="section-wrap spaces-section" id="units">
        <div className="section-heading-row"><div><span className="eyebrow">مساحات صنعت للراحة</span><h2>اختر مساحتك</h2></div><Link to="/units" className="text-link">كل الاستراحات <ChevronLeft size={16} /></Link></div>
        {loading ? <div className="section-loader"><Busy label="نجهّز لك المساحات" /></div> : units.length ? <div className="unit-grid">{units.slice(0, 3).map((unit, index) => <UnitCard key={unit.id} unit={unit} index={index} />)}</div> : <EmptyState title="نرتّب المكان بعناية" body="سيعرض هذا القسم الاستراحات المتاحة فور إضافتها من لوحة المالك." action={<Link className="text-link" to="/inquiry">اسألنا عن الافتتاح <ChevronLeft size={16} /></Link>} />}
      </section>

      <section className="ritual-section">
        <div className="ritual-image" style={{ backgroundImage: `url("${placeholderImages.detail}")` }}><div className="ritual-quote"><span className="eyebrow">وقتٌ لك</span><p>مساحة تجمع<br /><em>هدوء الطبيعة</em><br />بدفء المكان.</p></div></div>
        <div className="ritual-copy"><span className="eyebrow">تجربة متوازنة</span><h2>من أول خطوة،<br />حتى آخر ضوء.</h2><p>تفاصيل المنتجع تُدار لتمنحك الخصوصية والراحة: وصول واضح، مرافق مرتبة، وفريق قريب حين تحتاجه.</p>
          <div className="ritual-points"><div><span className="point-number">01</span><div><strong>مساحتك، كما تحب</strong><small>خصوصية وراحة في كل تفصيل.</small></div></div><div><span className="point-number">02</span><div><strong>ضيافة من القلب</strong><small>نحرص على أن تشعر أنك في مكانك.</small></div></div><div><span className="point-number">03</span><div><strong>وقت بلا استعجال</strong><small>احجز التاريخ والباقة التي تناسبك.</small></div></div></div>
          <Link to="/units" className="button button-outline">ابدأ باختيار الاستراحة <ArrowLeft size={16} /></Link>
        </div>
      </section>

      {packages.length > 0 && <section className="section-wrap packages-section" id="packages"><div className="section-heading-row"><div><span className="eyebrow">وقت يناسب يومك</span><h2>باقات بتفاصيل مرنة</h2></div><span className="muted-note">اختر ما يناسب خطتك</span></div><div className="package-strip">{packages.slice(0, 4).map((pkg, index) => <article className="package-tile" key={pkg.id}><span className="package-number">0{index + 1}</span><h3>{pkg.name}</h3><p>{pkg.description}</p><div className="package-tile-meta"><span><Clock3 size={15} />{durationLabel(pkg.duration_minutes)}</span><Price value={pkg.price} compact /></div><span className="package-bar" /></article>)}</div></section>}

      <section className="trust-section section-wrap"><div className="trust-heading"><span className="eyebrow">نهتم بما يهمك</span><h2>راحةٌ في كل<br /><em>خطوة من الرحلة.</em></h2></div><div className="trust-grid"><div><ShieldCheck /><strong>حجز واضح</strong><p>السعر والتفاصيل أمامك قبل التأكيد.</p></div><div><Sparkles /><strong>عناية بالتفاصيل</strong><p>مساحات مجهّزة لتبدأ وقتك براحة.</p></div><div><MessageCircle /><strong>نحن قريبون</strong><p>استفسارك يصل مباشرة إلى فريق المنتجع.</p></div></div></section>

      {reviews.length > 0 && <section className="review-section"><div className="section-wrap"><div className="section-heading-row"><div><span className="eyebrow">من ضيوفنا</span><h2>لحظات تستحق أن تُروى</h2></div><div className="review-score"><Star size={17} fill="currentColor" /><span>{(reviews.reduce((total, review) => total + review.rating, 0) / reviews.length).toFixed(1)}</span><small>متوسط التقييم</small></div></div><div className="review-grid">{reviews.map((review, index) => <article className="review-quote" key={review.id}><div className="review-stars">{Array.from({ length: review.rating }, (_, star) => <Star key={star} size={14} fill="currentColor" />)}</div><p>“{review.body || 'كانت تجربة جميلة، ونأمل أن نعود مرة أخرى.'}”</p><span>ضيف {index + 1} · {dateLabel(review.created_at, { month: 'long', year: 'numeric' })}</span></article>)}</div></div></section>}

      {faqs.length > 0 && <section className="section-wrap faq-section"><div className="section-heading-row"><div><span className="eyebrow">إجابات تهمك</span><h2>قبل أن تحجز</h2></div><CircleHelp className="faq-icon" /></div><div className="faq-list">{faqs.map((item) => <details key={item.id}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div></section>}

      <section className="final-cta"><span className="eyebrow">لحظتك تبدأ هنا</span><h2>امنح وقتك<br /><em>مساحة أوسع.</em></h2><Link to="/units" className="button button-light">اكتشف الاستراحات <ArrowLeft size={17} /></Link></section>
    </main>
  </>
}

export function UnitsPage() {
  const [units, setUnits] = useState<UnitData[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [capacity, setCapacity] = useState('')
  const [poolOnly, setPoolOnly] = useState(false)
  const [sort, setSort] = useState('recommended')
  useEffect(() => {
    let active = true
    if (!supabaseConfigured) { setLoading(false); return }
    fetchUnits().then((rows) => { if (active) setUnits(rows) }).catch(() => toast('تعذر تحميل الاستراحات.', 'error')).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => units.filter((unit) => unit.name.toLocaleLowerCase('ar').includes(query.toLocaleLowerCase('ar')) && (!capacity || unit.max_guests >= Number(capacity)) && (!poolOnly || unit.has_pool)).sort((a, b) => sort === 'price-low' ? a.base_price - b.base_price : sort === 'capacity' ? b.max_guests - a.max_guests : a.sort_order - b.sort_order), [units, query, capacity, poolOnly, sort])

  return <main className="inner-page section-wrap">
    <PageIntro eyebrow="أماكن صنعت للراحة" title="استراحاتنا" body="لكل استراحة طابعها الخاص. تعرّف على تفاصيلها واختر المساحة الأقرب إلى يومك." />
    <div className="units-toolbar"><label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم الاستراحة" /></label><label className="select-field"><SlidersHorizontal size={17} /><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">الترتيب المقترح</option><option value="price-low">السعر: الأقل أولاً</option><option value="capacity">الأكثر سعة</option></select></label><label className="select-field capacity-filter"><Users size={17} /><select value={capacity} onChange={(event) => setCapacity(event.target.value)}><option value="">كل السعات</option><option value="4">4 أشخاص فأكثر</option><option value="8">8 أشخاص فأكثر</option><option value="12">12 شخصًا فأكثر</option></select></label><label className={`filter-toggle ${poolOnly ? 'checked' : ''}`}><input type="checkbox" checked={poolOnly} onChange={(event) => setPoolOnly(event.target.checked)} /><Waves size={16} /> مسبح</label></div>
    {loading ? <div className="page-loader"><Busy label="نبحث عن المساحة المناسبة" /></div> : filtered.length ? <div className="unit-grid units-grid-page">{filtered.map((unit, index) => <UnitCard key={unit.id} unit={unit} index={index} />)}</div> : <EmptyState title={units.length ? 'لا توجد نتائج مطابقة' : 'تُجهّز الاستراحات لاستقبالك'} body={units.length ? 'جرّب تعديل البحث أو إزالة بعض الفلاتر.' : 'سيتم عرض الاستراحات هنا بعد أن يضيفها مالك المنتجع.'} action={units.length ? <Button variant="outline" onClick={() => { setQuery(''); setCapacity(''); setPoolOnly(false) }}>إزالة الفلاتر</Button> : <Link className="text-link" to="/inquiry">استفسر عن التوفر <ChevronLeft size={16} /></Link>} />}
  </main>
}

export function UnitDetailsPage() {
  const { slug } = useParams()
  const [unit, setUnit] = useState<UnitData | null>(null)
  const [packages, setPackages] = useState<ResortPackage[]>([])
  const [addons, setAddons] = useState<AddOn[]>([])
  const [reviews, setReviews] = useState<{ id: string; rating: number; body: string; created_at: string }[]>([])
  const [settings, setSettings] = useState<ResortSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    if (!slug || !supabaseConfigured) { setLoading(false); return }
    const load = async () => {
      const unitResult = await supabase.from('units').select('*,unit_media(*),unit_amenities(amenities(*))').eq('slug', slug).eq('published', true).maybeSingle()
      if (unitResult.error) throw unitResult.error
      const current = unitResult.data as unknown as UnitData | null
      if (!active) return
      setUnit(current)
      if (!current) return
      const [packageResult, settingsResult, addonResult, reviewResult] = await Promise.all([
        supabase.from('packages').select('*,package_features(*),package_units!inner(unit_id)').eq('active', true).eq('package_units.unit_id', current.id),
        supabase.from('resort_settings').select('*').eq('id', true).maybeSingle(),
        supabase.from('add_ons').select('*,unit_add_ons!inner(unit_id),package_add_ons(package_id)').eq('active', true).eq('unit_add_ons.unit_id', current.id),
        supabase.from('reviews').select('id,rating,body,created_at').eq('unit_id', current.id).eq('status', 'published').order('created_at', { ascending: false }).limit(12),
      ])
      if (!active) return
      setPackages((packageResult.data ?? []) as unknown as ResortPackage[])
      setSettings(settingsResult.data as ResortSettings | null)
      setAddons((addonResult.data ?? []) as unknown as AddOn[])
      setReviews((reviewResult.data ?? []) as typeof reviews)
    }
    load().catch(() => toast('تعذر تحميل تفاصيل الاستراحة.', 'error')).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [slug])

  const images = useMemo(() => [...(unit?.unit_media ?? [])].sort((a, b) => Number(Boolean(b.is_cover)) - Number(Boolean(a.is_cover)) || a.sort_order - b.sort_order), [unit])
  const share = async () => {
    const shareData = { title: unit?.name, text: unit?.short_description, url: window.location.href }
    try { if (navigator.share) await navigator.share(shareData); else { await navigator.clipboard.writeText(shareData.url); toast('نُسخ رابط الاستراحة.', 'success') } } catch { /* sharing can be cancelled by the visitor */ }
  }

  if (loading) return <main className="inner-page"><Busy label="نفتح لك تفاصيل الاستراحة" /></main>
  if (!unit) return <main className="inner-page section-wrap"><EmptyState title="لم نعثر على هذه الاستراحة" body="قد يكون الرابط قد تغيّر أو أن الاستراحة لم تعد معروضة." action={<Link className="text-link" to="/units">العودة للاستراحات <ChevronLeft size={16} /></Link>} /></main>

  return <main className="detail-page section-wrap">
    <div className="detail-topline"><div className="breadcrumbs"><Link to="/">الرئيسية</Link><ChevronLeft size={14} /><Link to="/units">الاستراحات</Link><ChevronLeft size={14} /><span>{unit.name}</span></div><div className="detail-actions"><button className="round-action" onClick={share}><Share2 size={17} /><span>مشاركة</span></button><FavoriteButton unitId={unit.id} className="round-action" /></div></div>
    <div className="detail-title"><div><span className="eyebrow">مساحة خاصة بك</span><h1>{unit.name}</h1><p><MapPin size={15} />{settings?.address || 'المملكة العربية السعودية'} <span className="dot" /> <Users size={15} />حتى {unit.max_guests} ضيوف</p></div><div className="detail-rate"><Price value={unit.base_price} /><small>قيمة الاستراحة الأساسية</small></div></div>
    <div className={`detail-gallery gallery-count-${Math.min(images.length || 1, 4)}`}>
      {images.length ? images.slice(0, 4).map((image, index) => <button className={`gallery-image gallery-image-${index + 1}`} key={image.id || image.storage_path} onClick={() => setGalleryIndex(index)}><img src={imageUrl(image.storage_path, placeholderImages.detail)} alt={image.alt_text || unit.name} />{index === 3 && images.length > 4 && <span className="gallery-more">+{images.length - 4} صور</span>}</button>) : <button className="gallery-image gallery-image-1 fallback-gallery" onClick={() => setGalleryIndex(0)}><img src={placeholderImages.unit} alt="صورة إرشادية قابلة للاستبدال من لوحة المالك" /><span className="gallery-placeholder-note">صورة إرشادية مؤقتة</span></button>}
      <button className="gallery-all" onClick={() => setGalleryIndex(0)}><Images size={16} />عرض الصور</button>
    </div>
    <div className="detail-columns"><div className="detail-main">
      <section className="detail-block detail-summary"><div><span className="eyebrow">عن الاستراحة</span><h2>{unit.short_description || 'مساحة تليق بوقتك'}</h2></div><p>{unit.description || 'أضف وصفًا تفصيليًا لهذه الاستراحة من لوحة المالك ليطّلع الضيوف على خصائصها وشروط استخدامها.'}</p></section>
      <section className="detail-block"><span className="eyebrow">تفاصيل المساحة</span><div className="spec-grid"><div><Users /><span>السعة</span><strong>حتى {unit.max_guests} ضيوف</strong></div>{unit.area_sqm && <div><Maximize /><span>المساحة</span><strong>{unit.area_sqm} م²</strong></div>}<div><BedDouble /><span>غرف النوم</span><strong>{unit.bedrooms} غرف</strong></div><div><Bath /><span>دورات المياه</span><strong>{unit.bathrooms} دورات</strong></div><div><Waves /><span>المسبح</span><strong>{unit.has_pool ? 'متوفر' : 'غير متوفر'}</strong></div></div></section>
      {!!unit.unit_amenities?.length && <section className="detail-block"><span className="eyebrow">مرافق الاستراحة</span><div className="amenity-detail-grid">{unit.unit_amenities.map(({ amenities: amenity }) => <div key={amenity.id}><span className="amenity-icon"><Sparkles size={18} /></span>{amenity.name}</div>)}</div></section>}
      {packages.length > 0 && <section className="detail-block"><span className="eyebrow">خيارات الإقامة</span><h2>الباقات المتاحة</h2><div className="detail-package-list">{packages.map((pkg) => <article key={pkg.id}><div><strong>{pkg.name}</strong><p>{pkg.description}</p><span><Clock3 size={14} />{durationLabel(pkg.duration_minutes)}</span></div><Price value={pkg.price} /></article>)}</div></section>}
      {!!addons.length && <section className="detail-block"><span className="eyebrow">لإضافة لمستك الخاصة</span><h2>خدمات إضافية</h2><div className="addon-preview-list">{addons.map((addon) => <div key={addon.id}><span className="amenity-icon"><Sparkles size={17} /></span><div><strong>{addon.name}</strong><small>{addon.description}</small></div><Price value={addon.price} compact /></div>)}</div></section>}
      {reviews.length > 0 && <section className="detail-block"><span className="eyebrow">تجارب الضيوف</span><h2>آراء موثّقة</h2><div className="detail-reviews">{reviews.map((review) => <article key={review.id}><span className="review-stars">{Array.from({ length: review.rating }, (_, i) => <Star key={i} size={13} fill="currentColor" />)}</span><p>{review.body || 'تجربة جميلة.'}</p><small>{dateLabel(review.created_at)}</small></article>)}</div></section>}
      <section className="detail-block location-block"><div><span className="eyebrow">الموقع والوصول</span><h2>نلتقي بك هنا</h2><p>{settings?.address || 'موقع المنتجع سيظهر بعد تحديث بيانات الموقع.'}</p></div>{settings?.map_url && <a className="button button-outline" href={settings.map_url} target="_blank" rel="noreferrer">افتح الخريطة <MapPin size={16} /></a>}{!settings?.map_url && settings?.latitude && settings.longitude && <a className="button button-outline" href={`https://maps.google.com/?q=${settings.latitude},${settings.longitude}`} target="_blank" rel="noreferrer">الاتجاهات <MapPin size={16} /></a>}</section>
    </div><aside className="booking-aside"><div className="booking-aside-inner"><span className="eyebrow">اجعلها موعدك القادم</span><h3>مساحتك<br />تنتظرك.</h3><div className="aside-price"><Price value={unit.base_price} /><small>السعر الأساسي للاستراحة</small></div><div className="aside-note"><Check size={16} /> أسعار الباقات والخدمات تظهر قبل تأكيد الحجز</div><Link to={`/book/${unit.id}`} className="button button-primary button-block">تحقق من التوفر <ArrowLeft size={17} /></Link><Link to="/inquiry" className="button button-ghost button-block">استفسر عن الاستراحة <MessageCircle size={17} /></Link>{settings?.phone && <a href={`tel:${settings.phone}`} className="aside-contact">تفضل الحديث معنا؟ <span>اتصل بنا</span></a>}</div></aside></div>
    {galleryIndex !== null && <div className="lightbox" role="dialog" aria-modal="true" aria-label="معرض صور الاستراحة"><button className="lightbox-close" onClick={() => setGalleryIndex(null)} aria-label="إغلاق"><X /></button><button className="lightbox-nav lightbox-prev" aria-label="الصورة السابقة" onClick={() => setGalleryIndex((galleryIndex + Math.max(images.length, 1) - 1) % Math.max(images.length, 1))}><ChevronRight /></button><img src={images.length ? imageUrl(images[galleryIndex]?.storage_path, placeholderImages.detail) : placeholderImages.unit} alt={images[galleryIndex]?.alt_text || unit.name} /><button className="lightbox-nav lightbox-next" aria-label="الصورة التالية" onClick={() => setGalleryIndex((galleryIndex + 1) % Math.max(images.length, 1))}><ChevronLeft /></button><span className="lightbox-count">{galleryIndex + 1} / {Math.max(images.length, 1)}</span></div>}
  </main>
}

export function InquiryPage() {
  const [search] = useSearchParams()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const unitId = search.get('unit_id')
  const packageId = search.get('package_id')
  useEffect(() => {
    if (supabaseConfigured) supabase.from('resort_settings').select('demo_mode').eq('id', true).maybeSingle()
      .then(({ data }) => setDemoMode(Boolean(data?.demo_mode)))
  }, [])
  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (demoMode) return toast('هذه معاينة تجريبية ولا ترسل استفسارات فعلية.', 'error')
    const normalizedPhone = normalizePhone(phone)
    if (name.trim().length < 2 || !isSaudiMobile(normalizedPhone) || message.trim().length < 5) return toast('أكمل الاسم ورقم الجوال ورسالتك بشكل صحيح.', 'error')
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('inquiries').insert({ name: name.trim(), phone: normalizedPhone, message: message.trim(), customer_id: user?.id ?? null, unit_id: unitId, package_id: packageId })
    setBusy(false)
    if (error) return toast(supabaseConfigured ? 'تعذر إرسال الاستفسار. حاول مجددًا.' : 'أكمل إعداد Supabase أولاً.', 'error')
    setSent(true)
  }
  return <main className="inner-page section-wrap inquiry-page"><PageIntro eyebrow="نحن هنا للمساعدة" title="دعنا نرتّب التفاصيل" body="أرسل سؤالك وسيصل مباشرة إلى فريق المنتجع. نعود إليك على رقم الجوال الذي تكتبه." /><div className="form-card inquiry-card">{sent ? <EmptyState title="وصلنا استفسارك" body="شكرًا لثقتك. سيتواصل معك فريق المنتجع قريبًا." action={<Link className="text-link" to="/">العودة للرئيسية <ChevronLeft size={16} /></Link>} /> : <form onSubmit={send}>{demoMode && <div className="demo-notice">معاينة تجريبية: لن يتم إرسال بيانات أو إنشاء استفسار.</div>}<label>الاسم<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label><label>رقم الجوال<input type="tel" inputMode="tel" placeholder="05xxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label><label>كيف نقدر نساعدك؟<textarea rows={5} value={message} onChange={(event) => setMessage(event.target.value)} minLength={5} maxLength={3000} required /></label><Button type="submit" disabled={busy || demoMode}>{busy ? 'جارٍ الإرسال…' : 'إرسال الاستفسار'} <ArrowLeft size={16} /></Button></form>}</div></main>
}

export function PolicyPage() {
  const { policy } = useParams()
  const [settings, setSettings] = useState<ResortSettings | null>(null)
  useEffect(() => { if (supabaseConfigured) supabase.from('resort_settings').select('*').eq('id', true).maybeSingle().then(({ data }) => setSettings(data as ResortSettings | null)) }, [])
  const pages: Record<string, { title: string; content?: string }> = {
    terms: { title: 'الشروط والأحكام وسياسة الإلغاء', content: [settings?.terms, settings?.cancellation_policy].filter(Boolean).join('\n\n') },
    privacy: { title: 'سياسة الخصوصية', content: settings?.privacy_policy },
    cancellation: { title: 'سياسة الإلغاء', content: settings?.cancellation_policy },
    refund: { title: 'سياسة الاسترداد', content: settings?.refund_policy },
    arrival: { title: 'التأخير وتعليمات الزيارة', content: settings?.late_policy },
  }
  const page = pages[policy ?? 'terms'] ?? pages.terms
  const title = page.title
  const content = page.content
  return <main className="inner-page section-wrap policy-page"><PageIntro eyebrow="معلومات تهمك" title={title} body="نحرص على وضوح المعلومات قبل إتمام الحجز." /><article className="policy-copy">{content ? content.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>) : <EmptyState title="السياسة قيد الإعداد" body="سيضيف مالك المنتجع النص المعتمد هنا قبل إتاحة الحجوزات." />}</article></main>
}

export function SetupPage() {
  return <main className="inner-page section-wrap setup-page"><PageIntro eyebrow="جاهزية التشغيل" title="إعداد المشروع" body="التطبيق يقرأ بياناته مباشرة من Supabase. أكمل الخطوات التالية في نسخة المشروع قبل استقبال العملاء." /><div className="setup-steps"><article><span>01</span><div><h3>أضف المفتاح العام</h3><p>انسخ <code>.env.example</code> إلى <code>.env.local</code> وأضف مفتاح anon/publishable من إعدادات مشروع Supabase. لا تستخدم مفتاح service_role في المتصفح.</p></div></article><article><span>02</span><div><h3>طبّق مخطط قاعدة البيانات</h3><p>نفّذ ملف الترحيل داخل <code>supabase/migrations</code> من Supabase CLI أو SQL Editor، ثم انشر دوال Edge Functions.</p></div></article><article><span>03</span><div><h3>جهّز حساب المالك</h3><p>أنشئ حسابك، ثم استخدم صفحة تهيئة المالك مرة واحدة بعد إضافة سر التهيئة في إعدادات الدوال.</p><Link to="/owner-setup" className="text-link">تهيئة حساب المالك <ChevronLeft size={16} /></Link></div></article><article><span>04</span><div><h3>أدخل بيانات المنتجع</h3><p>من لوحة المالك أضف الاستراحات والصور والأسعار والباقات والتوافر ووسائل التواصل والسياسات.</p></div></article></div></main>
}
