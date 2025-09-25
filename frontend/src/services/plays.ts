import { useCallback, useEffect, useState } from 'react'

export type PlayStatus = 'in-progress' | 'completed'

export type PlayChronicles = Record<string, string>

export type RoomOccupancySummary = Record<string, { activePlays: number; players: number }>

export type PlayRecord = {
  id: string
  game: string
  players: string[]
  startTime: string // ISO string
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

export type DuplicateMatch = {
  play: PlayRecord
  sharedPlayers: number
  sharedPlayersRatio: number
  differenceMinutes: number
}

const STORAGE_KEY = 'clbsk_event_plays_v1'
const now = new Date()
const seedPlays: PlayRecord[] = [
  {
    id: 'seed-play-heat-1',
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
    return parsed.map(normalizePlay)
  } catch (error) {
    console.warn('Datos de partidas corruptos, restableciendo', error)
    return seedPlays.slice()
  }
}

function normalizePlay(play: PlayRecord): PlayRecord {
  const players = Array.isArray(play.players)
    ? play.players.filter((player) => typeof player === 'string' && player.trim().length > 0)
    : []

  const startTimestamp = Number.isFinite(Number(play.startTime))
    ? Number(play.startTime)
    : Date.parse(play.startTime)

  const chronicles: PlayChronicles = {}
  if (play.chronicles && typeof play.chronicles === 'object') {
    Object.entries(play.chronicles).forEach(([name, text]) => {
      if (typeof name === 'string' && typeof text === 'string') {
        const trimmed = text.trim()
        if (trimmed) {
          chronicles[name.trim()] = trimmed
        }
      }
    })
  }

  const endedTimestamp = play.endedAt ? Date.parse(play.endedAt) : NaN

  return {
    id: typeof play.id === 'string' ? play.id : `play-${Math.random().toString(36).slice(2)}`,
    game: typeof play.game === 'string' ? play.game : 'Juego sin nombre',
    players,
    startTime: Number.isFinite(startTimestamp) ? new Date(startTimestamp).toISOString() : new Date().toISOString(),
    room: typeof play.room === 'string' ? play.room : 'Sala por confirmar',
    durationMinutes: Number.isFinite(play.durationMinutes) ? Number(play.durationMinutes) : null,
    notes: typeof play.notes === 'string' ? play.notes : null,
    recordedAt: Number.isFinite(play.recordedAt) ? Number(play.recordedAt) : Date.now(),
    status: play.status === 'completed' ? 'completed' : 'in-progress',
    resultSummary: typeof play.resultSummary === 'string' ? play.resultSummary : null,
    chronicles,
    endedAt: Number.isNaN(endedTimestamp) ? null : new Date(endedTimestamp).toISOString(),
  }
}

function readPlays(): PlayRecord[] {
  const storage = resolveStorage()
  if (!storage) {
    return seedPlays.slice()
  }

  const raw = storage.getItem(STORAGE_KEY)
  const plays = parseStoredPlays(raw)
  if (!raw) {
    storage.setItem(STORAGE_KEY, JSON.stringify(plays))
  }
  return plays
}

function writePlays(plays: PlayRecord[]) {
  const storage = resolveStorage()
  if (!storage) {
    return
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(plays))
}

function generateId(): string {
  return `play-${Math.random().toString(36).slice(2)}-${Date.now()}`
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

export function registerPlay(input: RegisterPlayInput): PlayRecord {
  const plays = readPlays()
  const normalizedPlayers = normalizePlayers(input.players)
  const now = new Date()
  const start = Date.parse(input.startTime)
  const startIso = Number.isNaN(start)
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString()
    : new Date(start).toISOString()

  const newPlay: PlayRecord = {
    id: generateId(),
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
  writePlays(next)
  return newPlay
}

export function completePlay(playId: string, input: CompletePlayInput): PlayRecord | null {
  const plays = readPlays()
  const index = plays.findIndex((play) => play.id === playId)
  if (index === -1) {
    return null
  }

  const base = plays[index]

  const sanitizedChronicles: PlayChronicles = {}
  Object.entries(input.chronicles ?? {}).forEach(([name, text]) => {
    if (typeof name !== 'string' || typeof text !== 'string') {
      return
    }
    const trimmedName = name.trim()
    const trimmedText = text.trim()
    if (!trimmedName || !trimmedText) {
      return
    }
    sanitizedChronicles[trimmedName] = trimmedText
  })

  const mergedChronicles: PlayChronicles = { ...base.chronicles, ...sanitizedChronicles }

  const resultSummary = input.result.trim()
  const parsedEnd = input.endedAt && !Number.isNaN(Date.parse(input.endedAt)) ? new Date(Date.parse(input.endedAt)) : new Date()

  const updated = normalizePlay({
    ...base,
    status: 'completed',
    resultSummary: resultSummary || base.resultSummary,
    chronicles: mergedChronicles,
    endedAt: parsedEnd.toISOString(),
  })

  const next = plays.slice()
  next[index] = updated
  writePlays(next)

  return updated
}

export function listPlays(): PlayRecord[] {
  return readPlays()
    .slice()
    .sort((first, second) => {
      const firstStart = Date.parse(first.startTime)
      const secondStart = Date.parse(second.startTime)
      return secondStart - firstStart
    })
}

export function listActivePlays(): PlayRecord[] {
  return listPlays().filter((play) => play.status === 'in-progress')
}

export function summarizeRoomOccupancy(): RoomOccupancySummary {
  const active = listActivePlays()
  return active.reduce<RoomOccupancySummary>((accumulator, play) => {
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

export function findPotentialDuplicates(query: DuplicateQuery): DuplicateMatch[] {
  const plays = readPlays()
  const normalizedPlayers = normalizePlayers(query.players)
  if (!query.game.trim() || normalizedPlayers.length === 0) {
    return []
  }

  const targetMinutes = minutesFromIso(query.startTime)
  const matches: DuplicateMatch[] = []
  const threshold = typeof query.thresholdMinutes === 'number' ? Math.max(1, query.thresholdMinutes) : 20

  const normalizeGame = (value: string) => value.trim().toLowerCase()
  const targetGame = normalizeGame(query.game)
  const targetSet = new Set(normalizedPlayers.map((player) => player.toLowerCase()))

  plays.forEach((play) => {
    if (normalizeGame(play.game) !== targetGame) {
      return
    }

    const candidateMinutes = minutesFromIso(play.startTime)
    if (targetMinutes !== null && candidateMinutes !== null) {
      const difference = Math.abs(targetMinutes - candidateMinutes)
      if (difference > threshold) {
        return
      }
    }

    const candidatePlayers = play.players.map((player) => player.toLowerCase())
    const sharedPlayers = candidatePlayers.filter((player) => targetSet.has(player))
    if (sharedPlayers.length === 0) {
      return
    }

    const ratio = sharedPlayers.length / Math.max(candidatePlayers.length, targetSet.size)
    if (ratio < 0.6) {
      return
    }

    matches.push({
      play,
      sharedPlayers: sharedPlayers.length,
      sharedPlayersRatio: ratio,
      differenceMinutes:
        targetMinutes !== null && candidateMinutes !== null ? Math.abs(targetMinutes - candidateMinutes) : Number.NaN,
    })
  })

  return matches.sort((a, b) => a.differenceMinutes - b.differenceMinutes)
}

export function useDuplicatePlays(query: DuplicateQuery) {
  const [matches, setMatches] = useState<DuplicateMatch[]>([])

  const refresh = useCallback((nextQuery: DuplicateQuery) => {
    setMatches(findPotentialDuplicates(nextQuery))
  }, [])

  const { game, players, startTime, thresholdMinutes } = query

  useEffect(() => {
    setMatches(findPotentialDuplicates({ game, players, startTime, thresholdMinutes }))
  }, [game, players, startTime, thresholdMinutes])

  return { matches, refresh }
}
