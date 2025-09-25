import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from 'firebase/firestore'
import { db } from '../utils/firebase'
import { getClientDeviceId, logActivity } from './activity'
import { registerPlay, completePlay } from './plays'

type TableParticipant = {
  deviceId: string | null
  name: string
}

export type TableStatus = 'open' | 'in-progress' | 'completed'

type TableChronicles = Record<string, string>

type StoredTable = {
  id: string
  game: string
  host: string
  seats: {
    total: number
    taken: number
  }
  start: string
  room: string
  description: string
  joinedByLocal: boolean
  createdAt: number
  coverUrl?: string | null
  participants?: TableParticipant[]
  status?: TableStatus
  activePlayId?: string | null
  currentPlayers?: TableParticipant[]
  startedAt?: number | null
  completedAt?: number | null
  resultSummary?: string | null
  chronicles?: TableChronicles
}

type FirestoreTable = {
  game: string
  host: string
  seats: {
    total: number
    taken: number
  }
  start: string
  room: string
  description: string
  joinedBy?: string[]
  createdAt: number
  updatedAt?: number
  coverUrl?: string | null
  participants?: TableParticipant[]
  status?: TableStatus
  activePlayId?: string | null
  currentPlayers?: TableParticipant[]
  startedAt?: number | null
  completedAt?: number | null
  resultSummary?: string | null
  chronicles?: TableChronicles
}

type FirestoreActionResult = {
  status: TableActionStatus
  message: string
  data?: FirestoreTable
}

export type TableRecord = {
  id: string
  game: string
  host: string
  seats: {
    total: number
    taken: number
  }
  start: string
  room: string
  description: string
  joined: boolean
  createdAt: number
  coverUrl?: string | null
  participants: TableParticipant[]
  status: TableStatus
  activePlayId: string | null
  currentPlayers: TableParticipant[]
  startedAt: number | null
  completedAt: number | null
  resultSummary: string | null
  chronicles: TableChronicles
}

export type CreateTableInput = {
  game: string
  host: string
  seats: number
  start: string
  room: string
  description: string
  coverUrl?: string | null
}

export type StartTableInput = {
  players: string[]
  room: string
  startTime?: string
}

export type CompleteTableInput = {
  result: string
  chronicles: TableChronicles
}

export type TableActionStatus = 'success' | 'already-joined' | 'full' | 'error'

export type TableActionResult = {
  status: TableActionStatus
  message: string
  table?: TableRecord
}

const STORAGE_KEY = 'clbsk_board_tables_v1'
const JOINED_STORAGE_KEY = 'clbsk_board_joined_ids_v1'
const FIRESTORE_COLLECTION = 'boardTables'
const MAX_TOTAL_SEATS = 8

const forceLocalTables = import.meta.env.VITE_FORCE_LOCAL_TABLES === 'true'
const isTestEnvironment = import.meta.env.MODE === 'test'
const useFirestore = !forceLocalTables && !isTestEnvironment
const tablesCollectionRef = useFirestore ? collection(db, FIRESTORE_COLLECTION) : null

const seedTables: StoredTable[] = [
  {
    id: 'table-revive',
    game: 'Revive',
    host: 'Lucía',
    seats: { taken: 2, total: 4 },
    start: '18:00',
    room: 'Sala Verde',
    description: 'Buscamos jugadoras con experiencia previa. Partida avanzada con módulos.',
    joinedByLocal: false,
    createdAt: new Date('2024-10-25T18:00:00Z').getTime(),
    coverUrl: null,
    participants: [{ deviceId: null, name: 'Lucía' }],
    status: 'open',
  },
  {
    id: 'table-scout',
    game: 'Scout',
    host: 'Javi',
    seats: { taken: 1, total: 5 },
    start: 'En cuanto estemos',
    room: 'Lobby',
    description: 'Ideal para partidas rápidas entre actividades. Explicación incluida.',
    joinedByLocal: false,
    createdAt: new Date('2024-10-25T17:30:00Z').getTime(),
    coverUrl: null,
    participants: [{ deviceId: null, name: 'Javi' }],
    status: 'open',
  },
  {
    id: 'table-earth',
    game: 'Earth',
    host: 'Marta',
    seats: { taken: 3, total: 4 },
    start: '19:30',
    room: 'Sala Azul',
    description: 'Buscamos un último hueco. Explicamos reglas y usamos expansión Boreal.',
    joinedByLocal: false,
    createdAt: new Date('2024-10-25T19:30:00Z').getTime(),
    coverUrl: null,
    participants: [{ deviceId: null, name: 'Marta' }],
    status: 'open',
  },
]

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch (error) {
    console.error('No se pudo acceder a localStorage', error)
    return null
  }
}

