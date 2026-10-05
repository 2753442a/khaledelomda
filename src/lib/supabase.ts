import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Database = {
  public: {
    Tables: {
      resort_settings: {
        Row: {
          id: number
          resort_name: string
          deposit_percentage: number
          default_check_in_time: string
          default_check_out_time: string
          bank_name: string
          bank_account_name: string
          bank_iban: string
          contact_phone: string
          contact_whatsapp: string
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          phone: string
          role: 'customer' | 'admin'
          is_flagged: boolean
          is_blacklisted: boolean
          cancellation_count: number
          created_at: string
        }
      }
      properties: {
        Row: {
          id: string
          name: string
          description: string | null
          weekday_price: number
          weekend_price: number
          images: string[]
          video_url: string | null
          amenities: string[]
          max_guests: number
          is_active: boolean
          created_at: string
        }
      }
      addons: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          total_inventory: number
          icon: string
          is_active: boolean
        }
      }
      bookings: {
        Row: {
          id: string
          property_id: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          booking_date: string
          check_in: string
          check_out: string
          total_amount: number
          deposit_amount: number
          payment_method: 'bank_transfer' | 'cash_on_arrival' | null
          payment_receipt_url: string | null
          status: 'pending_receipt' | 'pending_verification' | 'confirmed' | 'cancelled' | 'completed' | 'expired'
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
        }
      }
      booking_addons: {
        Row: {
          id: string
          booking_id: string
          addon_id: string
          quantity: number
          unit_price: number
        }
      }
    }
  }
}
