export const config = { runtime: 'edge' }

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const videoUrl = searchParams.get('url')

  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'Missing url param' }), { status: 400 })
  }

  try {
    const r = await fetch(decodeURIComponent(videoUrl), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://www.tiktok.com/',
        'Accept': '*/*',
      },
    })

    if (!r.ok) {
      return new Response(JSON.stringify({ error: `Upstream ${r.status}` }), { status: 502 })
    }

    return new Response(r.body, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message) }), { status: 500 })
  }
}
