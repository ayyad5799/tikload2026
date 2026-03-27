export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return new Response('Missing url', { status: 400 });
  }

  const decoded = decodeURIComponent(videoUrl);

  const response = await fetch(decoded, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'Referer': 'https://www.tiktok.com/',
      'Accept': '*/*',
    },
  });

  if (!response.ok) {
    return new Response('Failed: ' + response.status, { status: 500 });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    },
  });
}
