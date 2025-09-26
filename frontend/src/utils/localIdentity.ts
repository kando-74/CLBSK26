const STORAGE_KEY = 'clbsk_local_alias_v1'

function safeReadStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch (error) {
    console.warn('No se pudo acceder a localStorage para la identidad local', error)
    return null
  }
}

export function getLocalAlias(): string | null {
  const storage = safeReadStorage()
  if (!storage) {
    return null
  }

  const value = storage.getItem(STORAGE_KEY)
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function setLocalAlias(alias: string | null): void {
  const storage = safeReadStorage()
  if (!storage) {
    return
  }

  if (!alias || alias.trim().length === 0) {
    storage.removeItem(STORAGE_KEY)
    return
  }

  storage.setItem(STORAGE_KEY, alias.trim())
}

export function subscribeLocalAlias(listener: (alias: string | null) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener(event.newValue ? event.newValue.trim() || null : null)
    }
  }

  window.addEventListener('storage', handler)

  return () => {
    window.removeEventListener('storage', handler)
  }
}
