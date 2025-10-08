import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowDownToLine, BarChart3, LineChart, Timer, Trophy, Users, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import { getCurrentCongressDay, getDayBoundaries } from '../utils/date'
import { GameTitle } from '../components/GameTitle'
import {
  isRealtimePlaysEnabled,
  listPlays,
  subscribePlays,
  summarizeRoomOccupancy,
  type PlayRecord,
  type RoomOccupancySummary,
} from '../services/plays'
import { useLiveEvents } from '../components/LiveEventsProvider'
import { UserLink } from '../components/UserLink'

type StatsTab = 'global' | 'personal'

const PERSONAL_SAMPLE_NAME = 'Ana G.'

type MetricCard = {
  label: string
  value: string
  helper: string
  trend: string
  icon: LucideIcon
}

type PersonalActivitySlot = {
  label: string
  plays: number
  minutes: number
}

type PartnerSummary = {
  name: string
  plays: number
  sharedMinutes: number
}

type TopGameSummary = {
  title: string
  plays: number
  minutes: number
  players: number
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours === 0) {
    return `${remainingMinutes} min`
  }

  if (remainingMinutes === 0) {
    return `${hours} h`
  }

  return `${hours} h ${remainingMinutes} min`
}

export function Statistics() {
  const [activeTab, setActiveTab] = useState<StatsTab>('global')
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const day = getCurrentCongressDay()
  const { start: dayStart, end: dayEnd } = getDayBoundaries()
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [activePlays, setActivePlays] = useState<PlayRecord[]>([])
  const [roomSummary, setRoomSummary] = useState<RoomOccupancySummary>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { latestPlayTimestamp, formatRelativeTime } = useLiveEvents()
  const liveUpdateLabel = useMemo(
    () => (latestPlayTimestamp ? formatRelativeTime(latestPlayTimestamp) : null),
    [formatRelativeTime, latestPlayTimestamp],
  )

  const globalSummary = useMemo(() => {
    const totalPlays = plays.length
    const totalMinutes = plays.reduce((accumulator, play) => accumulator + (play.durationMinutes ?? 0), 0)

    const participantSet = new Set<string>()
    let totalParticipations = 0

    plays.forEach((play) => {
      play.players.forEach((player) => {
        const normalized = player.alias.trim()
        if (normalized) {
          participantSet.add(normalized)
        }
        totalParticipations += 1
      })
    })

    return {
      totalPlays,
      totalMinutes,
      activePlays: activePlays.length,
      uniquePlayers: participantSet.size,
      participations: totalParticipations,
      averagePlayers: totalPlays > 0 ? totalParticipations / totalPlays : 0,
      averageDuration: totalPlays > 0 ? totalMinutes / totalPlays : 0,
    }
  }, [activePlays.length, plays])

  const hourlyDistribution = useMemo(() => {
    const buckets = new Map<string, number>()
    plays.forEach((play) => {
      const date = new Date(play.startTime)
      const key = `${String(date.getHours()).padStart(2, '0')}h`
      const value = buckets.get(key) ?? 0
      buckets.set(key, value + 1)
    })

    return Array.from(buckets.entries())
      .map(([hour, value]) => ({ hour, value }))
      .sort((first, second) => first.hour.localeCompare(second.hour))
  }, [plays])

  const maxHourValue = useMemo(
    () => Math.max(1, ...hourlyDistribution.map((item) => item.value)),
    [hourlyDistribution],
  )

  const hourlySummary = useMemo(() => {
    if (hourlyDistribution.length === 0) {
      return 'Aún no hay partidas registradas en esta jornada.'
    }
    return hourlyDistribution.map((item) => `${item.hour}: ${item.value} partida(s)`).join('. ')
  }, [hourlyDistribution])

  const personalPlays = useMemo(() => {
    const normalizedTarget = PERSONAL_SAMPLE_NAME.trim().toLowerCase()
    if (!normalizedTarget) {
      return []
    }

    return plays.filter((play) =>
      play.players.some((player) => player.alias.trim().toLowerCase() === normalizedTarget),
    )
  }, [plays])

  const personalSummary = useMemo(() => {
    if (personalPlays.length === 0) {
      return 'Aún no hay partidas registradas a tu nombre en esta jornada.'
    }

    const totalMinutes = personalPlays.reduce((accumulator, play) => accumulator + (play.durationMinutes ?? 0), 0)
    return `${personalPlays.length} partidas • ${formatMinutes(totalMinutes)}`
  }, [personalPlays])

  const globalMetrics = useMemo<MetricCard[]>(() => {
    return [
      {
        label: 'Partidas registradas',
        value: String(globalSummary.totalPlays),
        helper: 'Jornada actual',
        trend:
          globalSummary.activePlays > 0
            ? `${globalSummary.activePlays} en curso ahora mismo`
            : 'Sin partidas activas en este momento',
        icon: Trophy,
      },
      {
        label: 'Tiempo acumulado',
        value: globalSummary.totalMinutes > 0 ? formatMinutes(globalSummary.totalMinutes) : '—',
        helper: 'Duración registrada',
        trend:
          globalSummary.totalPlays > 0
            ? `Promedio ${formatMinutes(Math.round(globalSummary.averageDuration || 0))} por partida`
            : 'Esperando primeras partidas registradas',
        icon: Timer,
      },
      {
        label: 'Participantes únicos',
        value: String(globalSummary.uniquePlayers),
        helper: 'Personas distintas',
        trend:
          globalSummary.participations > 0
            ? `${globalSummary.participations} participaciones registradas`
            : 'Sin inscripciones todavía',
        icon: Users,
      },
    ]
  }, [globalSummary])

  const topGames = useMemo<TopGameSummary[]>(() => {
    const entries = new Map<string, { plays: number; minutes: number; players: Set<string> }>()

    plays.forEach((play) => {
      const key = play.game.trim() || 'Juego sin título'
      const current = entries.get(key) ?? { plays: 0, minutes: 0, players: new Set<string>() }
      current.plays += 1
      current.minutes += play.durationMinutes ?? 0
      play.players.forEach((player) => {
        const normalized = player.alias.trim()
        if (normalized) {
          current.players.add(normalized)
        }
      })
      entries.set(key, current)
    })

    return Array.from(entries.entries())
      .map(([title, data]) => ({ title, plays: data.plays, minutes: data.minutes, players: data.players.size }))
      .sort((first, second) => {
        if (second.plays !== first.plays) {
          return second.plays - first.plays
        }
        return second.minutes - first.minutes
      })
      .slice(0, 3)
  }, [plays])

  const roomOccupancyList = useMemo(
    () =>
      Object.entries(roomSummary)
        .map(([room, summary]) => ({ room, activePlays: summary.activePlays, players: summary.players }))
        .sort((first, second) => {
          if (second.activePlays !== first.activePlays) {
            return second.activePlays - first.activePlays
          }
          return second.players - first.players
        }),
    [roomSummary],
  )

  const personalMetrics = useMemo<MetricCard[]>(() => {
    const totalMinutes = personalPlays.reduce((accumulator, play) => accumulator + (play.durationMinutes ?? 0), 0)
    const uniqueGames = new Set(personalPlays.map((play) => play.game.trim()).filter(Boolean))
    const partnerSet = new Set<string>()

    personalPlays.forEach((play) => {
      play.players.forEach((player) => {
        const normalized = player.alias.trim()
        if (!normalized || normalized.toLowerCase() === PERSONAL_SAMPLE_NAME.toLowerCase()) {
          return
        }
        partnerSet.add(normalized)
      })
    })

    if (personalPlays.length === 0) {
      return [
        {
          label: 'Partidas registradas',
          value: '0',
          helper: 'Jornada actual',
          trend: 'Añade la primera partida para activar estos indicadores.',
          icon: Trophy,
        },
        {
          label: 'Tiempo de juego',
          value: '—',
          helper: 'Duración acumulada',
          trend: 'Sin minutos registrados todavía.',
          icon: Timer,
        },
        {
          label: 'Compañeros de mesa',
          value: '0',
          helper: 'Jugadores distintos',
          trend: 'Invita a otros asistentes a tu próxima partida.',
          icon: Users,
        },
      ]
    }

    const averageDuration = personalPlays.length > 0 ? Math.round(totalMinutes / personalPlays.length) : 0

    return [
      {
        label: 'Partidas registradas',
        value: String(personalPlays.length),
        helper: 'Jornada actual',
        trend: uniqueGames.size > 1 ? `${uniqueGames.size} títulos distintos` : 'Un único título por ahora',
        icon: Trophy,
      },
      {
        label: 'Tiempo de juego',
        value: totalMinutes > 0 ? formatMinutes(totalMinutes) : '—',
        helper: 'Duración acumulada',
        trend:
          averageDuration > 0
            ? `Promedio ${formatMinutes(averageDuration)} por partida`
            : 'Sin duración registrada todavía',
        icon: Timer,
      },
      {
        label: 'Compañeros de mesa',
        value: String(partnerSet.size),
        helper: 'Jugadores distintos',
        trend:
          partnerSet.size > 0
            ? `Media ${(partnerSet.size / Math.max(1, personalPlays.length)).toFixed(1)} por partida`
            : 'Pendiente de compartir mesa',
        icon: Users,
      },
    ]
  }, [personalPlays])

  const personalActivity = useMemo<PersonalActivitySlot[]>(() => {
    const slotDefinitions = [
      { label: 'Mañana (07h-12h)', start: 7, end: 12 },
      { label: 'Mediodía (12h-17h)', start: 12, end: 17 },
      { label: 'Tarde (17h-22h)', start: 17, end: 22 },
      { label: 'Noche (22h-07h)', start: 22, end: 31 },
    ]

    const base: PersonalActivitySlot[] = slotDefinitions.map((slot) => ({ label: slot.label, plays: 0, minutes: 0 }))

    personalPlays.forEach((play) => {
      const date = new Date(play.startTime)
      let hour = date.getHours()
      if (hour < 7) {
        hour += 24
      }
      const minutes = play.durationMinutes ?? 0
      const index = slotDefinitions.findIndex((slot) => hour >= slot.start && hour < slot.end)
      if (index !== -1) {
        base[index].plays += 1
        base[index].minutes += minutes
      }
    })

    return base
  }, [personalPlays])

  const maxPersonalPlays = useMemo(
    () => Math.max(1, ...personalActivity.map((item) => item.plays)),
    [personalActivity],
  )

  const hasPersonalActivity = useMemo(() => personalActivity.some((item) => item.plays > 0), [personalActivity])

  const partnerStats = useMemo<PartnerSummary[]>(() => {
    const normalizedTarget = PERSONAL_SAMPLE_NAME.trim().toLowerCase()
    const summary = new Map<string, { plays: number; minutes: number }>()

    personalPlays.forEach((play) => {
      play.players.forEach((player) => {
        const normalized = player.alias.trim()
        if (!normalized || normalized.toLowerCase() === normalizedTarget) {
          return
        }

        const current = summary.get(normalized) ?? { plays: 0, minutes: 0 }
        current.plays += 1
        current.minutes += play.durationMinutes ?? 0
        summary.set(normalized, current)
      })
    })

    return Array.from(summary.entries())
      .map(([name, data]) => ({ name, plays: data.plays, sharedMinutes: data.minutes }))
      .sort((first, second) => {
        if (second.plays !== first.plays) {
          return second.plays - first.plays
        }
        return second.sharedMinutes - first.sharedMinutes
      })
      .slice(0, 5)
  }, [personalPlays])

  const achievements = useMemo(() => {
    if (personalPlays.length === 0) {
      return [
        {
          title: 'Empieza a registrar partidas',
          description: 'Añade tu primera partida para activar el seguimiento personal.',
          progress: 0,
        },
      ]
    }

    const totalMinutes = personalPlays.reduce((accumulator, play) => accumulator + (play.durationMinutes ?? 0), 0)
    const uniqueGames = new Set(personalPlays.map((play) => play.game.trim()).filter(Boolean))
    const completedPlays = personalPlays.filter((play) => play.status === 'completed').length

    return [
      {
        title: 'Sesión activa',
        description: `Has registrado ${personalPlays.length} partida(s) en la jornada.`,
        progress: Math.min(1, personalPlays.length / 4),
      },
      {
        title: 'Maratón 5h',
        description: 'Objetivo: 300 minutos acumulados en partidas.',
        progress: Math.min(1, totalMinutes / 300),
      },
      {
        title: 'Mesa completa',
        description: completedPlays > 0 ? `${completedPlays} partida(s) cerradas con resultado.` : 'Cierra la primera partida para registrar su resultado.',
        progress: Math.min(1, completedPlays / 3),
      },
      {
        title: 'Catálogo en expansión',
        description: uniqueGames.size > 0 ? `${uniqueGames.size} título(s) distintos.` : 'Juega a un nuevo título para desbloquear este indicador.',
        progress: Math.min(1, uniqueGames.size / 5),
      },
    ]
  }, [personalPlays])

  useEffect(() => {
    if (!exportStatus) {
      return
    }

    const timeout = setTimeout(() => setExportStatus(null), 4000)
    return () => clearTimeout(timeout)
  }, [exportStatus])

  useEffect(() => {
    let cancelled = false

    if (isRealtimePlaysEnabled()) {
      setLoading(true)
      setError(null)

      const unsubscribe = subscribePlays(
        { dayStart, dayEnd },
        (playsSnapshot) => {
          if (cancelled) {
            return
          }

          const activeSnapshot = playsSnapshot.filter((play) => play.status === 'in-progress')
          setPlays(playsSnapshot)
          setActivePlays(activeSnapshot)
          setRoomSummary(summarizeRoomOccupancy(activeSnapshot))
          setLoading(false)
        },
        (message) => {
          if (cancelled) {
            return
          }
          setError(message)
          setLoading(false)
        },
      )

      return () => {
        cancelled = true
        unsubscribe()
      }
    }

    async function loadPlays() {
      try {
        setLoading(true)
        setError(null)

        const playsOfDay = await listPlays({ dayStart, dayEnd })
        if (cancelled) {
          return
        }

        const active = playsOfDay.filter((play) => play.status === 'in-progress')
        setPlays(playsOfDay)
        setActivePlays(active)
        setRoomSummary(summarizeRoomOccupancy(active))
      } catch (loadError) {
        console.error('No se pudieron cargar las estadísticas', loadError)
        if (!cancelled) {
          setError('No se pudieron cargar las estadísticas del día. Intenta recargar la página.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPlays()

    const interval = window.setInterval(() => {
      void loadPlays()
    }, 10000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [dayEnd, dayStart])

  const handleDownloadCsv = useCallback(() => {
    try {
      const rows: string[][] = [
        ['Sección', 'Métrica', 'Valor', 'Detalle'],
        ['Global', 'Partidas registradas', String(globalSummary.totalPlays), `${activePlays.length} en curso`],
        [
          'Global',
          'Tiempo total',
          globalSummary.totalMinutes > 0 ? formatMinutes(globalSummary.totalMinutes) : '—',
          'Incluye partidas cerradas',
        ],
        [
          'Global',
          'Participantes únicos',
          String(globalSummary.uniquePlayers),
          `${globalSummary.participations} participaciones`,
        ],
        ...hourlyDistribution.map((item) => ['Horarios', item.hour, String(item.value), 'Partidas registradas']),
      ]

      if (roomOccupancyList.length > 0) {
        rows.push(['Salas', 'Con actividad', String(roomOccupancyList.length), 'Mesas activas por sala'])
        roomOccupancyList.forEach((item) => {
          rows.push([
            'Salas',
            item.room,
            `${item.activePlays} mesa(s)`,
            `${item.players} jugador(es) implicados`,
          ])
        })
      }

      if (topGames.length > 0) {
        topGames.forEach((game, index) => {
          rows.push([
            'Top juegos',
            `${index + 1}. ${game.title}`,
            `${game.plays} partida(s)`,
            `${game.minutes > 0 ? formatMinutes(game.minutes) : '—'} · ${game.players} jugador(es)`,
          ])
        })
      }

      rows.push(['Personal', 'Resumen', personalSummary, `Referencia de usuario: ${PERSONAL_SAMPLE_NAME}`])

      const csvContent = rows
        .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `estadisticas-clbsk-${day.label.replace(/\s+/g, '-').toLowerCase()}.csv`
      link.click()
      URL.revokeObjectURL(url)

      setExportStatus({ type: 'success', message: 'Exportación generada correctamente.' })
    } catch (error) {
      setExportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo generar el CSV.',
      })
    }
  }, [
    activePlays.length,
    day.label,
    globalSummary,
    hourlyDistribution,
    personalSummary,
    roomOccupancyList,
    topGames,
  ])

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="section-title">Panel de estadísticas</h2>
          <p className="text-sm text-text-secondary">
            Revisa los indicadores clave del congreso y tu rendimiento personal. El día de referencia se calcula con la frontera
            horaria de las 07:00.
          </p>
          <p className="mt-2 text-xs uppercase tracking-wide text-text-secondary">
            Resumen para el {day.label}
          </p>
          {liveUpdateLabel && (
            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Zap className="h-3 w-3" />
              Actividad reciente · {liveUpdateLabel}
            </span>
          )}
        </div>
        <button
          onClick={handleDownloadCsv}
          className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
        >
          <ArrowDownToLine className="h-4 w-4" />
          Descargar CSV (organización)
        </button>
      </header>

      {exportStatus && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            exportStatus.type === 'success'
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-error/30 bg-error/10 text-error'
          }`}
        >
          {exportStatus.message}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-medium text-error">
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-primary">
          Actualizando estadísticas en tiempo real...
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('global')}
          className={clsx(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'global'
              ? 'bg-primary text-white shadow-card'
              : 'bg-background text-text-secondary hover:bg-primary/10 hover:text-primary',
          )}
          type="button"
        >
          <BarChart3 className="h-4 w-4" />
          Panel global
        </button>
        <button
          onClick={() => setActiveTab('personal')}
          className={clsx(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'personal'
              ? 'bg-primary text-white shadow-card'
              : 'bg-background text-text-secondary hover:bg-primary/10 hover:text-primary',
          )}
          type="button"
        >
          <Users className="h-4 w-4" />
          Mi perfil
        </button>
      </div>

      {activeTab === 'global' ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            {globalMetrics.map((metric) => (
              <article key={metric.label} className="card flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-text-secondary">
                  <span>{metric.helper}</span>
                  <metric.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-3xl font-semibold text-text-primary">{metric.value}</p>
                <p className="text-sm font-semibold text-text-primary">{metric.label}</p>
                <p className="text-xs font-medium text-secondary">{metric.trend}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
            <div className="card space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">Partidas por franja horaria</h3>
                <LineChart className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-text-secondary">
                Histograma de actividad en la jornada actual. Permite ajustar recursos (salas, voluntarios) según la demanda.
              </p>
              {hourlyDistribution.length > 0 ? (
                <div className="flex items-end gap-3" aria-hidden="true">
                  {hourlyDistribution.map((slot) => (
                    <div key={slot.hour} className="flex flex-1 flex-col items-center gap-2 text-xs text-text-secondary">
                      <div className="flex h-32 w-full items-end justify-center rounded-t-full bg-primary/10">
                        <div
                          className="h-[var(--bar-height)] w-3 rounded-t-full bg-primary"
                          style={{ '--bar-height': `calc(${(slot.value / maxHourValue) * 100}%)` } as React.CSSProperties}
                        />
                      </div>
                      <span className="font-semibold text-text-primary">{slot.value}</span>
                      <span>{slot.hour}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
                  Aún no hay partidas registradas en esta jornada.
                </p>
              )}
              <p className="sr-only">Distribución horaria: {hourlySummary}.</p>
            </div>

            <div className="card space-y-4 p-5">
              <h3 className="text-lg font-semibold text-text-primary">Salas con actividad</h3>
              <p className="text-sm text-text-secondary">
                Estado en vivo de las partidas en curso. Útil para reasignar voluntarios o localizar mesas.
              </p>
              {roomOccupancyList.length > 0 ? (
                <ul className="space-y-3 text-sm text-text-secondary">
                  {roomOccupancyList.map((item) => (
                    <li key={item.room} className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-text-primary">{item.room}</p>
                        <p>{item.players} jugador(es) en {item.activePlays} mesa(s)</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                        {item.activePlays}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
                  No hay partidas en curso ahora mismo.
                </p>
              )}
            </div>
          </section>

          <section className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Top juegos más jugados</h3>
              <Trophy className="h-5 w-5 text-secondary" />
            </div>
            <p className="text-sm text-text-secondary">
              Ranking calculado con partidas confirmadas. Útil para destacar títulos populares o asignar copias adicionales.
            </p>
            {topGames.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-3">
                {topGames.map((game) => (
                  <div key={game.title} className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
                    <GameTitle name={game.title} size="sm" textClassName="text-base" />
                    <p className="mt-2">{game.plays} partida(s) registradas</p>
                    <p>{game.players} jugador(es) implicados</p>
                    <p>Tiempo acumulado: {game.minutes > 0 ? formatMinutes(game.minutes) : '—'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
                Aún no hay suficientes partidas registradas para generar un ranking.
              </p>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            {personalMetrics.map((metric) => (
              <article key={metric.label} className="card flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-text-secondary">
                  <span>{metric.helper}</span>
                  <metric.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-3xl font-semibold text-text-primary">{metric.value}</p>
                <p className="text-sm font-semibold text-text-primary">{metric.label}</p>
                <p className="text-xs font-medium text-secondary">{metric.trend}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
            <div className="card space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">Evolución diaria</h3>
                <LineChart className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-text-secondary">
                Controla tu ritmo de partidas y tiempo invertido para equilibrar descansos y nuevos encuentros.
              </p>
              <div className="space-y-3" aria-hidden="true">
                {hasPersonalActivity ? (
                  personalActivity
                    .filter((item) => item.plays > 0)
                    .map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm text-text-secondary">
                          <span className="font-semibold text-text-primary">{item.label}</span>
                          <span>
                            {item.plays} partida(s) ·{' '}
                            {item.minutes > 0 ? formatMinutes(item.minutes) : '—'}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-primary/10">
                          <div
                            className="h-full w-[var(--bar-width)] rounded-full bg-primary"
                            style={{ '--bar-width': `${(item.plays / maxPersonalPlays) * 100}%` } as React.CSSProperties}
                          />
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
                    Registra tu primera partida para ver la evolución por franjas horarias.
                  </p>
                )}
              </div>
              <p className="sr-only">Tu evolución: {personalSummary}.</p>
            </div>

            <div className="card space-y-4 p-5">
              <h3 className="text-lg font-semibold text-text-primary">Compañeros frecuentes</h3>
              {partnerStats.length > 0 ? (
                <ul className="space-y-3 text-sm text-text-secondary">
                  {partnerStats.map((partner) => (
                    <li key={partner.name} className="flex items-center justify-between">
                      <div>
                        <UserLink player={{ uid: partner.name, alias: partner.name }} className="font-semibold text-text-primary hover:text-primary/80" />
                        <p>{partner.plays} partida(s) en común</p>
                      </div>
                      <span className="rounded-full bg-secondary/20 px-3 py-1 text-xs font-semibold text-secondary">
                        {partner.sharedMinutes > 0 ? formatMinutes(partner.sharedMinutes) : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
                  Cuando compartas mesa con otros asistentes, verás aquí a tus compañeros habituales.
                </p>
              )}
            </div>
          </section>

          <section className="card space-y-4 p-5">
            <h3 className="text-lg font-semibold text-text-primary">Logros y próximos hitos</h3>
            <div className="space-y-3 text-sm text-text-secondary">
              {achievements.map((achievement) => (
                <div key={achievement.title} className="space-y-2 rounded-2xl bg-background px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-text-primary">{achievement.title}</p>
                      <p>{achievement.description}</p>
                    </div>
                    <span className="text-xs font-semibold text-primary">
                      {Math.round(achievement.progress * 100)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-primary/10">
                    <div
                      className="h-full w-[var(--bar-width)] rounded-full bg-primary"
                      style={{ '--bar-width': `${achievement.progress * 100}%` } as React.CSSProperties}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
