const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://oh-api-test.onrender.com',
  'https://oh-montajes-eventos.pages.dev',
  'https://www.oh-montajes-eventos.pages.dev',
  'https://render-backend-test.oh-montajes-eventos.pages.dev',
  'https://chidalgodev.xyz',
  'https://www.chidalgodev.xyz',
]

export const allowedOrigins = new Set(
  [...defaultOrigins, ...(process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)],
)

function normalizeHost(hostname) {
  return String(hostname ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
}

export function isAllowedHost(hostname) {
  const host = normalizeHost(hostname)
  if (!host) return false

  const trustedHosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
    'chidalgodev.xyz',
    'www.chidalgodev.xyz',
    'oh-api-test.onrender.com',
    'oh-montajes-eventos.pages.dev',
    'www.oh-montajes-eventos.pages.dev',
  ])

  if (trustedHosts.has(host) || host.endsWith('.chidalgodev.xyz') || host.endsWith('.pages.dev') || host.endsWith('.onrender.com')) return true
  if (host.endsWith('.localhost')) return true

  const privateIpPattern = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/
  if (privateIpPattern.test(host)) return true

  return false
}

export function isAllowedOrigin(origin) {
  if (!origin) return true

  try {
    const { hostname, origin: normalizedOrigin, protocol } = new URL(origin)
    const host = normalizeHost(hostname)

    if (allowedOrigins.has(normalizedOrigin)) return true
    if (isAllowedHost(host)) return true

    if (host.endsWith('.chidalgodev.xyz') || host.endsWith('.pages.dev') || host.endsWith('.onrender.com')) {
      return protocol === 'https:'
    }

    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || host.endsWith('.localhost')) {
      return protocol === 'http:' || protocol === 'https:'
    }

    return false
  } catch {
    return false
  }
}