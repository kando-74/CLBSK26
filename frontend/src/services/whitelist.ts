import { useCallback, useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, type DocumentData } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../utils/firebase'

export type WhitelistRole = 'asistente' | 'staff' | 'organizacion'

export type WhitelistStatus = 'approved' | 'pending' | 'revoked'

export type WhitelistEntryRecord = {
  email: string
  role: WhitelistRole
  status: WhitelistStatus
  invitedBy: string | null
  displayName: string | null
  notes: string | null
  updatedAt: Date | null
}

type AddWhitelistPayload = {
  email: string
  role: WhitelistRole
}

type CallableResponse = {
  status: 'success'
  entry: {
    email: string
    role?: string | null
    invitedBy?: string | null
    displayName?: string | null
    notes?: string | null
    status?: string | null
    updatedAt?: unknown
  }
}

function normalizeRole(value: unknown): WhitelistRole {
  if (value === 'organizacion' || value === 'staff') {
    return value
  }
  return 'asistente'
}

function normalizeStatus(value: unknown): WhitelistStatus {
  if (value === 'pending' || value === 'revoked') {
    return value
  }
  return 'approved'
}

function timestampToDate(value: unknown): Date | null {
  if (!value) {
    return null
  }

  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate()
    }
    if ('_seconds' in value && typeof (value as { _seconds?: number })._seconds === 'number') {
      const seconds = Number((value as { _seconds: number })._seconds)
      const nanos = Number((value as { _nanoseconds?: number })._nanoseconds ?? 0)
      return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000))
    }
  }

  if (typeof value === 'number') {
    return new Date(value)
  }

  return null
}

const addAuthorizedEmailCallable = httpsCallable(functions, 'addAuthorizedEmail')

export function useWhitelistManagement() {
  const [entries, setEntries] = useState<WhitelistEntryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const whitelistRef = collection(db, 'authorizedEmails')
    const whitelistQuery = query(whitelistRef, orderBy('email'))

    const unsubscribe = onSnapshot(
      whitelistQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((document) => mapWhitelistDocument(document.data()))
        setEntries(mapped)
        setLoading(false)
        setError(null)
      },
      (snapshotError) => {
        console.error('No se pudo leer la whitelist', snapshotError)
        setLoading(false)
        setError('No se pudo cargar la whitelist. Revisa tu conexión.')
      },
    )

    return () => {
      unsubscribe()
    }
  }, [])

  const addEntry = useCallback(async (payload: AddWhitelistPayload) => {
    try {
      const response = await addAuthorizedEmailCallable(payload)
      const data = response.data as CallableResponse

      if (data?.status !== 'success') {
        throw new Error('No se pudo registrar el correo en la whitelist.')
      }

      return mapWhitelistDocument({
        email: payload.email,
        role: data.entry.role ?? payload.role,
        invitedBy: data.entry.invitedBy ?? null,
        displayName: data.entry.displayName ?? null,
        notes: data.entry.notes ?? null,
        status: data.entry.status ?? 'approved',
        updatedAt: data.entry.updatedAt ?? new Date().toISOString(),
      })
    } catch (callableError) {
      console.error('Error al añadir un correo a la whitelist', callableError)
      throw callableError
    }
  }, [])

  return {
    entries,
    loading,
    error,
    addEntry,
    hasEntries: entries.length > 0,
  }
}

function mapWhitelistDocument(data: DocumentData): WhitelistEntryRecord {
  const email = String(data.email ?? '').trim().toLowerCase()
  const role = normalizeRole(data.role)
  const status = normalizeStatus(data.status)

  return {
    email,
    role,
    status,
    invitedBy: typeof data.invitedBy === 'string' ? data.invitedBy : null,
    displayName: typeof data.displayName === 'string' ? data.displayName : null,
    notes: typeof data.notes === 'string' ? data.notes : null,
    updatedAt: timestampToDate(data.updatedAt ?? data.createdAt ?? null),
  }
}

