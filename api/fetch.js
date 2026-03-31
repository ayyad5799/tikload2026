/**
 * /api/fetch  — مزود ذكي متعدد المصادر
 *
 * يدعم:
 *  1. RapidAPI  (tiktok-scraper7.p.rapidapi.com)
 *  2. Apify     (api.apify.com/v2/acts/...)
 *  3. ScraperAPI (api.scraperapi.com + tikwm)
 *  4. tikwm.com (مجاني، بدون مفتاح، Fallback نهائي)
 *
 * المفاتيح تأتي من:
 *  - header X-Keys: JSON {rapidapi:[...], apify:[...], scraperapi:[...]}
 *  - Environment variables
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Keys')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action = 'profile', username, cursor = '0', video_url } = req.query

  // ── جمع المفاتيح ──────────────────────────────────────
  let clientKeys = { rapidapi: [], apify: [], scraperapi: [] }
  try {
    const raw = req.headers['x-keys']
    if (raw) clientKeys = { ...clientKeys, ...JSON.parse(raw) }
  } catch {}

  const allKeys = {
    rapidapi: [
      ...clientKeys.rapidapi,
      process.env.RAPIDAPI_KEY,
      process.env.RAPIDAPI_KEY1,
      process.env.RAPIDAPI_KEY2,
    ].filter(Boolean),
    apify: [
      ...clientKeys.apify,
      process.env.APIFY_TOKEN,
      process.env.APIFY_TOKEN1,
    ].filter(Boolean),
    scraperapi: [
      ...clientKeys.scraperapi,
      process.env.SCRAPERAPI_KEY,
      process.env.SCRAPERAPI_KEY1,
    ].filter(Boolean),
  }

  const log = []   // سجل المحاولات

  // ── HELPER: parse response ────────────────────────────
  const tryParse = async (r) => {
    const text = await r.text()
    try { return JSON.parse(text) } catch { return null }
  }

  const isQuotaError = (d) =>
    d?.message?.toLowerCase().includes('exceeded') ||
    d?.message?.toLowerCase().includes('quota') ||
    d?.message?.toLowerCase().includes('limit') ||
    d?.message?.toLowerCase().includes('upgrade')

  const isAuthError = (d) =>
    d?.message?.toLowerCase().includes('invalid') ||
    d?.message?.toLowerCase().includes('forbidden') ||
    d?.message?.toLowerCase().includes('unauthorized') ||
    d?.status === 401 || d?.status === 403

  // normalize response to { videos, cursor, hasMore }
  const normalize = (data, source) => {
    if (!data) return null
    // RapidAPI / tikwm format
    if (data.code === 0 && data.data) {
      return {
        videos:   data.data.videos || (data.data.id ? [data.data] : []),
        cursor:   data.data.cursor || null,
        hasMore:  !!data.data.hasMore,
        source,
      }
    }
    // direct data array
    if (Array.isArray(data.data)) {
      return { videos: data.data, cursor: null, hasMore: false, source }
    }
    // single video
    if (data.data?.id) {
      return { videos: [data.data], cursor: null, hasMore: false, source }
    }
    return null
  }

  // ══════════════════════════════════════════════════════
  // PROVIDER 1: RapidAPI
  // ══════════════════════════════════════════════════════
  for (const key of allKeys.rapidapi) {
    try {
      let url
      if (action === 'profile') {
        url = `https://tiktok-scraper7.p.rapidapi.com/user/posts?unique_id=${encodeURIComponent(username)}&count=35&cursor=${cursor}`
      } else {
        url = `https://tiktok-scraper7.p.rapidapi.com/?url=${encodeURIComponent(video_url)}`
      }

      const r = await fetch(url, {
        headers: {
          'x-rapidapi-key':  key,
          'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
        },
        signal: AbortSignal.timeout(8000),
      })

      const d = await tryParse(r)
      const keyHint = key.slice(0, 6) + '...'

      if (!d) { log.push({ provider: 'rapidapi', key: keyHint, error: 'invalid_json' }); continue }
      if (isQuotaError(d))  { log.push({ provider: 'rapidapi', key: keyHint, error: 'quota_exceeded' }); continue }
      if (isAuthError(d))   { log.push({ provider: 'rapidapi', key: keyHint, error: 'auth_error' }); continue }

      const result = normalize(d, 'rapidapi')
      if (result) return res.status(200).json({ ok: true, ...result, log })
      log.push({ provider: 'rapidapi', key: keyHint, error: 'no_data' })
    } catch (e) {
      log.push({ provider: 'rapidapi', key: key.slice(0,6)+'...', error: e.message })
    }
  }

  // ══════════════════════════════════════════════════════
  // PROVIDER 2: Apify (TikTok Scraper)
  // ══════════════════════════════════════════════════════
  for (const token of allKeys.apify) {
    try {
      // Apify TikTok Profile Scraper
      const actorId = 'clockworks~tiktok-profile-scraper'
      const input = action === 'profile'
        ? { profiles: [`https://www.tiktok.com/@${username}`], resultsPerPage: 35 }
        : { postURLs: [video_url] }

      // Start run
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=30`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(35000),
        }
      )

      if (!runRes.ok) {
        const err = await tryParse(runRes)
        const hint = token.slice(0,6)+'...'
        if (runRes.status === 401 || runRes.status === 403) {
          log.push({ provider: 'apify', key: hint, error: 'auth_error' }); continue
        }
        log.push({ provider: 'apify', key: hint, error: err?.error?.message || `http_${runRes.status}` }); continue
      }

      const items = await runRes.json()
      if (!Array.isArray(items) || !items.length) {
        log.push({ provider: 'apify', key: token.slice(0,6)+'...', error: 'no_results' }); continue
      }

      // Transform Apify format → our format
      const videos = items.flatMap(profile =>
        (profile.videos || profile.items || []).map(v => ({
          id:           String(v.id || v.videoId || ''),
          cover:        v.videoMeta?.coverUrl || v.covers?.[0] || '',
          origin_cover: v.videoMeta?.coverUrl || '',
          title:        v.text || v.desc || '',
          duration:     v.videoMeta?.duration || v.duration || 0,
          play:         v.videoUrl || v.videoMeta?.downloadAddr || '',
          wmplay:       v.videoUrl || '',
          digg_count:   v.diggCount || v.stats?.diggCount || 0,
          play_count:   v.playCount || v.stats?.playCount || 0,
          comment_count:v.commentCount || v.stats?.commentCount || 0,
        }))
      )

      if (videos.length) {
        return res.status(200).json({ ok: true, videos, cursor: null, hasMore: false, source: 'apify', log })
      }
      log.push({ provider: 'apify', key: token.slice(0,6)+'...', error: 'empty_videos' })
    } catch (e) {
      log.push({ provider: 'apify', key: token.slice(0,6)+'...', error: e.message })
    }
  }

  // ══════════════════════════════════════════════════════
  // PROVIDER 3: ScraperAPI + tikwm
  // ══════════════════════════════════════════════════════
  for (const key of allKeys.scraperapi) {
    try {
      // ScraperAPI يعمل كـ proxy → نوصّل tikwm من خلاله
      let targetUrl
      if (action === 'profile') {
        targetUrl = `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(username)}&count=35&cursor=${cursor}`
      } else {
        targetUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(video_url)}`
      }

      const scraperUrl = `https://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(targetUrl)}&render=false`

      const r = await fetch(scraperUrl, {
        signal: AbortSignal.timeout(15000),
      })

      const d = await tryParse(r)
      const keyHint = key.slice(0,6)+'...'

      if (!d) { log.push({ provider: 'scraperapi', key: keyHint, error: 'invalid_json' }); continue }
      if (r.status === 403 || r.status === 401) {
        log.push({ provider: 'scraperapi', key: keyHint, error: 'auth_error' }); continue
      }

      const result = normalize(d, 'scraperapi')
      if (result) return res.status(200).json({ ok: true, ...result, log })
      log.push({ provider: 'scraperapi', key: keyHint, error: 'no_data' })
    } catch (e) {
      log.push({ provider: 'scraperapi', key: key.slice(0,6)+'...', error: e.message })
    }
  }

  // ══════════════════════════════════════════════════════
  // PROVIDER 4: tikwm.com (Free Fallback)
  // ══════════════════════════════════════════════════════
  try {
    let url
    if (action === 'profile') {
      url = `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(username)}&count=35&cursor=${cursor}`
    } else {
      url = `https://www.tikwm.com/api/?url=${encodeURIComponent(video_url)}`
    }

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.tikwm.com/',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    })

    const d = await tryParse(r)
    if (d) {
      const result = normalize(d, 'tikwm_free')
      if (result) return res.status(200).json({ ok: true, ...result, log })
    }
    log.push({ provider: 'tikwm_free', error: 'no_data', status: r.status })
  } catch (e) {
    log.push({ provider: 'tikwm_free', error: e.message })
  }

  // كل المزودين فشلوا
  return res.status(502).json({
    ok: false,
    error: 'جميع المزودين فشلوا. أضف مفاتيح API أو جرّب لاحقاً.',
    log,
  })
}
