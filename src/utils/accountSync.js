const ACCOUNT_SYNC_STORAGE_KEY = 'oh-account-sync'
export const ACCOUNT_SYNC_EVENT = 'oh-account-sync'

export function notifyAccountSync() {
  const payload = { timestamp: Date.now() }

  try {
    window.localStorage.setItem(ACCOUNT_SYNC_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignored: localStorage may be unavailable in some private contexts.
  }

  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(ACCOUNT_SYNC_STORAGE_KEY)
      channel.postMessage(payload)
      channel.close()
    }
  } catch {
    // Ignored: BroadcastChannel may not be available.
  }

  window.dispatchEvent(new CustomEvent(ACCOUNT_SYNC_EVENT, { detail: payload }))
}

export function subscribeToAccountSync(callback) {
  if (typeof window === 'undefined') return () => {}

  function handleCustomEvent() {
    callback()
  }

  function handleStorageEvent(event) {
    if (event.key === ACCOUNT_SYNC_STORAGE_KEY) callback()
  }

  function handleChannelMessage() {
    callback()
  }

  window.addEventListener(ACCOUNT_SYNC_EVENT, handleCustomEvent)
  window.addEventListener('storage', handleStorageEvent)

  let channel = null
  try {
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(ACCOUNT_SYNC_STORAGE_KEY)
      channel.addEventListener('message', handleChannelMessage)
    }
  } catch {
    channel = null
  }

  return () => {
    window.removeEventListener(ACCOUNT_SYNC_EVENT, handleCustomEvent)
    window.removeEventListener('storage', handleStorageEvent)
    if (channel) {
      channel.removeEventListener('message', handleChannelMessage)
      channel.close()
    }
  }
}
