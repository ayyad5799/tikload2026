export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const KEY = process.env.RAPIDAPI_KEY
  if (!KEY) {
    return res.status(500).json({ code: -1, msg: 'RAPIDAPI_KEY not configured' })
  }

  try {
    const { endpoint = 'user/posts', ...rest } = req.query
    const qs = new URLSearchParams(rest).toString()
    const url = `https://tiktok-scraper7.p.rapidapi.com/${endpoint}${qs ? '?' + qs : ''}`

    const r = await fetch(url, {
      headers: {
        'x-rapidapi-key': KEY,
        'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
      },
    })

    const text = await r.text()
    let data
    try { data = JSON.parse(text) }
    catch { return res.status(502).json({ code: -1, msg: 'Bad upstream response', status: r.status }) }

    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ code: -1, msg: String(e.message) })
  }
}