function readJoinedTableIds(): Set<string> {
  const storage = getStorage()
  if (!storage) {
    return new Set<string>()
  }

  try {
    const raw = storage.getItem(JOINED_STORAGE_KEY)
    if (!raw) {
      return new Set<string>()
    }

    const parsed = JSON.parse(raw) as string[]
    return new Set(parsed.filter((value) => typeof value === 'string'))
  } catch (error) {
    console.warn('No se pudieron leer las mesas apuntadas localmente', error)
    storage.removeItem(JOINED_STORAGE_KEY)
    return new Set<string>()
  }
}

function persistJoinedTableIds(ids: Set<string>) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.setItem(JOINED_STORAGE_KEY, JSON.stringify(Array.from(ids)))
}

function markTableAsJoinedLocally(tableId: string) {
  const joined = readJoinedTableIds()
  joined.add(tableId)
  persistJoinedTableIds(joined)
}

function unmarkTableAsJoinedLocally(tableId: string) {
  const joined = readJoinedTableIds()
  if (joined.delete(tableId)) {
    persistJoinedTableIds(joined)
  }
}

function normalizeLocalTable(entry: StoredTable | (StoredTable & { joined?: boolean })): StoredTable {
  const totalSeats = clampSeats(entry.seats?.total ?? 4)
  const takenSeats = clampSeats(entry.seats?.taken ?? 0, totalSeats)
  const participants = Array.isArray((entry as StoredTable).participants)
    ? (entry as StoredTable).participants!.map((participant) => ({
        deviceId:
          typeof participant.deviceId === 'string' || participant.deviceId === null
            ? participant.deviceId
            : null,
        name: participant.name ?? entry.host,
      }))
    : [{ deviceId: null, name: entry.host }]
  const currentPlayers = Array.isArray((entry as StoredTable).currentPlayers)
    ? (entry as StoredTable).currentPlayers!.map((participant) => ({
        deviceId:
          typeof participant.deviceId === 'string' || participant.deviceId === null
            ? participant.deviceId
            : null,
        name: participant.name ?? entry.host,
      }))
    : []
  const chronicles = (entry as StoredTable).chronicles ?? {}
  const status = (entry as StoredTable).status ?? 'open'
  return {
    id: entry.id,
    game: entry.game,
    host: entry.host,
    seats: {
      total: totalSeats,
      taken: Math.min(totalSeats, takenSeats),
    },
    start: entry.start,
    room: entry.room,
    description: entry.description,
    joinedByLocal: entry.joinedByLocal ?? (entry as { joined?: boolean }).joined ?? false,
    createdAt: entry.createdAt,
    coverUrl: 'coverUrl' in entry ? entry.coverUrl ?? null : null,
    participants,
    status,
    activePlayId:
      (entry as StoredTable).activePlayId === undefined
        ? null
        : (entry as StoredTable).activePlayId ?? null,
    currentPlayers,
    startedAt: typeof (entry as StoredTable).startedAt === 'number' ? (entry as StoredTable).startedAt ?? null : null,
    completedAt:
      typeof (entry as StoredTable).completedAt === 'number' ? (entry as StoredTable).completedAt ?? null : null,
    resultSummary:
      typeof (entry as StoredTable).resultSummary === 'string'
        ? (entry as StoredTable).resultSummary ?? null
        : null,
    chronicles,
  }
}

function normalizePlayerNames(names: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  names.forEach((name) => {
    const trimmed = name.trim()
    if (!trimmed) {
      return
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    normalized.push(trimmed)
  })

  return normalized
}

function formatTimeLabelFromDate(date: Date): string {
  try {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (error) {
    console.warn('No se pudo formatear la hora de inicio de la partida', error)
    return date.toISOString()
  }
}

function readLocalTables(): StoredTable[] {
  const storage = getStorage()
  if (!storage) {
    return seedTables.map(cloneTable)
  }

  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) {
    writeLocalTables(seedTables.map(cloneLocalTable))
    return seedTables.map(cloneLocalTable)
  }

  try {
    const parsed = JSON.parse(raw) as StoredTable[]
    return parsed.map(normalizeLocalTable)
  } catch (error) {
    console.warn('Datos corruptos del tablón, reseteando', error)
    writeLocalTables(seedTables.map(cloneLocalTable))
    return seedTables.map(cloneLocalTable)
  }
}

function writeLocalTables(tables: StoredTable[]) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(tables))
}

