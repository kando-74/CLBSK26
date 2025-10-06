import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { BookOpen, Clock, Loader2, MapPin, Search, Sparkles, Users } from 'lucide-react'
import { subscribePlays, type PlayRecord } from '../services/plays'
import { subscribeTables, type TableRecord } from '../services/tables'
import { useLibraryService, type LibraryGameRecord } from '../services/library'
import { normalizeUserName } from '../utils/profileLinks'
import { GameTitle } from '../components/GameTitle'
import { UserLink } from '../components/UserLink'

const EMPTY_STATE_MESSAGE = 'Todavia no tenemos actividad registrada para esta persona.'

type DirectoryEntry = {
  name: string
  normalized: string
  totalPlays: number
  totalMinutes: number
  uniqueGames: number
  activePlay: PlayRecord | null
  lastPlay: PlayRecord | null
  fallbackTable: TableRecord | null
  libraryGames: LibraryGameRecord[]
  recentPlays: PlayRecord[]
}

type DirectoryBuilder = {
  name: string
  normalized: string
  plays: PlayRecord[]
  totalMinutes: number
  uniqueGames: Set<string>
  activePlay: PlayRecord | null
  lastPlay: PlayRecord | null
  fallbackTable: TableRecord | null
  fallbackTableTimestamp: number
  libraryGames: LibraryGameRecord[]
}

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '--'
  }

  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60

  if (hours === 0) {
    return `${remaining} min`
  }

  if (remaining === 0) {
    return `${hours} h`
  }

  return `${hours} h ${remaining} min`
}

