import { CalendarCheck, Clock, MapPin, Plus } from 'lucide-react'

const openTables = [
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
  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="section-title">Tablón “Busco mesa”</h2>
          <p className="text-sm text-text-secondary">
            Encuentra partidas abiertas, apúntate con un toque y coordínate con el chat integrado.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Publicar anuncio
        </button>
      </header>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-text-secondary">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-background px-3 py-1">Todos los juegos</span>
          <span className="rounded-full bg-background px-3 py-1">Partidas competitivas</span>
          <span className="rounded-full bg-background px-3 py-1">Nivel: medio</span>
        </div>
        <button className="text-sm font-semibold text-primary">Gestionar filtros</button>
      </div>

      <section className="space-y-4">
        {openTables.map((table) => (
          <article key={table.id} className="card space-y-4 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-secondary">Juego</p>
                <h3 className="text-xl font-semibold text-text-primary">{table.game}</h3>
                <p className="text-sm text-text-secondary">Anfitrión: {table.host}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  {table.seats.total - table.seats.taken} plazas libres
                </span>
                <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90">
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
        ))}
      </section>
    </div>
  )
}