function cloneLocalTable(table: StoredTable): StoredTable {
  return {
    ...table,
    seats: { ...table.seats },
    participants: table.participants ? table.participants.map((participant) => ({ ...participant })) : [],
    currentPlayers: table.currentPlayers ? table.currentPlayers.map((participant) => ({ ...participant })) : [],
    chronicles: table.chronicles ? { ...table.chronicles } : {},
  }
}

function localTableToRecord(table: StoredTable): TableRecord {
  return {
    id: table.id,
    game: table.game,
    host: table.host,
    seats: { ...table.seats },
    start: table.start,
    room: table.room,
    description: table.description,
    joined: table.joinedByLocal,
    createdAt: table.createdAt,
    coverUrl: table.coverUrl ?? null,
    participants: table.participants ? table.participants.map((participant) => ({ ...participant })) : [],
    status: table.status ?? 'open',
    activePlayId: table.activePlayId ?? null,
    currentPlayers: table.currentPlayers ? table.currentPlayers.map((participant) => ({ ...participant })) : [],
    startedAt: typeof table.startedAt === 'number' ? table.startedAt : null,
    completedAt: typeof table.completedAt === 'number' ? table.completedAt : null,
    resultSummary: typeof table.resultSummary === 'string' ? table.resultSummary : null,
    chronicles: table.chronicles ? { ...table.chronicles } : {},
  }
}

async function fetchTablesFromFirestore(deviceId: string): Promise<TableRecord[]> {
  if (!tablesCollectionRef) {
    return []
  }

  const snapshot = await getDocs(query(tablesCollectionRef, orderBy('createdAt', 'desc')))
  const joinedSet = readJoinedTableIds()

  const records = snapshot.docs.map((document) => {
    const data = document.data() as FirestoreTable
    const joinedBy = Array.isArray(data.joinedBy) ? data.joinedBy : []
    const joined = joinedBy.includes(deviceId)

    if (joined) {
      joinedSet.add(document.id)
    } else {
      joinedSet.delete(document.id)
    }

    return mapFirestoreTable(document.id, data, joined)
  })

  persistJoinedTableIds(joinedSet)
  return records
}

function subscribeTablesFromFirestore(
  deviceId: string,
  onUpdate: (tables: TableRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!tablesCollectionRef) {
    return () => {}
  }

  const q = query(tablesCollectionRef, orderBy('createdAt', 'desc'))

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const joinedSet = readJoinedTableIds()

      const tables = snapshot.docs.map((document) => {
        const data = document.data() as FirestoreTable
        const joinedBy = Array.isArray(data.joinedBy) ? data.joinedBy : []
        const joined = joinedBy.includes(deviceId)

        if (joined) {
          joinedSet.add(document.id)
        } else {
          joinedSet.delete(document.id)
        }

        return mapFirestoreTable(document.id, data, joined)
      })

      persistJoinedTableIds(joinedSet)
      onUpdate(tables)
    },
    (error) => {
      console.error('Error de sincronización en tiempo real del tablón', error)
      onError('No se pudieron sincronizar las mesas en tiempo real. Revisa tu conexión.')
    },
  )

  return () => {
    unsubscribe()
  }
}

