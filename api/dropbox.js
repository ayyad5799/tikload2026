export const config = { runtime: 'edge' }

export default async function handler(req) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Video-Url,X-File-Name',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST')   return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS })

  const TOKEN    = process.env.DROPBOX_TOKEN
  const videoUrl = req.headers.get('X-Video-Url')
  const fileName = req.headers.get('X-File-Name') || `tiktok_${Date.now()}.mp4`

  if (!TOKEN)    return new Response(JSON.stringify({ error: 'DROPBOX_TOKEN not set in Vercel environment' }), { status: 500, headers: CORS })
  if (!videoUrl) return new Response(JSON.stringify({ error: 'Missing X-Video-Url header' }), { status: 400, headers: CORS })

  try {
    // 1. جلب الفيديو من TikTok
    const videoRes = await fetch(decodeURIComponent(videoUrl), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer':    'https://www.tiktok.com/',
        'Accept':     '*/*',
      },
    })
    if (!videoRes.ok) throw new Error(`TikTok fetch failed: ${videoRes.status}`)
    const buffer = await videoRes.arrayBuffer()

    // 2. رفع على Dropbox في مجلد /videos
    const dbxRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method:  'POST',
      headers: {
        'Authorization':    `Bearer ${TOKEN}`,
        'Dropbox-API-Arg':  JSON.stringify({
          path:        `/videos/${fileName}`,
          mode:        'add',
          autorename:  true,
          mute:        false,
        }),
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    })

    const result = await dbxRes.json()
    if (!dbxRes.ok) throw new Error(result?.error_summary || 'Dropbox upload failed')

    return new Response(
      JSON.stringify({ success: true, path: result.path_display }),
      { status: 200, headers: CORS }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e.message) }),
      { status: 500, headers: CORS }
    )
  }
}
