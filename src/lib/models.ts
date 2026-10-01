export type ResortSettings = {
  name: string
  tagline: string
  about: string
  logo_path: string | null
  hero_path: string | null
  phone: string
  whatsapp: string
  email: string
  address: string
  latitude: number | null
  longitude: number | null
  instagram_url: string
  map_url: string
  timezone: string
  cancellation_hours: number
  cancellation_policy: string
  refund_policy: string
  late_policy: string
  terms: string
  privacy_policy: string
  arrival_instructions: string
  online_payments_enabled: boolean
  cash_enabled: boolean
  bank_transfer_enabled: boolean
  bank_name: string
  bank_beneficiary: string
  bank_iban: string
  bank_transfer_hold_hours: number
  demo_mode: boolean
}

export type Amenity = { id: string; name: string; icon: string; sort_order: number }
export type Media = { id?: string; unit_id?: string; storage_path: string; alt_text: string; is_cover?: boolean; sort_order: number }
export type Feature = { id: string; feature: string; sort_order: number }

export type Unit = {
  id: string
  slug: string
  name: string
  short_description: string
  description: string
  max_guests: number
  area_sqm: number | null
  bedrooms: number
  bathrooms: number
  has_pool: boolean
  base_price: number
  published: boolean
  sort_order: number
  unit_media?: Media[]
  unit_amenities?: { amenity_id?: string; amenities: Amenity }[]
}

export type ResortPackage = {
  id: string
  name: string
  description: string
  duration_minutes: number
  start_window_start: string
  start_window_end: string
  price: number
  image_path: string | null
  active: boolean
  package_features?: Feature[]
  package_units?: { unit_id: string }[]
}

export type AddOn = {
  id: string
  name: string
  description: string
  price: number
  image_path: string | null
  active: boolean
  required: boolean
  unit_add_ons?: { unit_id: string }[]
  package_add_ons?: { package_id: string }[]
}

export type Booking = {
  id: string
  booking_number: number
  customer_id: string
  unit_id: string
  package_id: string
  starts_at: string
  ends_at: string
  guest_count: number
  guest_name: string
  guest_phone: string
  unit_name_snapshot: string
  package_name_snapshot: string
  unit_amount: number
  package_amount: number
  addons_amount: number
  discount_amount: number
  total_amount: number
  status: 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'expired'
  payment_method: 'cash' | 'bank_transfer' | 'online'
  payment_status: string
  hold_expires_at: string | null
  admin_note?: string
  created_at: string
}

export const placeholderImages = {
  hero: '/images/hero-taif-resort.jpg',
  unit: '/images/unit-pool-villa.jpg',
  detail: '/images/detail-pool-palms.jpg',
}

export const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(Number(value ?? 0))

export const dateLabel = (value: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Intl.DateTimeFormat('ar-SA', { ...options, timeZone: 'Asia/Riyadh' }).format(new Date(value))

export const timeLabel = (value: string) =>
  new Intl.DateTimeFormat('ar-SA', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(value))

export const durationLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return [hours ? `${hours} ساعات` : '', remaining ? `${remaining} دقيقة` : ''].filter(Boolean).join(' و')
}

export const imageUrl = (path?: string | null, fallback = placeholderImages.unit) => {
  if (!path) return fallback
  if (/^https?:\/\//i.test(path)) return path
  const { data } = window.__supabase.storage.from('resort-media').getPublicUrl(path)
  return data.publicUrl
}

export const normalizePhone = (value: string) => {
  const digits = value.replace(/[\s()-]/g, '')
  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`
  if (/^9665\d{8}$/.test(digits)) return `+${digits}`
  return digits
}

export const isSaudiMobile = (value: string) => /^\+9665\d{8}$/.test(normalizePhone(value))

export const statusLabel: Record<Booking['status'], string> = {
  pending: 'بانتظار الإجراء', confirmed: 'مؤكد', checked_in: 'جارٍ الآن', completed: 'مكتمل', cancelled: 'ملغي', expired: 'انتهت المهلة',
}

export const statusTone: Record<Booking['status'], string> = {
  pending: 'amber', confirmed: 'green', checked_in: 'green', completed: 'stone', cancelled: 'rose', expired: 'stone',
}

import type { SupabaseClient } from '@supabase/supabase-js'

declare global {
  interface Window {
    __supabase: SupabaseClient
    Moyasar?: { init: (options: Record<string, unknown>) => void }
  }
}
