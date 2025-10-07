import React, { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { CalendarCheck, Clock, MapPin, Plus, Sparkles } from 'lucide-react'
import { GameTitle } from '../components/GameTitle'
import {
  useTablesService,
  type TableActionStatus,
  type TableRecord,
  type TableStatus,
  type StartTableInput,
  type CompleteTableInput,
} from '../services/tables'
import { useAuth } from '../components/AuthProvider'
import { getDisplayName } from '../utils/user'
import { TableChat } from '../components/TableChat'
import { UserLink } from '../components/UserLink'
import { useLiveEvents } from '../components/LiveEventsProvider'
import { Tooltip } from '../components/Tooltip'
import { useUsers } from '../services/users'

type FilterState = {
  hideFull: boolean
  hideJoined: boolean
  hideCompleted: boolean
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
  hideCompleted: true,
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

const TABLE_STATUS_META: Record<TableStatus, { label: string; badgeClass: string }> = {
  open: {
    label: 'Mesa abierta',
    badgeClass: 'bg-primary/10 text-primary',
  },
  'in-progress': {
    label: 'En juego',
    badgeClass: 'bg-secondary/10 text-secondary',
  },
  completed: {
    label: 'Partida finalizada',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
}

type StartTableDialogProps = {
  table: TableRecord
  pending: boolean
  busyPlayerUids: Set<string>
  onConfirm: (payload: StartTableInput) => Promise<void>
  onDismiss: () => void
}

type FinishTableDialogProps = {
  table: TableRecord
  pending: boolean
  onConfirm: (payload: CompleteTableInput) => Promise<void>
  onDismiss: () => void
}

function renderUserList(names: string[]) {
  return names
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name, index) => (
      <span key={`${name}-${index}`}>
        {index > 0 && ', '}
                <UserLink player={{ uid: name, alias: name }} />
      </span>
    ))
}

function StartTableDialog({ table, pending, busyPlayerUids, onConfirm, onDismiss }: StartTableDialogProps) {
  const { users, loading: usersLoading } = useUsers()
  const initialPlayers = useMemo(() => table.participants.map((participant) => participant.name), [table.participants])
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(initialPlayers)
  const [room, setRoom] = useState(table.room)
  const defaultStartMatch = table.start.match(/\d{1,2}:\d{2}/)
  const [startTime, setStartTime] = useState(defaultStartMatch ? defaultStartMatch[0] : '19:00')
  const [playerToAdd, setPlayerToAdd] = useState('')
  const [onlyShowAvailable, setOnlyShowAvailable] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedPlayers(table.participants.map((participant) => participant.name))
    setRoom(table.room)
    const match = table.start.match(/\d{1,2}:\d{2}/)
    setStartTime(match ? match[0] : '19:00')
    setPlayerToAdd('')
    setError(null)
  }, [table])

  const availablePlayers = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    table.participants.forEach((participant) => {
      const name = participant.name
      if (!seen.has(name)) {
        seen.add(name)
        list.push(name)
      }
    })
    selectedPlayers.forEach((name) => {
      if (!seen.has(name)) {
        seen.add(name)
        list.push(name)
      }
    })
    return list
  }, [selectedPlayers, table.participants])

  const potentialPlayers = useMemo(() => {
    const availableNames = new Set(availablePlayers.map((name) => name.toLowerCase()))
    return users.filter((user) => {
      const isAlreadyPlayer = availableNames.has(user.alias.toLowerCase()) || busyPlayerUids.has(user.uid)
      if (isAlreadyPlayer) {
        return false
      }
      if (onlyShowAvailable) {
        return user.availableToPlay === true
      }
      return true
    })
  }, [availablePlayers, users, busyPlayerUids, onlyShowAvailable])

  function togglePlayer(name: string) {
    setSelectedPlayers((current) => {
      if (current.includes(name)) {
        return current.filter((player) => player !== name)
      }
      return [...current, name]
    })
  }

  function addSelectedPlayer() {
    const user = users.find((u) => u.uid === playerToAdd)
    const name = user?.alias
    if (!name) {
      return
    }
    setSelectedPlayers((current) => (current.includes(name) ? current : [...current, name]))
    setPlayerToAdd('')
  }

  function toIsoFromTime(value: string): string | undefined {
    const match = value.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) {
      return undefined
    }
    const hours = Number.parseInt(match[1] ?? '0', 10)
    const minutes = Number.parseInt(match[2] ?? '0', 10)
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return undefined
    }
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0).toISOString()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (selectedPlayers.length === 0) {
      setError('Selecciona al menos una persona para empezar la partida.')
      return
    }

    const userMap = new Map(users.map((u) => [u.alias.toLowerCase(), u]))
    const playersPayload: { uid: string; alias: string }[] = selectedPlayers.map((name) => {
      const user = userMap.get(name.toLowerCase())
      return {
        uid: user?.uid ?? name, // Fallback to name as UID for legacy/unmatched players
        alias: name,
      }
    })

    const startIso = toIsoFromTime(startTime)

    try {
      await onConfirm({
        players: playersPayload,
        room,
        startTime: startIso,
      })
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'No se pudo iniciar la partida. Revisa los datos e inténtalo de nuevo.',
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 px-4 py-8">
      <div className="w-full max-w-2xl space-y-4 rounded-2xl bg-surface p-6 shadow-card max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Iniciar partida</h3>
            <p className="text-sm text-text-secondary">
              Confirma quién juega y en qué sala antes de marcar la mesa como "en juego".
            </p>
          </div>
          <button onClick={onDismiss} className="text-sm font-semibold text-primary">
            Cerrar
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Jugadoras y jugadores</p>
            <div className="flex flex-wrap gap-2">
              {availablePlayers.map((name) => {
                const selected = selectedPlayers.includes(name)
                return (
                  <label
                    key={`${table.id}-player-${name}`}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      selected ? 'bg-primary text-white shadow-card' : 'bg-background text-text-secondary hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => togglePlayer(name)}
                      className="h-4 w-4"
                    />
                    {name}
                  </label>
                )
              })}
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={onlyShowAvailable}
                  onChange={(e) => setOnlyShowAvailable(e.target.checked)}
                  className="h-4 w-4"
                />
                Mostrar solo jugadores disponibles
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={playerToAdd}
                  onChange={(event) => setPlayerToAdd(event.currentTarget.value)}
                  className="w-full rounded-full border border-primary/20 px-4 py-2 text-sm text-text-primary outline-none focus:border-primary disabled:opacity-50"
                  disabled={usersLoading}
                >
                  <option value="">{usersLoading ? 'Cargando asistentes...' : 'Selecciona un asistente para añadir'}</option>
                  {potentialPlayers.map((user) => (
                    <option key={user.uid} value={user.uid}>
                      {user.alias}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addSelectedPlayer}
                  disabled={!playerToAdd}
                  className="rounded-full bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
                >
                  Añadir
                </button>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Sala</span>
              <input
                value={room}
                onChange={(event) => setRoom(event.currentTarget.value)}
                className="w-full bg-transparent text-base text-text-primary outline-none"
                required
              />
            </label>
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Hora de inicio</span>
              <input
                value={startTime}
                onChange={(event) => setStartTime(event.currentTarget.value)}
                className="w-full bg-transparent text-base text-text-primary outline-none"
                type="time"
                required
              />
            </label>
          </div>
          {error && <p className="rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
            >
              {pending ? 'Iniciando...' : 'Confirmar inicio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FinishTableDialog({ table, pending, onConfirm, onDismiss }: FinishTableDialogProps) {
  const players = useMemo(() => {
    if (table.currentPlayers.length > 0) {
      return table.currentPlayers.map((participant) => participant.name)
    }
    return table.participants.map((participant) => participant.name)
  }, [table.currentPlayers, table.participants])

  const [result, setResult] = useState(table.resultSummary ?? '')
  const [chronicles, setChronicles] = useState<Record<string, string>>(() => ({ ...table.chronicles }))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setResult(table.resultSummary ?? '')
    setChronicles({ ...table.chronicles })
    setError(null)
  }, [table])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    try {
      await onConfirm({
        result,
        chronicles,
      })
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'No se pudo cerrar la partida. Revisa los datos e inténtalo de nuevo.',
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 px-4 py-8">
      <div className="w-full max-w-2xl space-y-4 rounded-2xl bg-surface p-6 shadow-card max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Finalizar partida</h3>
            <p className="text-sm text-text-secondary">
              Añade el resultado y, si queréis, una breve crónica por persona.
            </p>
          </div>
          <button onClick={onDismiss} className="text-sm font-semibold text-primary">
            Cerrar
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex flex-col gap-2">
            <Tooltip text="Describe quién ganó y cómo. Por ejemplo: 'Ana gana por 3 puntos'">
              <span className="text-xs uppercase tracking-wide text-text-secondary">Resumen del resultado</span>
            </Tooltip>
            <textarea
              value={result}
              onChange={(event) => {
                const { value } = event.currentTarget
                setResult(value)
              }}
              placeholder="Ej. Ana gana por 3 puntos tras una última ronda épica."
              className="h-20 w-full resize-none rounded-2xl border border-primary/20 bg-background px-4 py-2 text-sm text-text-secondary outline-none focus:border-primary focus:text-text-primary"
            />
          </label>
          <div className="space-y-3">
            <Tooltip text="Cada jugador puede escribir un breve comentario sobre la partida.">
              <p className="text-xs uppercase tracking-wide text-text-secondary">Crónicas individuales</p>
            </Tooltip>
            {players.map((player) => (
              <label key={`${table.id}-chronicle-${player}`} className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary/80">{player}</span>
                <textarea
                  value={chronicles[player] ?? ''}
                  onChange={(event) => {
                    const { value } = event.currentTarget
                    setChronicles((current) => ({
                      ...current,
                      [player]: value,
                    }))
                  }}
                  placeholder="Añade cómo fue la partida desde tu punto de vista"
                  className="h-20 w-full resize-none bg-transparent text-sm text-text-secondary outline-none"
                />
              </label>
            ))}
          </div>
          {error && <p className="rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:bg-secondary/60"
            >
              {pending ? 'Guardando...' : 'Registrar resultado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export const BoardPage: React.FC = () => {
  const { user, profile, localAlias } = useAuth()
  const location = useLocation()
  const userDisplayName = useMemo(() => getDisplayName(profile, user, localAlias), [localAlias, profile, user])
  const { tables, loading, error, refresh, createTable, joinTable, startTable, completeTable, cancelTable } = useTablesService()
  const { getTableHighlight } = useLiveEvents()
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTable, setNewTable] = useState<NewTableState>(() => ({
    ...INITIAL_NEW_TABLE,
    host: userDisplayName,
  }))
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null)
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const actionMessageRef = useRef<HTMLDivElement | null>(null)
  const [startTableId, setStartTableId] = useState<string | null>(null)
  const [finishTableId, setFinishTableId] = useState<string | null>(null)
  const [pendingStartId, setPendingStartId] = useState<string | null>(null)
  const [pendingFinishId, setPendingFinishId] = useState<string | null>(null)
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)
  const [openChatTableId, setOpenChatTableId] = useState<string | null>(null)
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(null)

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (hash) {
      setHighlightedTableId(hash)
      const element = document.getElementById(hash)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => {
          setHighlightedTableId(null)
        }, 5000)
      }
    }
  }, [location.hash])

  const availableRooms = useMemo(() => {
    const rooms = new Set<string>()
    tables.forEach((table) => {
      if (table.room) {
        rooms.add(table.room)
      }
    })

    return ['Todas', ...Array.from(rooms).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))]
  }, [tables])

  const normalizedUserName = userDisplayName.trim().toLowerCase()

  const filteredTables = useMemo(() => {
    const normalized = normalizedUserName
    return tables
      .filter((table) => shouldIncludeTable(table, filters))
      .filter((table) => {
        if (table.status === 'open') {
          return table.seats.taken < table.seats.total
        }

        if (table.status === 'in-progress' || table.status === 'completed') {
          const hostMatches = table.host.trim().toLowerCase() === normalized && normalized.length > 0
          const participantMatches = table.participants
            .map((participant) => participant.name.trim().toLowerCase())
            .includes(normalized)
          const currentMatches = table.currentPlayers
            .map((participant) => participant.name.trim().toLowerCase())
            .includes(normalized)
          return hostMatches || participantMatches || currentMatches
        }

        return false
      })
  }, [filters, tables, normalizedUserName])

  const startTargetTable = useMemo(() => tables.find((table) => table.id === startTableId) ?? null, [startTableId, tables])
  const finishTargetTable = useMemo(
    () => tables.find((table) => table.id === finishTableId) ?? null,
    [finishTableId, tables],
  )

  const busyPlayerUids = useMemo(() => {
    const uids = new Set<string>()
    tables
      .filter((table) => table.status === 'in-progress')
      .forEach((table) => {
        table.currentPlayers.forEach((player) => {
          if (player.uid) {
            uids.add(player.uid)
          }
        })
      })
    return uids
  }, [tables])


  function formatTimeFromTimestamp(timestamp: number | null) {
    if (!timestamp) {
      return ''
    }

    try {
      return new Date(timestamp).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (formatError) {
      console.warn('No se pudo formatear la hora de la partida', formatError)
      return ''
    }
  }

  useEffect(() => {
    setNewTable((current) => {
      if (!current.host || current.host === 'Tú' || current.host === 'Invitado') {
        return { ...current, host: userDisplayName }
      }
      return current
    })
  }, [userDisplayName])

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

  function handleToggleFilter(key: 'hideFull' | 'hideJoined' | 'hideCompleted', value: boolean) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  async function handleJoin(tableId: string) {
    setPendingJoinId(tableId)
    try {
      const result = await joinTable(tableId, userDisplayName)
      setActionFeedback({
        message: result.message,
        tone: mapStatusToTone(result.status),
      })
    } finally {
      setPendingJoinId(null)
    }
  }

  async function confirmStart(tableId: string, payload: StartTableInput) {
    setPendingStartId(tableId)
    try {
      const result = await startTable(tableId, payload)
      if (result.status !== 'success' || !result.table) {
        const message = result.message ?? 'No se pudo iniciar la partida.'
        setActionFeedback({ message, tone: 'error' })
        throw new Error(message)
      }

      setActionFeedback({
        message: `${result.table.game}: partida en marcha.`,
        tone: 'success',
      })
      setStartTableId(null)
    } finally {
      setPendingStartId(null)
    }
  }

  async function confirmFinish(tableId: string, payload: CompleteTableInput) {
    setPendingFinishId(tableId)
    try {
      const result = await completeTable(tableId, payload)
      if (result.status !== 'success' || !result.table) {
        const message = result.message ?? 'No se pudo cerrar la partida.'
        setActionFeedback({ message, tone: 'error' })
        throw new Error(message)
      }

      setActionFeedback({
        message: `${result.table.game}: partida finalizada.`,
        tone: 'success',
      })
      setFinishTableId(null)
    } finally {
      setPendingFinishId(null)
    }
  }
  async function handleCancelTable(tableId: string) {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Seguro que quieres cancelar esta mesa?')
      if (!confirmed) {
        return
      }
    }

    setPendingCancelId(tableId)
    try {
      const result = await cancelTable(tableId, userDisplayName)
      setActionFeedback({
        message: result.message,
        tone: mapStatusToTone(result.status),
      })
      if (result.status === 'success') {
        if (startTableId === tableId) {
          setStartTableId(null)
        }
        if (finishTableId === tableId) {
          setFinishTableId(null)
        }
      }
    } finally {
      setPendingCancelId(null)
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
        host: trimmedHost || userDisplayName,
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
        setNewTable({ ...INITIAL_NEW_TABLE, host: userDisplayName })
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
          <span className="rounded-full bg-background px-3 py-1">Ocultar finalizadas: {filters.hideCompleted ? 'Sí' : 'No'}</span>
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
          <form noValidate onSubmit={handleCreateTable} className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Juego</span>
              <input
                className="w-full bg-transparent text-base text-text-primary outline-none"
                value={newTable.game}
                onChange={(event) => {
                  const { value } = event.currentTarget
                  setNewTable((current) => ({ ...current, game: value }))
                }}
                placeholder="Nombre del juego"
                required
              />
            </label>
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Anfitrión</span>
              <input
                className="w-full bg-transparent text-base text-text-primary outline-none"
                value={newTable.host}
                onChange={(event) => {
                  const { value } = event.currentTarget
                  setNewTable((current) => ({ ...current, host: value }))
                }}
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
                onChange={(event) => {
                  const { value } = event.currentTarget
                  setNewTable((current) => ({ ...current, seats: Number(value) || 1 }))
                }}
              />
            </label>
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Horario estimado</span>
              <input
                className="w-full bg-transparent text-base text-text-primary outline-none"
                value={newTable.start}
                onChange={(event) => {
                  const { value } = event.currentTarget
                  setNewTable((current) => ({ ...current, start: value }))
                }}
                placeholder="Ej. 19:30"
              />
            </label>
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary md:col-span-2">
              <span className="text-xs uppercase tracking-wide">Sala</span>
              <input
                className="w-full bg-transparent text-base text-text-primary outline-none"
                value={newTable.room}
                onChange={(event) => {
                  const { value } = event.currentTarget
                  setNewTable((current) => ({ ...current, room: value }))
                }}
                placeholder="Sala o ubicación"
              />
            </label>
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary md:col-span-2">
              <span className="text-xs uppercase tracking-wide">Descripción</span>
              <textarea
                className="h-24 w-full resize-none bg-transparent text-sm text-text-secondary outline-none"
                value={newTable.description}
                onChange={(event) => {
                  const { value } = event.currentTarget
                  setNewTable((current) => ({ ...current, description: value }))
                }}
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
            <label className="flex items-center gap-3 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={filters.hideCompleted}
                onChange={(event) => handleToggleFilter('hideCompleted', event.target.checked)}
                className="h-4 w-4"
              />
              Ocultar partidas finalizadas
            </label>
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="block text-xs uppercase tracking-wide">Sala</span>
              <select
                className="mt-2 w-full bg-transparent text-base text-text-primary outline-none"
                value={filters.room}
                onChange={(event) => {
                  const { value } = event.currentTarget
                  setFilters((current) => ({ ...current, room: value }))
                }}
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
          {filteredTables.map((table) => {
            const statusMeta = TABLE_STATUS_META[table.status]
            const participantNamesLower = table.participants.map((participant) => participant.name.toLowerCase())
            const currentPlayersLower = table.currentPlayers.map((participant) => participant.name.toLowerCase())
            const isHost = table.host.trim().toLowerCase() === normalizedUserName && normalizedUserName.length > 0
            const isParticipant = participantNamesLower.includes(normalizedUserName)
            const isCurrentPlayer = currentPlayersLower.includes(normalizedUserName)
            const canStart = table.status === 'open' && (isHost || isParticipant)
            const canCancel = table.status === 'open' && isHost
            const canFinish = table.status === 'in-progress' && (isHost || isParticipant || isCurrentPlayer)
            const joinDisabled =
              table.seats.taken >= table.seats.total ||
              table.joined ||
              pendingJoinId === table.id ||
              table.status !== 'open'

            const joinLabel = (() => {
              if (pendingJoinId === table.id) {
                return 'Reservando...'
              }
              if (table.status === 'in-progress') {
                return 'En juego'
              }
              if (table.status === 'completed') {
                return 'Finalizada'
              }
              if (table.joined) {
                return 'Apuntado'
              }
              if (table.seats.taken >= table.seats.total) {
                return 'Completa'
              }
              return 'Apuntarme'
            })()

            const startedLabel = formatTimeFromTimestamp(table.startedAt)
            const completionLabel = formatTimeFromTimestamp(table.completedAt)
            const currentPlayersNames = table.currentPlayers.length > 0
              ? table.currentPlayers.map((participant) => participant.name)
              : table.participants.map((participant) => participant.name)
            const currentPlayersNodes = renderUserList(currentPlayersNames)

            const tableHighlight = getTableHighlight(table.id)
            const cardHighlightClass = tableHighlight || highlightedTableId === table.id
              ? 'ring-2 ring-primary/40 shadow-[0_18px_50px_rgba(99,102,241,0.25)]'
              : ''

            return (
              <article id={table.id} key={table.id} className={`card space-y-4 p-5 transition-shadow duration-200 ${cardHighlightClass}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-text-secondary">Juego</p>
                    <GameTitle
                      name={table.game}
                      coverUrl={table.coverUrl ?? undefined}
                      size="md"
                      textClassName="text-xl"
                      role="heading"
                      aria-level={3}
                    >
                      <p className="text-sm font-normal text-text-secondary">
                        Anfitrión: <UserLink player={{ uid: table.host, alias: table.host }} />
                      </p>
                    </GameTitle>
                  </div>
                  <div className="flex flex-col items-start justify-end gap-2 md:items-end">
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </span>
                    {tableHighlight && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        <Sparkles className="h-3 w-3" />
                        Actualizado {tableHighlight.label}
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                        {Math.max(0, table.seats.total - table.seats.taken)} plazas libres
                      </span>
                      <button
                        onClick={() => {
                          void handleJoin(table.id)
                        }}
                        disabled={joinDisabled}
                        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
                      >
                        {joinLabel}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-text-secondary">{table.description}</p>
                {table.participants.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
                    <span className="rounded-full bg-background px-3 py-1 font-semibold text-text-primary">Participantes</span>
                    {table.participants.map((participant) => (
                      <span
                        key={`${table.id}-${participant.deviceId ?? participant.name}`}
                        className="rounded-full bg-background px-3 py-1"
                      >
                        <UserLink player={{ uid: participant.uid ?? participant.name, alias: participant.name }} className="text-text-secondary hover:text-primary" />
                      </span>
                    ))}
                  </div>
                )}
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
                      {table.status === 'in-progress' ? 'Partida en marcha' : 'Se convierte en partida'}
                    </p>
                    <p>{table.status === 'in-progress' ? 'Confirmada por los jugadores' : 'Tras confirmar plazas'}</p>
                  </div>
                </div>

                {table.status === 'in-progress' && (
                  <div className="rounded-2xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-text-secondary">
                    <p className="font-semibold text-text-primary">Partida en juego</p>
                    <p>
                      Jugadores: {currentPlayersNodes}
                    </p>
                    {startedLabel && <p>Inicio: {startedLabel}</p>}
                  </div>
                )}

                {table.status === 'completed' && (
                  <div className="space-y-2 rounded-2xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <p className="font-semibold">Resultado registrado</p>
                    <p>{table.resultSummary ?? 'Partida finalizada sin resumen.'}</p>
                    {completionLabel && <p className="text-xs text-emerald-800/80">Cierre: {completionLabel}</p>}
                    {Object.keys(table.chronicles).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800/90">Crónicas</p>
                        {Object.entries(table.chronicles).map(([player, chronicle]) => (
                          <div key={`${table.id}-chronicle-${player}`} className="rounded-xl bg-white/70 px-3 py-2 text-xs text-emerald-900">
                            <p className="font-semibold text-emerald-800">{player}</p>
                            <p>{chronicle}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {canStart && (
                    <button
                      type="button"
                      onClick={() => setStartTableId(table.id)}
                      className="rounded-full border border-primary/50 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      Iniciar partida
                    </button>
                  )}
                  {canFinish && (
                    <button
                      type="button"
                      onClick={() => setFinishTableId(table.id)}
                      className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-secondary/80"
                    >
                      Finalizar partida
                    </button>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => handleCancelTable(table.id)}
                      disabled={pendingCancelId === table.id}
                      className="rounded-full border border-error/40 px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:border-error/20 disabled:text-error/60"
                    >
                      {pendingCancelId === table.id ? 'Cancelando...' : 'Cancelar mesa'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpenChatTableId((current) => (current === table.id ? null : table.id))
                    }}
                    className="text-sm font-semibold text-primary"
                  >
                    {openChatTableId === table.id ? 'Cerrar chat' : 'Abrir chat'}
                  </button>
                </div>

                {openChatTableId === table.id && (
                  <TableChat
                    tableId={table.id}
                    currentUserName={userDisplayName}
                    currentUserId={user?.uid ?? null}
                    canUsePrivateChannel={table.joined}
                    className="mt-3"
                  />
                )}
              </article>
            )
          })}
        </section>
      )}

      {startTargetTable && (
        <StartTableDialog
          table={startTargetTable}
          pending={pendingStartId === startTargetTable.id}
          busyPlayerUids={busyPlayerUids}
          onConfirm={async (payload) => {
            await confirmStart(startTargetTable.id, payload)
          }}
          onDismiss={() => setStartTableId(null)}
        />
      )}

      {finishTargetTable && (
        <FinishTableDialog
          table={finishTargetTable}
          pending={pendingFinishId === finishTargetTable.id}
          onConfirm={async (payload) => {
            await confirmFinish(finishTargetTable.id, payload)
          }}
          onDismiss={() => setFinishTableId(null)}
        />
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
  if (filters.hideCompleted && table.status === 'completed') {
    return false
  }

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
