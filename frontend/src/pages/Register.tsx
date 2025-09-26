import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight, Crown } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { registerPlay, useDuplicatePlays } from '../services/plays'

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

type RegisterLocationState = {
  preselectedGame?: string
}

function toIsoFromTimeLabel(label: string): string {
  const [hoursRaw, minutesRaw] = label.split(':')
  const hours = Number.parseInt(hoursRaw ?? '', 10)
  const minutes = Number.parseInt(minutesRaw ?? '', 10)
  const now = new Date()

  if (Number.isFinite(hours) && Number.isFinite(minutes)) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0).toISOString()
  }

  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString()
}

function formatDifferenceMinutes(value: number): string {
  if (Number.isNaN(value)) {
    return 'horario desconocido'
  }

  if (value === 0) {
    return 'a la misma hora'
  }

  if (value < 5) {
    return `con ${value} min de diferencia`
  }

  return `a ${value} min de diferencia`
}

function formatIsoToTimeLabel(iso: string): string {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) {
    return 'hora desconocida'
  }

  const date = new Date(parsed)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function Register() {
  const location = useLocation()
  const preselectedGame = (location.state as RegisterLocationState | null)?.preselectedGame
  const [step, setStep] = useState(0)
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(['Ana', 'Luis'])
  const [winner, setWinner] = useState('Ana')
  const [selectedGame, setSelectedGame] = useState(preselectedGame ?? 'Heat: Pedal to the Metal')
  const [startTime, setStartTime] = useState('16:30')
  const [room, setRoom] = useState('Sala Azul')
  const [duration, setDuration] = useState(60)
  const [notes, setNotes] = useState('')
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null)

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step])

  useEffect(() => {
    if (preselectedGame) {
      setSelectedGame(preselectedGame)
    }
  }, [preselectedGame])

  const duplicateQuery = useMemo(
    () => ({
      game: selectedGame,
      players: selectedPlayers,
      startTime: toIsoFromTimeLabel(startTime),
      thresholdMinutes: 25,
    }),
    [selectedGame, selectedPlayers, startTime],
  )

  const { matches: duplicateMatches, loading: duplicatesLoading } = useDuplicatePlays(duplicateQuery)

  useEffect(() => {
    if (!submissionMessage) {
      return
    }
    const timeout = setTimeout(() => setSubmissionMessage(null), 4000)
    return () => clearTimeout(timeout)
  }, [submissionMessage])

  const hasDuplicates = duplicateMatches.length > 0
  const mainDuplicate = hasDuplicates ? duplicateMatches[0] : null
  const duplicateSharedPlayers = useMemo(() => {
    if (!mainDuplicate) {
      return ''
    }
    const target = new Set(selectedPlayers.map((player) => player.toLowerCase()))
    const shared = mainDuplicate.play.players.filter((player) => target.has(player.toLowerCase()))
    return shared.join(', ')
  }, [mainDuplicate, selectedPlayers])

  const duplicateTimeLabel = mainDuplicate ? formatIsoToTimeLabel(mainDuplicate.play.startTime) : ''

  const handleConfirmRegistration = async () => {
    const trimmedGame = selectedGame.trim()
    if (!trimmedGame || selectedPlayers.length === 0) {
      setSubmissionMessage('Completa juego y jugadores antes de registrar la partida.')
      return
    }

    const iso = toIsoFromTimeLabel(startTime)
    const combinedNotes = [
      notes.trim(),
      winner !== 'Empate' ? `Ganador: ${winner}` : 'Resultado: empate',
      `Jugadores: ${selectedPlayers.join(', ')}`,
    ]
      .filter(Boolean)
      .join(' | ')

    try {
      await registerPlay({
        game: trimmedGame,
        players: selectedPlayers,
        startTime: iso,
        room,
        durationMinutes: duration,
        notes: combinedNotes,
      })

      setSubmissionMessage('Partida registrada correctamente. Consulta el resumen en Estadísticas.')
      setStep(0)
    } catch (error) {
      console.error('No se pudo registrar la partida', error)
      setSubmissionMessage('No se pudo registrar la partida. Revisa la conexión y vuelve a intentarlo.')
    }
  }

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
                    value={selectedGame}
                    onChange={(event) => setSelectedGame(event.currentTarget.value)}
                    placeholder="Selecciona un juego"
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
                {selectedGame ? `Continuar con ${selectedGame}` : 'Selecciona un juego'}
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
                  <input
                    className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
                    value={startTime}
                    onChange={(event) => setStartTime(event.currentTarget.value)}
                    type="time"
                    required
                  />
                </label>
                <label className="rounded-2xl border border-primary/20 px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-text-secondary">Duración</span>
                  <select
                    className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
                    value={duration}
                    onChange={(event) => setDuration(Number(event.currentTarget.value))}
                  >
                    <option value={45}>45 minutos</option>
                    <option value={60}>60 minutos</option>
                    <option value={75}>75 minutos</option>
                    <option value={90}>90 minutos</option>
                  </select>
                </label>
                <label className="rounded-2xl border border-primary/20 px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-text-secondary">Sala</span>
                  <select
                    className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
                    value={room}
                    onChange={(event) => setRoom(event.currentTarget.value)}
                  >
                    <option value="Sala Azul">Sala Azul</option>
                    <option value="Sala Amarilla">Sala Amarilla</option>
                    <option value="Lobby principal">Lobby principal</option>
                    <option value="Sala Verde">Sala Verde</option>
                  </select>
                </label>
                <label className="rounded-2xl border border-dashed border-primary/30 px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-text-secondary">Notas</span>
                  <textarea
                    className="mt-1 h-20 w-full resize-none bg-transparent text-sm text-text-secondary outline-none"
                    placeholder="Añade recordatorios para la mesa"
                    value={notes}
                    onChange={(event) => setNotes(event.currentTarget.value)}
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
              {!duplicatesLoading && hasDuplicates && mainDuplicate && (
                <div className="space-y-2 rounded-2xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-secondary">
                  <p className="font-semibold text-text-primary">Posible duplicado detectado</p>
                  <p>
                    Existe una partida registrada a las {duplicateTimeLabel}{' '}
                    {formatDifferenceMinutes(mainDuplicate.differenceMinutes)} con{' '}
                    {duplicateSharedPlayers || 'jugadores similares'}. Revisa los detalles antes de confirmar.
                  </p>
                  <div className="rounded-xl border border-secondary/30 bg-white px-3 py-2 text-xs text-text-secondary">
                    <p className="font-semibold text-text-primary">Último registro</p>
                    <p>
                      {mainDuplicate.play.game} • Sala {mainDuplicate.play.room} •{' '}
                      {mainDuplicate.play.players.join(', ')}
                    </p>
                  </div>
                </div>
              )}
              {submissionMessage && (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                  {submissionMessage}
                </div>
              )}
              <button
                type="button"
                onClick={handleConfirmRegistration}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
              >
                Confirmar registro
              </button>
            </div>
          )}
        </section>

        <aside className="card space-y-4 p-6">
          <h3 className="text-lg font-semibold text-text-primary">Resumen</h3>
          <div className="rounded-2xl bg-background px-4 py-3 text-sm text-text-secondary">
            <p className="text-xs uppercase tracking-wide">Juego</p>
            <p className="text-base font-semibold text-text-primary">{selectedGame || 'Pendiente de seleccionar'}</p>
            <p>{selectedPlayers.length} jugadores previstos</p>
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
            <p className="text-xs uppercase tracking-wide">Hora y duración</p>
            <p>
              {startTime} • {duration} min
            </p>
            <p>Sala: {room}</p>
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
