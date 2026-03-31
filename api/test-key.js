/**
 * /api/test-key
 * POST { provider, key }
 * Returns { ok, status, message }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  let body
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body }
  catch { return res.status(400).json({ ok: false, message: 'Invalid JSON' }) }

  const { provider, key } = body || {}
  if (!provider || !key) return res.status(400).json({ ok: false, message: 'Missing provider or key' })

  try {
    if (provider === 'rapidapi') {
      const r = await fetch(
        'https://tiktok-scraper7.p.rapidapi.com/user/posts?unique_id=tiktok&count=1&cursor=0',
        { headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com' }, signal: AbortSignal.timeout(8000) }
      )
      const d = await r.json().catch(() => ({}))
      if (d?.message?.toLowerCase().includes('exceeded') || d?.message?.toLowerCase().includes('quota'))
        return res.status(200).json({ ok: false, status: 'quota', message: 'الحصة الشهرية انتهت' })
      if (d?.message?.toLowerCase().includes('invalid') || r.status === 403)
        return res.status(200).json({ ok: false, status: 'invalid', message: 'مفتاح غير صحيح' })
      if (d?.code === 0 || d?.data)
        return res.status(200).json({ ok: true, status: 'active', message: 'المفتاح يعمل بشكل صحيح ✓' })
      return res.status(200).json({ ok: false, status: 'unknown', message: d?.message || 'استجابة غير متوقعة' })
    }

    if (provider === 'apify') {
      const r = await fetch(`https://api.apify.com/v2/users/me?token=${key}`, { signal: AbortSignal.timeout(8000) })
      if (r.status === 401) return res.status(200).json({ ok: false, status: 'invalid', message: 'توكن غير صحيح' })
      const d = await r.json().catch(() => ({}))
      if (d?.data?.id) return res.status(200).json({ ok: true, status: 'active', message: `مرحباً ${d.data.username || ''} — التوكن يعمل ✓` })
      return res.status(200).json({ ok: false, status: 'unknown', message: 'فشل التحقق' })
    }

    if (provider === 'scraperapi') {
      const r = await fetch(`https://api.scraperapi.com/account?api_key=${key}`, { signal: AbortSignal.timeout(8000) })
      const d = await r.json().catch(() => ({}))
      if (r.status === 403 || d?.error) return res.status(200).json({ ok: false, status: 'invalid', message: 'مفتاح غير صحيح' })
      if (d?.requestCount !== undefined) {
        const remaining = (d.requestLimit || 0) - (d.requestCount || 0)
        return res.status(200).json({ ok: true, status: remaining > 0 ? 'active' : 'quota', message: `${remaining.toLocaleString()} طلب متبقي` })
      }
      return res.status(200).json({ ok: false, status: 'unknown', message: 'فشل التحقق' })
    }

    if (provider === 'dropbox') {
      const r = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: 'null',
        signal: AbortSignal.timeout(8000),
      })
      const d = await r.json().catch(() => ({}))
      if (r.status === 401) return res.status(200).json({ ok: false, status: 'invalid', message: 'توكن غير صحيح أو منتهي' })
      if (d?.account_id) return res.status(200).json({ ok: true, status: 'active', message: `متصل بـ ${d.email || d.name?.display_name || 'Dropbox'} ✓` })
      return res.status(200).json({ ok: false, status: 'unknown', message: 'فشل التحقق' })
    }

    return res.status(400).json({ ok: false, message: 'Unknown provider' })
  } catch (e) {
    return res.status(200).json({ ok: false, status: 'error', message: `خطأ: ${e.message}` })
  }
}
