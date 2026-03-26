export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { endpoint = 'user/posts', ...rest } = req.query;
    const params = new URLSearchParams(rest).toString();
    const url = `https://www.tikwm.com/api/${endpoint}${params ? '?' + params : ''}`;
    const response = await globalThis.fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://www.tikwm.com/',
        'Accept': 'application/json',
      },
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message, code: -1 });
  }
}
