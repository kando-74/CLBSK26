import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  BookmarkCheck,
  Download,
  Filter,
  Globe,
  Loader2,
  Search,
  Star,
  Users,
} from 'lucide-react'
import type { BggSearchResult } from '../utils/bgg'
import { getBoardGameDetails, searchBoardGames } from '../utils/bgg'
import { useNavigate } from 'react-router-dom'
import { GameTitle } from '../components/GameTitle'
import { useLibraryService, type LibraryGameRecord, type LibraryGameInput } from '../services/library'

type BuiltinFilter = {
  id: string
  label: string
  type: 'builtin'
  apply: (game: LibraryGameRecord) => boolean
}

type SearchFilter = {
  id: string
  label: string
  type: 'search'
  term: string
}

type SavedFilter = BuiltinFilter | SearchFilter

function getMaxDurationMinutes(label: string): number | null {
  const matches = label.match(/\d+/g)

  if (!matches || matches.length === 0) {
    return null
  }

  const values = matches.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite)

  if (values.length === 0) {
    return null
  }

  return Math.max(...values)
}

function matchesSearchTerm(game: LibraryGameRecord, term: string) {
  const normalizedTerm = term.toLowerCase()
  const haystack = `${game.title} ${game.owner} ${game.mechanics.join(' ')} ${game.language}`.toLowerCase()
  return haystack.includes(normalizedTerm)
}

const builtinFilters: BuiltinFilter[] = [
  {
    id: 'favoritos',
    label: 'Favoritos',
    type: 'builtin',
    apply: (game) => Boolean(game.manual),
  },
  {
    id: 'novedades',
    label: 'Novedades',
    type: 'builtin',
    apply: (game) => !game.manual,
  },
  {
    id: 'familiares',
    label: 'Familiares <45 min',
    type: 'builtin',
    apply: (game) => {
      const maxDuration = getMaxDurationMinutes(game.duration)
      return maxDuration !== null && maxDuration <= 45
    },
  },
]

