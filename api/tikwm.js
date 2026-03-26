import fetch from 'node-fetch';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { endpoint = 'user/posts', ...rest } = req.query;
    const params = new URLSearchParams(rest).toString();
    const url = `https://www.tikwm.com/api/${endpoint}${params ? '?' + params : ''}`;

    console.log('Fetching:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.tikwm.com/',
        'Accept': 'application/json',
      },
    });

    const text = await response.text();
    console.log('Response status:', response.status);

    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch {
      return res.status(200).send(text);
    }
  } catch (e) {
    console.error('Error:', e.message);
    return res.status(500).json({ error: e.message, code: -1 });
  }
}
