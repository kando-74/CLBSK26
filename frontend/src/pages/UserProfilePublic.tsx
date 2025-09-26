import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CalendarClock,
  Clock,
  MapPin,
  Sparkles,
  Trophy,
  User,
  Users,
  Zap,
} from 'lucide-react'
import { subscribePlays, type PlayRecord } from '../services/plays'
import { subscribeTables, type TableRecord } from '../services/tables'
import { decodeUserProfileParam, normalizeUserName } from '../utils/profileLinks'
import { UserLink } from '../components/UserLink'

function formatTime(iso: string | null): string {
  if (!iso) {
    return ''
  }
  try {
    const date = new Date(iso)
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  } catch (error) {
    console.warn('No se pudo formatear la hora', error)
    return ''
  }
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '—'
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

function normalizeList(names: string[]): string[] {
  return names.filter((name) => name.trim().length > 0)
}

export function UserProfilePublic() {
  const params = useParams<{ alias: string }>()
  const rawAlias = decodeUserProfileParam(params.alias)
  const trimmedAlias = rawAlias.trim()
  const normalizedAlias = normalizeUserName(trimmedAlias)

  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [tables, setTables] = useState<TableRecord[]>([])
  const [playsReady, setPlaysReady] = useState(false)
  const [tablesReady, setTablesReady] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribePlays({}, (snapshot) => {
      setPlays(snapshot)
      setPlaysReady(true)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeTables((snapshot) => {
      setTables(snapshot)
      setTablesReady(true)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const initials = useMemo(() => {
    const segments = trimmedAlias
      .split(' ')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2)
    if (segments.length === 0) {
      return '??'
    }
    return segments.map((segment) => segment[0]?.toUpperCase() ?? '').join('')
  }, [trimmedAlias])

  const aliasMatches = useMemo(() => {
    if (!normalizedAlias) {
      return () => false
    }
    return (value: string | null | undefined) => normalizeUserName(value ?? '') === normalizedAlias
  }, [normalizedAlias])

  const playsForUser = useMemo(
    () => plays.filter((play) => play.players.some((player) => aliasMatches(player))),
    [aliasMatches, plays],
  )

  const activePlay = useMemo(() => {
    return playsForUser
      .filter((play) => play.status === 'in-progress')
      .sort((first, second) => Date.parse(second.startTime) - Date.parse(first.startTime))[0] ?? null
  }, [playsForUser])

  const completedPlays = useMemo(
    () =>
      playsForUser
        .filter((play) => play.status === 'completed')
        .sort((first, second) => Date.parse(second.startTime) - Date.parse(first.startTime)),
    [playsForUser],
  )

  const totalMinutes = useMemo(
    () =>
      playsForUser.reduce((accumulator, play) => accumulator + (play.durationMinutes ?? 0), 0),
    [playsForUser],
  )

  const tablesForUser = useMemo(
    () =>
      tables.filter((table) => {
        if (aliasMatches(table.host)) {
          return true
        }
        if (table.participants.some((participant) => aliasMatches(participant.name))) {
          return true
        }
        if (table.currentPlayers.some((participant) => aliasMatches(participant.name))) {
          return true
        }
        return false
      }),
    [aliasMatches, tables],
  )

  const openTables = useMemo(
    () => tablesForUser.filter((table) => table.status === 'open'),
    [tablesForUser],
  )

  const inProgressTables = useMemo(
    () => tablesForUser.filter((table) => table.status === 'in-progress'),
    [tablesForUser],
  )

  const recentPlays = useMemo(() => playsForUser.slice(0, 10), [playsForUser])

  const loading = !normalizedAlias || !playsReady || !tablesReady
  const hasData = playsForUser.length > 0 || tablesForUser.length > 0

  if (!trimmedAlias) {
    return (
      <div className="space-y-4 pb-10">
        <header className="flex flex-col gap-2">
          <h2 className="section-title">Ficha de usuario no disponible</h2>
          <p className="text-sm text-text-secondary">Introduce un alias válido para consultar la ficha pública.</p>
        </header>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
            {initials}
          </div>
          <div>
            <h2 className="section-title">{trimmedAlias}</h2>
            <p className="text-sm text-text-secondary">
              Resumen público de actividad en el congreso. Todas las personas asistentes pueden consultar estas fichas.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-dashed border-primary px-4 py-2 text-sm font-semibold text-primary"
          title="Próximamente podrás subir una foto de perfil"
          disabled
        >
          <User className="h-4 w-4" />
          Añadir foto (próximamente)
        </button>
      </header>

      {loading && (
        <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-primary">
          Sincronizando actividad en vivo...
        </div>
      )}

      {!loading && !hasData && (
        <div className="card space-y-3 p-6">
          <h3 className="text-lg font-semibold text-text-primary">Sin actividad registrada todavía</h3>
          <p className="text-sm text-text-secondary">
            No encontramos partidas o mesas asociadas a esta persona. Pide que se apunte con su alias al registrar
            partidas o mesas para activar su ficha.
          </p>
        </div>
      )}

      {!loading && hasData && (
        <section className="grid gap-4 md:grid-cols-3">
          <article className="card space-y-2 p-5">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <Trophy className="h-4 w-4 text-primary" />
              Partidas registradas
            </span>
            <p className="text-3xl font-semibold text-text-primary">{playsForUser.length}</p>
            <p className="text-xs text-text-secondary">
              {completedPlays.length} completadas · {formatDuration(totalMinutes)} en mesa
            </p>
          </article>
          <article className="card space-y-2 p-5">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <Users className="h-4 w-4 text-primary" />
              Mesas activas
            </span>
            <p className="text-3xl font-semibold text-text-primary">{inProgressTables.length}</p>
            <p className="text-xs text-text-secondary">{openTables.length} mesa(s) buscando personas</p>
          </article>
          <article className="card space-y-2 p-5">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <Sparkles className="h-4 w-4 text-primary" />
              Última actividad
            </span>
            <p className="text-3xl font-semibold text-text-primary">
              {playsForUser.length > 0
                ? new Date(
                    Math.max(
                      ...playsForUser.map((play) =>
                        Number.isNaN(Date.parse(play.startTime)) ? 0 : Date.parse(play.startTime),
                      ),
                    ),
                  ).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
                : '—'}
            </p>
            <p className="text-xs text-text-secondary">Actividad agregada en directo</p>
          </article>
        </section>
      )}

      {activePlay && (
        <section className="card space-y-4 p-6">
          <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Zap className="h-4 w-4" />
              Ahora mismo en mesa
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
              <CalendarClock className="h-4 w-4" />
              Desde {formatTime(activePlay.startTime)}
            </span>
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-secondary">Juego</p>
              <p className="text-lg font-semibold text-text-primary">{activePlay.game}</p>
              <p className="mt-1 text-sm text-text-secondary">
                Sala {activePlay.room} · {activePlay.players.length} jugador(es)
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-text-secondary">Jugadores</p>
              <p className="text-sm text-text-secondary">
                {normalizeList(activePlay.players).map((player, index) => (
                  <span key={`${player}-${index}`}>
                    {index > 0 && ', '}
                    <UserLink name={player} />
                  </span>
                ))}
              </p>
            </div>
          </div>
        </section>
      )}

      {openTables.length > 0 && (
        <section className="card space-y-4 p-6">
          <header className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">Mesas abiertas o en búsqueda</h3>
            <span className="text-xs uppercase tracking-wide text-text-secondary">
              {openTables.length} mesa(s) esperando personas
            </span>
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            {openTables.map((table) => {
              const participants = normalizeList(table.participants.map((participant) => participant.name))
              return (
                <article key={table.id} className="rounded-2xl border border-primary/20 bg-background px-4 py-3 text-sm text-text-secondary">
                  <p className="text-base font-semibold text-text-primary">{table.game}</p>
                  <p className="mt-1">Sala {table.room} · {table.seats.taken}/{table.seats.total} plazas ocupadas</p>
                  <p className="mt-1">Anfitrión: <UserLink name={table.host} /></p>
                  {participants.length > 0 && (
                    <p className="mt-1">
                      Apuntados:{' '}
                      {participants.map((participant, index) => (
                        <span key={`${participant}-${index}`}>
                          {index > 0 && ', '}
                          <UserLink name={participant} />
                        </span>
                      ))}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      )}

      {inProgressTables.length > 0 && (
        <section className="card space-y-4 p-6">
          <h3 className="text-lg font-semibold text-text-primary">Mesas en las que participa</h3>
          <div className="space-y-3 text-sm text-text-secondary">
            {inProgressTables.map((table) => (
              <div key={table.id} className="rounded-2xl bg-background px-4 py-3">
                <p className="text-base font-semibold text-text-primary">{table.game}</p>
                <p>
                  Jugadores:{' '}
                  {normalizeList(
                    table.currentPlayers.length > 0
                      ? table.currentPlayers.map((player) => player.name)
                      : table.participants.map((participant) => participant.name),
                  ).map((name, index) => (
                    <span key={`${name}-${index}`}>
                      {index > 0 && ', '}
                      <UserLink name={name} />
                    </span>
                  ))}
                </p>
                <p>
                  <MapPin className="mr-1 inline h-3 w-3" /> Sala {table.room}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {recentPlays.length > 0 && (
        <section className="card space-y-4 p-6">
          <header className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text-primary">Últimas partidas</h3>
            <span className="text-xs uppercase tracking-wide text-text-secondary">
              {recentPlays.length} partida(s) recientes
            </span>
          </header>
          <ul className="space-y-3 text-sm text-text-secondary">
            {recentPlays.map((play) => (
              <li key={play.id} className="rounded-2xl bg-background px-4 py-3">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-base font-semibold text-text-primary">{play.game}</p>
                    <p>
                      {normalizeList(play.players).map((player, index) => (
                        <span key={`${player}-${index}`}>
                          {index > 0 && ', '}
                          <UserLink name={player} />
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(play.startTime)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Sala {play.room}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
