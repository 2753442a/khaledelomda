import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors })
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return Response.json({ error: 'يلزم تسجيل الدخول.' }, { status: 401, headers: cors })

  let body: { booking_id?: string; payment_id?: string }
  try { body = await request.json() } catch { return Response.json({ error: 'طلب غير صالح.' }, { status: 400, headers: cors }) }
  if (!body.booking_id || !body.payment_id || !/^[a-zA-Z0-9_-]{4,100}$/.test(body.payment_id)) {
    return Response.json({ error: 'بيانات الدفع غير مكتملة.' }, { status: 400, headers: cors })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const secret = Deno.env.get('MOYASAR_SECRET_KEY')
  if (!secret) return Response.json({ error: 'التحقق من الدفع غير مهيأ.' }, { status: 503, headers: cors })
  const admin = createClient(url, serviceKey)
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return Response.json({ error: 'انتهت الجلسة.' }, { status: 401, headers: cors })

  const { data: booking, error: bookingError } = await admin.from('bookings')
    .select('id,customer_id,booking_number,total_amount,status,payment_status,payment_method,hold_expires_at')
    .eq('id', body.booking_id).eq('customer_id', user.id).single()
  if (bookingError || !booking || booking.payment_method !== 'online') {
    return Response.json({ error: 'الحجز غير موجود.' }, { status: 404, headers: cors })
  }
  if (booking.status === 'confirmed' && booking.payment_status === 'paid') {
    return Response.json({ status: 'paid' }, { headers: cors })
  }
  if (booking.status !== 'pending' || !booking.hold_expires_at || new Date(booking.hold_expires_at) <= new Date()) {
    return Response.json({ error: 'انتهت مهلة الحجز؛ تواصل مع المنتجع قبل إعادة المحاولة.' }, { status: 409, headers: cors })
  }

  const providerResponse = await fetch(`https://api.moyasar.com/v1/payments/${encodeURIComponent(body.payment_id)}`, {
    headers: { Authorization: `Basic ${btoa(`${secret}:`)}` },
  })
  if (!providerResponse.ok) return Response.json({ error: 'تعذر التحقق من حالة الدفع.' }, { status: 502, headers: cors })
  const payment = await providerResponse.json()
  const expectedAmount = Math.round(Number(booking.total_amount) * 100)
  const associatedBooking = payment.metadata?.booking_id === booking.id
  if (payment.currency !== 'SAR' || payment.amount !== expectedAmount || !associatedBooking) {
    return Response.json({ error: 'بيانات الدفع لا تطابق الحجز.' }, { status: 409, headers: cors })
  }

  const paymentStatus = payment.status === 'paid' ? 'paid' : payment.status === 'failed' ? 'failed' : 'pending'
  const { error: saveError } = await admin.from('payments').upsert({
    booking_id: booking.id,
    customer_id: user.id,
    provider: 'moyasar',
    provider_reference: payment.id,
    amount: Number(booking.total_amount),
    currency: 'SAR',
    status: paymentStatus,
    provider_data: { status: payment.status },
  }, { onConflict: 'provider,provider_reference' })
  if (saveError) {
    console.error('Payment record could not be saved')
    return Response.json({ error: 'تعذر حفظ نتيجة الدفع.' }, { status: 500, headers: cors })
  }

  if (paymentStatus === 'paid') {
    const { data: confirmed, error } = await admin.from('bookings').update({
      status: 'confirmed', payment_status: 'paid', hold_expires_at: null,
    }).eq('id', booking.id).eq('status', 'pending').select('id').maybeSingle()
    if (error) return Response.json({ error: 'تم استلام الدفع لكن تعذر تأكيد الحجز. تواصل مع المنتجع.' }, { status: 500, headers: cors })
    if (!confirmed) {
      const { data: current } = await admin.from('bookings').select('status,payment_status').eq('id', booking.id).maybeSingle()
      if (current?.status !== 'confirmed' || current.payment_status !== 'paid') {
        return Response.json({ error: 'تم استلام الدفع لكن تعذر تأكيد الحجز. تواصل مع المنتجع.' }, { status: 409, headers: cors })
      }
    }
  } else if (paymentStatus === 'failed') {
    const { data: failedBooking, error: bookingUpdateError } = await admin.from('bookings')
      .update({ payment_status: 'failed' }).eq('id', booking.id).eq('status', 'pending').select('id').maybeSingle()
    if (bookingUpdateError) {
      console.error('Failed payment could not update booking state')
      return Response.json({ error: 'تم تسجيل فشل الدفع لكن تعذر تحديث حالة الحجز.' }, { status: 500, headers: cors })
    }
    if (!failedBooking) {
      const { data: current, error: currentError } = await admin.from('bookings')
        .select('payment_status').eq('id', booking.id).maybeSingle()
      if (currentError || current?.payment_status !== 'failed') {
        return Response.json({ error: 'تغيرت حالة الحجز أثناء التحقق من الدفع.' }, { status: 409, headers: cors })
      }
    }
  }
  return Response.json({ status: paymentStatus }, { headers: cors })
})
