const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https://images.unsplash.com",
  "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://*.cloudflare.com",
  "script-src-elem 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://*.cloudflare.com",
  "connect-src 'self' https://static.cloudflareinsights.com https://*.cloudflare.com",
].join('; ')

export async function onRequest({ request, next }) {
  const pathname = new URL(request.url).pathname
  const response = pathname === '/400' || pathname === '/500'
    ? Response.redirect(new URL('/', request.url), 302)
    : await next()
  const headers = new Headers(response.headers)

  headers.set('Content-Security-Policy', contentSecurityPolicy)
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=()')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')

  if (pathname === '/cuenta' || pathname.startsWith('/api/')) {
    headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}