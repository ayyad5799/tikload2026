export const config = { runtime: 'edge' }

export default async function handler(req) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Video-Url,X-File-Name,X-Dbx-Token',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST')   return new Response('Method not allowed', { status: 405, headers: CORS })

  const TOKEN    = req.headers.get('X-Dbx-Token') || process.env.DROPBOX_TOKEN
  const videoUrl = req.headers.get('X-Video-Url')
  const fileName = req.headers.get('X-File-Name') || `tiktok_${Date.now()}.mp4`

  if (!TOKEN)    return new Response(JSON.stringify({ error: 'No Dropbox token' }),    { status: 400, headers: CORS })
  if (!videoUrl) return new Response(JSON.stringify({ error: 'Missing X-Video-Url' }), { status: 400, headers: CORS })

  try {
    // جلب الفيديو من TikTok
    const vRes = await fetch(decodeURIComponent(videoUrl), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://www.tiktok.com/',
        'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
      },
    })
    if (!vRes.ok) throw new Error(`فشل جلب الفيديو: ${vRes.status}`)

    const buffer = await vRes.arrayBuffer()
    if (!buffer.byteLength) throw new Error('الفيديو فارغ')

    // رفع على Dropbox
    const dbxRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization':   `Bearer ${TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: `/videos/${fileName}`,
          mode: 'add',
          autorename: true,
          mute: false,
        }),
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    })

    const result = await dbxRes.json()
    if (!dbxRes.ok) throw new Error(result?.error_summary || 'فشل الرفع على Dropbox')

    return new Response(
      JSON.stringify({ success: true, path: result.path_display, size: buffer.byteLength }),
      { status: 200, headers: CORS }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS })
  }
}
