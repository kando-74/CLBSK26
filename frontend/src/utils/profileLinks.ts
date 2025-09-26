export function buildUserProfilePath(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    return '/personas/anonimo'
  }
  return `/personas/${encodeURIComponent(trimmed)}`
}

export function decodeUserProfileParam(param: string | undefined): string {
  if (!param) {
    return ''
  }
  try {
    return decodeURIComponent(param)
  } catch {
    return param
  }
}

export function normalizeUserName(value: string): string {
  return value.trim().toLowerCase()
}
