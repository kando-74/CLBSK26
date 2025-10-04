import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  BookmarkCheck,
  CalendarCheck,
  ClipboardList,
  Download,
  Globe,
  Loader2,
  Search,
  Star,
  Users,
  X,
} from 'lucide-react'
import type { BggSearchResult } from '../utils/bgg'
import { getBoardGameDetails, searchBoardGames } from '../utils/bgg'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { useTablesService } from '../services/tables'
import { getDisplayName } from '../utils/user'
import {
  useLibraryService,
  type LibraryGameRecord,
  type LibraryGameInput,
  applyLibraryFilters,
  getLibraryOwnerOptions,
  type LibraryFilter,
  type LibraryOwnerOption,
} from '../services/library'
export function Library() {
  const { user, profile, localAlias } = useAuth()
  const userDisplayName = useMemo(() => getDisplayName(profile, user, localAlias), [localAlias, profile, user])
  const userId = user?.uid ?? null

  const { createTable } = useTablesService()
  const { games, loading: libraryLoading, error: libraryError, addGame } = useLibraryService()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<LibraryFilter>({})
  const [selectedOwner, setSelectedOwner] = useState('all')
  const [durationMinInput, setDurationMinInput] = useState('')
  const [durationMaxInput, setDurationMaxInput] = useState('')
  const [weightMinInput, setWeightMinInput] = useState('')
  const [weightMaxInput, setWeightMaxInput] = useState('')
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const [bggQuery, setBggQuery] = useState('')
  const [bggResults, setBggResults] = useState<BggSearchResult[]>([])
  const [isSearchingBgg, setIsSearchingBgg] = useState(false)
  const [bggError, setBggError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<number | null>(null)
  const [importMessage, setImportMessage] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null)

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

  const [selectedGame, setSelectedGame] = useState<LibraryGameRecord | null>(null)

  const importSectionRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  const ownerOptions = useMemo<LibraryOwnerOption[]>(() => getLibraryOwnerOptions(games), [games])
  const filteredGames = useMemo(() => applyLibraryFilters(games, filter), [games, filter])
  useEffect(() => {
    if (!infoMessage) {
      return
    }

    const timeout = setTimeout(() => setInfoMessage(null), 4000)
    return () => clearTimeout(timeout)
  }, [infoMessage])

  useEffect(() => {
    setFilter((current) => ({
      ...current,
      searchTerm: search.trim() ? search.trim() : undefined,
    }))
  }, [search])

  useEffect(() => {
    if (selectedOwner === 'all') {
      setFilter((current) => ({ ...current, ownerIds: undefined, ownerNames: undefined }))
      return
    }

    if (selectedOwner === 'me') {
     if (!userId) {
       setSelectedOwner('all')
       setFilter((current) => ({ ...current, ownerIds: undefined, ownerNames: undefined }))
       return
     }

      setFilter((current) => ({ ...current, ownerIds: [userId!], ownerNames: undefined }))
     return
   }

   const option = ownerOptions.find((item) => item.value === selectedOwner)
    if (!option) {
      setSelectedOwner('all')
      setFilter((current) => ({ ...current, ownerIds: undefined, ownerNames: undefined }))
      return
    }

    if (option.ownerId) {
      setFilter((current) => ({ ...current, ownerIds: [option.ownerId!], ownerNames: undefined }))
    } else {
      setFilter((current) => ({ ...current, ownerIds: undefined, ownerNames: [option.label] }))
    }
  }, [selectedOwner, ownerOptions, userId])
  const ownerSelectOptions = useMemo(() => {
    const options = [
      { value: 'all', label: 'Todos los propietarios' },
      ...(userId ? [{ value: 'me', label: 'Mis juegos' }] : []),
      ...ownerOptions.map((option) => ({ value: option.value, label: `${option.label} (${option.count})` })),
    ]
    return options
  }, [ownerOptions, userId])

  const handleDurationMinChange = useCallback((value: string) => {
    setDurationMinInput(value)
    const numeric = value.trim() === '' ? undefined : Number(value)
    setFilter((current) => ({ ...current, durationMin: Number.isFinite(numeric) ? numeric : undefined }))
  }, [])

  const handleDurationMaxChange = useCallback((value: string) => {
    setDurationMaxInput(value)
    const numeric = value.trim() === '' ? undefined : Number(value)
    setFilter((current) => ({ ...current, durationMax: Number.isFinite(numeric) ? numeric : undefined }))
  }, [])

  const handleWeightMinChange = useCallback((value: string) => {
    setWeightMinInput(value)
    const numeric = value.trim() === '' ? undefined : Number(value)
    setFilter((current) => ({ ...current, weightMin: Number.isFinite(numeric) ? numeric : undefined }))
  }, [])

  const handleWeightMaxChange = useCallback((value: string) => {
    setWeightMaxInput(value)
    const numeric = value.trim() === '' ? undefined : Number(value)
    setFilter((current) => ({ ...current, weightMax: Number.isFinite(numeric) ? numeric : undefined }))
  }, [])

  const handleScrollToImport = useCallback(() => {
    importSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  async function handleBggSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
        setBggError('No se encontraron juegos en BGG para esa bÃºsqueda.')
      }
    } catch (error) {
      setBggResults([])
      setBggError(error instanceof Error ? error.message : 'No se pudo completar la bÃºsqueda en BGG.')
    } finally {
      setIsSearchingBgg(false)
    }
  }

  async function handleImport(id: number, yearPublished?: number) {
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

      const mechanics = details.mechanics.length > 0 ? details.mechanics.slice(0, 8) : ['Sin datos BGG']
      const weightLabel = details.averageWeight && details.averageWeight > 0 ? details.averageWeight.toFixed(1) : 'N/D'

      const input: LibraryGameInput = {
        id: `bgg-${details.id}`,
        title: details.name,
        owner: userDisplayName,
        ownerId: userId,
        ownerEmail: user?.email ?? null,
        players: playersLabel,
        duration: durationLabel,
        weight: weightLabel,
        language: 'BGG',
        mechanics,
        coverUrl: details.imageUrl ?? details.thumbnailUrl ?? undefined,
        bggId: details.id,
        yearPublished: yearPublished ?? details.yearPublished ?? null,
        durationMinutes: details.playingTime || details.maxPlaytime || details.minPlaytime || null,
        weightValue: details.averageWeight && details.averageWeight > 0 ? details.averageWeight : null,
      }

      const result = await addGame(input)

      if (result.status === 'already-exists') {
        setImportMessage({ type: 'error', message: 'El juego ya estÃ¡ en la ludoteca.' })
      } else if (result.status === 'error') {
        setImportMessage({ type: 'error', message: result.message })
      } else {
        setImportMessage({ type: 'success', message: 'Juego importado correctamente desde BGG.' })
        setSelectedOwner((current) => (current === 'all' && userId ? 'me' : current))
      }
    } catch (error) {
      setImportMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo importar el juego desde BGG.',
      })
    } finally {
      setImportingId(null)
    }
  }
  const handleRegisterGame = useCallback(
    (game: LibraryGameRecord) => {
      navigate('/registrar', { state: { preselectedGame: game.title } })
    },
    [navigate],
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
        coverUrl: tableDraft.game.coverUrl ?? undefined,
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

  const ownerFilterHelp = ownerSelectOptions.find((option) => option.value === selectedOwner)?.label
  return (
    <div className="space-y-6 pb-10">
      <header className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="section-title">Ludoteca del evento</h2>
            <p className="text-sm text-text-secondary">Busca entre todos los juegos disponibles y gestiona tus registros.</p>
          </div>
          <button
            onClick={handleScrollToImport}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
          >
            <Star className="h-4 w-4" />
            AÃ±adir juego
          </button>
        </div>
        <div className="card space-y-3 p-4">
          <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <Search className="h-4 w-4 text-text-secondary" />
              <input
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Buscar por tÃ­tulo, propietario o mecÃ¡nica"
                className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
              />
            </label>
            <select
              value={selectedOwner}
              onChange={(event) => {
                const { value } = event.currentTarget
                setSelectedOwner(value)
                if (value === 'all') {
                  setInfoMessage('Mostrando juegos de todos los propietarios.')
                } else if (value === 'me') {
                  setInfoMessage('Mostrando tus juegos.')
                } else {
                  const option = ownerSelectOptions.find((item) => item.value === value)
                  if (option) {
                    setInfoMessage(`Mostrando juegos de ${option.label.replace(/ \(.*\)$/, '')}.`)
                  }
                }
              }}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            >
              {ownerSelectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              DuraciÃ³n mÃ­nima (min)
              <input
                type="number"
                min={0}
                value={durationMinInput}
                onChange={(event) => handleDurationMinChange(event.currentTarget.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-text-primary outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              DuraciÃ³n mÃ¡xima (min)
              <input
                type="number"
                min={0}
                value={durationMaxInput}
                onChange={(event) => handleDurationMaxChange(event.currentTarget.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-text-primary outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              Peso mÃ­nimo BGG
              <input
                type="number"
                step="0.1"
                min={0}
                max={5}
                value={weightMinInput}
                onChange={(event) => handleWeightMinChange(event.currentTarget.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-text-primary outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              Peso mÃ¡ximo BGG
              <input
                type="number"
                step="0.1"
                min={0}
                max={5}
                value={weightMaxInput}
                onChange={(event) => handleWeightMaxChange(event.currentTarget.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-text-primary outline-none"
              />
            </label>
          </div>
          {ownerFilterHelp && <p className="text-xs text-text-secondary">{ownerFilterHelp}</p>}
          {infoMessage && <p className="text-xs text-primary">{infoMessage}</p>}
        </div>
      </header>
      {libraryError && (
        <div className="rounded-2xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error">
          {libraryError}
        </div>
      )}

      {libraryLoading ? (
        <div className="rounded-2xl border border-primary/20 bg-white px-4 py-3 text-sm text-text-secondary">
          Cargando ludoteca...
        </div>
      ) : filteredGames.length === 0 ? (
        <section className="card space-y-3 p-5">
          <h3 className="text-lg font-semibold text-text-primary">No hay juegos que coincidan</h3>
          <p className="text-sm text-text-secondary">
            Ajusta los filtros o importa nuevos tÃ­tulos desde BoardGameGeek para ampliar la ludoteca.
          </p>
        </section>
      ) : (
        <section className="card overflow-hidden">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-semibold">Juego</th>
                <th className="px-4 py-3 font-semibold">AÃ±o</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Propietario</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">DuraciÃ³n (min)</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Peso BGG</th>
              </tr>
            </thead>
            <tbody>
              {filteredGames.map((game) => (
                <tr
                  key={game.id}
                  onClick={() => setSelectedGame(game)}
                  className="cursor-pointer border-t border-slate-200/70 hover:bg-primary/5"
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold text-text-primary">{game.title}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{game.yearPublished ?? 'N/D'}</td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{game.owner}</td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                    {game.durationMinutes ?? 'N/D'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                    {game.weightValue ? game.weightValue.toFixed(1) : 'N/D'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {showTableModal && tableDraft.game && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-surface p-6 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Proponer mesa</h3>
                <p className="text-sm text-text-secondary">Configura los datos para abrir una mesa pÃºblica de {tableDraft.game.title}.</p>
              </div>
              <button onClick={handleCloseTable} className="text-sm font-semibold text-primary">
                Cerrar
              </button>
            </div>
            <form onSubmit={handleSubmitTable} className="space-y-4">
              <label className="flex flex-col gap-1 text-sm">
                Capacidad de la mesa
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={tableDraft.seats}
                  onChange={(event) => setTableDraft((current) => ({ ...current, seats: Number(event.currentTarget.value) }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-text-primary outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Hora prevista
                <input
                  type="text"
                  value={tableDraft.start}
                  onChange={(event) => setTableDraft((current) => ({ ...current, start: event.currentTarget.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-text-primary outline-none"
                  placeholder="Por confirmar"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Sala
                <input
                  type="text"
                  value={tableDraft.room}
                  onChange={(event) => setTableDraft((current) => ({ ...current, room: event.currentTarget.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-text-primary outline-none"
                  placeholder="Sala por confirmar"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                DescripciÃ³n
                <textarea
                  value={tableDraft.description}
                  onChange={(event) => setTableDraft((current) => ({ ...current, description: event.currentTarget.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-text-primary outline-none"
                  rows={3}
                />
              </label>
              {tableError && <p className="text-sm text-error">{tableError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={handleCloseTable} className="rounded-full px-4 py-2 text-sm font-semibold text-text-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card"
                  disabled={creatingTable}
                >
                  {creatingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
                  Publicar mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <section ref={importSectionRef} className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <BookmarkCheck className="h-4 w-4 text-secondary" />
          Importar desde BoardGameGeek
        </div>
        <form onSubmit={handleBggSearch} className="flex flex-col gap-3 md:flex-row">
          <input
            value={bggQuery}
            onChange={(event) => setBggQuery(event.currentTarget.value)}
            placeholder="Buscar juego en BGG (ej. Ark Nova)"
            className="input flex-grow"
          />
          <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2" disabled={isSearchingBgg}>
            {isSearchingBgg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
        </form>
        {bggError && <p className="text-sm text-error">{bggError}</p>}
        {importMessage && (
          <p className={importMessage.type === 'success' ? 'text-sm text-success' : 'text-sm text-error'}>{importMessage.message}</p>
        )}
        {bggResults.length > 0 && (
          <div className="space-y-2">
            {bggResults.map((result) => {
              const isImportingThis = importingId === result.id
              return (
                <div key={result.id} className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{result.name}</p>
                    <p className="text-xs text-text-secondary">BGG #{result.id} {result.yearPublished ? `â€¢ ${result.yearPublished}` : ''}</p>
                  </div>
                  <button
                    onClick={() => handleImport(result.id, result.yearPublished)}
                    disabled={isImportingThis}
                    className="btn-secondary inline-flex items-center gap-2 text-xs"
                  >
                    {isImportingThis ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importando...
                      </>
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
      </section>
      {selectedGame && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-900/50 px-4 py-8">
          <div className="w-full max-w-3xl space-y-4 rounded-2xl bg-surface p-6 shadow-card max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{selectedGame.title}</h3>
                <p className="text-sm text-text-secondary">Propietario: {selectedGame.owner}</p>
              </div>
              <button onClick={() => setSelectedGame(null)} className="text-sm font-semibold text-primary inline-flex items-center gap-1">
                Cerrar
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-background px-3 py-2 text-sm text-text-secondary">
                <p className="text-xs uppercase tracking-wide">Jugadores</p>
                <p className="text-base text-text-primary">{selectedGame.players}</p>
              </div>
              <div className="rounded-xl bg-background px-3 py-2 text-sm text-text-secondary">
                <p className="text-xs uppercase tracking-wide">DuraciÃ³n</p>
                <p className="text-base text-text-primary">
                  {selectedGame.duration}
                  {selectedGame.durationMinutes ? ` â€¢ ${selectedGame.durationMinutes} min` : ''}
                </p>
              </div>
              <div className="rounded-xl bg-background px-3 py-2 text-sm text-text-secondary">
                <p className="text-xs uppercase tracking-wide">Peso BGG</p>
                <p className="text-base text-text-primary">
                  {selectedGame.weight}
                  {selectedGame.weightValue ? ` â€¢ ${selectedGame.weightValue.toFixed(1)}` : ''}
                </p>
              </div>
              <div className="rounded-xl bg-background px-3 py-2 text-sm text-text-secondary">
                <p className="text-xs uppercase tracking-wide">Idioma</p>
                <p className="inline-flex items-center gap-2 text-base text-text-primary">
                  <Globe className="h-4 w-4" />
                  {selectedGame.language}
                </p>
              </div>
            </div>
            {selectedGame.mechanics.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
                {selectedGame.mechanics.map((mechanic) => (
                  <span key={mechanic} className="rounded-full bg-background px-3 py-1">
                    {mechanic}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenTable(selectedGame)}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Proponer mesa
                </button>
                <button
                  onClick={() => handleRegisterGame(selectedGame)}
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
          </div>
        </div>
      )}
    </div>
  )
}

