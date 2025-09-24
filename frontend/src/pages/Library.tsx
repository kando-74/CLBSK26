import { useMemo, useState } from 'react'
import {
  BookmarkCheck,
  Filter,
  Globe,
  Search,
  Star,
  Users,
} from 'lucide-react'

interface GameEntry {
  id: number
  title: string
  owner: string
  players: string
  duration: string
  weight: string
  language: string
  mechanics: string[]
  manual?: boolean
}

const library: GameEntry[] = [
  {
    id: 1,
    title: 'Heat: Pedal to the Metal',
    owner: 'Claudia',
    players: '2-6',
    duration: '60-90 min',
    weight: '2.3',
    language: 'ES',
    mechanics: ['Carreras', 'Gestión de mano'],
  },
  {
    id: 2,
    title: 'Sky Team',
    owner: 'Luis',
    players: '2',
    duration: '25 min',
    weight: '2.0',
    language: 'EN',
    mechanics: ['Cooperativo', 'Tiradas ocultas'],
  },
  {
    id: 3,
    title: 'Kutná Hora',
    owner: 'Elena',
    players: '2-4',
    duration: '90-120 min',
    weight: '3.6',
    language: 'ES',
    mechanics: ['Economía', 'Construcción'],
  },
  {
    id: 4,
    title: 'Akropolis',
    owner: 'Patricia',
    players: '2-4',
    duration: '30 min',
    weight: '1.9',
    language: 'FR',
    mechanics: ['Puzzle', 'Draft'],
  },
]

const presetFilters = ['Favoritos', 'Novedades', 'Familiares <45 min']

export function Library() {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()

    if (!term) {
      return library
    }

    return library.filter((item) => {
      const haystack = `${item.title} ${item.owner} ${item.mechanics.join(' ')}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [search])

  return (
    <div className="space-y-6 pb-10">
      <header className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="section-title">Ludoteca del evento</h2>
            <p className="text-sm text-text-secondary">Añade tus juegos y explora la colección disponible durante el congreso.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90">
            <Star className="h-4 w-4" />
            Añadir juego
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
          <label className="card flex items-center gap-3 px-4 py-3">
            <Search className="h-5 w-5 text-text-secondary" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, propietario o mecánica"
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
            />
          </label>
          <div className="card flex items-center justify-between px-4 py-3 text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>Filtros activos: Jugadores 3-4, Idioma ES</span>
            </div>
            <button className="text-sm font-semibold text-primary">Editar</button>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Filtros guardados</h3>
        <div className="flex flex-wrap gap-2">
          {presetFilters.map((filter) => (
            <button
              key={filter}
              className="rounded-full bg-background px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
            >
              {filter}
            </button>
          ))}
          <button className="inline-flex items-center gap-2 rounded-full border border-dashed border-primary px-4 py-2 text-sm font-medium text-primary">
            <BookmarkCheck className="h-4 w-4" />
            Guardar filtro
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((game) => (
          <article key={game.id} className="card flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{game.title}</h3>
                <p className="text-sm text-text-secondary">Propietario: {game.owner}</p>
              </div>
              {game.manual ? (
                <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">Manual</span>
              ) : (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">BGG #{game.id}</span>
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
            <div className="flex items-center justify-between pt-2">
              <button className="text-sm font-semibold text-primary">Registrar partida</button>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Users className="h-4 w-4" />
                Ideal 4 jugadores
              </span>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
