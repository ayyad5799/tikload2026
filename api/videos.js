/**
 * /api/videos
 * Smart TikTok API proxy with multiple providers + auto-fallback
 * Providers tried in order: RapidAPI keys → tikwm.com
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action = 'profile', username, cursor = '0', video_url } = req.query

  // collect all available RapidAPI keys
  const rapidKeys = [
    process.env.RAPIDAPI_KEY,
    process.env.RAPIDAPI_KEY1,
    process.env.RAPIDAPI_KEY2,
    process.env.RAPIDAPI_KEY3,
  ].filter(Boolean)

  // ── Provider 1: RapidAPI (TikTok Scraper 7) ────────────
  for (const key of rapidKeys) {
    try {
      let url
      if (action === 'profile') {
        url = `https://tiktok-scraper7.p.rapidapi.com/user/posts?unique_id=${encodeURIComponent(username)}&count=35&cursor=${cursor}`
      } else {
        url = `https://tiktok-scraper7.p.rapidapi.com/?url=${encodeURIComponent(video_url)}`
      }

      const r = await fetch(url, {
        headers: {
          'x-rapidapi-key': key,
          'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
        },
        signal: AbortSignal.timeout(7000),
      })

      const text = await r.text()
      let data
      try { data = JSON.parse(text) } catch { continue }

      // quota exceeded → try next key
      if (data?.message?.includes('exceeded') || data?.message?.includes('quota')) continue

      if (data?.code === 0 || data?.data) {
        return res.status(200).json({ ok: true, source: 'rapidapi', data })
      }
    } catch { continue }
  }

  // ── Provider 2: tikwm.com (free, no key) ───────────────
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
      },
      signal: AbortSignal.timeout(10000),
    })

    const text = await r.text()
    let data
    try { data = JSON.parse(text) } catch {
      return res.status(502).json({ ok: false, error: 'All providers failed or returned invalid response' })
    }

    if (data?.code === 0 || data?.data) {
      return res.status(200).json({ ok: true, source: 'tikwm', data })
    }

    return res.status(502).json({ ok: false, error: data?.msg || 'Provider error' })
  } catch (e) {
    return res.status(502).json({ ok: false, error: `All providers failed: ${e.message}` })
  }
}
