import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, onSnapshot, orderBy, query, runTransaction, setDoc } from 'firebase/firestore'
import { db } from '../utils/firebase'

export type LibraryGameRecord = {
  id: string
  title: string
  owner: string
  players: string
  duration: string
  weight: string
  language: string
  mechanics: string[]
  manual?: boolean
  coverUrl?: string
  bggId?: number
  createdAt: number
}

export type LibraryGameInput = {
  id: string
  title: string
  owner: string
  players: string
  duration: string
  weight: string
  language: string
  mechanics: string[]
  manual?: boolean
  coverUrl?: string
  bggId?: number
}

type LibraryActionStatus = 'success' | 'already-exists' | 'error'

type LibraryActionResult = {
  status: LibraryActionStatus
  message: string
  game?: LibraryGameRecord
}

type StoredGame = LibraryGameRecord

type FirestoreGame = {
  title: string
  owner: string
  players: string
  duration: string
  weight: string
  language: string
  mechanics: string[]
  manual?: boolean
  coverUrl?: string
  bggId?: number
  createdAt: number
  updatedAt?: number
}

const STORAGE_KEY = 'clbsk_library_games_v1'
const FIRESTORE_COLLECTION = 'libraryGames'

const forceLocalLibrary = import.meta.env.VITE_FORCE_LOCAL_LIBRARY === 'true'
const isTestEnvironment = import.meta.env.MODE === 'test'
const useFirestore = !forceLocalLibrary && !isTestEnvironment
const collectionRef = useFirestore ? collection(db, FIRESTORE_COLLECTION) : null

const seedGames: StoredGame[] = [
  {
    id: 'seed-heat',
    title: 'Heat: Pedal to the Metal',
    owner: 'Claudia',
    players: '2-6',
    duration: '60-90 min',
    weight: '2.3',
    language: 'ES',
    mechanics: ['Carreras', 'Gestión de mano'],
    manual: true,
    coverUrl: '/covers/heat-pedal-to-the-metal.svg',
    createdAt: new Date('2024-10-20T18:00:00Z').getTime(),
  },
  {
    id: 'seed-sky-team',
    title: 'Sky Team',
    owner: 'Luis',
    players: '2',
    duration: '25 min',
    weight: '2.0',
    language: 'EN',
    mechanics: ['Cooperativo', 'Tiradas ocultas'],
    manual: true,
    coverUrl: '/covers/sky-team.svg',
    createdAt: new Date('2024-10-22T17:45:00Z').getTime(),
  },
  {
    id: 'seed-kutna-hora',
    title: 'Kutná Hora',
    owner: 'Elena',
    players: '2-4',
    duration: '90-120 min',
    weight: '3.6',
    language: 'ES',
    mechanics: ['Economía', 'Construcción'],
    manual: true,
    coverUrl: '/covers/kutna-hora.svg',
    createdAt: new Date('2024-10-24T19:15:00Z').getTime(),
  },
  {
    id: 'seed-akropolis',
    title: 'Akropolis',
    owner: 'Patricia',
    players: '2-4',
    duration: '30 min',
    weight: '1.9',
    language: 'FR',
    mechanics: ['Puzzle', 'Draft'],
    manual: true,
    coverUrl: '/covers/akropolis.svg',
    createdAt: new Date('2024-10-24T18:10:00Z').getTime(),
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

function normalizeStoredGame(game: StoredGame): StoredGame {
  const rawId = (game as { id?: unknown }).id
  const normalizedId =
    typeof rawId === 'string'
      ? rawId
      : typeof rawId === 'number'
        ? `legacy-${rawId}`
        : `local-${Math.random().toString(36).slice(2)}-${Date.now()}`

  return {
    ...game,
    id: normalizedId,
    mechanics: Array.isArray(game.mechanics) ? game.mechanics : [],
    createdAt: typeof game.createdAt === 'number' ? game.createdAt : Date.now(),
  }
}

function readLocalGames(): StoredGame[] {
  const storage = getStorage()
  if (!storage) {
    return seedGames.map(normalizeStoredGame)
  }

  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) {
    writeLocalGames(seedGames.map(normalizeStoredGame))
    return seedGames.map(normalizeStoredGame)
  }

  try {
    const parsed = JSON.parse(raw) as StoredGame[]
    return parsed.map(normalizeStoredGame)
  } catch (error) {
    console.warn('Datos de ludoteca corruptos, restableciendo', error)
    writeLocalGames(seedGames.map(normalizeStoredGame))
    return seedGames.map(normalizeStoredGame)
  }
}

function writeLocalGames(games: StoredGame[]) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(games))
}

