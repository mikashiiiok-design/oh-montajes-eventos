const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export async function apiRequest(path, options = {}) {
  if (!path.startsWith('/api/')) {
    throw new Error('API paths must start with /api/')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error ?? `API request failed (${response.status})`)
  }

  return data
}