import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarCheck, Clock, MapPin, Plus } from 'lucide-react'
import { GameTitle } from '../components/GameTitle'

type Table = {
  id: number
  game: string
  host: string
  seats: {
    taken: number
    total: number
  }
  start: string
  room: string
  description: string
  joined?: boolean
}

const initialTables: Table[] = [
  {
    id: 1,
    game: 'Revive',
    host: 'Lucía',
    seats: { taken: 2, total: 4 },
    start: '18:00',
    room: 'Sala Verde',
    description: 'Buscamos jugadoras con experiencia previa. Partida avanzada con módulos.',
  },
  {
    id: 2,
    game: 'Scout',
    host: 'Javi',
    seats: { taken: 1, total: 5 },
    start: 'En cuanto estemos',
    room: 'Lobby',
    description: 'Ideal para partidas rápidas entre actividades. Explicación incluida.',
  },
  {
    id: 3,
    game: 'Earth',
    host: 'Marta',
    seats: { taken: 3, total: 4 },
    start: '19:30',
    room: 'Sala Azul',
    description: 'Buscamos un último hueco. Explicamos reglas y usamos expansión Boreal.',
  },
]

export function Board() {
  const [tables, setTables] = useState<Table[]>(() => initialTables.map((table) => ({ ...table, joined: false })))
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    hideFull: false,
    hideJoined: false,
    room: 'Todas',
  })
  const [newTable, setNewTable] = useState({
    game: '',
    host: 'Tú',
    seats: 4,
    start: '',
    room: '',
    description: '',
  })

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
    return tables.filter((table) => {
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
    })
  }, [filters.hideFull, filters.hideJoined, filters.room, tables])

  useEffect(() => {
    if (!actionMessage) {
      return
    }

    const timeout = setTimeout(() => setActionMessage(null), 4000)
    return () => clearTimeout(timeout)
  }, [actionMessage])

  const createButtonLabel = showCreateForm ? 'Cerrar formulario' : 'Publicar anuncio'

  function handleToggleFilter(key: 'hideFull' | 'hideJoined', value: boolean) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function handleJoin(tableId: number) {
    setTables((current) => {
      let joinedGame: string | null = null
      const next = current.map((table) => {
        if (table.id !== tableId) {
          return table
        }

        if (table.joined) {
          joinedGame = `${table.game}: ya estás apuntado`
          return table
        }

        if (table.seats.taken >= table.seats.total) {
          joinedGame = `${table.game}: no quedan plazas libres`
          return table
        }

        joinedGame = `${table.game}: plaza reservada`
        return {
          ...table,
          seats: { ...table.seats, taken: table.seats.taken + 1 },
          joined: true,
        }
      })

      if (joinedGame) {
        setActionMessage(joinedGame)
      }

      return next
    })
  }

  function handleCreateTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedGame = newTable.game.trim()
    const trimmedRoom = newTable.room.trim()
    const trimmedDescription = newTable.description.trim()

    if (!trimmedGame) {
      setActionMessage('Indica el juego antes de publicar el anuncio.')
      return
    }

    if (!trimmedDescription) {
      setActionMessage('Describe la mesa para que otras personas sepan qué esperar.')
      return
    }

    const totalSeats = Math.max(1, Number.isFinite(newTable.seats) ? Math.floor(newTable.seats) : 4)

    setTables((current) => [
      {
        id: Date.now(),
        game: trimmedGame,
        host: newTable.host.trim() || 'Tú',
        seats: {
          total: totalSeats,
          taken: Math.min(totalSeats, 1),
        },
        start: newTable.start.trim() || 'Por confirmar',
        room: trimmedRoom || 'Por confirmar',
        description: trimmedDescription,
        joined: true,
      },
      ...current,
    ])

    setNewTable({ game: '', host: 'Tú', seats: 4, start: '', room: '', description: '' })
    setShowCreateForm(false)
    setActionMessage('Mesa publicada y plaza reservada para ti.')
  }

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
          <span className="rounded-full bg-background px-3 py-1">
            Sala: {filters.room}
          </span>
          <span className="rounded-full bg-background px-3 py-1">
            Ocultar llenas: {filters.hideFull ? 'Sí' : 'No'}
          </span>
          <span className="rounded-full bg-background px-3 py-1">
            Ocultar apuntadas: {filters.hideJoined ? 'Sí' : 'No'}
          </span>
        </div>
        <button
          onClick={() => setShowFilters((value) => !value)}
          className="text-sm font-semibold text-primary"
        >
          Gestionar filtros
        </button>
      </div>

      {showCreateForm && (
        <section className="card space-y-4 p-5">
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
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
              >
                Publicar mesa
              </button>
            </div>
          </form>
        </section>
      )}

      {showFilters && (
        <section className="card space-y-4 p-5">
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

      {actionMessage && (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          {actionMessage}
        </div>
      )}

      <section className="space-y-4">
        {filteredTables.map((table) => {
          const freeSeats = Math.max(0, table.seats.total - table.seats.taken)
          const isFull = freeSeats === 0
          return (
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
                  {freeSeats} plazas libres
                </span>
                <button
                  onClick={() => handleJoin(table.id)}
                  disabled={isFull || table.joined}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
                >
                  Apuntarme
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
          )
        })}
      </section>
    </div>
  )
}
