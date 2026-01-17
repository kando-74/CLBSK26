import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../utils/firebase'

export type UserProfile = {
  uid: string
  alias: string
  fullName: string
  email: string
  role: 'participante' | 'organizacion'
  availableToPlay: boolean
  playStyleTags: string[]
  avatarUrl?: string
  availabilityNote?: string
  interestTags: string[]
  radarMode: 'manual' | 'auto'
}

type UseUsersState = {
  users: UserProfile[]
  loading: boolean
  error: string | null
}

const usersCollectionRef = collection(db, 'users')

// listUsers removed in favor of subscribeUsers

export function subscribeUsers(onUpdate: (users: UserProfile[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    usersCollectionRef,
    (snapshot) => {
      const users = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          uid: doc.id,
          alias: data.alias ?? 'Sin alias',
          fullName: data.fullName ?? '',
          email: data.email ?? 'Sin correo',
          role: data.role ?? 'participante',
          availableToPlay: data.preferences?.availableToPlay ?? false,
          playStyleTags: data.preferences?.playStyleTags ?? [],
          avatarUrl: data.avatarUrl,
          availabilityNote: data.preferences?.availabilityNote ?? '',
          interestTags: data.preferences?.interestTags ?? [],
          radarMode: data.preferences?.radarMode ?? 'manual',
        } as UserProfile
      })
      onUpdate(users)
    },
    (error) => {
      console.error('Error subscribing to users:', error)
      onError(new Error('No se pudo suscribir a la lista de usuarios.'))
    }
  )
}

export function useUsers(): UseUsersState {
  const [state, setState] = useState<UseUsersState>({
    users: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    const unsubscribe = subscribeUsers(
      (users) => {
        setState({ users, loading: false, error: null })
      },
      (error) => {
        setState({ users: [], loading: false, error: error.message })
      }
    )

    return unsubscribe
  }, [])

  return state
}

export async function updateUserStatus(
  userId: string,
  available: boolean,
  note?: string,
): Promise<{ status: 'success' | 'error'; message?: string }> {
  try {
    const { doc, setDoc, getDoc } = await import('firebase/firestore')
    const userRef = doc(db, 'users', userId)

    // We need to merge with existing preferences
    const userDoc = await getDoc(userRef)
    const currentData = userDoc.data()
    const currentPreferences = currentData?.preferences || {}

    await setDoc(
      userRef,
      {
        preferences: {
          ...currentPreferences,
          availableToPlay: available,
          availabilityNote: note ?? currentPreferences.availabilityNote ?? '',
        }
      },
      { merge: true }
    )
    return { status: 'success' }
  } catch (error) {
    console.error('Error updating status:', error)
    return { status: 'error', message: 'No se pudo actualizar el estado.' }
  }
}
