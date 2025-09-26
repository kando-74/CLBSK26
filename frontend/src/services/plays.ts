import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'
import { db } from '../utils/firebase'

export type PlaysFilter = {
  dayStart?: Date
  dayEnd?: Date
  status?: PlayStatus | 'all'
  room?: string | null
}

export type PlayStatus = 'in-progress' | 'completed'

export type PlayChronicles = Record<string, string>

export type RoomOccupancySummary = Record<string, { activePlays: number; players: number }>

export type PlayRecord = {
  id: string
  tableId: string | null
  game: string
  players: string[]
  startTime: string
  room: string
  durationMinutes: number | null
  notes?: string | null
  recordedAt: number
  status: PlayStatus
  resultSummary: string | null
  chronicles: PlayChronicles
  endedAt: string | null
}

export type RegisterPlayInput = {
  tableId?: string | null
  game: string
  players: string[]
  startTime: string
  room: string
  durationMinutes?: number | null
  notes?: string | null
}

export type CompletePlayInput = {
  result: string
  chronicles: PlayChronicles
  endedAt?: string
}

const STORAGE_KEY = 'clbsk_event_plays_v1'
const now = new Date()

const seedPlays: PlayRecord[] = [
  {
    id: 'seed-play-heat-1',
    tableId: null,
    game: 'Heat: Pedal to the Metal',
    players: ['Ana', 'Luis', 'María', 'Jorge'],
    startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0, 0).toISOString(),
    room: 'Sala Roja',
    durationMinutes: 70,
    notes: 'Carrera con módulo Weather',
    recordedAt: Date.now() - 1000 * 60 * 35,
    status: 'completed',
    resultSummary: 'Ana gana por 12 puntos',
    chronicles: {
      Ana: 'Carrera muy reñida hasta la última curva.',
      Luis: 'Volveremos a jugar con la expansión Meteo.',
    },
    endedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 10, 0, 0).toISOString(),
  },
  {
    id: 'seed-play-earth-1',
    tableId: null,
    game: 'Earth',
    players: ['Claudia', 'Inés', 'Raúl'],
    startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 30, 0, 0).toISOString(),
    room: 'Sala Verde',
    durationMinutes: 90,
    notes: null,
    recordedAt: Date.now() - 1000 * 60 * 90,
    status: 'in-progress',
    resultSummary: null,
    chronicles: {},
    endedAt: null,
  },
  {
    id: 'seed-play-scout-1',
    tableId: null,
    game: 'Scout',
    players: ['Ana', 'María', 'Claudia'],
    startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 45, 0, 0).toISOString(),
    room: 'Lobby principal',
    durationMinutes: 25,
    notes: 'Dos rondas seguidas',
    recordedAt: Date.now() - 1000 * 60 * 15,
    status: 'completed',
    resultSummary: 'Victoria compartida de Ana y María',
    chronicles: {
      Ana: 'Scout siempre es un acierto para cerrar la jornada.',
    },
    endedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 15, 0, 0).toISOString(),
  },
]

const forceLocalPlays = import.meta.env.VITE_FORCE_LOCAL_PLAYS === 'true'
const isTestEnvironment = import.meta.env.MODE === 'test'
const useFirestore = !forceLocalPlays && !isTestEnvironment
const playsCollectionRef = useFirestore ? collection(db, 'boardPlays') : null
const SEED_PREFIX = 'seed-play-'
let cachedPlaysMemory: PlayRecord[] | null = null
let remoteSourceInitialized = false

function resolveStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch (error) {
    console.warn('No se pudo acceder a localStorage para partidas', error)
    return null
  }
}

function parseStoredPlays(raw: string | null): PlayRecord[] {
  if (!raw) {
    return seedPlays.slice()
  }

  try {
    const parsed = JSON.parse(raw) as PlayRecord[]
    return parsed.map(normalizeLocalPlay)
  } catch (error) {
    console.warn('Datos de partidas corruptos, restableciendo', error)
    return seedPlays.slice()
  }
}

