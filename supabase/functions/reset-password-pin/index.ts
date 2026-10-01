import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const generic = { message: 'إذا كانت البيانات صحيحة، يمكنك الآن تجربة كلمة المرور الجديدة.' }

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors })

  let body: { phone?: string; pin?: string; password?: string }
  try { body = await request.json() } catch { return Response.json(generic, { status: 202, headers: cors }) }

  const phone = (body.phone ?? '').replace(/[\s()-]/g, '')
  const pin = body.pin ?? ''
  const password = body.password ?? ''
  if (!/^\+9665\d{8}$/.test(phone) || !/^\d{4}$/.test(pin) || password.length < 10 || password.length > 128) {
    return Response.json(generic, { status: 202, headers: cors })
  }

  const secret = Deno.env.get('RECOVERY_HASH_SECRET')
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secret || !url || !serviceKey) {
    console.error('Password recovery is not configured')
    return Response.json({ error: 'خدمة الاسترداد غير مهيأة حالياً.' }, { status: 503, headers: cors })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ipHash = await sha256(`${secret}:${ip}`)
  const admin = createClient(url, serviceKey)
  const { data: userId, error: verifyError } = await admin.rpc('consume_password_recovery', {
    p_phone: phone,
    p_pin: pin,
    p_ip_hash: ipHash,
  })
  if (verifyError) {
    console.error('Password recovery verification failed')
    return Response.json({ error: 'تعذر إكمال الطلب حالياً.' }, { status: 503, headers: cors })
  }
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) {
      console.error('Password recovery update failed')
      return Response.json({ error: 'تعذر إكمال الطلب حالياً.' }, { status: 503, headers: cors })
    }
  }
  return Response.json(generic, { status: 202, headers: cors })
})
