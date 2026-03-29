export const config = { runtime: 'edge' }

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Video-Url,X-File-Name',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers })

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  const DBX_TOKEN = process.env.DROPBOX_TOKEN
  if (!DBX_TOKEN) {
    return new Response(JSON.stringify({ error: 'DROPBOX_TOKEN not configured in environment' }), { status: 500, headers })
  }

  const videoUrl = req.headers.get('X-Video-Url')
  const fileName = req.headers.get('X-File-Name') || `tiktok_${Date.now()}.mp4`

  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'Missing X-Video-Url header' }), { status: 400, headers })
  }

  try {
    // جلب الفيديو من TikTok
    const videoRes = await fetch(decodeURIComponent(videoUrl), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://www.tiktok.com/',
        'Accept': '*/*',
      },
    })

    if (!videoRes.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch video: HTTP ${videoRes.status}` }),
        { status: 502, headers }
      )
    }

    const videoBuffer = await videoRes.arrayBuffer()

    // رفع على Dropbox في مجلد /TikLoad
    const dbxRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DBX_TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: `/TikLoad/${fileName}`,
          mode: 'add',
          autorename: true,
          mute: false,
        }),
        'Content-Type': 'application/octet-stream',
      },
      body: videoBuffer,
    })

    const result = await dbxRes.json()

    if (!dbxRes.ok) {
      return new Response(
        JSON.stringify({ error: result?.error_summary || 'Dropbox upload failed' }),
        { status: 502, headers }
      )
    }

    return new Response(
      JSON.stringify({ success: true, path: result.path_display, name: result.name }),
      { status: 200, headers }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e.message) }),
      { status: 500, headers }
    )
  }
}
