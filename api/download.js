export const config = { runtime: 'edge' }

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const videoUrl = searchParams.get('url')

  const CORS = { 'Access-Control-Allow-Origin': '*' }

  if (!videoUrl) return new Response('Missing url', { status: 400, headers: CORS })

  try {
    const r = await fetch(decodeURIComponent(videoUrl), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer':    'https://www.tiktok.com/',
        'Accept':     'video/mp4,video/*;q=0.9,*/*;q=0.8',
      },
    })

    if (!r.ok) return new Response(`Upstream ${r.status}`, { status: 502, headers: CORS })

    return new Response(r.body, {
      status: 200,
      headers: { 'Content-Type': 'video/mp4', ...CORS, 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return new Response(e.message, { status: 500, headers: CORS })
  }
}
