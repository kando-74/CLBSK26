import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from 'firebase/auth'
import { doc, onSnapshot, type DocumentData } from 'firebase/firestore'
import { auth, db } from '../utils/firebase'
import { getLocalAlias, setLocalAlias, subscribeLocalAlias } from '../utils/localIdentity'

type LanguageOption = 'es' | 'en'

type UserPreferences = {
  notifications?: boolean
  darkMode?: boolean
  availableToPlay?: boolean
}

type UserProfile = {
  alias?: string
  fullName?: string
  language?: LanguageOption
  bio?: string
  consentAt?: Date | null
  role?: string
  preferences?: UserPreferences
  avatarUrl?: string
  avatarStoragePath?: string
  avatarUpdatedAt?: Date | null
}

type AuthorizedEntry = {
  role?: string
  invitedBy?: string
  displayName?: string
  notes?: string
}

type AuthContextValue = {
  user: User | null
  loading: boolean
  profile: UserProfile | null
  profileLoading: boolean
  authorized: AuthorizedEntry | null
  localAlias: string | null
  updateLocalAlias: (alias: string) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [authorized, setAuthorized] = useState<AuthorizedEntry | null>(null)
  const [localAlias, setLocalAliasState] = useState<string | null>(() => getLocalAlias())

  useEffect(() => {
    const unsubscribe = subscribeLocalAlias((alias) => {
      setLocalAliasState(alias)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      setAuthorized(null)
      return
    }

    setProfileLoading(true)
    const profileRef = doc(db, 'users', user.uid)
    const unsubscribeProfile = onSnapshot(
      profileRef,
      (snapshot) => {
        const data = snapshot.data()
        setProfile(data ? mapProfile(data) : null)
        if (data?.alias) {
          const normalizedAlias = String(data.alias).trim()
          if (normalizedAlias) {
            setLocalAlias(normalizedAlias)
            setLocalAliasState(normalizedAlias)
          }
        }
        setProfileLoading(false)
      },
      () => {
        setProfile(null)
        setProfileLoading(false)
      },
    )

    const email = user.email?.toLowerCase()
    if (!email) {
      setAuthorized(null)
      return () => {
        unsubscribeProfile()
      }
    }

    const authorizedRef = doc(db, 'authorizedEmails', email)
    const unsubscribeAuthorized = onSnapshot(
      authorizedRef,
      (snapshot) => {
        const data = snapshot.data()
        setAuthorized(data ? mapAuthorized(data) : null)
      },
      () => {
        setAuthorized(null)
      },
    )

    return () => {
      unsubscribeProfile()
      unsubscribeAuthorized()
    }
  }, [user])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      profile,
      profileLoading,
      authorized,
      localAlias,
      updateLocalAlias: (alias: string) => {
        const normalized = alias.trim()
        setLocalAlias(normalized || null)
        setLocalAliasState(normalized ? normalized : null)
      },
      signOut: () => firebaseSignOut(auth),
    }),
    [authorized, localAlias, loading, profile, profileLoading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

function mapProfile(data: DocumentData): UserProfile {
  return {
    alias: data.alias ?? undefined,
    fullName: data.fullName ?? undefined,
    language: data.language ?? 'es',
    bio: data.bio ?? undefined,
    consentAt: data.consentAt ? data.consentAt.toDate?.() ?? null : null,
    role: data.role ?? undefined,
    preferences: {
      notifications: data.preferences?.notifications ?? false,
      darkMode: data.preferences?.darkMode ?? false,
      availableToPlay: data.preferences?.availableToPlay ?? false,
    },
    avatarUrl: data.avatarUrl ?? undefined,
    avatarStoragePath: data.avatarStoragePath ?? undefined,
    avatarUpdatedAt: data.avatarUpdatedAt ? data.avatarUpdatedAt.toDate?.() ?? null : null,
  }
}

function mapAuthorized(data: DocumentData): AuthorizedEntry {
  return {
    role: data.role ?? undefined,
    invitedBy: data.invitedBy ?? undefined,
    displayName: data.displayName ?? undefined,
    notes: data.notes ?? undefined,
  }
}