function normalizeLocalPlay(play: PlayRecord): PlayRecord {
  const players = Array.isArray(play.players)
    ? play.players.filter((player) => typeof player === 'string' && player.trim().length > 0)
    : []

  return {
    id: typeof play.id === 'string' ? play.id : `play-${Math.random().toString(36).slice(2)}`,
    tableId: typeof play.tableId === 'string' ? play.tableId : null,
    game: typeof play.game === 'string' ? play.game : 'Juego sin nombre',
    players,
    startTime:
      typeof play.startTime === 'string' && !Number.isNaN(Date.parse(play.startTime))
        ? new Date(play.startTime).toISOString()
        : new Date().toISOString(),
    room: typeof play.room === 'string' ? play.room : 'Sala por confirmar',
    durationMinutes: Number.isFinite(play.durationMinutes) ? Number(play.durationMinutes) : null,
    notes: typeof play.notes === 'string' ? play.notes : null,
    recordedAt: Number.isFinite(play.recordedAt) ? Number(play.recordedAt) : Date.now(),
    status: play.status === 'completed' ? 'completed' : 'in-progress',
    resultSummary: typeof play.resultSummary === 'string' ? play.resultSummary : null,
    chronicles: sanitizeChronicles(play.chronicles ?? {}),
    endedAt:
      typeof play.endedAt === 'string' && !Number.isNaN(Date.parse(play.endedAt))
        ? new Date(play.endedAt).toISOString()
        : null,
  }
}

function readLocalPlays(): PlayRecord[] {
  if (cachedPlaysMemory) {
    const sanitized = remoteSourceInitialized ? removeSeedPlays(cachedPlaysMemory) : cachedPlaysMemory
    if (remoteSourceInitialized) {
      cachedPlaysMemory = sanitized.slice()
    }
    return sanitized.slice()
  }

  const storage = resolveStorage()
  if (!storage) {
    cachedPlaysMemory = seedPlays.slice()
    const sanitized = remoteSourceInitialized ? removeSeedPlays(cachedPlaysMemory) : cachedPlaysMemory
    return sanitized.slice()
  }

  const raw = storage.getItem(STORAGE_KEY)
  let plays = parseStoredPlays(raw)
  if (remoteSourceInitialized) {
    plays = removeSeedPlays(plays)
  }
  if (!raw || remoteSourceInitialized) {
    storage.setItem(STORAGE_KEY, JSON.stringify(plays))
  }
  cachedPlaysMemory = plays.slice()
  if (remoteSourceInitialized) {
    cachedPlaysMemory = removeSeedPlays(cachedPlaysMemory)
  }
  return cachedPlaysMemory.slice()
}

function writeLocalPlays(plays: PlayRecord[]) {
  const sanitized = remoteSourceInitialized ? removeSeedPlays(plays) : plays
  cachedPlaysMemory = sanitized.slice()
  const storage = resolveStorage()
  if (!storage) {
    return
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
}

function getCachedPlays(): PlayRecord[] {
  return readLocalPlays()
}

function upsertCachedPlay(play: PlayRecord): PlayRecord[] {
  const base = remoteSourceInitialized ? removeSeedPlays(getCachedPlays()) : getCachedPlays()
  const index = base.findIndex((item) => item.id === play.id)
  let next: PlayRecord[]

  if (index === -1) {
    next = [play, ...base]
  } else {
    next = base.slice()
    next[index] = play
  }

  const sorted = sortByRecordedAt(next)
  writeLocalPlays(sorted)
  return sorted
}

function mergeCachedPlays(plays: PlayRecord[]): PlayRecord[] {
  const current = remoteSourceInitialized ? removeSeedPlays(getCachedPlays()) : getCachedPlays()

  if (plays.length === 0) {
    writeLocalPlays(current)
    return current
  }

  const byId = new Map<string, PlayRecord>()

  current.forEach((play) => byId.set(play.id, play))
  plays.forEach((play) => byId.set(play.id, play))

  const merged = sortByRecordedAt(Array.from(byId.values()))
  const sanitized = remoteSourceInitialized ? removeSeedPlays(merged) : merged
  writeLocalPlays(sanitized)
  return sanitized
}

function removeSeedPlays(plays: PlayRecord[]): PlayRecord[] {
  return plays.filter((play) => !play.id.startsWith(SEED_PREFIX))
}

function sortByRecordedAt(plays: PlayRecord[]): PlayRecord[] {
  return plays.slice().sort((first, second) => second.recordedAt - first.recordedAt)
}

function sanitizeChronicles(value: PlayChronicles | unknown): PlayChronicles {
  const sanitized: PlayChronicles = {}
  if (!value || typeof value !== 'object') {
    return sanitized
  }

  Object.entries(value as PlayChronicles).forEach(([name, text]) => {
    if (typeof name !== 'string' || typeof text !== 'string') {
      return
    }

    const trimmedName = name.trim()
    const trimmedText = text.trim()
    if (!trimmedName || !trimmedText) {
      return
    }

    sanitized[trimmedName] = trimmedText
  })

  return sanitized
}

function normalizePlayers(players: string[]): string[] {
  return players
    .map((player) => player.trim())
    .filter((player) => player.length > 0)
}

function minutesFromIso(iso: string): number | null {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) {
    return null
  }

  return Math.floor(parsed / 60000)
}

