import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'

export interface PresetImage {
  id: string
  title: string
  category: 'pool' | 'orchard' | 'lawn' | 'majlis' | 'suite' | 'scooters' | 'water' | 'night'
  url: string
}

export const PRESET_RESORT_IMAGES: PresetImage[] = [
  {
    id: 'p-hero-pool',
    title: 'المسبح الفيروزي والبستان الملكي (بانوراما)',
    category: 'pool',
    url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=2000&q=80',
  },
  {
    id: 'p-night-lights',
    title: 'سحر الإضاءة المسائية والبيرغولا',
    category: 'night',
    url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2000&q=80',
  },
  {
    id: 'p-palms-walk',
    title: 'بستان النخيل ومسارات المشي الفسيحة',
    category: 'orchard',
    url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'p-green-lawn',
    title: 'المسطحات الخضراء وجلسات الاحتفالات',
    category: 'lawn',
    url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'p-vip-majlis',
    title: 'مجلس الضيافة الملكي الفاخر VIP',
    category: 'majlis',
    url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'p-master-suite',
    title: 'جناح الماستر الفندقي المعاصر',
    category: 'suite',
    url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'p-scooters',
    title: 'سكوترات الجولات الترفيهية بالبستان',
    category: 'scooters',
    url: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'p-water-truck',
    title: 'وايت مياه عذبة نقية للمنازل',
    category: 'water',
    url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'p-modern-resort',
    title: 'واجهة المنتجع المعمارية الحديثة',
    category: 'pool',
    url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80',
  },
]

/**
 * Compresses an image file in browser to WebP format.
 */
export async function compressImage(
  file: File,
  options: { maxWidth?: number; quality?: number; maxSizeMB?: number } = {}
): Promise<File> {
  const maxWidth = options.maxWidth || 1600
  const quality = options.quality || 0.82
  const maxSizeMB = options.maxSizeMB || 0.45 // ~450KB max

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight: maxWidth,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: quality,
    })
    return compressed
  } catch (err) {
    // Canvas fallback
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width
        let h = img.height
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w)
          w = maxWidth
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file)
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          blob => {
            URL.revokeObjectURL(url)
            if (!blob) {
              resolve(file)
              return
            }
            resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' }))
          },
          'image/webp',
          quality
        )
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(file)
      }
      img.src = url
    })
  }
}

/**
 * Converts a File or Blob into a Base64 data URL string.
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Uploads an image to Supabase Storage with graceful fallback to Base64.
 * Tries buckets 'resort-media' then 'receipts'. If both fail (e.g. no bucket exists),
 * it returns the compressed Base64 data URL directly, guaranteeing it ALWAYS works!
 */
export async function uploadImageToSupabase(
  file: File,
  bucketName = 'resort-media',
  folder = 'uploads'
): Promise<{ url: string; source: 'storage' | 'base64'; size: number }> {
  // Compress first
  const compressed = await compressImage(file)
  const size = compressed.size

  const ext = 'webp'
  const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
  const filePath = `${folder}/${Date.now()}_${cleanName}.${ext}`

  // Try primary bucket
  try {
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, compressed, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (!uploadError) {
      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)
      if (data?.publicUrl) {
        return { url: data.publicUrl, source: 'storage', size }
      }
    }
  } catch (e) {
    // Continue to fallback
  }

  // Try secondary fallback bucket 'receipts'
  try {
    const { error: fallbackError } = await supabase.storage
      .from('receipts')
      .upload(filePath, compressed, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (!fallbackError) {
      const { data } = supabase.storage.from('receipts').getPublicUrl(filePath)
      if (data?.publicUrl) {
        return { url: data.publicUrl, source: 'storage', size }
      }
    }
  } catch (e) {
    // Continue to Base64 fallback
  }

  // Guaranteed fallback: Base64 Data URL
  const dataUrl = await fileToDataUrl(compressed)
  return { url: dataUrl, source: 'base64', size }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
