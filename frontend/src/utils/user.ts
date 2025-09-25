export type UserProfileLike = {
  alias?: string | null
  fullName?: string | null
}

export type AuthUserLike = {
  displayName?: string | null
  email?: string | null
}

export function getDisplayName(
  profile: UserProfileLike | null | undefined,
  user: AuthUserLike | null | undefined,
): string {
  const alias = profile?.alias?.trim()
  if (alias) {
    return alias
  }

  const fullName = profile?.fullName?.trim()
  if (fullName) {
    return fullName
  }

  const displayName = user?.displayName?.trim()
  if (displayName) {
    return displayName
  }

  return user?.email ?? 'Invitado'
}