function localGameToRecord(game: StoredGame): LibraryGameRecord {
  return {
    ...game,
    mechanics: [...game.mechanics],
  }
}

async function seedFirestoreGames(): Promise<void> {
  if (!collectionRef) {
    return
  }

  await Promise.all(
    seedGames.map(async (game) => {
      const gameRef = doc(collectionRef, game.id)
      await setDoc(gameRef, {
        title: game.title,
        owner: game.owner,
        players: game.players,
        duration: game.duration,
        weight: game.weight,
        language: game.language,
        mechanics: game.mechanics,
        manual: game.manual ?? false,
        coverUrl: game.coverUrl ?? null,
        bggId: game.bggId ?? null,
        createdAt: game.createdAt,
        updatedAt: Date.now(),
      }, { merge: true })
    }),
  )
}

function mapFirestoreGame(id: string, data: FirestoreGame): LibraryGameRecord {
  return {
    id,
    title: data.title,
    owner: data.owner,
    players: data.players,
    duration: data.duration,
    weight: data.weight,
    language: data.language,
    mechanics: Array.isArray(data.mechanics) ? data.mechanics : [],
    manual: data.manual,
    coverUrl: data.coverUrl ?? undefined,
    bggId: typeof data.bggId === 'number' ? data.bggId : undefined,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
  }
}

async function fetchGamesFromFirestore(): Promise<LibraryGameRecord[]> {
  if (!collectionRef) {
    return []
  }

  const snapshot = await getDocs(query(collectionRef, orderBy('title')))

  if (snapshot.empty) {
    await seedFirestoreGames()
    const seededSnapshot = await getDocs(query(collectionRef, orderBy('title')))
    return seededSnapshot.docs
      .map((document) => mapFirestoreGame(document.id, document.data() as FirestoreGame))
      .sort((first, second) => first.title.localeCompare(second.title, 'es', { sensitivity: 'base' }))
  }

  return snapshot.docs
    .map((document) => mapFirestoreGame(document.id, document.data() as FirestoreGame))
    .sort((first, second) => first.title.localeCompare(second.title, 'es', { sensitivity: 'base' }))
}

function subscribeLibraryGames(
  onUpdate: (games: LibraryGameRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  if (!collectionRef) {
    return () => {}
  }

  const q = query(collectionRef, orderBy('title'))

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const games = snapshot.docs
        .map((document) => mapFirestoreGame(document.id, document.data() as FirestoreGame))
        .sort((first, second) => first.title.localeCompare(second.title, 'es', { sensitivity: 'base' }))

      onUpdate(games)
    },
    (error) => {
      console.error('Error de sincronización en tiempo real de la ludoteca', error)
      onError('No se pudo sincronizar la ludoteca en tiempo real. Revisa tu conexión.')
    },
  )

  return () => {
    unsubscribe()
  }
}

export async function fetchLibraryGames(): Promise<LibraryGameRecord[]> {
  if (useFirestore) {
    return fetchGamesFromFirestore()
  }

  return readLocalGames()
    .slice()
    .sort((first, second) => first.title.localeCompare(second.title, 'es', { sensitivity: 'base' }))
    .map(localGameToRecord)
}