function mapFirestorePlay(id: string, data: Record<string, unknown>): PlayRecord {
  const players = Array.isArray(data.players)
    ? data.players.filter((player) => typeof player === 'string').map((player) => (player as string).trim()).filter(Boolean)
    : []

  return {
    id,
    tableId: typeof data.tableId === 'string' ? (data.tableId as string) : null,
    game: typeof data.game === 'string' ? (data.game as string) : 'Juego sin nombre',
    players,
    startTime:
      typeof data.startTime === 'string' && !Number.isNaN(Date.parse(data.startTime as string))
        ? new Date(data.startTime as string).toISOString()
        : new Date().toISOString(),
    room: typeof data.room === 'string' ? (data.room as string) : 'Sala por confirmar',
    durationMinutes: typeof data.durationMinutes === 'number' ? (data.durationMinutes as number) : null,
    notes: typeof data.notes === 'string' ? (data.notes as string) : null,
    recordedAt: typeof data.recordedAt === 'number' ? (data.recordedAt as number) : Date.now(),
    status: data.status === 'completed' ? 'completed' : 'in-progress',
    resultSummary: typeof data.resultSummary === 'string' ? (data.resultSummary as string) : null,
    chronicles: sanitizeChronicles(data.chronicles),
    endedAt:
      typeof data.endedAt === 'string' && !Number.isNaN(Date.parse(data.endedAt as string))
        ? new Date(data.endedAt as string).toISOString()
        : null,
  }
}

