import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type QuerySnapshot,
  type FieldValue,
} from 'firebase/firestore'
import { db } from '../utils/firebase'
import { getClientDeviceId } from './activity'

export type TableChatChannel = 'public' | 'participants'

export type TableChatMessage = {
  id: string
  tableId: string
  content: string
  authorName: string
  authorId: string | null
  deviceId: string | null
  channel: TableChatChannel
  createdAt: number
}

export type SendTableChatInput = {
  tableId: string
  content: string
  authorName: string
  authorId?: string | null
  channel: TableChatChannel
}

export type SendTableChatResult = {
  status: 'success' | 'error'
  message?: string
}

type FirestoreChatDocument = {
  content: string
  authorName: string
  authorId?: string | null
  deviceId?: string | null
  channel: TableChatChannel
  createdAt?: Timestamp | number | FieldValue | null
}

type TableChatState = {
  loading: boolean
  error: string | null
  messages: TableChatMessage[]
}

const CHAT_STORAGE_PREFIX = 'clbsk_table_chat_v1_'
const FIRESTORE_COLLECTION = 'boardTables'
const CHAT_SUBCOLLECTION = 'messages'

const forceLocalTables = import.meta.env.VITE_FORCE_LOCAL_TABLES === 'true'
const isTestEnvironment = import.meta.env.MODE === 'test'
const useFirestore = !forceLocalTables && !isTestEnvironment

const localSubscribers = new Map<string, Set<() => void>>()

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch (error) {
    console.error('No se pudo acceder a localStorage para el chat de mesa', error)
    return null
  }
}

function getStorageKey(tableId: string) {
  return `${CHAT_STORAGE_PREFIX}${tableId}`
}

type StoredChatMessage = {
  id: string
  tableId: string
  content: string
  authorName: string
  authorId: string | null
  deviceId: string | null
  channel: TableChatChannel
  createdAt: number
}

function normalizeStoredMessage(message: StoredChatMessage): StoredChatMessage {
  return {
    id: typeof message.id === 'string' ? message.id : `chat-${Math.random().toString(36).slice(2)}`,
    tableId: message.tableId,
    content: typeof message.content === 'string' ? message.content : '',
    authorName: typeof message.authorName === 'string' ? message.authorName : 'Anónimo',
    authorId:
      typeof message.authorId === 'string'
        ? message.authorId
        : message.authorId === null
        ? null
        : null,
    deviceId:
      typeof message.deviceId === 'string'
        ? message.deviceId
        : message.deviceId === null
        ? null
        : null,
    channel: message.channel === 'participants' ? 'participants' : 'public',
    createdAt: typeof message.createdAt === 'number' ? message.createdAt : Date.now(),
  }
}

function readLocalMessages(tableId: string): StoredChatMessage[] {
  const storage = getStorage()
  if (!storage) {
    return []
  }

  const raw = storage.getItem(getStorageKey(tableId))
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as StoredChatMessage[]
    return parsed.map(normalizeStoredMessage).sort((a, b) => a.createdAt - b.createdAt)
  } catch (error) {
    console.warn('Datos de chat corruptos, reiniciando', error)
    storage.removeItem(getStorageKey(tableId))
    return []
  }
}

function writeLocalMessages(tableId: string, messages: StoredChatMessage[]) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.setItem(getStorageKey(tableId), JSON.stringify(messages))
  notifyLocalSubscribers(tableId)
}

function notifyLocalSubscribers(tableId: string) {
  const listeners = localSubscribers.get(tableId)
  if (!listeners) {
    return
  }

  listeners.forEach((listener) => {
    listener()
  })
}

function toChatMessage(message: StoredChatMessage): TableChatMessage {
  return {
    ...message,
  }
}

function mapFirestoreDocuments(tableId: string, snapshot: QuerySnapshot<DocumentData>): TableChatMessage[] {
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as FirestoreChatDocument
      let createdAt = Date.now()

      if (data.createdAt instanceof Timestamp) {
        createdAt = data.createdAt.toMillis()
      } else if (typeof data.createdAt === 'number') {
        createdAt = data.createdAt
      }

      const channel: TableChatChannel = data.channel === 'participants' ? 'participants' : 'public'

      return {
        id: doc.id,
        tableId,
        content: data.content ?? '',
        authorName: data.authorName ?? 'Anónimo',
        authorId: typeof data.authorId === 'string' ? data.authorId : null,
        deviceId: typeof data.deviceId === 'string' ? data.deviceId : null,
        channel,
        createdAt,
      }
    })
    .sort((a, b) => a.createdAt - b.createdAt)
}

async function fetchMessagesFromFirestore(tableId: string): Promise<TableChatMessage[]> {
  const messagesRef = collection(db, FIRESTORE_COLLECTION, tableId, CHAT_SUBCOLLECTION)
  const snapshot = await getDocs(query(messagesRef, orderBy('createdAt', 'asc')))
  return mapFirestoreDocuments(tableId, snapshot)
}

function subscribeToFirestore(
  tableId: string,
  onUpdate: (messages: TableChatMessage[]) => void,
  onError: (message: string) => void,
): () => void {
  const messagesRef = collection(db, FIRESTORE_COLLECTION, tableId, CHAT_SUBCOLLECTION)
  const q = query(messagesRef, orderBy('createdAt', 'asc'))

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      onUpdate(mapFirestoreDocuments(tableId, snapshot))
    },
    (error) => {
      console.error('No se pudo sincronizar el chat de la mesa', error)
      onError('No se pudo sincronizar el chat de la mesa. Revisa tu conexión.')
    },
  )

  return unsubscribe
}

