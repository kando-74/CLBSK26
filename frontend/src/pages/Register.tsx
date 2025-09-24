import { useMemo, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Crown } from 'lucide-react'

const steps = [
  {
    title: 'Juego',
    description: 'Elige un título de la ludoteca o añade uno manual.',
  },
  {
    title: 'Jugadores',
    description: 'Selecciona a los participantes y ordena el turno inicial.',
  },
  {
    title: 'Detalles',
    description: 'Define horario, duración estimada y sala.',
  },
  {
    title: 'Resultado',
    description: 'Indica ganador, podio u otras notas relevantes.',
  },
]

const players = ['Ana', 'Luis', 'María', 'Jorge', 'Claudia', 'Inés', 'Raúl']

export function Register() {
  const [step, setStep] = useState(0)
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(['Ana', 'Luis'])
  const [winner, setWinner] = useState('Ana')

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step])

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="section-title">Registrar partida</h2>
          <p className="text-sm text-text-secondary">
            Completa los 4 pasos. Podrás editar la partida durante los próximos 30 minutos.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm text-text-secondary">
          <CalendarClock className="h-4 w-4" />
          Ventana de registro: 07:00 - 06:59
        </span>
      </header>

      <div className="card space-y-5 p-6">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Progreso</span>
            <span className="text-sm font-semibold text-text-primary">
              Paso {step + 1} de {steps.length}
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-background">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {steps.map((item, index) => (
            <button
              key={item.title}
              onClick={() => setStep(index)}
              className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                index === step
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-transparent bg-background hover:border-primary/30'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide">Paso {index + 1}</p>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="text-xs text-text-secondary">{item.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <section className="card space-y-4 p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">Selecciona el juego</h3>
              <p className="text-sm text-text-secondary">
                Busca en la ludoteca o introduce un juego manual si todavía no está dado de alta.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="rounded-2xl border border-primary/20 px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-text-secondary">Juego de la ludoteca</span>
                  <input
                    className="mt-1 w-full bg-transparent text-base font-semibold text-text-primary outline-none"
                    defaultValue="Heat: Pedal to the Metal"
                  />
                </label>
                <label className="rounded-2xl border border-dashed border-primary/40 px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-text-secondary">Juego manual</span>
                  <input
                    className="mt-1 w-full bg-transparent text-base text-text-primary outline-none placeholder:text-text-secondary"
                    placeholder="Nombre del juego"
                  />
                </label>
              </div>
              <button className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90">
                Continuar con Heat
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">Añade jugadores</h3>
              <p className="text-sm text-text-secondary">
                Debes seleccionar únicamente asistentes del evento. El máximo recomendado para el juego es 6 jugadores.
              </p>
              <div className="flex flex-wrap gap-2">
                {players.map((player) => {
                  const isSelected = selectedPlayers.includes(player)
                  return (
                    <button
                      key={player}
                      onClick={() =>
                        setSelectedPlayers((prev) =>
                          prev.includes(player) ? prev.filter((item) => item !== player) : [...prev, player],
                        )
                      }
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-primary text-white shadow-card'
                          : 'bg-background text-text-secondary hover:bg-primary/10 hover:text-primary'
                      }`}
                    >
                      {player}
                    </button>
                  )
                })}
              </div>
              <div className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
                <p className="font-semibold text-text-primary">Turno sugerido</p>
                <p>{selectedPlayers.join(' → ')}</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">Configura los detalles</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="rounded-2xl border border-primary/20 px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-text-secondary">Hora de inicio</span>
                  <input className="mt-1 w-full bg-transparent text-base text-text-primary outline-none" defaultValue="16:30" />
                </label>
                <label className="rounded-2xl border border-primary/20 px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-text-secondary">Duración</span>
                  <select className="mt-1 w-full bg-transparent text-base text-text-primary outline-none">
                    <option>60 minutos</option>
                    <option>75 minutos</option>
                    <option>90 minutos</option>
                  </select>
                </label>
                <label className="rounded-2xl border border-primary/20 px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-text-secondary">Sala</span>
                  <select className="mt-1 w-full bg-transparent text-base text-text-primary outline-none">
                    <option>Sala Azul</option>
                    <option>Sala Amarilla</option>
                    <option>Lobby principal</option>
                  </select>
                </label>
                <label className="rounded-2xl border border-dashed border-primary/30 px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-text-secondary">Notas</span>
                  <textarea
                    className="mt-1 h-20 w-full resize-none bg-transparent text-sm text-text-secondary outline-none"
                    placeholder="Añade recordatorios para la mesa"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">Resultado de la partida</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="rounded-2xl border border-primary/20 px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-text-secondary">Ganador</span>
                  <select
                    value={winner}
                    onChange={(event) => setWinner(event.target.value)}
                    className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
                  >
                    {selectedPlayers.map((player) => (
                      <option key={player}>{player}</option>
                    ))}
                    <option>Empate</option>
                  </select>
                </label>
                <label className="rounded-2xl border border-primary/20 px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-text-secondary">Podio</span>
                  <input
                    className="mt-1 w-full bg-transparent text-sm text-text-secondary outline-none"
                    defaultValue={`${winner} → ${selectedPlayers.filter((player) => player !== winner).join(' → ')}`}
                  />
                </label>
              </div>
              <div className="rounded-2xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-secondary">
                <p className="font-semibold text-text-primary">Posible duplicado detectado</p>
                <p>
                  Existe una partida registrada hace 12 minutos con los mismos jugadores. Revisa los detalles antes de confirmar.
                </p>
              </div>
              <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90">
                Confirmar registro
              </button>
            </div>
          )}
        </section>

        <aside className="card space-y-4 p-6">
          <h3 className="text-lg font-semibold text-text-primary">Resumen</h3>
          <div className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
            <p className="text-xs uppercase tracking-wide">Juego</p>
            <p className="text-base font-semibold text-text-primary">Heat: Pedal to the Metal</p>
            <p>Propietario: Claudia</p>
          </div>
          <div className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
            <p className="text-xs uppercase tracking-wide">Jugadores</p>
            <p>{selectedPlayers.join(', ')}</p>
          </div>
          <div className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
            <p className="text-xs uppercase tracking-wide">Ganador provisional</p>
            <p className="inline-flex items-center gap-2 text-base font-semibold text-text-primary">
              <Crown className="h-4 w-4 text-secondary" />
              {winner}
            </p>
          </div>
          <div className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
            <p className="text-xs uppercase tracking-wide">Duración</p>
            <p>60 minutos estimados</p>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
              disabled={step === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <button
              onClick={() => setStep((prev) => Math.min(prev + 1, steps.length - 1))}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
              disabled={step === steps.length - 1}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </aside>
      </div>

      <footer className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
        <p className="font-semibold text-text-primary">Consejo</p>
        <p>
          Guarda el enlace que se generará tras confirmar. Podrás compartirlo con los jugadores para que sigan el chat de la
          partida.
        </p>
      </footer>
    </div>
  )
}
