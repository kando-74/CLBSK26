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
import { getCurrentCongressDay, formatHour } from '../utils/date'
import { GameTitle } from '../components/GameTitle'
import { UserLink } from '../components/UserLink'

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

const statsHighlights = [
  {
    label: 'Partidas hoy',
    value: '18',
    trend: '+4 vs ayer',
    icon: Sparkles,
    badge: 'Hoy',
  },
  {
    label: 'Tiempo de juego',
    value: '26 h',
    trend: '↑ +12%',
    icon: Clock4,
    badge: 'Acumulado',
  },
  {
    label: 'Jugadores activos',
    value: '42',
    trend: '78% asistentes',
    icon: Users,
    badge: 'Conectados',
  },
]

const recentPlays = [
  {
    id: 1,
    game: 'Heat: Pedal to the Metal',
    players: ['Ana', 'Luis', 'María', 'Jorge'],
    duration: '75 min',
    winner: 'Ana',
    start: new Date().setMinutes(new Date().getMinutes() - 25),
  },
  {
    id: 2,
    game: 'Bohnanza',
    players: ['Pablo', 'Irene', 'Claudia'],
    duration: '45 min',
    winner: 'Claudia',
    start: new Date().setMinutes(new Date().getMinutes() - 50),
  },
  {
    id: 3,
    game: 'Dune: Imperium',
    players: ['Raúl', 'Inés', 'Hugo', 'Elena'],
    duration: '110 min',
    winner: 'Hugo',
    start: new Date().setMinutes(new Date().getMinutes() - 130),
  },
]

const announcements = [
  {
    id: 1,
    title: 'Cena comunitaria a las 20:30',
    message: 'Nos vemos en la sala multiusos. Trae tu acreditación.',
  },
  {
    id: 2,
    title: 'Entrega premios prototipos',
    message: 'Domingo 12:00 en el auditorio. ¡No te lo pierdas!',
  },
]

export function Home() {
  const day = getCurrentCongressDay()

  return (
    <div className="space-y-8 pb-10">
      <section className="card relative overflow-hidden bg-gradient-to-r from-primary to-emerald-600 text-white">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_top,_rgba(255,180,0,0.35),_transparent_70%)] md:block" />
        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-10">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-white/80">Día del congreso</p>
            <h2 className="mt-1 text-3xl font-semibold capitalize md:text-4xl">{day.label}</h2>
            <p className="mt-3 max-w-xl text-base text-white/80">
              Consulta de un vistazo las partidas de hoy, las mesas abiertas y los próximos anuncios de la organización.
            </p>
            <Link
              to="/estadisticas"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              <BarChart3 className="h-4 w-4" />
              Abrir panel de estadísticas
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 md:gap-6">
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
                <Share2 className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Actividad reciente</h2>
            <span className="flex items-center gap-2 text-sm text-text-secondary">
              <CalendarDays className="h-4 w-4" />
              {day.label}
            </span>
          </div>
          <div className="space-y-3">
            {recentPlays.map((play) => (
              <article key={play.id} className="card flex items-start justify-between gap-4 p-5">
                <div className="space-y-2">
                  <GameTitle
                    name={play.game}
                    size="sm"
                    textClassName="text-lg"
                    role="heading"
                    aria-level={3}
                  />
                  <div className="flex flex-wrap gap-2 text-sm text-text-secondary">
                    {play.players.map((player) => (
                      <span key={player} className="rounded-full bg-background px-3 py-1">
                        <UserLink name={player} className="text-text-secondary hover:text-primary" />
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-text-secondary">
                    <strong className="text-text-primary">Ganó:</strong>{' '}
                    <UserLink name={play.winner} className="text-text-secondary hover:text-primary" />
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 text-right text-sm text-text-secondary">
                  <span className="rounded-full bg-secondary/20 px-3 py-1 text-xs font-semibold text-secondary">
                    {formatHour(new Date(play.start))}
                  </span>
                  <span>{play.duration}</span>
                </div>
              </article>
            ))}
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
            <h3 className="text-lg font-semibold text-text-primary">Consejos rápidos</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li>• Marca tus juegos favoritos para encontrarlos en segundos.</li>
              <li>• Configura alertas push para no perderte nuevas mesas.</li>
              <li>• Comparte el enlace de tu partida con un toque.</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  )
}
