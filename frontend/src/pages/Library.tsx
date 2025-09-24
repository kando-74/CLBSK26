import { useMemo, useState } from 'react'
import {
  BookmarkCheck,
  Download,
  Filter,
  Globe,
  Loader2,
  Search,
  Star,
  Users,
} from 'lucide-react'
import type { BggSearchResult } from '../utils/bgg'
import { getBoardGameDetails, searchBoardGames } from '../utils/bgg'
import { GameTitle } from '../components/GameTitle'

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
  coverUrl?: string
}

const initialLibrary: GameEntry[] = [
  {
    id: 1,
    title: 'Heat: Pedal to the Metal',
    owner: 'Claudia',
    players: '2-6',
    duration: '60-90 min',
    weight: '2.3',
    language: 'ES',
    mechanics: ['Carreras', 'Gestión de mano'],
    manual: true,
    coverUrl: '/covers/heat-pedal-to-the-metal.svg',
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
    manual: true,
    coverUrl: '/covers/sky-team.svg',
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
    manual: true,
    coverUrl: '/covers/kutna-hora.svg',
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
    manual: true,
    coverUrl: '/covers/akropolis.svg',
  },
]

const presetFilters = ['Favoritos', 'Novedades', 'Familiares <45 min']

export function Library() {
  const [search, setSearch] = useState('')
  const [games, setGames] = useState<GameEntry[]>(initialLibrary)
  const [bggQuery, setBggQuery] = useState('')
  const [bggResults, setBggResults] = useState<BggSearchResult[]>([])
  const [isSearchingBgg, setIsSearchingBgg] = useState(false)
  const [bggError, setBggError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<number | null>(null)
  const [importMessage, setImportMessage] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null)

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()

    if (!term) {
      return games
    }

    return games.filter((item) => {
      const haystack = `${item.title} ${item.owner} ${item.mechanics.join(' ')}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [games, search])

  async function handleBggSearch() {
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
        setBggError('No se encontraron juegos en BGG para esa búsqueda.')
      }
    } catch (error) {
      setBggResults([])
      setBggError(
        error instanceof Error
          ? error.message
          : 'No se pudo completar la búsqueda en BGG.',
      )
    } finally {
      setIsSearchingBgg(false)
    }
  }

  async function handleImport(id: number) {
    setImportMessage(null)
    setImportingId(id)

    try {
      const details = await getBoardGameDetails(id)
      let wasDuplicate = false

      setGames((current) => {
        if (current.some((item) => item.id === details.id)) {
          wasDuplicate = true
          return current
        }

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

        const mechanics =
          details.mechanics.length > 0
            ? details.mechanics.slice(0, 8)
            : ['Sin datos BGG']

        const weightLabel =
          details.averageWeight && details.averageWeight > 0
            ? details.averageWeight.toFixed(1)
            : 'N/D'

        const entry: GameEntry = {
          id: details.id,
          title: details.name,
          owner: 'Importado',
          players: playersLabel,
          duration: durationLabel,
          weight: weightLabel,
          language: 'BGG',
          mechanics,
          coverUrl: details.imageUrl ?? details.thumbnailUrl,
        }

        const next = [...current, entry]
        next.sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }))
        return next
      })

      if (wasDuplicate) {
        setImportMessage({ type: 'error', message: 'El juego ya está en la ludoteca.' })
      } else {
        setImportMessage({ type: 'success', message: 'Juego importado correctamente desde BGG.' })
      }
    } catch (error) {
      setImportMessage({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'No se pudo importar el juego desde BGG.',
      })
    } finally {
      setImportingId(null)
    }
  }

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

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Importar desde BoardGameGeek
        </h3>
        <div className="card space-y-4 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex grow items-center gap-3 rounded-xl bg-background px-4 py-2">
              <Search className="h-5 w-5 text-text-secondary" />
              <input
                value={bggQuery}
                onChange={(event) => setBggQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleBggSearch()
                  }
                }}
                placeholder="Buscar juego en BGG (ej. Catan, Ark Nova)"
                className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
              />
            </label>
            <button
              onClick={() => void handleBggSearch()}
              disabled={isSearchingBgg}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
            >
              {isSearchingBgg ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Buscar en BGG
                </>
              )}
            </button>
          </div>
          {bggError && <p className="text-sm text-red-500">{bggError}</p>}
          {importMessage && (
            <p
              className={`text-sm ${
                importMessage.type === 'success' ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {importMessage.message}
            </p>
          )}
          {bggResults.length > 0 && (
            <div className="space-y-2">
              {bggResults.map((result) => {
                const alreadyImported = games.some((game) => game.id === result.id)

                return (
                  <div
                    key={result.id}
                    className="flex flex-col gap-2 rounded-xl bg-background px-4 py-3 text-sm text-text-secondary md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <GameTitle
                        name={result.name}
                        size="sm"
                        textClassName="text-sm"
                      />
                      <p className="text-xs text-text-secondary">
                        BGG #{result.id}
                        {result.yearPublished ? ` • Año ${result.yearPublished}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleImport(result.id)}
                      disabled={alreadyImported || importingId === result.id}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-primary/40 disabled:text-primary/60"
                    >
                      {importingId === result.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Importando...
                        </>
                      ) : alreadyImported ? (
                        'Ya importado'
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
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((game) => (
          <article key={game.id} className="card flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <GameTitle
                name={game.title}
                coverUrl={game.coverUrl}
                size="lg"
                className="items-start"
                textClassName="text-xl"
                role="heading"
                aria-level={3}
              >
                <p className="text-sm font-normal text-text-secondary">Propietario: {game.owner}</p>
              </GameTitle>
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