async function createTableInFirestore(input: CreateTableInput, deviceId: string): Promise<TableActionResult> {
  if (!tablesCollectionRef) {
    return {
      status: 'error',
      message: 'No se pudo publicar la mesa. Inténtalo de nuevo en unos segundos.',
    }
  }

  const totalSeats = clampSeats(input.seats, MAX_TOTAL_SEATS)
  const safeTotal = totalSeats > 0 ? totalSeats : 1
  const now = Date.now()

  const newDocRef = doc(tablesCollectionRef)
  const stored: FirestoreTable = {
    game: input.game,
    host: input.host,
    seats: {
      total: safeTotal,
      taken: Math.min(safeTotal, 1),
    },
    start: input.start,
    room: input.room,
    description: input.description,
    joinedBy: [deviceId],
    createdAt: now,
    updatedAt: now,
    coverUrl: input.coverUrl ?? null,
    participants: [
      {
        deviceId,
        name: input.host,
      },
    ],
    status: 'open',
    activePlayId: null,
    currentPlayers: [],
    startedAt: null,
    completedAt: null,
    resultSummary: null,
    chronicles: {},
  }

  try {
    await setDoc(newDocRef, stored)
    markTableAsJoinedLocally(newDocRef.id)
    void logActivity(
      {
        type: 'table:create',
        entityId: newDocRef.id,
        entityName: input.game,
        message: 'Mesa publicada en el tablón',
        metadata: {
          seatsTotal: safeTotal,
          seatsTaken: Math.min(safeTotal, 1),
          room: stored.room,
          start: stored.start,
        },
      },
      { deviceId },
    )
    return {
      status: 'success',
      message: 'Mesa publicada y plaza reservada para ti.',
      table: mapFirestoreTable(newDocRef.id, stored, true),
    }
  } catch (error) {
    console.error('No se pudo crear la mesa en Firestore', error)
    return {
      status: 'error',
      message: 'No se pudo publicar la mesa. Inténtalo de nuevo en unos segundos.',
    }
  }
}

async function joinTableInFirestore(
  tableId: string,
  deviceId: string,
  participantName: string,
): Promise<TableActionResult> {
  if (!tablesCollectionRef) {
    return {
      status: 'error',
      message: 'No se pudo apuntar a la mesa. Prueba de nuevo en unos segundos.',
    }
  }

  try {
    const result = await runTransaction<FirestoreActionResult>(db, async (transaction) => {
      const tableRef = doc(tablesCollectionRef, tableId)
      const snapshot = await transaction.get(tableRef)

      if (!snapshot.exists()) {
        return {
          status: 'error',
          message: 'La mesa ya no está disponible.',
        }
      }

      const rawData = snapshot.data() as FirestoreTable
      const joinedBy = Array.isArray(rawData.joinedBy) ? [...rawData.joinedBy] : []
      const totalSeats = clampSeats(rawData.seats?.total ?? 4, MAX_TOTAL_SEATS)
      const takenSeats = clampSeats(rawData.seats?.taken ?? 0, totalSeats)
      const participants = Array.isArray(rawData.participants)
        ? rawData.participants.map((participant) => ({
            deviceId:
              typeof participant.deviceId === 'string' || participant.deviceId === null
                ? participant.deviceId
                : null,
            name: participant.name ?? rawData.host,
          }))
        : [{ deviceId: null, name: rawData.host }]

      const normalizedData: FirestoreTable = {
        ...rawData,
        seats: {
          total: totalSeats,
          taken: takenSeats,
        },
        joinedBy,
        participants,
      }

      if (joinedBy.includes(deviceId)) {
        return {
          status: 'already-joined',
          message: `${rawData.game}: ya estás apuntado`,
          data: normalizedData,
        }
      }

      if (takenSeats >= totalSeats) {
        return {
          status: 'full',
          message: `${rawData.game}: no quedan plazas libres`,
          data: normalizedData,
        }
      }

      const nextTaken = Math.min(totalSeats, takenSeats + 1)
      const nextJoined = [...joinedBy, deviceId]
      const hasParticipant = participants.some((participant) => participant.deviceId === deviceId)
      const nextParticipants = hasParticipant
        ? participants
        : [...participants, { deviceId, name: participantName }]

      transaction.update(tableRef, {
        seats: {
          total: totalSeats,
          taken: nextTaken,
        },
        joinedBy: nextJoined,
        participants: nextParticipants,
        updatedAt: Date.now(),
      })

      return {
        status: 'success',
        message: `${rawData.game}: plaza reservada`,
        data: {
          ...normalizedData,
          seats: {
            total: totalSeats,
            taken: nextTaken,
          },
          joinedBy: nextJoined,
          participants: nextParticipants,
        },
      }
    })

    if (result.data) {
      const joined = Array.isArray(result.data.joinedBy) ? result.data.joinedBy.includes(deviceId) : false
      if (joined) {
        markTableAsJoinedLocally(tableId)
      } else {
        unmarkTableAsJoinedLocally(tableId)
      }

      if (result.status === 'success') {
        const seatsInfo = result.data.seats ?? { total: null, taken: null }
        void logActivity(
          {
            type: 'table:join',
            entityId: tableId,
            entityName: result.data.game,
            message: 'Plaza reservada en la mesa',
            metadata: {
              seatsTotal: seatsInfo.total,
              seatsTaken: seatsInfo.taken,
            },
          },
          { deviceId },
        )
      }

      return {
        status: result.status,
        message: result.message,
        table: mapFirestoreTable(tableId, result.data, joined),
      }
    }

    return {
      status: result.status,
      message: result.message,
    }
  } catch (error) {
    console.error('No se pudo apuntar a la mesa en Firestore', error)
    return {
      status: 'error',
      message: 'No se pudo apuntar a la mesa. Prueba de nuevo en unos segundos.',
    }
  }
}

