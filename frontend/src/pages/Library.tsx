import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  BookmarkCheck,
  CalendarCheck,
  ClipboardList,
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
import { useAuth } from '../components/AuthProvider'
import { useTablesService } from '../services/tables'
import { getDisplayName } from '../utils/user'
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
  const { user, profile } = useAuth()
  const userDisplayName = useMemo(() => getDisplayName(profile, user), [profile, user])
  const userId = user?.uid ?? null

  const { createTable } = useTablesService()
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
  const [ownerFilter, setOwnerFilter] = useState<string>('all')

  const [showTableModal, setShowTableModal] = useState(false)
  const [tableDraft, setTableDraft] = useState({
    game: null as LibraryGameRecord | null,
    seats: 4,
    start: '',
    room: '',
    description: '',
  })
  const [creatingTable, setCreatingTable] = useState(false)
  const [tableError, setTableError] = useState<string | null>(null)

  const importSectionRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  const activeFilter = useMemo(
    () => savedFilters.find((filter) => filter.id === activeFilterId) ?? null,
    [activeFilterId, savedFilters],
  )

  const ownerOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; count: number }>()
    games.forEach((game) => {
      const label = game.owner || 'Sin propietario'
      const value = game.ownerId ? `owner:${game.ownerId}` : `name:${label.toLowerCase()}`
      const existing = map.get(value)
      if (existing) {
        existing.count += 1
      } else {
        map.set(value, { value, label, count: 1 })
      }
    })

    return Array.from(map.values()).sort((first, second) =>
      first.label.localeCompare(second.label, 'es', { sensitivity: 'base' }),
    )
  }, [games])

  const filtered = useMemo(() => {
    let current = games

    if (ownerFilter === 'me') {
      current = current.filter((game) => (userId ? game.ownerId === userId : false))
    } else if (ownerFilter.startsWith('owner:')) {
      const filterId = ownerFilter.slice('owner:'.length)
      current = current.filter((game) => game.ownerId === filterId)
    } else if (ownerFilter.startsWith('name:')) {
      const filterName = ownerFilter.slice('name:'.length)
      current = current.filter(
        (game) => game.owner.toLowerCase() === filterName,
      )
    }

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
  }, [activeFilter, games, ownerFilter, search, userId])

  useEffect(() => {
    if (!infoMessage) {
      return
    }

    const timeout = setTimeout(() => setInfoMessage(null), 4000)
    return () => clearTimeout(timeout)
  }, [infoMessage])

  useEffect(() => {
    if (ownerFilter === 'me') {
      if (!userId || !games.some((game) => game.ownerId === userId)) {
        setOwnerFilter('all')
      }
      return
    }

    if (ownerFilter === 'all') {
      return
    }

    const exists = ownerOptions.some((option) => option.value === ownerFilter)
    if (!exists) {
      setOwnerFilter('all')
    }
  }, [ownerFilter, ownerOptions, userId, games])

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
        owner: userDisplayName,
        ownerId: userId,
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
        setOwnerFilter((current) => (current === 'all' && userId ? 'me' : current))
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

  const handleOwnerFilterChange = useCallback(
    (value: string) => {
      setOwnerFilter(value)

      if (value === 'all') {
        setInfoMessage('Mostrando juegos de todos los propietarios.')
        return
      }

      if (value === 'me') {
        setInfoMessage('Mostrando tus juegos.')
        return
      }

      const option = ownerOptions.find((item) => item.value === value)
      if (option) {
        setInfoMessage(`Mostrando juegos de ${option.label}.`)
      }
    },
    [ownerOptions],
  )

  const handleOpenTable = useCallback(
    (game: LibraryGameRecord) => {
      setTableDraft({
        game,
        seats: 4,
        start: '',
        room: game.language ? `Sala ${game.language}` : '',
        description: `Proponemos partida para ${game.title}.`,
      })
      setTableError(null)
      setShowTableModal(true)
    },
    [],
  )

  const handleCloseTable = useCallback(() => {
    setShowTableModal(false)
    setTableDraft({ game: null, seats: 4, start: '', room: '', description: '' })
    setTableError(null)
  }, [])

  const handleSubmitTable = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!tableDraft.game) {
        return
      }

      setCreatingTable(true)
      setTableError(null)

      const safeSeats = Math.max(1, Math.min(8, Math.floor(Number(tableDraft.seats) || 4)))
      const start = tableDraft.start.trim() || 'Por confirmar'
      const room = tableDraft.room.trim() || 'Por confirmar'
      const description = tableDraft.description.trim() || `Proponemos partida para ${tableDraft.game.title}.`

      const result = await createTable({
        game: tableDraft.game.title,
        host: userDisplayName,
        seats: safeSeats,
        start,
        room,
        description,
      })

      if (result.status === 'success') {
        setInfoMessage(`Mesa publicada para ${tableDraft.game.title}.`)
        handleCloseTable()
      } else {
        setTableError(result.message)
      }

      setCreatingTable(false)
    },
    [createTable, handleCloseTable, tableDraft, userDisplayName],
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
        <div className="card flex items-center gap-3 px-4 py-3 text-sm text-text-secondary">
          <Users className="h-4 w-4" />
          <select
            value={ownerFilter}
            onChange={(event) => handleOwnerFilterChange(event.currentTarget.value)}
            className="w-full bg-transparent text-sm text-text-primary outline-none"
          >
            <option value="all">Todos los propietarios</option>
            {userId && (
              <option value="me">Mis juegos</option>
            )}
            {ownerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.count > 1 ? ` (${option.count})` : ''}
              </option>
            ))}
          </select>
        </div>
      </header>

      {infoMessage && (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          {infoMessage}
        </div>
      )}

      {showTableModal && tableDraft.game && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-surface p-6 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Proponer mesa</h3>
                <p className="text-sm text-text-secondary">
                  Publica una mesa para "{tableDraft.game.title}" directamente desde la ludoteca.
                </p>
              </div>
              <button onClick={handleCloseTable} className="text-sm font-semibold text-primary">
                Cerrar
              </button>
            </div>
            <form onSubmit={handleSubmitTable} className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-background px-4 py-3">
                <GameTitle name={tableDraft.game.title} coverUrl={tableDraft.game.coverUrl} size="sm" />
                <p className="mt-2 text-xs text-text-secondary">
                  Propietario: {tableDraft.game.owner || 'Sin propietario registrado'}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
                  <span className="text-xs uppercase tracking-wide">Plazas totales</span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={tableDraft.seats}
                    onChange={(event) =>
                      setTableDraft((current) => ({
                        ...current,
                        seats: Number(event.currentTarget.value) || 4,
                      }))
                    }
                    className="w-full bg-transparent text-base text-text-primary outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
                  <span className="text-xs uppercase tracking-wide">Horario estimado</span>
                  <input
                    value={tableDraft.start}
                    onChange={(event) =>
                      setTableDraft((current) => ({
                        ...current,
                        start: event.currentTarget.value,
                      }))
                    }
                    placeholder="Ej. 19:30"
                    className="w-full bg-transparent text-base text-text-primary outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary md:col-span-2">
                  <span className="text-xs uppercase tracking-wide">Sala o ubicación</span>
                  <input
                    value={tableDraft.room}
                    onChange={(event) =>
                      setTableDraft((current) => ({
                        ...current,
                        room: event.currentTarget.value,
                      }))
                    }
                    placeholder="Sala o ubicación"
                    className="w-full bg-transparent text-base text-text-primary outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary md:col-span-2">
                  <span className="text-xs uppercase tracking-wide">Descripción</span>
                  <textarea
                    value={tableDraft.description}
                    onChange={(event) =>
                      setTableDraft((current) => ({
                        ...current,
                        description: event.currentTarget.value,
                      }))
                    }
                    className="h-24 w-full resize-none bg-transparent text-sm text-text-secondary outline-none"
                    placeholder="Añade detalles relevantes: nivel, módulos, si explicas reglas..."
                  />
                </label>
              </div>
              {tableError && <p className="text-sm text-error">{tableError}</p>}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseTable}
                  className="rounded-full border border-primary/20 px-4 py-2 text-sm font-semibold text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingTable}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
                >
                  {creatingTable ? 'Publicando...' : 'Publicar mesa'}
                </button>
              </div>
            </form>
          </div>
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
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleOpenTable(game)}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Proponer mesa
                </button>
                <button
                  onClick={() => handleRegisterGame(game)}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Registrar partida
                </button>
              </div>
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