function formatTimeLabel(iso: string | null): string {
  if (!iso) {
    return ''
  }

  try {
    const date = new Date(iso)
    return date.toLocaleString('es-ES', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (error) {
    console.warn('No se pudo formatear la fecha', error)
    return ''
  }
}

export function UsersDirectory() {
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [tables, setTables] = useState<TableRecord[]>([])
  const [playsReady, setPlaysReady] = useState(false)
  const [tablesReady, setTablesReady] = useState(false)
  const { games, loading: libraryLoading, error: libraryError } = useLibraryService()

  useEffect(() => {
    const unsubscribe = subscribePlays(
      {},
      (snapshot) => {
        setPlays(snapshot)
        setPlaysReady(true)
      },
      () => {
        setPlaysReady(true)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeTables(
      (snapshot) => {
        setTables(snapshot)
        setTablesReady(true)
      },
      () => {
        setTablesReady(true)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [])

  const directory = useMemo<DirectoryEntry[]>(() => {
    const map = new Map<string, DirectoryBuilder>()

    const ensureEntry = (rawName: string | null | undefined): DirectoryBuilder | null => {
      if (!rawName) {
        return null
      }

      const trimmed = rawName.trim()
      if (!trimmed) {
        return null
      }

      const normalized = normalizeUserName(trimmed)
      if (!normalized) {
        return null
      }

      let entry = map.get(normalized)
      if (!entry) {
        entry = {
          name: trimmed,
          normalized,
          plays: [],
          totalMinutes: 0,
          uniqueGames: new Set<string>(),
          activePlay: null,
          lastPlay: null,
          fallbackTable: null,
          fallbackTableTimestamp: 0,
          libraryGames: [],
        }
        map.set(normalized, entry)
      } else if (trimmed.length > entry.name.length) {
        entry.name = trimmed
      }

      return entry
    }

    plays.forEach((play) => {
      const startTimestamp = Date.parse(play.startTime ?? '') || 0

      play.players.forEach((player) => {
        const entry = ensureEntry(player.alias)
        if (!entry) {
          return
        }

        entry.plays.push(play)
        if (Number.isFinite(play.durationMinutes)) {
          entry.totalMinutes += play.durationMinutes ?? 0
        }

        const gameTitle = play.game.trim()
        if (gameTitle) {
          entry.uniqueGames.add(gameTitle)
        }

        if (play.status === 'in-progress') {
          if (!entry.activePlay || Date.parse(entry.activePlay.startTime) < startTimestamp) {
            entry.activePlay = play
          }
        } else if (play.status === 'completed') {
          if (!entry.lastPlay || Date.parse(entry.lastPlay.startTime) < startTimestamp) {
            entry.lastPlay = play
          }
        }
      })
    })

    const registerTable = (rawName: string | null | undefined, table: TableRecord) => {
      const entry = ensureEntry(rawName)
      if (!entry) {
        return
      }

      const timestamp = table.startedAt ?? table.createdAt ?? 0
      if (table.status !== 'completed' && timestamp >= entry.fallbackTableTimestamp) {
        entry.fallbackTable = table
        entry.fallbackTableTimestamp = timestamp
      }
    }

    tables.forEach((table) => {
      registerTable(table.host, table)

      const participants = table.participants ?? []
      participants.forEach((participant) => registerTable(participant.name, table))

      const currentPlayers = table.currentPlayers ?? []
      currentPlayers.forEach((participant) => registerTable(participant.name, table))
    })

    games.forEach((game) => {
      const entry = ensureEntry(game.owner)
      if (!entry) {
        return
      }
      entry.libraryGames.push(game)
    })

    return Array.from(map.values())
      .map<DirectoryEntry>((entry) => {
        const recentPlays = entry.plays
          .slice()
          .sort((first, second) => Date.parse(second.startTime) - Date.parse(first.startTime))
          .slice(0, 5)

        return {
          name: entry.name,
          normalized: entry.normalized,
          totalPlays: entry.plays.length,
          totalMinutes: entry.totalMinutes,
          uniqueGames: entry.uniqueGames.size,
          activePlay: entry.activePlay,
          lastPlay: entry.lastPlay,
          fallbackTable: entry.fallbackTable,
          libraryGames: entry.libraryGames
            .slice()
            .sort((first, second) => first.title.localeCompare(second.title, 'es', { sensitivity: 'base' })),
          recentPlays,
        }
      })
      .sort((first, second) => first.name.localeCompare(second.name, 'es', { sensitivity: 'base' }))
  }, [games, plays, tables])

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUserKey, setSelectedUserKey] = useState<string | null>(null)

  const filteredDirectory = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      return directory
    }
    return directory.filter((entry) => entry.name.toLowerCase().includes(term))
  }, [directory, searchTerm])

  useEffect(() => {
    if (filteredDirectory.length === 0) {
      setSelectedUserKey(null)
      return
    }

    setSelectedUserKey((current) => {
      if (!current) {
        return filteredDirectory[0]?.normalized ?? null
      }
      const exists = filteredDirectory.some((entry) => entry.normalized === current)
      return exists ? current : filteredDirectory[0]?.normalized ?? null
    })
  }, [filteredDirectory])

  const selectedEntry = useMemo(() => {
    if (!selectedUserKey) {
      return null
    }
    return directory.find((entry) => entry.normalized === selectedUserKey) ?? null
  }, [directory, selectedUserKey])

  const isLoading = !playsReady || !tablesReady || libraryLoading

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
      <aside className="space-y-4">
        <div className="card space-y-3 p-4">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Personas</h1>
            <p className="text-sm text-text-secondary">
              Consulta asistentes, su actividad destacada y los juegos que han aportado.
            </p>
          </div>
          <label className="relative block">
            <span className="sr-only">Buscar usuarios</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre o alias"
              className="w-full rounded-full border border-slate-200 bg-background py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>

        <div className="card max-h-[560px] overflow-y-auto p-2">
          {isLoading && directory.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando personas...
            </div>
          ) : filteredDirectory.length > 0 ? (
            <ul className="space-y-1">
              {filteredDirectory.map((entry) => {
                const isActive = entry.normalized === selectedUserKey
                return (
                  <li key={entry.normalized}>
                    <button
                      type="button"
                      onClick={() => setSelectedUserKey(entry.normalized)}
                      className={clsx(
                        'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-primary/5',
                      )}
                    >
                      <span className="font-semibold text-text-primary">{entry.name}</span>
                      <span className="text-xs text-text-secondary">{entry.totalPlays} partidas</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-xl bg-background px-4 py-6 text-sm text-text-secondary">
              No encontramos personas que coincidan con tu busqueda.
            </p>
          )}
        </div>
      </aside>

      <section className="space-y-5">
        {libraryError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {libraryError}
          </div>
        )}

        {!selectedEntry ? (
          <div className="card flex items-center justify-center gap-3 p-10 text-sm text-text-secondary">
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Preparando informacion...
              </>
            ) : (
              <>Selecciona a una persona para ver su ficha.</>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <header className="flex flex-col gap-3 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 shadow-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-secondary">Ficha de asistencia</p>
                <h2 className="text-3xl font-semibold text-text-primary">{selectedEntry.name}</h2>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-text-secondary">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
                  <Users className="h-4 w-4" />
                  {selectedEntry.totalPlays} partida(s)
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-secondary/15 px-3 py-1 font-semibold text-secondary">
                  <Sparkles className="h-4 w-4" />
                  {selectedEntry.uniqueGames} juego(s) distintos
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 font-semibold text-text-secondary">
                  <Clock className="h-4 w-4" />
                  {formatMinutes(selectedEntry.totalMinutes)} jugados
                </span>
              </div>
            </header>

            <div className="grid gap-4 lg:grid-cols-2">
              <article className="card space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text-primary">Ultima ubicacion conocida</h3>
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                {selectedEntry.activePlay ? (
                  <div className="space-y-2 text-sm text-text-secondary">
                    <p>
                      Actualmente jugando <span className="font-semibold text-text-primary">{selectedEntry.activePlay.game}</span>
                    </p>
                    <p>
                      {formatTimeLabel(selectedEntry.activePlay.startTime)}  -  Sala {selectedEntry.activePlay.room}
                    </p>
                    <p>
                      {selectedEntry.activePlay.players.map((player, index) => (
                        <span key={`${player}-${index}`}>
                          {index > 0 && ', '}
                          <UserLink player={player} />
                        </span>
                      ))}
                    </p>
                  </div>
                ) : selectedEntry.lastPlay ? (
                  <div className="space-y-2 text-sm text-text-secondary">
                    <p>
                      Ultima partida registrada: <span className="font-semibold text-text-primary">{selectedEntry.lastPlay.game}</span>
                    </p>
                    <p>
                      {formatTimeLabel(selectedEntry.lastPlay.startTime)}  -  Sala {selectedEntry.lastPlay.room}
                    </p>
                    <p>
                      {selectedEntry.lastPlay.players.map((player, index) => (
                        <span key={`${player}-${index}`}>
                          {index > 0 && ', '}
                          <UserLink player={player} />
                        </span>
                      ))}
                    </p>
                  </div>
                ) : selectedEntry.fallbackTable ? (
                  <div className="space-y-2 text-sm text-text-secondary">
                    <p>
                      {selectedEntry.fallbackTable.status === 'open'
                        ? 'Esta organizando una mesa abierta'
                        : 'Participa en una mesa en curso'}{' '}
                      de <span className="font-semibold text-text-primary">{selectedEntry.fallbackTable.game}</span>
                    </p>
                    <p>
                      Sala {selectedEntry.fallbackTable.room}  -  {selectedEntry.fallbackTable.seats.taken}/{selectedEntry.fallbackTable.seats.total} plazas
                    </p>
                  </div>
                ) : (
                  <p className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">{EMPTY_STATE_MESSAGE}</p>
                )}
              </article>

              <article className="card space-y-4 p-6">
                <h3 className="text-lg font-semibold text-text-primary">Actividad reciente</h3>
                {selectedEntry.recentPlays.length > 0 ? (
                  <ul className="space-y-3 text-sm text-text-secondary">
                    {selectedEntry.recentPlays.map((play) => (
                      <li key={play.id} className="rounded-2xl bg-background px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <p className="font-semibold text-text-primary">{play.game}</p>
                          <p>{formatTimeLabel(play.startTime)}  -  Sala {play.room}</p>
                          <p>
                            {play.players.map((player, index) => (
                              <span key={`${player}-${index}`}>
                                {index > 0 && ', '}
                                <UserLink player={player} />
                              </span>
                            ))}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">{EMPTY_STATE_MESSAGE}</p>
                )}
              </article>
            </div>

            <article className="card space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">Ludoteca personal</h3>
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              {selectedEntry.libraryGames.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedEntry.libraryGames.map((game) => (
                    <div key={game.id} className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
                      <GameTitle name={game.title} size="sm" textClassName="text-base" />
                      <p className="mt-1">Jugadores: {game.players}</p>
                      {game.duration && <p className="mt-1">Duracion: {game.duration}</p>}
                      <p className="mt-1">Idioma: {game.language}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">No ha registrado juegos propios.</p>
              )}
            </article>
          </div>
        )}
      </section>
    </div>
  )
}