function subscribeToLocal(
  tableId: string,
  onUpdate: (messages: TableChatMessage[]) => void,
): () => void {
  const emit = () => {
    const messages = readLocalMessages(tableId).map(toChatMessage)
    onUpdate(messages)
  }

  emit()

  const listener = () => emit()
  const set = localSubscribers.get(tableId)
  if (set) {
    set.add(listener)
  } else {
    localSubscribers.set(tableId, new Set([listener]))
  }

  if (typeof window !== 'undefined') {
    const handler = (event: StorageEvent) => {
      if (event.key === getStorageKey(tableId)) {
        emit()
      }
    }
    window.addEventListener('storage', handler)

    return () => {
      const listeners = localSubscribers.get(tableId)
      if (listeners) {
        listeners.delete(listener)
        if (listeners.size === 0) {
          localSubscribers.delete(tableId)
        }
      }
      window.removeEventListener('storage', handler)
    }
  }

  return () => {
    const listeners = localSubscribers.get(tableId)
    if (listeners) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        localSubscribers.delete(tableId)
      }
    }
  }
}

export function subscribeTableChat(
  tableId: string,
  onUpdate: (messages: TableChatMessage[]) => void,
  onError: (message: string) => void,
): () => void {
  if (useFirestore) {
    return subscribeToFirestore(tableId, onUpdate, onError)
  }

  return subscribeToLocal(tableId, onUpdate)
}

export async function fetchTableChatMessages(tableId: string): Promise<TableChatMessage[]> {
  if (useFirestore) {
    return fetchMessagesFromFirestore(tableId)
  }

  return readLocalMessages(tableId).map(toChatMessage)
}

function addLocalMessage(input: SendTableChatInput & { deviceId: string | null }) {
  const messages = readLocalMessages(input.tableId)
  const storedMessage: StoredChatMessage = {
    id: `chat-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    tableId: input.tableId,
    content: input.content,
    authorName: input.authorName,
    authorId: input.authorId ?? null,
    deviceId: input.deviceId,
    channel: input.channel,
    createdAt: Date.now(),
  }

  const next = [...messages, storedMessage]
  writeLocalMessages(input.tableId, next)
}

async function addFirestoreMessage(input: SendTableChatInput & { deviceId: string | null }) {
  const messagesRef = collection(db, FIRESTORE_COLLECTION, input.tableId, CHAT_SUBCOLLECTION)
  await addDoc(messagesRef, {
    content: input.content,
    authorName: input.authorName,
    authorId: input.authorId ?? null,
    deviceId: input.deviceId,
    channel: input.channel,
    createdAt: serverTimestamp(),
  } satisfies FirestoreChatDocument)
}

export async function sendTableChatMessage(input: SendTableChatInput): Promise<SendTableChatResult> {
  const trimmed = input.content.trim()

  if (!trimmed) {
    return {
      status: 'error',
      message: 'Escribe un mensaje antes de enviarlo.',
    }
  }

  const payload = {
    ...input,
    content: trimmed,
    deviceId: getClientDeviceId(),
  }

  try {
    if (useFirestore) {
      await addFirestoreMessage(payload)
    } else {
      addLocalMessage(payload)
    }

    return {
      status: 'success',
    }
  } catch (error) {
    console.error('No se pudo enviar el mensaje del chat', error)
    return {
      status: 'error',
      message: 'No se pudo enviar el mensaje. Inténtalo de nuevo.',
    }
  }
}

export function resetTableChatForTests() {
  if (useFirestore) {
    console.warn('resetTableChatForTests solo está disponible en modo local.')
    return
  }

  if (typeof window === 'undefined') {
    return
  }

  try {
    const storage = window.localStorage
    const keys = Object.keys(storage)
    keys.forEach((key) => {
      if (key.startsWith(CHAT_STORAGE_PREFIX)) {
        storage.removeItem(key)
      }
    })
  } catch (error) {
    console.error('No se pudo reiniciar el chat de mesas para pruebas', error)
  }
}

type UseTableChatOptions = {
  tableId: string
}

type UseTableChatHook = TableChatState & {
  sendMessage: (input: Omit<SendTableChatInput, 'tableId'>) => Promise<SendTableChatResult>
}

export function useTableChat({ tableId }: UseTableChatOptions): UseTableChatHook {
  const [state, setState] = useState<TableChatState>({ loading: true, error: null, messages: [] })

  useEffect(() => {
    let active = true
    setState({ loading: true, error: null, messages: [] })

    if (useFirestore) {
      const unsubscribe = subscribeTableChat(
        tableId,
        (messages) => {
          if (!active) {
            return
          }
          setState({ loading: false, error: null, messages })
        },
        (message) => {
          if (!active) {
            return
          }
          setState((current) => ({ ...current, loading: false, error: message }))
        },
      )

      return () => {
        active = false
        unsubscribe()
      }
    }

    const unsubscribe = subscribeTableChat(
      tableId,
      (messages) => {
        if (!active) {
          return
        }
        setState({ loading: false, error: null, messages })
      },
      () => {},
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [tableId])

  const sendMessage = useCallback(
    async (input: Omit<SendTableChatInput, 'tableId'>) => {
      const result = await sendTableChatMessage({ tableId, ...input })
      if (result.status === 'error') {
        setState((current) => ({ ...current, error: result.message ?? 'No se pudo enviar el mensaje.' }))
      }
      return result
    },
    [tableId],
  )

  return useMemo(
    () => ({
      ...state,
      sendMessage,
    }),
    [sendMessage, state],
  )
}
