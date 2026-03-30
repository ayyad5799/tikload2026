export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { endpoint = 'user/posts', ...rest } = req.query
    const qs = new URLSearchParams(rest).toString()
    const url = `https://www.tikwm.com/api/${endpoint}${qs ? '?' + qs : ''}`

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.tikwm.com/',
        'Accept': 'application/json',
      },
    })

    const text = await r.text()
    try {
      const data = JSON.parse(text)
      return res.status(200).json(data)
    } catch {
      return res.status(502).json({ code: -1, msg: 'Bad response', status: r.status })
    }
  } catch (e) {
    return res.status(500).json({ code: -1, msg: String(e.message) })
  }
}