export function Library() {
  const { games, loading: libraryLoading, error: libraryError, addGame } = useLibraryService()
  const [search, setSearch] = useState('')
  const [bggQuery, setBggQuery] = useState('')
  const [bggResults, setBggResults] = useState<BggSearchResult[]>([])
  const [isSearchingBgg, setIsSearchingBgg] = useState(false)
  const [bggError, setBggError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<number | null>(null)
  const [importMessage, setImportMessage] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null)
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(builtinFilters)
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null)
  const [showFilterEditor, setShowFilterEditor] = useState(false)
  const [newFilterName, setNewFilterName] = useState('')
  const [filterError, setFilterError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const importSectionRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  const activeFilter = useMemo(
    () => savedFilters.find((filter) => filter.id === activeFilterId) ?? null,
    [activeFilterId, savedFilters],
  )

  const filtered = useMemo(() => {
    let current = games

    if (activeFilter) {
      if (activeFilter.type === 'builtin') {
        current = current.filter(activeFilter.apply)
      } else if (activeFilter.term) {
        current = current.filter((game) => matchesSearchTerm(game, activeFilter.term))
      }
    }

    const term = search.toLowerCase().trim()

    if (!term) {
      return current
    }

    return current.filter((item) => matchesSearchTerm(item, term))
  }, [activeFilter, games, search])

  useEffect(() => {
    if (!infoMessage) {
      return
    }

    const timeout = setTimeout(() => setInfoMessage(null), 4000)
    return () => clearTimeout(timeout)
  }, [infoMessage])

  useEffect(() => {
    if (activeFilter?.type === 'search') {
      setSearch(activeFilter.term)
    }
  }, [activeFilter])

  async function handleBggSearch() {
    const query = bggQuery.trim()

    if (query.length < 2) {
      setBggError('Introduce al menos 2 caracteres para buscar en BGG.')
      setBggResults([])
      return
    }

    setBggError(null)
    setImportMessage(null)
    setIsSearchingBgg(true)

    try {
      const results = await searchBoardGames(query)
      setBggResults(results.slice(0, 10))

      if (results.length === 0) {
        setBggError('No se encontraron juegos en BGG para esa búsqueda.')
      }
    } catch (error) {
      setBggResults([])
      setBggError(
        error instanceof Error
          ? error.message
          : 'No se pudo completar la búsqueda en BGG.',
      )
    } finally {
      setIsSearchingBgg(false)
    }
  }

  async function handleImport(id: number) {
    setImportMessage(null)
    setImportingId(id)

    try {
      const details = await getBoardGameDetails(id)
      const playersLabel = (() => {
        if (details.minPlayers && details.maxPlayers) {
          if (details.minPlayers === details.maxPlayers) {
            return `${details.minPlayers}`
          }
          return `${details.minPlayers}-${details.maxPlayers}`
        }

        if (details.minPlayers) {
          return `${details.minPlayers}+`
        }

        return 'N/D'
      })()

      const durationLabel = (() => {
        const minTime = details.minPlaytime ?? details.playingTime
        const maxTime = details.maxPlaytime ?? details.playingTime

        if (minTime && maxTime) {
          if (minTime === maxTime) {
            return `${minTime} min`
          }

          return `${minTime}-${maxTime} min`
        }

        if (maxTime) {
          return `${maxTime} min`
        }

        return 'N/D'
      })()

      const mechanics =
        details.mechanics.length > 0 ? details.mechanics.slice(0, 8) : ['Sin datos BGG']

      const weightLabel =
        details.averageWeight && details.averageWeight > 0
          ? details.averageWeight.toFixed(1)
          : 'N/D'

      const input: LibraryGameInput = {
        id: `bgg-${details.id}`,
        title: details.name,
        owner: 'Importado',
        players: playersLabel,
        duration: durationLabel,
        weight: weightLabel,
        language: 'BGG',
        mechanics,
        coverUrl: details.imageUrl ?? details.thumbnailUrl ?? undefined,
        bggId: details.id,
      }

      const result = await addGame(input)

      if (result.status === 'already-exists') {
        setImportMessage({ type: 'error', message: 'El juego ya está en la ludoteca.' })
      } else if (result.status === 'error') {
        setImportMessage({ type: 'error', message: result.message })
      } else {
        setImportMessage({ type: 'success', message: 'Juego importado correctamente desde BGG.' })
      }
    } catch (error) {
      setImportMessage({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'No se pudo importar el juego desde BGG.',
      })
    } finally {
      setImportingId(null)
    }
  }

  const handleScrollToImport = useCallback(() => {
    importSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleSelectFilter = useCallback(
    (filterId: string) => {
      setActiveFilterId((current) => {
        if (current === filterId) {
          setInfoMessage('Filtro desactivado.')
          return null
        }

        const nextFilter = savedFilters.find((filter) => filter.id === filterId)
        if (nextFilter) {
          setInfoMessage(`Aplicado filtro "${nextFilter.label}".`)
        }

        return filterId
      })

      setShowFilterEditor(false)
      setFilterError(null)
    },
    [savedFilters],
  )

  const handleSaveFilter = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const trimmedName = newFilterName.trim()
      const term = search.trim()

      if (!trimmedName) {
        setFilterError('Introduce un nombre para el filtro guardado.')
        return
      }

      if (!term) {
        setFilterError('Aplica una búsqueda antes de guardar el filtro.')
        return
      }

      const exists = savedFilters.some((filter) => filter.label.toLowerCase() === trimmedName.toLowerCase())
      if (exists) {
        setFilterError('Ya existe un filtro con ese nombre.')
        return
      }

      const newFilter: SearchFilter = {
        id: `custom-${Date.now()}`,
        label: trimmedName,
        type: 'search',
        term,
      }

      setSavedFilters((current) => [...current, newFilter])
      setActiveFilterId(newFilter.id)
      setShowFilterEditor(false)
      setNewFilterName('')
      setFilterError(null)
      setInfoMessage('Filtro guardado correctamente.')
    },
    [newFilterName, savedFilters, search],
  )

  const handleRegisterGame = useCallback(
    (game: LibraryGameRecord) => {
      navigate('/registrar', { state: { preselectedGame: game.title } })
    },
    [navigate],
  )

  return (
    <div className="space-y-6 pb-10">
      <header className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="section-title">Ludoteca del evento</h2>
            <p className="text-sm text-text-secondary">Añade tus juegos y explora la colección disponible durante el congreso.</p>
          </div>
          <button
            onClick={handleScrollToImport}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
          >
            <Star className="h-4 w-4" />
            Añadir juego
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
          <label className="card flex items-center gap-3 px-4 py-3">
            <Search className="h-5 w-5 text-text-secondary" />
            <input
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Buscar por nombre, propietario o mecánica"
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
            />
          </label>
          <div className="card flex items-center justify-between px-4 py-3 text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>
                {activeFilter
                  ? `Filtro activo: ${activeFilter.label}`
                  : 'Sin filtros adicionales'}
              </span>
            </div>
            <button
              onClick={() => {
                setShowFilterEditor((value) => !value)
                setFilterError(null)
              }}
              className="text-sm font-semibold text-primary"
            >
              {showFilterEditor ? 'Cerrar' : 'Gestionar filtros'}
            </button>
          </div>
        </div>
      </header>

      {infoMessage && (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          {infoMessage}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Filtros guardados</h3>
        <div className="flex flex-wrap gap-2">
          {savedFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => handleSelectFilter(filter.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeFilterId === filter.id
                  ? 'bg-primary text-white shadow-card'
                  : 'bg-background text-text-secondary hover:bg-primary/10 hover:text-primary'
              }`}
            >
              {filter.label}
            </button>
          ))}
          <button
            onClick={() => {
              setShowFilterEditor(true)
              setFilterError(null)
              setNewFilterName('')
            }}
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-primary px-4 py-2 text-sm font-medium text-primary"
          >
            <BookmarkCheck className="h-4 w-4" />
            Guardar filtro
          </button>
        </div>
      </section>

      {showFilterEditor && (
        <section className="card space-y-4 p-5">
          <h3 className="text-base font-semibold text-text-primary">Crear filtro personalizado</h3>
          <p className="text-sm text-text-secondary">
            Se guardará usando la búsqueda actual (`{search.trim() || 'sin término'}`). Puedes seleccionar el filtro más tarde
            desde la lista superior.
          </p>
          <form onSubmit={handleSaveFilter} className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex grow flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Nombre del filtro</span>
              <input
                className="w-full bg-transparent text-base text-text-primary outline-none"
                value={newFilterName}
                onChange={(event) => setNewFilterName(event.currentTarget.value)}
                placeholder="Ej. Eurogames favoritos"
                required
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
            >
              Guardar filtro
            </button>
          </form>
          {filterError && <p className="text-sm text-error">{filterError}</p>}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Importar desde BoardGameGeek
        </h3>
        <div ref={importSectionRef} className="card space-y-4 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex grow items-center gap-3 rounded-xl bg-background px-4 py-2">
              <Search className="h-5 w-5 text-text-secondary" />
              <input
                value={bggQuery}
                onChange={(event) => setBggQuery(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleBggSearch()
                  }
                }}
                placeholder="Buscar juego en BGG (ej. Catan, Ark Nova)"
                className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
              />
            </label>
            <button
              onClick={() => void handleBggSearch()}
              disabled={isSearchingBgg}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
            >
              {isSearchingBgg ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Buscar en BGG
                </>
              )}
            </button>
          </div>
          {bggError && <p className="text-sm text-red-500">{bggError}</p>}
          {importMessage && (
            <p
              className={`text-sm ${
                importMessage.type === 'success' ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {importMessage.message}
            </p>
          )}
          {bggResults.length > 0 && (
            <div className="space-y-2">
              {bggResults.map((result) => {
                const alreadyImported = games.some((game) => game.bggId === result.id)

                return (
                  <div
                    key={result.id}
                    className="flex flex-col gap-2 rounded-xl bg-background px-4 py-3 text-sm text-text-secondary md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <GameTitle
                        name={result.name}
                        size="sm"
                        textClassName="text-sm"
                      />
                      <p className="text-xs text-text-secondary">
                        BGG #{result.id}
                        {result.yearPublished ? ` • Año ${result.yearPublished}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleImport(result.id)}
                      disabled={alreadyImported || importingId === result.id}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-primary/40 disabled:text-primary/60"
                    >
                      {importingId === result.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Importando...
                        </>
                      ) : alreadyImported ? (
                        'Ya importado'
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Importar juego
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {libraryError && (
        <div className="rounded-2xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error">
          {libraryError}
        </div>
      )}

      {libraryLoading ? (
        <div className="rounded-2xl border border-primary/20 bg-white px-4 py-3 text-sm text-text-secondary">
          Cargando ludoteca...
        </div>
      ) : filtered.length === 0 ? (
        <section className="card space-y-3 p-5">
          <h3 className="text-lg font-semibold text-text-primary">No hay juegos que coincidan</h3>
          <p className="text-sm text-text-secondary">
            Ajusta los filtros o importa nuevos títulos desde BoardGameGeek para ampliar la ludoteca.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((game) => (
            <article key={game.id} className="card flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <GameTitle
                  name={game.title}
                  coverUrl={game.coverUrl}
                  size="lg"
                  className="items-start"
                  textClassName="text-xl"
                  role="heading"
                  aria-level={3}
                >
                  <p className="text-sm font-normal text-text-secondary">Propietario: {game.owner}</p>
                </GameTitle>
                {game.manual ? (
                  <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">Manual</span>
                ) : (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    BGG #{game.bggId ?? 'N/D'}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-text-secondary">
                <div className="rounded-xl bg-background px-3 py-2">
                  <p className="text-xs uppercase tracking-wide">Jugadores</p>
                  <p className="text-base text-text-primary">{game.players}</p>
                </div>
                <div className="rounded-xl bg-background px-3 py-2">
                  <p className="text-xs uppercase tracking-wide">Duración</p>
                  <p className="text-base text-text-primary">{game.duration}</p>
                </div>
                <div className="rounded-xl bg-background px-3 py-2">
                  <p className="text-xs uppercase tracking-wide">Peso BGG</p>
                  <p className="text-base text-text-primary">{game.weight}</p>
                </div>
                <div className="rounded-xl bg-background px-3 py-2">
                  <p className="text-xs uppercase tracking-wide">Idioma</p>
                  <p className="inline-flex items-center gap-2 text-base text-text-primary">
                    <Globe className="h-4 w-4" />
                    {game.language}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
                {game.mechanics.map((mechanic) => (
                  <span key={mechanic} className="rounded-full bg-background px-3 py-1">
                    {mechanic}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => handleRegisterGame(game)}
                  className="text-sm font-semibold text-primary"
                >
                  Registrar partida
                </button>
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Users className="h-4 w-4" />
                  Ideal 4 jugadores
                </span>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
