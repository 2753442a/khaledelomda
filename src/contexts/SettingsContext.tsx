import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface ResortSettings {
  id?: number
  resort_name: string
  deposit_percentage: number
  default_check_in_time: string
  default_check_out_time: string
  bank_name: string
  bank_account_name: string
  bank_iban: string
  contact_phone: string
  contact_whatsapp: string
  // Dynamic Hero & Content CMS
  hero_image_url: string
  hero_title: string
  hero_subtitle: string
  hero_badge: string
  stats_events: string
  stats_clients: string
  stats_days: string
  show_hero_stats: boolean
  location_address: string
  water_contact_phone: string
  water_contact_whatsapp: string
}

export const DEFAULT_RESORT_SETTINGS: ResortSettings = {
  id: 1,
  resort_name: 'منتجع وبستان خالد العمدة للاستثمار',
  deposit_percentage: 25,
  default_check_in_time: '15:30',
  default_check_out_time: '11:30',
  bank_name: 'مصرف الراجحي',
  bank_account_name: 'خالد العمدة',
  bank_iban: 'SA0000000000000000000000',
  contact_phone: '0543034553',
  contact_whatsapp: '0547382222',
  hero_image_url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=2000&q=80',
  hero_title: 'منتجع وبستان خالد العمدة',
  hero_subtitle: 'انغمس في تجربة استثنائية تجمع بين بستان النخيل والمسطحات الخضراء، والمسبح الفيروزي والألعاب المائية، ومجالس الضيافة الملكية في خصوصية تامة تلبي كافة تطلعاتكم.',
  hero_badge: '🌴💧 واحة الاسترخاء والمناسبات في قلب الطبيعة',
  stats_events: '+200',
  stats_clients: '+1000',
  stats_days: '365',
  show_hero_stats: true,
  location_address: 'المملكة العربية السعودية • موقع مميز وسهل الوصول',
  water_contact_phone: '0543034553',
  water_contact_whatsapp: '0547382222',
}

const SETTINGS_STORAGE_KEY = 'khaledelomda_resort_settings'

interface SettingsContextType {
  settings: ResortSettings
  loading: boolean
  refreshSettings: () => Promise<void>
  updateSettings: (newSettings: Partial<ResortSettings>) => Promise<{ success: boolean; error?: string }>
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_RESORT_SETTINGS,
  loading: true,
  refreshSettings: async () => {},
  updateSettings: async () => ({ success: true }),
})

export const useSettings = () => useContext(SettingsContext)

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ResortSettings>(() => {
    // Try local storage cache for instant rendering
    try {
      const cached = localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (cached) {
        return { ...DEFAULT_RESORT_SETTINGS, ...JSON.parse(cached) }
      }
    } catch (_) {}
    return DEFAULT_RESORT_SETTINGS
  })
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('resort_settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (!error && data) {
        const merged: ResortSettings = {
          ...DEFAULT_RESORT_SETTINGS,
          ...data,
          // Guarantee values exist even if columns are empty or null
          hero_image_url: data.hero_image_url || DEFAULT_RESORT_SETTINGS.hero_image_url,
          hero_title: data.hero_title || DEFAULT_RESORT_SETTINGS.hero_title,
          hero_subtitle: data.hero_subtitle || DEFAULT_RESORT_SETTINGS.hero_subtitle,
          hero_badge: data.hero_badge || DEFAULT_RESORT_SETTINGS.hero_badge,
          stats_events: data.stats_events || DEFAULT_RESORT_SETTINGS.stats_events,
          stats_clients: data.stats_clients || DEFAULT_RESORT_SETTINGS.stats_clients,
          stats_days: data.stats_days || DEFAULT_RESORT_SETTINGS.stats_days,
          show_hero_stats: data.show_hero_stats !== undefined ? Boolean(data.show_hero_stats) : true,
          location_address: data.location_address || DEFAULT_RESORT_SETTINGS.location_address,
          water_contact_phone: data.water_contact_phone || data.contact_phone || DEFAULT_RESORT_SETTINGS.water_contact_phone,
          water_contact_whatsapp: data.water_contact_whatsapp || data.contact_whatsapp || DEFAULT_RESORT_SETTINGS.water_contact_whatsapp,
        }
        setSettings(merged)
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged))
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Could not fetch settings from Supabase, using defaults:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = async (newSettings: Partial<ResortSettings>): Promise<{ success: boolean; error?: string }> => {
    const updated: ResortSettings = {
      ...settings,
      ...newSettings,
      id: 1,
    }

    // Optimistic update
    setSettings(updated)
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated))
    } catch (_) {}

    try {
      // 1. First attempt full update
      const { error } = await supabase
        .from('resort_settings')
        .update(updated)
        .eq('id', 1)

      if (error) {
        // If some columns do not exist in older table schema, fallback to base columns
        console.warn('Full settings update notice:', error.message)
        const basePayload = {
          resort_name: updated.resort_name,
          deposit_percentage: updated.deposit_percentage,
          default_check_in_time: updated.default_check_in_time,
          default_check_out_time: updated.default_check_out_time,
          bank_name: updated.bank_name,
          bank_account_name: updated.bank_account_name,
          bank_iban: updated.bank_iban,
          contact_phone: updated.contact_phone,
          contact_whatsapp: updated.contact_whatsapp,
        }
        const { error: baseError } = await supabase
          .from('resort_settings')
          .update(basePayload)
          .eq('id', 1)

        if (baseError) {
          return { success: false, error: baseError.message }
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || 'تعذر حفظ الإعدادات' }
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}