function generateId(): string {
  return `play-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

export async function registerPlay(input: RegisterPlayInput): Promise<PlayRecord> {
  const normalizedPlayers = normalizePlayers(input.players)
  const nowDate = new Date()
  const start = Date.parse(input.startTime)
  const startIso = Number.isNaN(start)
    ? new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0).toISOString()
    : new Date(start).toISOString()

  if (useFirestore && playsCollectionRef) {
    try {
      const playRef = doc(playsCollectionRef)
      const payload = {
        tableId: input.tableId ?? null,
        game: input.game.trim() || 'Partida sin nombre',
        gameLower: (input.game.trim() || 'Partida sin nombre').toLowerCase(),
        players: normalizedPlayers,
        room: input.room.trim() || 'Sala por confirmar',
        startTime: startIso,
        durationMinutes:
          typeof input.durationMinutes === 'number' && Number.isFinite(input.durationMinutes)
            ? Math.max(5, Math.floor(input.durationMinutes))
            : null,
        notes: input.notes?.trim() || null,
        recordedAt: Date.now(),
        status: 'in-progress' as PlayStatus,
        resultSummary: null,
        chronicles: {},
        endedAt: null,
      }

      await setDoc(playRef, payload)
      remoteSourceInitialized = true
      const mapped = mapFirestorePlay(playRef.id, payload)
      upsertCachedPlay(mapped)
      return mapped
    } catch (error) {
      console.error('No se pudo registrar la partida en Firestore, usando caché local', error)
    }
  }

  const plays = readLocalPlays()

  const newPlay: PlayRecord = {
    id: generateId(),
    tableId: input.tableId ?? null,
    game: input.game.trim() || 'Partida sin nombre',
    players: normalizedPlayers,
    startTime: startIso,
    room: input.room.trim() || 'Sala por confirmar',
    durationMinutes:
      typeof input.durationMinutes === 'number' && Number.isFinite(input.durationMinutes)
        ? Math.max(5, Math.floor(input.durationMinutes))
        : null,
    notes: input.notes?.trim() || null,
    recordedAt: Date.now(),
    status: 'in-progress',
    resultSummary: null,
    chronicles: {},
    endedAt: null,
  }

  const next = [newPlay, ...plays]
  writeLocalPlays(next)
  return newPlay
}

export async function completePlay(playId: string, input: CompletePlayInput): Promise<PlayRecord | null> {
  const sanitizedChronicles = sanitizeChronicles(input.chronicles)
  const resultSummary = input.result.trim()
  const endedAtIso = input.endedAt && !Number.isNaN(Date.parse(input.endedAt))
    ? new Date(input.endedAt).toISOString()
    : new Date().toISOString()

  if (useFirestore && playsCollectionRef) {
    try {
      const playRef = doc(playsCollectionRef, playId)
      await updateDoc(playRef, {
        status: 'completed',
        resultSummary: resultSummary || null,
        chronicles: sanitizedChronicles,
        endedAt: endedAtIso,
      })

      const snapshot = await getDoc(playRef)
      if (!snapshot.exists()) {
        return null
      }

      const mapped = mapFirestorePlay(snapshot.id, snapshot.data() as Record<string, unknown>)
      remoteSourceInitialized = true
      upsertCachedPlay(mapped)
      return mapped
    } catch (error) {
      console.error('No se pudo cerrar la partida en Firestore', error)
      return null
    }
  }

  const plays = readLocalPlays()
  const index = plays.findIndex((play) => play.id === playId)
  if (index === -1) {
    return null
  }

  const base = plays[index]
  const updated = normalizeLocalPlay({
    ...base,
    status: 'completed',
    resultSummary: resultSummary || base.resultSummary,
    chronicles: { ...base.chronicles, ...sanitizedChronicles },
    endedAt: endedAtIso,
  })

  const next = plays.slice()
  next[index] = updated
  writeLocalPlays(next)

  return updated
}

export async function listPlays(filters: PlaysFilter = {}): Promise<PlayRecord[]> {
  if (useFirestore && playsCollectionRef) {
    try {
      const constraints = [orderBy('recordedAt', 'desc')]

      if (filters.status && filters.status !== 'all') {
        constraints.push(where('status', '==', filters.status))
      }

      if (filters.room && filters.room.trim()) {
        constraints.push(where('room', '==', filters.room.trim()))
      }

      const snapshot = await getDocs(query(playsCollectionRef, ...constraints))
      const plays = snapshot.docs.map((document) => mapFirestorePlay(document.id, document.data() as Record<string, unknown>))

      remoteSourceInitialized = true
      mergeCachedPlays(plays)

      return plays.filter((play) => {
        if (filters.dayStart && Date.parse(play.startTime) < filters.dayStart.getTime()) {
          return false
        }

        if (filters.dayEnd && Date.parse(play.startTime) > filters.dayEnd.getTime()) {
          return false
        }

        return true
      })
    } catch (error) {
      console.error('No se pudieron obtener las partidas', error)
      return []
    }
  }

  return readLocalPlays()
    .filter((play) => {
      if (filters.status && filters.status !== 'all' && play.status !== filters.status) {
        return false
      }

      if (filters.room && filters.room.trim() && play.room !== filters.room.trim()) {
        return false
      }

      if (filters.dayStart && Date.parse(play.startTime) < filters.dayStart.getTime()) {
        return false
      }

      if (filters.dayEnd && Date.parse(play.startTime) > filters.dayEnd.getTime()) {
        return false
      }

      return true
    })
    .sort((first, second) => Date.parse(second.startTime) - Date.parse(first.startTime))
}

export async function listActivePlays(filters: Omit<PlaysFilter, 'status'> = {}): Promise<PlayRecord[]> {
  return listPlays({ ...filters, status: 'in-progress' })
}

export function summarizeRoomOccupancy(plays: PlayRecord[]): RoomOccupancySummary {
  return plays.reduce<RoomOccupancySummary>((accumulator, play) => {
    const room = play.room || 'Sala sin definir'
    if (!accumulator[room]) {
      accumulator[room] = { activePlays: 0, players: 0 }
    }
    accumulator[room].activePlays += 1
    accumulator[room].players += play.players.length
    return accumulator
  }, {})
}

export type DuplicateQuery = {
  game: string
  players: string[]
  startTime: string
  thresholdMinutes?: number
}
export type DuplicateMatch = {
  play: PlayRecord
  sharedPlayers: number
  sharedPlayersRatio: number
  differenceMinutes: number
}

function computeDuplicateMatches(
  source: PlayRecord[],
  duplicateQuery: DuplicateQuery,
  normalizedPlayers: string[],
): DuplicateMatch[] {
  const threshold =
    typeof duplicateQuery.thresholdMinutes === 'number' ? Math.max(1, duplicateQuery.thresholdMinutes) : 20
  const targetMinutes = minutesFromIso(duplicateQuery.startTime)
  const normalizeGame = (value: string) => value.trim().toLowerCase()
  const targetGame = normalizeGame(duplicateQuery.game)
  const targetSet = new Set(normalizedPlayers.map((player) => player.toLowerCase()))

  const matches = source.reduce<DuplicateMatch[]>((accumulator, play) => {
    if (normalizeGame(play.game) !== targetGame) {
      return accumulator
    }

    const candidateMinutes = minutesFromIso(play.startTime)
    if (targetMinutes !== null && candidateMinutes !== null) {
      const difference = Math.abs(targetMinutes - candidateMinutes)
      if (difference > threshold) {
        return accumulator
      }
    }

    const candidatePlayers = play.players.map((player) => player.toLowerCase())
    const sharedPlayers = candidatePlayers.filter((player) => targetSet.has(player))
    if (sharedPlayers.length === 0) {
      return accumulator
    }

    const ratio = sharedPlayers.length / Math.max(candidatePlayers.length, targetSet.size)
    if (ratio < 0.6) {
      return accumulator
    }

    accumulator.push({
      play,
      sharedPlayers: sharedPlayers.length,
      sharedPlayersRatio: ratio,
      differenceMinutes:
        targetMinutes !== null && candidateMinutes !== null ? Math.abs(targetMinutes - candidateMinutes) : Number.NaN,
    })
    return accumulator
  }, [])

  return matches.sort((a, b) => a.differenceMinutes - b.differenceMinutes)
}

export async function findPotentialDuplicates(duplicateQuery: DuplicateQuery): Promise<DuplicateMatch[]> {
  const normalizedPlayers = normalizePlayers(duplicateQuery.players)

  if (!duplicateQuery.game.trim() || normalizedPlayers.length === 0) {
    return []
  }

  if (useFirestore && playsCollectionRef) {
    try {
      const normalizedGame = duplicateQuery.game.trim().toLowerCase()
      const constraints = [where('gameLower', '==', normalizedGame), orderBy('recordedAt', 'desc'), limit(40)]
      const snapshot = await getDocs(query(playsCollectionRef, ...constraints))
      const remotePlays = snapshot.docs.map((document) =>
        mapFirestorePlay(document.id, document.data() as Record<string, unknown>),
      )

      remoteSourceInitialized = true
      mergeCachedPlays(remotePlays)
      return computeDuplicateMatches(remotePlays, duplicateQuery, normalizedPlayers)
    } catch (error) {
      console.error('No se pudieron buscar duplicados en Firestore, usando caché local', error)
    }
  }

  const localPlays = getCachedPlays()
  return computeDuplicateMatches(localPlays, duplicateQuery, normalizedPlayers)
}

export function useDuplicatePlays(duplicateQuery: DuplicateQuery) {
  const [matches, setMatches] = useState<DuplicateMatch[]>([])

  const refresh = useCallback((nextQuery: DuplicateQuery) => {
    void findPotentialDuplicates(nextQuery).then(setMatches)
  }, [])

  const { game, players, startTime, thresholdMinutes } = duplicateQuery

  useEffect(() => {
    let cancelled = false

    void findPotentialDuplicates({ game, players, startTime, thresholdMinutes }).then((duplicates) => {
      if (!cancelled) {
        setMatches(duplicates)
      }
    })

    return () => {
      cancelled = true
    }
  }, [game, players, startTime, thresholdMinutes])

  return { matches, refresh }
}
