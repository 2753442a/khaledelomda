import { createClient } from '@supabase/supabase-js'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://dwvivykudgrulqntskqk.supabase.co'
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseConfigured = Boolean(configuredUrl && configuredKey)
const projectUrl = supabaseConfigured ? configuredUrl! : 'http://127.0.0.1:54321'
const publicKey = supabaseConfigured ? configuredKey! : 'local-development-placeholder'

export const supabase = createClient(projectUrl, publicKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  global: { headers: { 'x-application-name': 'khaled-alomda-resort' } },
})
window.__supabase = supabase
