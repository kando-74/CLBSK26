import { useCallback, useEffect, useMemo, useState } from 'react'

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
}

export type CreateTableInput = {
  game: string
  host: string
  seats: number
  start: string
  room: string
  description: string
}

export type TableActionStatus = 'success' | 'already-joined' | 'full' | 'error'

export type TableActionResult = {
  status: TableActionStatus
  message: string
  table?: TableRecord
}

const STORAGE_KEY = 'clbsk_board_tables_v1'

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

function normalizeTable(entry: StoredTable | (StoredTable & { joined?: boolean })): StoredTable {
  const totalSeats = clampSeats(entry.seats?.total ?? 4)
  const takenSeats = clampSeats(entry.seats?.taken ?? 0, totalSeats)
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
  }
}

function readTables(): StoredTable[] {
  const storage = getStorage()
  if (!storage) {
    return seedTables.map(cloneTable)
  }

  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) {
    writeTables(seedTables.map(cloneTable))
    return seedTables.map(cloneTable)
  }

  try {
    const parsed = JSON.parse(raw) as StoredTable[]
    return parsed.map(normalizeTable)
  } catch (error) {
    console.warn('Datos corruptos del tablón, reseteando', error)
    writeTables(seedTables.map(cloneTable))
    return seedTables.map(cloneTable)
  }
}

function writeTables(tables: StoredTable[]) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(tables))
}

function cloneTable(table: StoredTable): StoredTable {
  return {
    ...table,
    seats: { ...table.seats },
  }
}

function toRecord(table: StoredTable): TableRecord {
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
  const tables = readTables()
  return tables
    .slice()
    .sort((first, second) => second.createdAt - first.createdAt)
    .map(toRecord)
}

export async function createTableEntry(input: CreateTableInput): Promise<TableActionResult> {
  await simulateDelay(150)
  try {
    const tables = readTables()
    const totalSeats = clampSeats(input.seats, 8)
    const safeTotal = totalSeats > 0 ? totalSeats : 1
    const now = Date.now()

    const storedTable: StoredTable = normalizeTable({
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
    })

    const next = [storedTable, ...tables]
    writeTables(next)

    return {
      status: 'success',
      message: 'Mesa publicada y plaza reservada para ti.',
      table: toRecord(storedTable),
    }
  } catch (error) {
    console.error('No se pudo crear la mesa', error)
    return {
      status: 'error',
      message: 'No se pudo publicar la mesa. Inténtalo de nuevo en unos segundos.',
    }
  }
}

export async function joinTableEntry(tableId: string): Promise<TableActionResult> {
  await simulateDelay()
  try {
    const tables = readTables()
    const index = tables.findIndex((table) => table.id === tableId)
    if (index === -1) {
      return {
        status: 'error',
        message: 'La mesa ya no está disponible.',
      }
    }

    const table = tables[index]

    if (table.joinedByLocal) {
      return {
        status: 'already-joined',
        message: `${table.game}: ya estás apuntado`,
        table: toRecord(table),
      }
    }

    if (table.seats.taken >= table.seats.total) {
      return {
        status: 'full',
        message: `${table.game}: no quedan plazas libres`,
        table: toRecord(table),
      }
    }

    const updated: StoredTable = normalizeTable({
      ...table,
      seats: {
        total: table.seats.total,
        taken: Math.min(table.seats.total, table.seats.taken + 1),
      },
      joinedByLocal: true,
    })

    const next = [...tables]
    next[index] = updated
    writeTables(next)

    return {
      status: 'success',
      message: `${table.game}: plaza reservada`,
      table: toRecord(updated),
    }
  } catch (error) {
    console.error('No se pudo apuntar a la mesa', error)
    return {
      status: 'error',
      message: 'No se pudo apuntar a la mesa. Prueba de nuevo en unos segundos.',
    }
  }
}

export function resetTablesForTests() {
  writeTables(seedTables.map(cloneTable))
}

type TablesState = {
  loading: boolean
  error: string | null
  tables: TableRecord[]
}

type UseTablesService = TablesState & {
  refresh: () => Promise<void>
  createTable: (input: CreateTableInput) => Promise<TableActionResult>
  joinTable: (tableId: string) => Promise<TableActionResult>
}

export function useTablesService(): UseTablesService {
  const [state, setState] = useState<TablesState>({ loading: true, error: null, tables: [] })

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
    if (typeof window === 'undefined') {
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

  const handleJoin = useCallback(async (tableId: string) => {
    const result = await joinTableEntry(tableId)
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

  return useMemo(
    () => ({
      ...state,
      refresh: loadTables,
      createTable: handleCreate,
      joinTable: handleJoin,
    }),
    [handleCreate, handleJoin, loadTables, state],
  )
}