function mapFirestoreTable(id: string, data: FirestoreTable, joined: boolean): TableRecord {
  const totalSeats = clampSeats(data.seats?.total ?? 4, MAX_TOTAL_SEATS)
  const takenSeats = clampSeats(data.seats?.taken ?? 0, totalSeats)

  const createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now()
  const participants = Array.isArray(data.participants)
    ? data.participants
        .filter((participant) => participant && typeof participant.name === 'string')
        .map((participant) => ({
          deviceId:
            typeof participant.deviceId === 'string' || participant.deviceId === null
              ? participant.deviceId
              : null,
          name: participant.name ?? data.host,
        }))
    : [{ deviceId: null, name: data.host }]
  const currentPlayers = Array.isArray(data.currentPlayers)
    ? data.currentPlayers
        .filter((participant) => participant && typeof participant.name === 'string')
        .map((participant) => ({
          deviceId:
            typeof participant.deviceId === 'string' || participant.deviceId === null
              ? participant.deviceId
              : null,
          name: participant.name ?? data.host,
        }))
    : []
  const chronicles = data.chronicles ?? {}
  const status: TableStatus = data.status ?? 'open'

  return {
    id,
    game: data.game,
    host: data.host,
    seats: {
      total: totalSeats,
      taken: takenSeats,
    },
    start: data.start,
    room: data.room,
    description: data.description,
    joined,
    createdAt,
    coverUrl: data.coverUrl ?? null,
    participants,
    status,
    activePlayId: data.activePlayId ?? null,
    currentPlayers,
    startedAt: typeof data.startedAt === 'number' ? data.startedAt : null,
    completedAt: typeof data.completedAt === 'number' ? data.completedAt : null,
    resultSummary: typeof data.resultSummary === 'string' ? data.resultSummary : null,
    chronicles,
  }
}

