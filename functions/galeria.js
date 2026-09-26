export async function onRequest({ request, env }) {
  const assetUrl = new URL('/', request.url)
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request))
  const headers = new Headers(assetResponse.headers)

  headers.set('Cache-Control', 'no-store')
  headers.set('Retry-After', '3600')

  return new Response(assetResponse.body, {
    status: 503,
    statusText: 'Service Unavailable',
    headers,
  })
}