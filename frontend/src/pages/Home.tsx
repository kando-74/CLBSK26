import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import {
  BarChart3,
  CalendarDays,
  Clock4,
  LibraryBig,
  Megaphone,
  Share2,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { getCurrentCongressDay, getDayBoundaries, formatHour } from '../utils/date'
import { GameTitle } from '../components/GameTitle'
import { UserLink } from '../components/UserLink'
import { subscribePlays, type PlayRecord } from '../services/plays'
import { subscribeTables, type TableRecord } from '../services/tables'
import { isActivityLoggingEnabled, subscribeActivityLogs, type ActivityLogRecord } from '../services/activity'

const quickActions = [
  {
    label: 'Registrar partida',
    description: 'Añade juego, jugadores y resultado en menos de un minuto.',
    icon: Trophy,
    to: '/registrar',
    accent: 'bg-primary/10 text-primary',
  },
  {
    label: 'Añadir juego',
    description: 'Completa la ludoteca del evento con tus títulos.',
    icon: LibraryBig,
    to: '/ludoteca',
    accent: 'bg-secondary/10 text-secondary',
  },
  {
    label: 'Publicar anuncio',
    description: 'Abre una mesa y permite que otros se apunten al instante.',
    icon: Megaphone,
    to: '/tablon',
    accent: 'bg-primary/5 text-text-secondary',
  },
  {
    label: 'Ver estadísticas',
    description: 'Consulta métricas globales y tu progreso personal del evento.',
    icon: BarChart3,
    to: '/estadisticas',
    accent: 'bg-primary/5 text-primary',
  },
]

const activityDateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
})

type LoadingState = {
  plays: boolean
  tables: boolean
  announcements: boolean
}

function formatMinutesLabel(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return '—'
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) {
    return `${minutes} min`
  }
  if (minutes === 0) {
    return `${hours} h`
  }
  return `${hours} h ${minutes} min`
}

function renderPlayersInline(players: string[]): ReactNode {
  const normalized = players.map((player) => player.trim()).filter((player) => player.length > 0)
  return normalized.map((player, index) => (
    <span key={`${player}-${index}`}>
      {index > 0 && ', '}
      <UserLink name={player} />
    </span>
  ))
}

function formatActivityMessage(entry: ActivityLogRecord) {
  if (entry.message) {
    return entry.message
  }

  switch (entry.type) {
    case 'table:create':
      return `Nueva mesa publicada: ${entry.entityName}`
    case 'table:join':
      return `Reserva en la mesa ${entry.entityName}`
    case 'library:add':
      return `Juego añadido a la ludoteca: ${entry.entityName}`
    default:
      return entry.entityName
  }
}

function formatActivitySubtitle(entry: ActivityLogRecord) {
  const actorName = entry.actor?.displayName ?? entry.actor?.email ?? 'Sistema'
  const timestamp = entry.createdAt ? activityDateFormatter.format(entry.createdAt) : 'Sincronizando…'
  const device = entry.deviceId ? ` · ${entry.deviceId}` : ''
  return `${actorName} · ${timestamp}${device}`
}

function getPlayDurationLabel(play: PlayRecord): string {
  if (play.status === 'in-progress') {
    return 'En juego'
  }
  if (Number.isFinite(play.durationMinutes) && (play.durationMinutes ?? 0) > 0) {
    return formatMinutesLabel(play.durationMinutes ?? 0)
  }
  return 'Duración por confirmar'
}

function getPlayStartLabel(play: PlayRecord): string {
  const parsed = Date.parse(play.startTime)
  if (Number.isNaN(parsed)) {
    return 'Horario en revisión'
  }
  return formatHour(new Date(parsed))
}

