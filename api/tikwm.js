export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // جرب API keys متعددة بالترتيب
  const KEYS = [
    process.env.RAPIDAPI_KEY,
    process.env.RAPIDAPI_KEY1,
    process.env.RAPIDAPI_KEY2,
  ].filter(Boolean)

  if (!KEYS.length) {
    return res.status(500).json({ code: -1, msg: 'No API keys configured' })
  }

  const { endpoint = 'user/posts', ...rest } = req.query
  const qs = new URLSearchParams(rest).toString()
  const url = `https://tiktok-scraper7.p.rapidapi.com/${endpoint}${qs ? '?' + qs : ''}`

  for (const key of KEYS) {
    try {
      const r = await fetch(url, {
        headers: {
          'x-rapidapi-key': key,
          'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
        },
      })
      const text = await r.text()
      try {
        const data = JSON.parse(text)
        // لو الكوتة انتهت جرب الـ key التاني
        if (data?.message?.includes('exceeded')) continue
        return res.status(200).json(data)
      } catch {
        continue
      }
    } catch {
      continue
    }
  }

  return res.status(429).json({
    code: -1,
    msg: 'All API keys exhausted. Please add a new RAPIDAPI_KEY or wait for monthly reset.'
  })
}
