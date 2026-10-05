import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  full_name: string
  phone: string
  role: 'customer' | 'admin'
  is_flagged: boolean
  is_blacklisted: boolean
  cancellation_count: number
  created_at: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (fullName: string, phone: string, password: string) => Promise<{ error: string | null }>
  signIn: (phone: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

const phoneToEmail = (phone: string) => {
  const clean = phone.replace(/[^0-9]/g, '')
  return `${clean}@khalidresort.com`
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (!error && data) {
        setProfile(data)
      }
    } catch (e) {
      console.error('Error fetching profile:', e)
    }
  }

  useEffect(() => {
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      })
      return () => subscription.unsubscribe()
    } catch (e) {
      console.error('Auth state change listener error:', e)
      setLoading(false)
    }
  }, [])

  const signUp = async (fullName: string, phone: string, password: string) => {
    try {
      const cleanPhone = phone.replace(/\s/g, '')
      const email = phoneToEmail(cleanPhone)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: cleanPhone,
          },
        },
      })
      if (error) return { error: error.message }
      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName,
          phone: cleanPhone,
          role: 'customer',
        })
        if (profileError && !profileError.message.includes('duplicate')) {
          return { error: profileError.message }
        }
      }
      return { error: null }
    } catch (err: any) {
      return { error: err?.message || 'حدث خطأ غير متوقع أثناء إنشاء الحساب' }
    }
  }

  const signIn = async (phone: string, password: string) => {
    try {
      const email = phoneToEmail(phone)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: 'رقم الجوال أو كلمة المرور غير صحيحة' }
      return { error: null }
    } catch (err: any) {
      return { error: err?.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول' }
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('Error signing out:', e)
    } finally {
      setUser(null)
      setProfile(null)
    }
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
