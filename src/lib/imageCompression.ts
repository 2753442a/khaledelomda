import imageCompression from 'browser-image-compression'

export async function compressReceiptImage(file: File): Promise<File> {
  // First, try browser-image-compression
  const options = {
    maxSizeMB: 0.15, // 150KB
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.8,
  }

  try {
    const compressed = await imageCompression(file, options)
    return compressed
  } catch {
    // Fallback: canvas-based compression
    return canvasCompress(file)
  }
}

async function canvasCompress(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const MAX_W = 1200
      let w = img.width
      let h = img.height
      if (w > MAX_W) {
        h = Math.round((h * MAX_W) / w)
        w = MAX_W
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (!blob) { reject(new Error('فشل الضغط')); return }
          resolve(new File([blob], 'receipt.webp', { type: 'image/webp' }))
        },
        'image/webp',
        0.75
      )
    }
    img.onerror = reject
    img.src = url
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