async function addGameToFirestore(input: LibraryGameInput): Promise<LibraryActionResult> {
  if (!collectionRef) {
    return {
      status: 'error',
      message: 'No se pudo guardar el juego. Inténtalo de nuevo en unos segundos.',
    }
  }

  const gameRef = doc(collectionRef, input.id)
  try {
    const timestamp = Date.now()
    const result = await runTransaction<{ exists: boolean }>(db, async (transaction) => {
      const snapshot = await transaction.get(gameRef)
      if (snapshot.exists()) {
        return { exists: true }
      }

      transaction.set(gameRef, {
        title: input.title,
        owner: input.owner,
        players: input.players,
        duration: input.duration,
        weight: input.weight,
        language: input.language,
        mechanics: input.mechanics,
        manual: input.manual ?? false,
        coverUrl: input.coverUrl ?? null,
        bggId: input.bggId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      return { exists: false }
    })

    if (result.exists) {
      return {
        status: 'already-exists',
        message: 'El juego ya estaba registrado en la ludoteca.',
      }
    }

    const createdGame: LibraryGameRecord = {
      id: input.id,
      title: input.title,
      owner: input.owner,
      players: input.players,
      duration: input.duration,
      weight: input.weight,
      language: input.language,
      mechanics: [...input.mechanics],
      manual: input.manual,
      coverUrl: input.coverUrl,
      bggId: input.bggId,
      createdAt: timestamp,
    }

    return {
      status: 'success',
      message: 'Juego guardado correctamente en la ludoteca.',
      game: createdGame,
    }
  } catch (error) {
    console.error('No se pudo guardar el juego en Firestore', error)
    return {
      status: 'error',
      message: 'No se pudo guardar el juego. Inténtalo de nuevo en unos segundos.',
    }
  }
}

async function addGameToLocal(input: LibraryGameInput): Promise<LibraryActionResult> {
  const games = readLocalGames()
  const duplicate = games.some((game) => game.id === input.id || (input.bggId && game.bggId === input.bggId))

  if (duplicate) {
    return {
      status: 'already-exists',
      message: 'El juego ya estaba registrado en la ludoteca.',
    }
  }

  const stored: StoredGame = normalizeStoredGame({
    id: input.id,
    title: input.title,
    owner: input.owner,
    players: input.players,
    duration: input.duration,
    weight: input.weight,
    language: input.language,
    mechanics: input.mechanics,
    manual: input.manual,
    coverUrl: input.coverUrl,
    bggId: input.bggId,
    createdAt: Date.now(),
  })

  const next = [...games, stored]
  next.sort((first, second) => first.title.localeCompare(second.title, 'es', { sensitivity: 'base' }))
  writeLocalGames(next)

  return {
    status: 'success',
    message: 'Juego guardado correctamente en la ludoteca.',
    game: localGameToRecord(stored),
  }
}

export async function addLibraryGame(input: LibraryGameInput): Promise<LibraryActionResult> {
  if (useFirestore) {
    return addGameToFirestore(input)
  }

  return addGameToLocal(input)
}

type LibraryState = {
  loading: boolean
  error: string | null
  games: LibraryGameRecord[]
}

type UseLibraryService = LibraryState & {
  refresh: () => Promise<void>
  addGame: (input: LibraryGameInput) => Promise<LibraryActionResult>
}

export function useLibraryService(): UseLibraryService {
  const [state, setState] = useState<LibraryState>({ loading: true, error: null, games: [] })

  useEffect(() => {
    if (!useFirestore) {
      return
    }

    let cancelled = false
    let unsubscribe: (() => void) | null = null

    setState((current) => ({ ...current, loading: true, error: null }))

    void fetchLibraryGames()
      .then((list) => {
        if (cancelled) {
          return
        }

        setState({ loading: false, error: null, games: list })

        unsubscribe = subscribeLibraryGames(
          (games) => {
            setState({ loading: false, error: null, games })
          },
          (message) => {
            setState((current) => ({ ...current, loading: false, error: message }))
          },
        )
      })
      .catch((error) => {
        console.error('Error inicial al cargar la ludoteca', error)
        if (!cancelled) {
          setState({ loading: false, error: 'No se pudo cargar la ludoteca. Intenta recargar.', games: [] })
        }
      })

    return () => {
      cancelled = true
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  const loadGames = useCallback(async () => {
    if (useFirestore) {
      return
    }

    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const list = await fetchLibraryGames()
      const sorted = list.slice().sort((first, second) =>
        first.title.localeCompare(second.title, 'es', { sensitivity: 'base' }),
      )

      setState({ loading: false, error: null, games: sorted })
    } catch (error) {
      console.error('Error al cargar la ludoteca', error)
      setState({ loading: false, error: 'No se pudo cargar la ludoteca. Intenta recargar.', games: [] })
    }
  }, [])

  useEffect(() => {
    if (useFirestore) {
      return
    }

    void loadGames()
  }, [loadGames])

  const handleAddGame = useCallback(async (input: LibraryGameInput) => {
    const result = await addLibraryGame(input)
    if (result.game) {
      setState((current) => {
        const nextGames = [
          result.game!,
          ...current.games.filter((game) => game.id !== result.game!.id),
        ]

        const sorted = nextGames.sort((first, second) =>
          first.title.localeCompare(second.title, 'es', { sensitivity: 'base' }),
        )

        return {
          loading: false,
          error: null,
          games: sorted,
        }
      })
    }

    if (result.status === 'error') {
      setState((current) => ({ ...current, error: 'No se pudo guardar el juego. Inténtalo de nuevo.' }))
    }

    return result
  }, [])

  return useMemo(
    () => ({
      ...state,
      refresh: loadGames,
      addGame: handleAddGame,
    }),
    [handleAddGame, loadGames, state],
  )
}
