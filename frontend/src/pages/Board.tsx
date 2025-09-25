import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CalendarCheck, Clock, MapPin, Plus } from 'lucide-react'
import { GameTitle } from '../components/GameTitle'
import { useTablesService, type TableActionStatus, type TableRecord } from '../services/tables'

type FilterState = {
  hideFull: boolean
  hideJoined: boolean
  room: string
}

type NewTableState = {
  game: string
  host: string
  seats: number
  start: string
  room: string
  description: string
}

type FeedbackTone = 'success' | 'warning' | 'error'

type ActionFeedback = {
  message: string
  tone: FeedbackTone
}

const INITIAL_FILTERS: FilterState = {
  hideFull: false,
  hideJoined: false,
  room: 'Todas',
}

const INITIAL_NEW_TABLE: NewTableState = {
  game: '',
  host: 'Tú',
  seats: 4,
  start: '',
  room: '',
  description: '',
}

const FEEDBACK_TONE_STYLES: Record<FeedbackTone, string> = {
  success: 'border-success/30 bg-success/10 text-success focus-visible:outline-success',
  warning: 'border-secondary/30 bg-secondary/10 text-secondary focus-visible:outline-secondary',
  error: 'border-error/30 bg-error/10 text-error focus-visible:outline-error',
}

export function Board() {
  const { tables, loading, error, refresh, createTable, joinTable } = useTablesService()
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTable, setNewTable] = useState<NewTableState>(INITIAL_NEW_TABLE)
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null)
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const actionMessageRef = useRef<HTMLDivElement | null>(null)

  const availableRooms = useMemo(() => {
    const rooms = new Set<string>()
    tables.forEach((table) => {
      if (table.room) {
        rooms.add(table.room)
      }
    })

    return ['Todas', ...Array.from(rooms).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))]
  }, [tables])

  const filteredTables = useMemo(() => {
    return tables.filter((table) => shouldIncludeTable(table, filters))
  }, [filters, tables])

  useEffect(() => {
    if (!actionFeedback) {
      return
    }

    const timeout = setTimeout(() => setActionFeedback(null), 4000)
    return () => clearTimeout(timeout)
  }, [actionFeedback])

  useEffect(() => {
    if (actionFeedback && actionMessageRef.current) {
      actionMessageRef.current.focus()
    }
  }, [actionFeedback])

  const createButtonLabel = showCreateForm ? 'Cerrar formulario' : 'Publicar anuncio'

  function handleToggleFilter(key: 'hideFull' | 'hideJoined', value: boolean) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  async function handleJoin(tableId: string) {
    setPendingJoinId(tableId)
    try {
      const result = await joinTable(tableId)
      setActionFeedback({
        message: result.message,
        tone: mapStatusToTone(result.status),
      })
    } finally {
      setPendingJoinId(null)
    }
  }

  async function handleCreateTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedGame = newTable.game.trim()
    const trimmedRoom = newTable.room.trim()
    const trimmedDescription = newTable.description.trim()
    const trimmedHost = newTable.host.trim()
    const trimmedStart = newTable.start.trim()

    if (!trimmedGame) {
      setActionFeedback({
        message: 'Indica el juego antes de publicar el anuncio.',
        tone: 'error',
      })
      return
    }

    if (!trimmedDescription) {
      setActionFeedback({
        message: 'Describe la mesa para que otras personas sepan qué esperar.',
        tone: 'error',
      })
      return
    }

    const totalSeats = Math.max(1, Number.isFinite(newTable.seats) ? Math.floor(newTable.seats) : 4)

    setSubmitting(true)
    try {
      const result = await createTable({
        game: trimmedGame,
        host: trimmedHost || 'Tú',
        seats: totalSeats,
        start: trimmedStart || 'Por confirmar',
        room: trimmedRoom || 'Por confirmar',
        description: trimmedDescription,
      })

      setActionFeedback({
        message: result.message,
        tone: mapStatusToTone(result.status),
      })

      if (result.status === 'success') {
        setNewTable(INITIAL_NEW_TABLE)
        setShowCreateForm(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRetry() {
    setActionFeedback(null)
    await refresh()
  }

  const hasNoTables = !loading && filteredTables.length === 0

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="section-title">Tablón “Busco mesa”</h2>
          <p className="text-sm text-text-secondary">
            Encuentra partidas abiertas, apúntate con un toque y coordínate con el chat integrado.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm((value) => !value)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {createButtonLabel}
        </button>
      </header>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-text-secondary">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-background px-3 py-1">Sala: {filters.room}</span>
          <span className="rounded-full bg-background px-3 py-1">Ocultar llenas: {filters.hideFull ? 'Sí' : 'No'}</span>
          <span className="rounded-full bg-background px-3 py-1">Ocultar apuntadas: {filters.hideJoined ? 'Sí' : 'No'}</span>
        </div>
        <button
          onClick={() => setShowFilters((value) => !value)}
          className="text-sm font-semibold text-primary"
        >
          Gestionar filtros
        </button>
      </div>

      {showCreateForm && (
        <section className="card space-y-4 p-5" aria-label="Publicar nueva mesa">
          <h3 className="text-lg font-semibold text-text-primary">Publicar nueva mesa</h3>
          <p className="text-sm text-text-secondary">
            Rellena los detalles principales para que otras personas puedan unirse rápidamente a tu partida.
          </p>
          <form onSubmit={handleCreateTable} className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Juego</span>
              <input
                className="w-full bg-transparent text-base text-text-primary outline-none"
                value={newTable.game}
                onChange={(event) => setNewTable((current) => ({ ...current, game: event.currentTarget.value }))}
                placeholder="Nombre del juego"
                required
              />
            </label>
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Anfitrión</span>
              <input
                className="w-full bg-transparent text-base text-text-primary outline-none"
                value={newTable.host}
                onChange={(event) => setNewTable((current) => ({ ...current, host: event.currentTarget.value }))}
                placeholder="Tu nombre o alias"
              />
            </label>
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Plazas totales</span>
              <input
                type="number"
                min={1}
                max={8}
                className="w-full bg-transparent text-base text-text-primary outline-none"
                value={newTable.seats}
                onChange={(event) =>
                  setNewTable((current) => ({ ...current, seats: Number(event.currentTarget.value) || 1 }))
                }
              />
            </label>
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Horario estimado</span>
              <input
                className="w-full bg-transparent text-base text-text-primary outline-none"
                value={newTable.start}
                onChange={(event) => setNewTable((current) => ({ ...current, start: event.currentTarget.value }))}
                placeholder="Ej. 19:30"
              />
            </label>
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary md:col-span-2">
              <span className="text-xs uppercase tracking-wide">Sala</span>
              <input
                className="w-full bg-transparent text-base text-text-primary outline-none"
                value={newTable.room}
                onChange={(event) => setNewTable((current) => ({ ...current, room: event.currentTarget.value }))}
                placeholder="Sala o ubicación"
              />
            </label>
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary md:col-span-2">
              <span className="text-xs uppercase tracking-wide">Descripción</span>
              <textarea
                className="h-24 w-full resize-none bg-transparent text-sm text-text-secondary outline-none"
                value={newTable.description}
                onChange={(event) => setNewTable((current) => ({ ...current, description: event.currentTarget.value }))}
                placeholder="Añade detalles relevantes: nivel, módulos, si explicas reglas..."
                required
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
              >
                {submitting ? 'Publicando...' : 'Publicar mesa'}
              </button>
            </div>
          </form>
        </section>
      )}

      {showFilters && (
        <section className="card space-y-4 p-5" aria-label="Filtrar mesas">
          <h3 className="text-lg font-semibold text-text-primary">Filtrar mesas</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={filters.hideFull}
                onChange={(event) => handleToggleFilter('hideFull', event.target.checked)}
                className="h-4 w-4"
              />
              Ocultar mesas sin plazas libres
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={filters.hideJoined}
                onChange={(event) => handleToggleFilter('hideJoined', event.target.checked)}
                className="h-4 w-4"
              />
              Ocultar mesas donde ya estás apuntado
            </label>
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="block text-xs uppercase tracking-wide">Sala</span>
              <select
                className="mt-2 w-full bg-transparent text-base text-text-primary outline-none"
                value={filters.room}
                onChange={(event) => setFilters((current) => ({ ...current, room: event.currentTarget.value }))}
              >
                {availableRooms.map((roomOption) => (
                  <option key={roomOption} value={roomOption}>
                    {roomOption}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => {
                void handleRetry()
              }}
              className="rounded-full bg-error px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-error/80"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {actionFeedback && (
        <div
          ref={actionMessageRef}
          tabIndex={-1}
          role="status"
          aria-live="assertive"
          aria-atomic="true"
          className={`rounded-2xl border px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 ${FEEDBACK_TONE_STYLES[actionFeedback.tone]}`}
        >
          {actionFeedback.message}
        </div>
      )}

      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-primary/20 bg-white px-4 py-3 text-sm text-text-secondary"
        >
          Cargando mesas disponibles...
        </div>
      )}

      {hasNoTables && !loading && (
        <section className="card space-y-3 p-5">
          <h3 className="text-lg font-semibold text-text-primary">No hay mesas que coincidan con los filtros</h3>
          <p className="text-sm text-text-secondary">
            Modifica los filtros o publica un anuncio para que otras personas puedan unirse a tu partida.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 self-start rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
          >
            Publicar mesa
          </button>
        </section>
      )}

      {!hasNoTables && (
        <section className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {filteredTables.map((table) => (
            <article key={table.id} className="card space-y-4 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-text-secondary">Juego</p>
                  <GameTitle
                    name={table.game}
                    size="md"
                    textClassName="text-xl"
                    role="heading"
                    aria-level={3}
                  >
                    <p className="text-sm font-normal text-text-secondary">Anfitrión: {table.host}</p>
                  </GameTitle>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                    {Math.max(0, table.seats.total - table.seats.taken)} plazas libres
                  </span>
                  <button
                    onClick={() => {
                      void handleJoin(table.id)
                    }}
                    disabled={table.seats.taken >= table.seats.total || table.joined || pendingJoinId === table.id}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
                  >
                    {pendingJoinId === table.id
                      ? 'Reservando...'
                      : table.joined
                      ? 'Apuntado'
                      : table.seats.taken >= table.seats.total
                      ? 'Completa'
                      : 'Apuntarme'}
                  </button>
                </div>
              </div>
              <p className="text-sm text-text-secondary">{table.description}</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
                  <p className="flex items-center gap-2 text-text-primary">
                    <Clock className="h-4 w-4" />
                    {table.start}
                  </p>
                  <p>Inicio estimado</p>
                </div>
                <div className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
                  <p className="flex items-center gap-2 text-text-primary">
                    <MapPin className="h-4 w-4" />
                    {table.room}
                  </p>
                  <p>Ubicación</p>
                </div>
                <div className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
                  <p className="flex items-center gap-2 text-text-primary">
                    <CalendarCheck className="h-4 w-4" />
                    Se convierte en partida
                  </p>
                  <p>Tras confirmar plazas</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}

function mapStatusToTone(status: TableActionStatus): FeedbackTone {
  switch (status) {
    case 'success':
      return 'success'
    case 'error':
      return 'error'
    default:
      return 'warning'
  }
}

function shouldIncludeTable(table: TableRecord, filters: FilterState) {
  if (filters.hideFull && table.seats.taken >= table.seats.total) {
    return false
  }

  if (filters.hideJoined && table.joined) {
    return false
  }

  if (filters.room !== 'Todas' && table.room !== filters.room) {
    return false
  }

  return true
}