export function Home() {
  const day = getCurrentCongressDay()
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [tables, setTables] = useState<TableRecord[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>([])
  const [loading, setLoading] = useState<LoadingState>({
    plays: true,
    tables: true,
    announcements: isActivityLoggingEnabled,
  })
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    const { start, end } = getDayBoundaries()

    const unsubscribePlays = subscribePlays(
      { dayStart: start, dayEnd: end },
      (next) => {
        setPlays(next)
        setLoading((current) => ({ ...current, plays: false }))
      },
      (message) => {
        if (message) {
          setStatusMessage(message)
        }
        setLoading((current) => ({ ...current, plays: false }))
      },
    )

    const unsubscribeTables = subscribeTables(
      (next) => {
        setTables(next)
        setLoading((current) => ({ ...current, tables: false }))
      },
      (message) => {
        if (message) {
          setStatusMessage(message)
        }
        setLoading((current) => ({ ...current, tables: false }))
      },
    )

    let unsubscribeActivity = () => {}
    if (isActivityLoggingEnabled) {
      unsubscribeActivity = subscribeActivityLogs(
        6,
        (logs) => {
          setActivityLogs(logs)
          setLoading((current) => ({ ...current, announcements: false }))
        },
        (message) => {
          if (message) {
            setStatusMessage(message)
          }
          setLoading((current) => ({ ...current, announcements: false }))
        },
      )
    } else {
      setLoading((current) => ({ ...current, announcements: false }))
    }

    return () => {
      unsubscribePlays()
      unsubscribeTables()
      unsubscribeActivity()
    }
  }, [])

  const activePlays = useMemo(
    () => plays.filter((play) => play.status === 'in-progress'),
    [plays],
  )

  const completedPlays = useMemo(
    () => plays.filter((play) => play.status === 'completed'),
    [plays],
  )

  const livePlays = useMemo(() => activePlays.slice(0, 4), [activePlays])

  const uniquePlayers = useMemo(() => {
    const set = new Set<string>()
    plays.forEach((play) => {
      play.players.forEach((player) => {
        const trimmed = player.alias.trim()
        if (trimmed) {
          set.add(trimmed.toLowerCase())
        }
      })
    })
    return set.size
  }, [plays])

  const totalMinutes = useMemo(
    () => plays.reduce((accumulator, play) => accumulator + (play.durationMinutes ?? 0), 0),
    [plays],
  )

  const openTables = useMemo(
    () =>
      tables
        .filter((table) => table.status === 'open')
        .sort((first, second) => (second.createdAt ?? 0) - (first.createdAt ?? 0))
        .slice(0, 4),
    [tables],
  )

  const tablesInProgress = useMemo(
    () =>
      tables
        .filter((table) => table.status === 'in-progress')
        .sort((first, second) => (second.startedAt ?? 0) - (first.startedAt ?? 0))
        .slice(0, 4),
    [tables],
  )

  const recentPlays = useMemo(() => {
    return plays
      .slice()
      .sort((first, second) => Date.parse(second.startTime) - Date.parse(first.startTime))
      .slice(0, 5)
  }, [plays])

  const statsHighlights = useMemo(
    () => [
      {
        label: 'Partidas registradas',
        value: String(plays.length),
        trend: `${completedPlays.length} finalizadas hoy`,
        icon: Trophy,
        badge: 'Hoy',
      },
      {
        label: 'Partidas en curso',
        value: String(activePlays.length),
        trend: `${openTables.length} mesa(s) buscando personas`,
        icon: Sparkles,
        badge: 'En vivo',
      },
      {
        label: 'Participantes únicos',
        value: String(uniquePlayers),
        trend: totalMinutes > 0 ? `${formatMinutesLabel(totalMinutes)} acumulados` : 'Duración pendiente',
        icon: Users,
        badge: 'Personas',
      },
    ],
    [activePlays.length, completedPlays.length, openTables.length, plays.length, totalMinutes, uniquePlayers],
  )

  const announcements = useMemo(() => {
    if (activityLogs.length === 0) {
      return [
        {
          id: 'placeholder',
          title: 'Sin anuncios por ahora',
          message: 'La organización publicará avisos en este espacio en cuanto estén disponibles.',
        },
      ]
    }

    return activityLogs.slice(0, 3).map((entry) => ({
      id: entry.id,
      title: formatActivityMessage(entry),
      message: formatActivitySubtitle(entry),
    }))
  }, [activityLogs])

  const isLoading = loading.plays || loading.tables

  return (
    <div className="space-y-8 pb-10">
      <section className="card relative overflow-hidden bg-gradient-to-r from-primary to-emerald-600 text-white">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_top,_rgba(255,180,0,0.35),_transparent_70%)] md:block" />
        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-xl">
            <p className="text-sm font-medium uppercase tracking-wide text-white/80">Día del congreso</p>
            <h2 className="mt-1 text-3xl font-semibold capitalize md:text-4xl">{day.label}</h2>
            <p className="mt-3 text-base text-white/80">
              Consulta en vivo las partidas registradas hoy, las mesas abiertas y los últimos avisos de la organización.
            </p>
            <Link
              to="/estadisticas"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              <BarChart3 className="h-4 w-4" />
              Abrir panel de estadísticas
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-6">
            {statsHighlights.map((item) => (
              <div
                key={item.label}
                className="flex flex-col rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"
              >
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
                  <span>{item.badge}</span>
                  <item.icon className="h-4 w-4" />
                </div>
                <span className="text-2xl font-semibold">{item.value}</span>
                <span className="text-sm text-white/80">{item.label}</span>
                <span className="mt-2 text-xs font-medium text-emerald-200">{item.trend}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {statusMessage ? (
        <div className="card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {statusMessage}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Acciones rápidas</h2>
          <Link className="text-sm font-semibold text-primary" to="/estadisticas">
            Ver panel de estadísticas
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="card group flex flex-col gap-3 p-5 transition-transform hover:-translate-y-1"
            >
              <div
                className={clsx(
                  'inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
                  action.accent,
                )}
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </div>
              <p className="text-sm text-text-secondary">{action.description}</p>
              <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Ir ahora
                <Share2 className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Actividad reciente</h2>
              <span className="flex items-center gap-2 text-sm text-text-secondary">
                <CalendarDays className="h-4 w-4" />
                {day.label}
              </span>
            </div>
            {isLoading && recentPlays.length === 0 ? (
              <div className="card p-5 text-sm text-text-secondary">Sincronizando partidas del día…</div>
            ) : null}
            {recentPlays.length > 0 ? (
              <div className="space-y-3">
                {recentPlays.map((play) => (
                  <article key={play.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:justify-between">
                    <div className="space-y-2">
                      <GameTitle
                        name={play.game}
                        size="sm"
                        textClassName="text-lg"
                        role="heading"
                        aria-level={3}
                      />
                      <p className="text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Jugadores:</span>{' '}
                        {renderPlayersInline(play.players.map(p => p.alias))}
                      </p>
                      <p className="text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Sala:</span> {play.room || 'Por confirmar'}
                      </p>
                      {play.resultSummary ? (
                        <p className="text-sm text-text-secondary">
                          <span className="font-semibold text-text-primary">Resultado:</span> {play.resultSummary}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right text-sm text-text-secondary">
                      <span className="rounded-full bg-secondary/20 px-3 py-1 text-xs font-semibold text-secondary">
                        {getPlayStartLabel(play)}
                      </span>
                      <span>{getPlayDurationLabel(play)}</span>
                      <span
                        className={clsx(
                          'rounded-full px-3 py-1 text-xs font-semibold',
                          play.status === 'in-progress'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-emerald-100 text-emerald-800',
                        )}
                      >
                        {play.status === 'in-progress' ? 'En curso' : 'Finalizada'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {!isLoading && recentPlays.length === 0 ? (
              <div className="card p-5 text-sm text-text-secondary">
                Aún no se han registrado partidas para hoy. ¡Anímate a estrenar la jornada!
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Partidas en curso</h2>
              <span className="flex items-center gap-2 text-sm text-text-secondary">
                <Clock4 className="h-4 w-4" />
                {activePlays.length} activas
              </span>
            </div>
            {isLoading && livePlays.length === 0 ? (
              <div className="card p-5 text-sm text-text-secondary">Cargando partidas en curso…</div>
            ) : null}
            {livePlays.length > 0 ? (
              <div className="space-y-3">
                {livePlays.map((play) => (
                  <article key={play.id} className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <GameTitle
                        name={play.game}
                        size="sm"
                        textClassName="text-base font-semibold text-primary"
                        role="heading"
                        aria-level={3}
                      />
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        Desde {getPlayStartLabel(play)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-text-secondary">{renderPlayersInline(play.players.map(p => p.alias))}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
                      <span>{play.room || 'Sala por confirmar'}</span>
                      <span>{getPlayDurationLabel(play)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {!isLoading && livePlays.length === 0 ? (
              <div className="card p-5 text-sm text-text-secondary">No hay partidas en curso en este momento.</div>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card space-y-3 p-5">
            <h3 className="text-lg font-semibold text-text-primary">Anuncios de la organización</h3>
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="rounded-xl bg-background/80 p-3">
                  <p className="text-sm font-semibold text-text-primary">{announcement.title}</p>
                  <p className="text-sm text-text-secondary">{announcement.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card space-y-3 p-5">
            <h3 className="text-lg font-semibold text-text-primary">Mesas abiertas</h3>
            {loading.tables && openTables.length === 0 ? (
              <p className="text-sm text-text-secondary">Sincronizando mesas…</p>
            ) : null}
            {openTables.length > 0 ? (
              <div className="space-y-3">
                {openTables.map((table) => {
                  const availableSeats = Math.max(table.seats.total - table.seats.taken, 0)
                  const participants = (table.participants ?? []).map((participant) => participant.name)

                  return (
                    <article key={table.id} className="rounded-2xl bg-background/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <GameTitle name={table.game} size="sm" textClassName="text-base" />
                        <span
                          className={clsx(
                            'rounded-full px-3 py-1 text-xs font-semibold',
                            availableSeats > 0
                              ? 'bg-secondary/20 text-secondary'
                              : 'bg-emerald-100 text-emerald-800',
                          )}
                        >
                          {availableSeats > 0 ? `${availableSeats} plaza(s) libre(s)` : 'Completa'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Anfitrión:</span>{' '}
                        <UserLink name={table.host} className="text-text-secondary hover:text-primary" />
                      </p>
                      <p className="text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Sala:</span> {table.room || 'Por confirmar'} ·{' '}
                        <span className="font-semibold text-text-primary">Inicio:</span> {table.start || 'Próximamente'}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {table.seats.taken}/{table.seats.total} personas anotadas
                      </p>
                      {participants.length > 0 ? (
                        <p className="mt-1 text-xs text-text-secondary">{renderPlayersInline(participants)}</p>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : null}
            {!loading.tables && openTables.length === 0 ? (
              <p className="text-sm text-text-secondary">No hay mesas abiertas ahora mismo. Vuelve en unos minutos.</p>
            ) : null}
          </div>

          <div className="card space-y-3 p-5">
            <h3 className="text-lg font-semibold text-text-primary">Mesas en juego</h3>
            {loading.tables && tablesInProgress.length === 0 ? (
              <p className="text-sm text-text-secondary">Recuperando estado de las mesas…</p>
            ) : null}
            {tablesInProgress.length > 0 ? (
              <div className="space-y-3">
                {tablesInProgress.map((table) => {
                  const players = (table.currentPlayers ?? table.participants ?? []).map((participant) => participant.name)
                  const startedAtLabel = table.startedAt ? formatHour(new Date(table.startedAt)) : 'En curso'

                  return (
                    <article key={table.id} className="rounded-2xl bg-primary/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <GameTitle name={table.game} size="sm" textClassName="text-base font-semibold text-primary" />
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          Desde {startedAtLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Sala:</span> {table.room || 'Por confirmar'}
                      </p>
                      {players.length > 0 ? (
                        <p className="text-xs text-text-secondary">{renderPlayersInline(players)}</p>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : null}
            {!loading.tables && tablesInProgress.length === 0 ? (
              <p className="text-sm text-text-secondary">No hay mesas activas en este momento.</p>
            ) : null}
          </div>
        </aside>
      </section>
    </div>
  )
}
