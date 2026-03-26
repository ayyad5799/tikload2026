export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  const { endpoint, download_url, ...rest } = req.query;

  try {
    if (download_url) {
      const response = await globalThis.fetch(decodeURIComponent(download_url), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://www.tiktok.com/'
        }
      });
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
      const buffer = await response.arrayBuffer();
      return res.status(200).send(Buffer.from(buffer));
    }

    const params = new URLSearchParams(rest).toString();
    const url = `https://tiktok-scraper7.p.rapidapi.com/${endpoint || 'user/posts'}${params ? '?' + params : ''}`;
    const response = await globalThis.fetch(url, {
      headers: {
        'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
