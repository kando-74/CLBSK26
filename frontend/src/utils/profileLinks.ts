export function buildUserProfilePath(uid: string): string {
  if (!uid) {
    return '/personas/anonimo'
  }
  return `/personas/${uid}`
}

export function decodeUserProfileParam(param: string | undefined): string {
  if (!param) {
    return ''
  }
  return param
}

export function normalizeUserName(value: string): string {
  return value.trim().toLowerCase()
}
