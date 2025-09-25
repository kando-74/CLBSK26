import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../utils/firebase'

const ACTIVITY_COLLECTION = 'activityLogs'
const DEVICE_ID_STORAGE_KEY = 'clbsk_board_device_id_v1'

const disableLogging =
  import.meta.env.MODE === 'test' || import.meta.env.VITE_DISABLE_ACTIVITY_LOGS === 'true'

const activityCollectionRef = disableLogging ? null : collection(db, ACTIVITY_COLLECTION)

export type ActivityLogEvent = {
  type: string
  entityId: string
  entityName: string
  message?: string
  metadata?: Record<string, unknown>
}

export type LogActivityOptions = {
  deviceId?: string
}

export function getClientDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'device-server'
  }

  try {
    const storage = window.localStorage
    const existing = storage.getItem(DEVICE_ID_STORAGE_KEY)
    if (existing) {
      return existing
    }

    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `device-${Math.random().toString(36).slice(2)}-${Date.now()}`

    storage.setItem(DEVICE_ID_STORAGE_KEY, generated)
    return generated
  } catch (error) {
    console.warn('No se pudo determinar el identificador de dispositivo', error)
    return 'device-unknown'
  }
}

export async function logActivity(
  event: ActivityLogEvent,
  options: LogActivityOptions = {},
): Promise<void> {
  if (disableLogging || !activityCollectionRef) {
    return
  }

  try {
    const user = auth.currentUser

    await addDoc(activityCollectionRef, {
      type: event.type,
      entityId: event.entityId,
      entityName: event.entityName,
      message: event.message ?? null,
      metadata: event.metadata ?? null,
      actor: user
        ? {
            uid: user.uid,
            email: user.email ?? null,
            displayName: user.displayName ?? null,
          }
        : null,
      deviceId: options.deviceId ?? getClientDeviceId(),
      createdAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('No se pudo registrar la actividad', error)
  }
}

