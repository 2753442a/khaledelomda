import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './supabase'
import { isSaudiMobile, normalizePhone } from './models'

type Profile = { id: string; full_name: string; phone: string; role: 'customer' | 'owner' }
type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (phone: string, password: string) => Promise<void>
  signUp: (name: string, phone: string, password: string, pin: string) => Promise<void>
  signOut: () => Promise<void>
  updateName: (name: string) => Promise<void>
  changePin: (pin: string) => Promise<void>
  changePassword: (password: string) => Promise<void>
  recoverPassword: (phone: string, pin: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const emailForPhone = (phone: string) => `${phone.replace(/\D/g, '')}@accounts.rawdat-alwadi.invalid`

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }
    let receivedAuthEvent = false
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true
      setSession(nextSession)
      if (active) setLoading(false)
    })
    supabase.auth.getSession().then(({ data }) => {
      if (active && !receivedAuthEvent) setSession(data.session)
    }).catch(() => {
      if (active && !receivedAuthEvent) setSession(null)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    setProfile(null)
    if (!session?.user) {
      return
    }
    let active = true
    supabase.from('profiles').select('id,full_name,phone,role').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => { if (active) setProfile(data as Profile | null) })
    return () => { active = false }
  }, [session?.user.id])

  const requireConfigured = () => {
    if (!supabaseConfigured) throw new Error('أكمل إعداد اتصال Supabase قبل استخدام الحسابات.')
  }

  const signIn = async (phone: string, password: string) => {
    requireConfigured()
    const normalized = normalizePhone(phone)
    if (!isSaudiMobile(normalized)) throw new Error('أدخل رقم جوال سعودي بصيغة 05xxxxxxxx أو +9665xxxxxxxx.')
    const { error } = await supabase.auth.signInWithPassword({ email: emailForPhone(normalized), password })
    if (error) throw new Error('تعذر تسجيل الدخول. تحقق من البيانات ثم حاول مجددًا.')
  }

  const signUp = async (name: string, phone: string, password: string, pin: string) => {
    requireConfigured()
    const normalized = normalizePhone(phone)
    if (name.trim().length < 2) throw new Error('اكتب الاسم كما سيظهر في الحجوزات.')
    if (!isSaudiMobile(normalized)) throw new Error('أدخل رقم جوال سعودي بصيغة 05xxxxxxxx أو +9665xxxxxxxx.')
    if (password.length < 10) throw new Error('كلمة المرور يجب أن تتكون من 10 أحرف على الأقل.')
    if (!/^\d{4}$/.test(pin)) throw new Error('رقم PIN يجب أن يتكون من أربعة أرقام.')
    const { data, error } = await supabase.auth.signUp({
      email: emailForPhone(normalized),
      password,
      options: { data: { full_name: name.trim(), phone: normalized } },
    })
    if (error) throw new Error('تعذر إنشاء الحساب. تأكد من الرقم أو جرّب تسجيل الدخول.')
    if (!data.session) throw new Error('تعذر إنشاء جلسة الحساب. عطّل تأكيد البريد في إعدادات Supabase وأعد المحاولة.')
    const { error: pinError } = await supabase.rpc('set_recovery_pin', { p_pin: pin })
    if (pinError) throw new Error('تم إنشاء الحساب لكن تعذر حفظ PIN؛ من حسابي اختر تعيين PIN مرة أخرى.')
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const updateName = async (name: string) => {
    requireConfigured()
    if (!session?.user || name.trim().length < 2) throw new Error('اكتب اسمًا صحيحًا.')
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', session.user.id)
    if (error) throw new Error('تعذر تحديث الاسم.')
    setProfile((current) => current ? { ...current, full_name: name.trim() } : current)
  }

  const changePin = async (pin: string) => {
    requireConfigured()
    if (!/^\d{4}$/.test(pin)) throw new Error('PIN يجب أن يتكون من أربعة أرقام.')
    const { error } = await supabase.rpc('set_recovery_pin', { p_pin: pin })
    if (error) throw new Error('تعذر تحديث PIN. تأكد من اتصال حسابك.')
  }

  const changePassword = async (password: string) => {
    requireConfigured()
    if (password.length < 10) throw new Error('كلمة المرور يجب أن تتكون من 10 أحرف على الأقل.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error('تعذر تغيير كلمة المرور.')
  }

  const recoverPassword = async (phone: string, pin: string, password: string) => {
    requireConfigured()
    const { error } = await supabase.functions.invoke('reset-password-pin', {
      body: { phone: normalizePhone(phone), pin, password },
    })
    if (error) throw new Error('تعذر إكمال الطلب. إن كانت البيانات صحيحة، جرّب تسجيل الدخول بكلمة المرور الجديدة.')
  }

  return <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signIn, signUp, signOut, updateName, changePin, changePassword, recoverPassword }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
