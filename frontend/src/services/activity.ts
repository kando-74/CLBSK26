import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { auth, db } from '../utils/firebase'

const ACTIVITY_COLLECTION = 'activityLogs'
const DEVICE_ID_STORAGE_KEY = 'clbsk_board_device_id_v1'

const disableLogging =
  import.meta.env.MODE === 'test' || import.meta.env.VITE_DISABLE_ACTIVITY_LOGS === 'true'

const activityCollectionRef = disableLogging ? null : collection(db, ACTIVITY_COLLECTION)

export const isActivityLoggingEnabled = !disableLogging

export type ActivityLogRecord = {
  id: string
  type: string
  entityId: string
  entityName: string
  message: string | null
  metadata: Record<string, unknown> | null
  actor: {
    uid: string | null
    email: string | null
    displayName: string | null
  } | null
  deviceId: string | null
  createdAt: Date | null
}

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

function mapActivityLog(document: QueryDocumentSnapshot<DocumentData>): ActivityLogRecord {
  const raw = document.data()
  const createdAtRaw = raw?.createdAt
  let createdAt: Date | null = null

  if (createdAtRaw && typeof createdAtRaw.toDate === 'function') {
    createdAt = createdAtRaw.toDate()
  } else if (typeof createdAtRaw === 'number') {
    createdAt = new Date(createdAtRaw)
  }

  return {
    id: document.id,
    type: raw?.type ?? 'unknown',
    entityId: raw?.entityId ?? 'unknown',
    entityName: raw?.entityName ?? 'Desconocido',
    message: raw?.message ?? null,
    metadata: raw?.metadata ?? null,
    actor: raw?.actor ?? null,
    deviceId: raw?.deviceId ?? null,
    createdAt,
  }
}

export function subscribeActivityLogs(
  limitCount: number,
  onUpdate: (logs: ActivityLogRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!isActivityLoggingEnabled || !activityCollectionRef) {
    onUpdate([])
    return () => {}
  }

  const constraints = [orderBy('createdAt', 'desc')]
  if (Number.isFinite(limitCount) && limitCount > 0) {
    constraints.push(limit(limitCount))
  }

  const q = query(activityCollectionRef, ...constraints)

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((doc) => mapActivityLog(doc))
      onUpdate(logs)
    },
    (error) => {
      console.error('No se pudieron leer los registros de actividad', error)
      onError('No se pudieron cargar los registros de actividad.')
    },
  )

  return () => {
    unsubscribe()
  }
}
