import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bootstrap-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors })

  const expected = Deno.env.get('OWNER_BOOTSTRAP_SECRET') ?? ''
  const provided = request.headers.get('x-bootstrap-secret') ?? ''
  if (!expected || !sameSecret(expected, provided)) {
    return Response.json({ error: 'تعذر إكمال التهيئة.' }, { status: 403, headers: cors })
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return Response.json({ error: 'يلزم تسجيل الدخول أولاً.' }, { status: 401, headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return Response.json({ error: 'انتهت الجلسة. سجّل الدخول مجدداً.' }, { status: 401, headers: cors })

  const { error } = await admin.rpc('claim_first_owner', { p_user_id: user.id })
  if (error) return Response.json({ error: 'تعذر تهيئة حساب المالك. قد يكون الإعداد اكتمل مسبقاً.' }, { status: 409, headers: cors })
  return Response.json({ ok: true }, { headers: cors })
})
