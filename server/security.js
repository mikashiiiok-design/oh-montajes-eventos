export const allowedOrigins = new Set(
  (process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

export function isAllowedOrigin(origin) {
  if (!origin || allowedOrigins.has(origin)) return true
  if (process.env.NODE_ENV === 'production') return false

  try {
    const { hostname, protocol } = new URL(origin)
    return protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
  } catch {
    return false
  }
}