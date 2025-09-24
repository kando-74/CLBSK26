import { useMemo, useState } from 'react'
import { ArrowDownToLine, BarChart3, LineChart, Timer, Trophy, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { getCurrentCongressDay } from '../utils/date'
import { GameTitle } from '../components/GameTitle'

type StatsTab = 'global' | 'personal'

const globalMetrics = [
  {
    label: 'Partidas registradas',
    value: '128',
    helper: 'Últimas 24 horas',
    trend: '+12% vs ayer',
    icon: Trophy,
  },
  {
    label: 'Tiempo acumulado',
    value: '98 h',
    helper: 'Tiempo total jugado',
    trend: '+5 h respecto a 2023',
    icon: Timer,
  },
  {
    label: 'Asistentes activos',
    value: '74',
    helper: 'de 96 inscritos',
    trend: '77% participación',
    icon: Users,
  },
]

const hourlyDistribution = [
  { hour: '09h', value: 4 },
  { hour: '11h', value: 9 },
  { hour: '13h', value: 6 },
  { hour: '15h', value: 14 },
  { hour: '17h', value: 18 },
  { hour: '19h', value: 22 },
  { hour: '21h', value: 16 },
  { hour: '23h', value: 8 },
]

const dayComparison = [
  { label: 'Jueves', value: 32, detail: '+4 vs miércoles' },
  { label: 'Viernes', value: 41, detail: '+9 vs jueves' },
  { label: 'Sábado', value: 55, detail: '+14 vs viernes' },
]

const topGames = [
  {
    title: 'Heat: Pedal to the Metal',
    plays: 8,
    time: '9 h 10 min',
    players: 26,
  },
  {
    title: 'Earth',
    plays: 6,
    time: '7 h 45 min',
    players: 18,
  },
  {
    title: 'Scout',
    plays: 5,
    time: '4 h 15 min',
    players: 15,
  },
]

const personalMetrics = [
  {
    label: 'Partidas jugadas',
    value: '12',
    helper: 'Últimos 3 días',
    trend: '+3 vs tu media',
    icon: Trophy,
  },
  {
    label: 'Tiempo de juego',
    value: '14 h 20 min',
    helper: 'Promedio 71 min',
    trend: '↑ +18%',
    icon: Timer,
  },
  {
    label: 'Ratio victorias',
    value: '58%',
    helper: '7 victorias',
    trend: '2 seguidas',
    icon: BarChart3,
  },
]

const personalActivity = [
  { day: 'Jueves', plays: 3, minutes: 210 },
  { day: 'Viernes', plays: 5, minutes: 320 },
  { day: 'Sábado', plays: 4, minutes: 280 },
  { day: 'Domingo', plays: 2, minutes: 150 },
]

const partnerStats = [
  { name: 'Ana M.', plays: 5, sharedMinutes: 390 },
  { name: 'Jorge L.', plays: 4, sharedMinutes: 240 },
  { name: 'Claudia P.', plays: 3, sharedMinutes: 215 },
]

const achievements = [
  {
    title: 'Explorador de novedades',
    description: 'Has jugado a 3 juegos que debutan este año en el congreso.',
    progress: 1,
  },
  {
    title: 'Maratón 10h',
    description: 'Acumula 10 horas registradas durante el evento.',
    progress: 0.85,
  },
  {
    title: 'Conecta equipos',
    description: 'Participa con 6 compañeros distintos en un mismo día.',
    progress: 0.66,
  },
]

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
  const day = getCurrentCongressDay()

  const maxHourValue = useMemo(
    () => Math.max(...hourlyDistribution.map((item) => item.value)),
    [],
  )

  const hourlySummary = useMemo(
    () => hourlyDistribution.map((item) => `${item.hour}: ${item.value} partidas`).join('. '),
    [],
  )

  const maxPersonalPlays = useMemo(
    () => Math.max(...personalActivity.map((item) => item.plays)),
    [],
  )

  const personalSummary = useMemo(
    () =>
      personalActivity
        .map((item) => `${item.day}: ${item.plays} partidas (${formatMinutes(item.minutes)})`)
        .join('. '),
    [],
  )

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
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white">
          <ArrowDownToLine className="h-4 w-4" />
          Descargar CSV (organización)
        </button>
      </header>

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
              <div className="flex items-end gap-3" aria-hidden="true">
                {hourlyDistribution.map((slot) => (
                  <div key={slot.hour} className="flex flex-1 flex-col items-center gap-2 text-xs text-text-secondary">
                    <div className="flex h-32 w-full items-end justify-center rounded-full bg-primary/10">
                      <div
                        className="w-3 rounded-full bg-primary"
                        style={{ height: `${(slot.value / maxHourValue) * 100}%` }}
                      />
                    </div>
                    <span className="font-semibold text-text-primary">{slot.value}</span>
                    <span>{slot.hour}</span>
                  </div>
                ))}
              </div>
              <p className="sr-only">Distribución horaria: {hourlySummary}.</p>
            </div>

            <div className="card space-y-4 p-5">
              <h3 className="text-lg font-semibold text-text-primary">Partidas por día</h3>
              <ul className="space-y-3 text-sm text-text-secondary">
                {dayComparison.map((item) => (
                  <li key={item.label} className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-text-primary">{item.label}</p>
                      <p>{item.detail}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
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
            <div className="grid gap-4 md:grid-cols-3">
              {topGames.map((game) => (
                <div key={game.title} className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
                  <GameTitle
                    name={game.title}
                    size="sm"
                    textClassName="text-base"
                  />
                  <p className="mt-2">{game.plays} partidas registradas</p>
                  <p>{game.players} jugadores únicos</p>
                  <p>Tiempo acumulado: {game.time}</p>
                </div>
              ))}
            </div>
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
                {personalActivity.map((item) => (
                  <div key={item.day} className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-text-secondary">
                      <span className="font-semibold text-text-primary">{item.day}</span>
                      <span>{item.plays} partidas · {formatMinutes(item.minutes)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-primary/10">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(item.plays / maxPersonalPlays) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="sr-only">Tu evolución: {personalSummary}.</p>
            </div>

            <div className="card space-y-4 p-5">
              <h3 className="text-lg font-semibold text-text-primary">Compañeros frecuentes</h3>
              <ul className="space-y-3 text-sm text-text-secondary">
                {partnerStats.map((partner) => (
                  <li key={partner.name} className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-text-primary">{partner.name}</p>
                      <p>{partner.plays} partidas en común</p>
                    </div>
                    <span className="rounded-full bg-secondary/20 px-3 py-1 text-xs font-semibold text-secondary">
                      {formatMinutes(partner.sharedMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
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
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${achievement.progress * 100}%` }}
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
