const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://oh-montajes-eventos.pages.dev',
  'https://chidalgodev.xyz',
]

export const allowedOrigins = new Set(
  [...defaultOrigins, ...(process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)],
)

export function isAllowedOrigin(origin) {
  if (!origin) return true

  try {
    const { hostname, origin: normalizedOrigin, protocol } = new URL(origin)
    const host = hostname.toLowerCase()

    if (allowedOrigins.has(normalizedOrigin)) return true

    const trustedHosts = new Set([
      'localhost',
      '127.0.0.1',
      '[::1]',
      'chidalgodev.xyz',
      'www.chidalgodev.xyz',
      'oh-montajes-eventos.pages.dev',
      'www.oh-montajes-eventos.pages.dev',
    ])

    if (host.endsWith('.chidalgodev.xyz') || host.endsWith('.pages.dev')) {
      return protocol === 'https:'
    }

    if (trustedHosts.has(host)) return true

    if (process.env.NODE_ENV === 'production') return false
    return protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(host)
  } catch {
    return false
  }
}