function clampSeats(value: number, max?: number): number {
  const parsed = Number.isFinite(value) ? Math.floor(value) : 0
  const normalized = parsed < 0 ? 0 : parsed
  if (typeof max === 'number') {
    return Math.min(normalized, max)
  }

  return normalized
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `table-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

async function simulateDelay(ms = 120) {
  if (ms <= 0) {
    return
  }

  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function fetchTables(): Promise<TableRecord[]> {
  await simulateDelay()
  if (useFirestore) {
    const deviceId = getClientDeviceId()
    return fetchTablesFromFirestore(deviceId)
  }

  const tables = readLocalTables()
  return tables
    .slice()
    .sort((first, second) => second.createdAt - first.createdAt)
    .map(localTableToRecord)
}

export async function createTableEntry(input: CreateTableInput): Promise<TableActionResult> {
  await simulateDelay(150)

  if (useFirestore) {
    const deviceId = getClientDeviceId()
    return createTableInFirestore(input, deviceId)
  }

  try {
    const tables = readLocalTables()
    const totalSeats = clampSeats(input.seats, MAX_TOTAL_SEATS)
    const safeTotal = totalSeats > 0 ? totalSeats : 1
    const now = Date.now()

    const storedTable: StoredTable = normalizeLocalTable({
      id: generateId(),
      game: input.game,
      host: input.host,
      seats: {
        total: safeTotal,
        taken: Math.min(safeTotal, 1),
      },
      start: input.start,
      room: input.room,
      description: input.description,
      joinedByLocal: true,
      createdAt: now,
      coverUrl: input.coverUrl ?? null,
      participants: [
        {
          deviceId: null,
          name: input.host,
        },
      ],
      status: 'open',
      activePlayId: null,
      currentPlayers: [],
      startedAt: null,
      completedAt: null,
      resultSummary: null,
      chronicles: {},
    })

    const next = [storedTable, ...tables]
    writeLocalTables(next)
    markTableAsJoinedLocally(storedTable.id)

    return {
      status: 'success',
      message: 'Mesa publicada y plaza reservada para ti.',
      table: localTableToRecord(storedTable),
    }
  } catch (error) {
    console.error('No se pudo crear la mesa', error)
    return {
      status: 'error',
      message: 'No se pudo publicar la mesa. Inténtalo de nuevo en unos segundos.',
    }
  }
}

export async function joinTableEntry(tableId: string, participantName: string): Promise<TableActionResult> {
  await simulateDelay()

  if (useFirestore) {
    const deviceId = getClientDeviceId()
    return joinTableInFirestore(tableId, deviceId, participantName)
  }

  try {
    const tables = readLocalTables()
    const index = tables.findIndex((table) => table.id === tableId)
    if (index === -1) {
      return {
        status: 'error',
        message: 'La mesa ya no está disponible.',
      }
    }

    const table = tables[index]

    const status = table.status ?? 'open'
    if (status !== 'open') {
      return {
        status: 'error',
        message: `${table.game}: la partida ya está en marcha o finalizada.`,
        table: localTableToRecord({ ...table }),
      }
    }

    if (table.joinedByLocal) {
      markTableAsJoinedLocally(table.id)
      const participants = table.participants ?? []
      const hasParticipant = participants.some((participant) => participant.name === participantName)
      if (!hasParticipant) {
        table.participants = [...participants, { deviceId: null, name: participantName }]
      }
      return {
        status: 'already-joined',
        message: `${table.game}: ya estás apuntado`,
        table: localTableToRecord({ ...table }),
      }
    }

    if (table.seats.taken >= table.seats.total) {
      unmarkTableAsJoinedLocally(table.id)
      return {
        status: 'full',
        message: `${table.game}: no quedan plazas libres`,
        table: localTableToRecord({ ...table }),
      }
    }

    const updated: StoredTable = normalizeLocalTable({
      ...table,
      seats: {
        total: table.seats.total,
        taken: Math.min(table.seats.total, table.seats.taken + 1),
      },
      joinedByLocal: true,
      participants: [...(table.participants ?? []), { deviceId: null, name: participantName }],
    })

    const next = [...tables]
    next[index] = updated
    writeLocalTables(next)
    markTableAsJoinedLocally(tableId)

    return {
      status: 'success',
      message: `${table.game}: plaza reservada`,
      table: localTableToRecord(updated),
    }
  } catch (error) {
    console.error('No se pudo apuntar a la mesa', error)
    return {
      status: 'error',
      message: 'No se pudo apuntar a la mesa. Prueba de nuevo en unos segundos.',
    }
  }
}

export async function startTableEntry(tableId: string, input: StartTableInput): Promise<TableActionResult> {
  await simulateDelay(150)

  if (useFirestore) {
    return {
      status: 'error',
      message: 'La sincronización remota de partidas se habilitará en una próxima versión.',
    }
  }

  const playerNames = normalizePlayerNames(input.players)
  if (playerNames.length === 0) {
    return {
      status: 'error',
      message: 'Selecciona al menos una persona que vaya a jugar.',
    }
  }

  const tables = readLocalTables()
  const index = tables.findIndex((table) => table.id === tableId)
  if (index === -1) {
    return {
      status: 'error',
      message: 'La mesa ya no está disponible.',
    }
  }

  const table = tables[index]
  if ((table.status ?? 'open') !== 'open') {
    return {
      status: 'error',
      message: `${table.game}: la partida ya está en marcha o finalizada.`,
      table: localTableToRecord({ ...table }),
    }
  }

  const resolvedRoom = input.room.trim() || table.room
  const parsedStart = input.startTime && !Number.isNaN(Date.parse(input.startTime))
    ? new Date(Date.parse(input.startTime))
    : new Date()
  const startIso = parsedStart.toISOString()

  const participants = table.participants ?? []
  const knownNames = new Set(participants.map((participant) => participant.name.toLowerCase()))
  playerNames.forEach((name) => {
    if (!knownNames.has(name.toLowerCase())) {
      participants.push({ deviceId: null, name })
      knownNames.add(name.toLowerCase())
    }
  })

  const currentPlayers = playerNames.map((name) => ({ deviceId: null, name }))
  const startedAt = Date.now()

  const playRecord = registerPlay({
    game: table.game,
    players: playerNames,
    startTime: startIso,
    room: resolvedRoom,
    durationMinutes: table.seats.total ? Math.min(table.seats.total * 20, 240) : undefined,
    notes: table.description,
  })

  const updatedRaw: StoredTable = {
    ...table,
    participants,
    currentPlayers,
    status: 'in-progress',
    activePlayId: playRecord.id,
    startedAt,
    completedAt: null,
    resultSummary: null,
    chronicles: {},
    room: resolvedRoom,
    start: formatTimeLabelFromDate(parsedStart),
    seats: {
      total: table.seats.total,
      taken: Math.min(table.seats.total, Math.max(playerNames.length, table.seats.taken)),
    },
    joinedByLocal: true,
  }

  const normalized = normalizeLocalTable(updatedRaw)
  tables[index] = normalized
  writeLocalTables(tables)

  const deviceId = getClientDeviceId()
  void logActivity(
    {
      type: 'table:start',
      entityId: tableId,
      entityName: table.game,
      message: 'La partida ha comenzado',
      metadata: {
        room: resolvedRoom,
        players: playerNames.length,
      },
    },
    { deviceId },
  )

  return {
    status: 'success',
    message: 'Partida iniciada. ¡Buen juego!',
    table: localTableToRecord(normalized),
  }
}

export async function completeTableEntry(tableId: string, input: CompleteTableInput): Promise<TableActionResult> {
  await simulateDelay(150)

  if (useFirestore) {
    return {
      status: 'error',
      message: 'El cierre de partidas aún no está disponible con sincronización remota.',
    }
  }

  const tables = readLocalTables()
  const index = tables.findIndex((table) => table.id === tableId)
  if (index === -1) {
    return {
      status: 'error',
      message: 'La mesa ya no está disponible.',
    }
  }

  const table = tables[index]
  if ((table.status ?? 'open') !== 'in-progress') {
    return {
      status: 'error',
      message: `${table.game}: la mesa no está marcada como en juego.`,
      table: localTableToRecord({ ...table }),
    }
  }

  const resultSummary = input.result.trim()
  const chronicles: TableChronicles = {}
  const referencePlayers = (table.currentPlayers && table.currentPlayers.length > 0
    ? table.currentPlayers
    : table.participants ?? []).map((participant) => participant.name.toLowerCase())

  Object.entries(input.chronicles ?? {}).forEach(([name, text]) => {
    const trimmedName = name.trim()
    const trimmedText = text.trim()
    if (!trimmedName || !trimmedText) {
      return
    }

    // permit cualquier jugador, pero preferimos los que ya están en la mesa
    if (referencePlayers.length === 0 || referencePlayers.includes(trimmedName.toLowerCase())) {
      chronicles[trimmedName] = trimmedText
    }
  })

  const completedAt = Date.now()

  if (table.activePlayId) {
    completePlay(table.activePlayId, {
      result: resultSummary,
      chronicles,
      endedAt: new Date(completedAt).toISOString(),
    })
  }

  const updatedRaw: StoredTable = {
    ...table,
    status: 'completed',
    activePlayId: null,
    currentPlayers: [],
    completedAt,
    resultSummary: resultSummary || null,
    chronicles,
  }

  const normalized = normalizeLocalTable(updatedRaw)
  tables[index] = normalized
  writeLocalTables(tables)

  const deviceId = getClientDeviceId()
  void logActivity(
    {
      type: 'table:finish',
      entityId: tableId,
      entityName: table.game,
      message: 'La partida ha finalizado',
      metadata: {
        result: resultSummary || 'Partida cerrada',
        chronicles: Object.keys(chronicles).length,
      },
    },
    { deviceId },
  )

  return {
    status: 'success',
    message: 'Partida finalizada y registrada correctamente.',
    table: localTableToRecord(normalized),
  }
}

export function resetTablesForTests() {
  if (useFirestore) {
    console.warn('resetTablesForTests solo está disponible en modo local.')
    return
  }

  writeLocalTables(seedTables.map(cloneLocalTable))
  persistJoinedTableIds(new Set())
}

type TablesState = {
  loading: boolean
  error: string | null
  tables: TableRecord[]
}

type UseTablesService = TablesState & {
  refresh: () => Promise<void>
  createTable: (input: CreateTableInput) => Promise<TableActionResult>
  joinTable: (tableId: string, participantName: string) => Promise<TableActionResult>
  startTable: (tableId: string, input: StartTableInput) => Promise<TableActionResult>
  completeTable: (tableId: string, input: CompleteTableInput) => Promise<TableActionResult>
}

export function useTablesService(): UseTablesService {
  const [state, setState] = useState<TablesState>({ loading: true, error: null, tables: [] })

  useEffect(() => {
    if (!useFirestore) {
      return
    }

    const deviceId = getClientDeviceId()

    setState((current) => ({ ...current, loading: true, error: null }))

    const unsubscribe = subscribeTablesFromFirestore(
      deviceId,
      (tables) => {
        setState({ loading: false, error: null, tables })
      },
      (message) => {
        setState((current) => ({ ...current, loading: false, error: message }))
      },
    )

    return () => {
      unsubscribe()
    }
  }, [])

  const loadTables = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const list = await fetchTables()
      setState({ loading: false, error: null, tables: list })
    } catch (error) {
      console.error('Error al cargar las mesas', error)
      setState({ loading: false, error: 'No se pudieron cargar las mesas. Intenta recargar.', tables: [] })
    }
  }, [])

  useEffect(() => {
    void loadTables()
  }, [loadTables])

  useEffect(() => {
    if (useFirestore || typeof window === 'undefined') {
      return
    }

    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        void loadTables()
      }
    }

    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('storage', handler)
    }
  }, [loadTables])

  const handleCreate = useCallback(async (input: CreateTableInput) => {
    const result = await createTableEntry(input)
    if (result.table) {
      setState((current) => {
        const nextTables = [result.table!, ...current.tables.filter((table) => table.id !== result.table!.id)]
        return {
          loading: false,
          error: null,
          tables: nextTables.sort((first, second) => second.createdAt - first.createdAt),
        }
      })
    }
    if (result.status === 'error') {
      setState((current) => ({ ...current, error: 'No se pudo publicar la mesa. Revisa tu conexión.' }))
    }

    return result
  }, [])

  const handleJoin = useCallback(async (tableId: string, participantName: string) => {
    const result = await joinTableEntry(tableId, participantName)
    if (result.table) {
      setState((current) => ({
        loading: false,
        error: null,
        tables: current.tables
          .map((table) => (table.id === result.table!.id ? result.table! : table))
          .sort((first, second) => second.createdAt - first.createdAt),
      }))
    }
    if (result.status === 'error') {
      setState((current) => ({ ...current, error: 'No se pudo actualizar la mesa. Revisa tu conexión.' }))
    }

    return result
  }, [])

  const handleStart = useCallback(async (tableId: string, startInput: StartTableInput) => {
    const result = await startTableEntry(tableId, startInput)
    if (result.table) {
      setState((current) => ({
        loading: false,
        error: null,
        tables: current.tables
          .map((table) => (table.id === result.table!.id ? result.table! : table))
          .sort((first, second) => second.createdAt - first.createdAt),
      }))
    }
    if (result.status === 'error') {
      setState((current) => ({ ...current, error: result.message ?? 'No se pudo iniciar la partida.' }))
    }

    return result
  }, [])

  const handleComplete = useCallback(async (tableId: string, completeInput: CompleteTableInput) => {
    const result = await completeTableEntry(tableId, completeInput)
    if (result.table) {
      setState((current) => ({
        loading: false,
        error: null,
        tables: current.tables
          .map((table) => (table.id === result.table!.id ? result.table! : table))
          .sort((first, second) => second.createdAt - first.createdAt),
      }))
    }
    if (result.status === 'error') {
      setState((current) => ({ ...current, error: result.message ?? 'No se pudo finalizar la partida.' }))
    }

    return result
  }, [])

  return useMemo(
    () => ({
      ...state,
      refresh: loadTables,
      createTable: handleCreate,
      joinTable: handleJoin,
      startTable: handleStart,
      completeTable: handleComplete,
    }),
    [handleComplete, handleCreate, handleJoin, handleStart, loadTables, state],
  )
}
