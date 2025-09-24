import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  Ban,
  CheckCircle2,
  ClipboardList,
  Clock4,
  ExternalLink,
  Filter,
  MailPlus,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react'
import { getCurrentCongressDay } from '../utils/date'

type PanelTab = 'attendees' | 'whitelist' | 'duplicates' | 'exports'

type AttendeeStatus = 'online' | 'offline' | 'pending'

type WhitelistStatus = 'approved' | 'pending' | 'revoked'

type DuplicateStatus = 'open' | 'in_review' | 'resolved'

const attendees = [
  {
    id: 1,
    alias: 'Ana G.',
    email: 'ana.galvez@example.com',
    role: 'Asistente',
    status: 'online' as AttendeeStatus,
    games: 4,
    plays: 7,
    lastActive: 'Hace 5 min',
  },
  {
    id: 2,
    alias: 'Luis R.',
    email: 'luis.romero@example.com',
    role: 'Asistente',
    status: 'offline' as AttendeeStatus,
    games: 2,
    plays: 5,
    lastActive: 'Hace 42 min',
  },
  {
    id: 3,
    alias: 'Claudia P.',
    email: 'claudia.perez@example.com',
    role: 'Staff',
    status: 'online' as AttendeeStatus,
    games: 6,
    plays: 11,
    lastActive: 'En sala azul',
  },
  {
    id: 4,
    alias: 'Jorge L.',
    email: 'jorge.lopez@example.com',
    role: 'Organización',
    status: 'pending' as AttendeeStatus,
    games: 1,
    plays: 3,
    lastActive: 'Sin actividad registrada',
  },
]

const whitelistEntries = [
  {
    email: 'eva.martinez@example.com',
    role: 'asistente',
    status: 'approved' as WhitelistStatus,
    invitedBy: 'Alejandro',
    updatedAt: 'Hoy · 11:05',
  },
  {
    email: 'staff.sala3@example.com',
    role: 'staff',
    status: 'pending' as WhitelistStatus,
    invitedBy: 'Lucía',
    updatedAt: 'Hoy · 09:32',
  },
  {
    email: 'marina@prototypegames.com',
    role: 'asistente',
    status: 'approved' as WhitelistStatus,
    invitedBy: 'Patricio',
    updatedAt: 'Ayer · 19:18',
  },
  {
    email: 'carlos.suarez@example.com',
    role: 'asistente',
    status: 'revoked' as WhitelistStatus,
    invitedBy: 'Organización',
    updatedAt: 'Hace 3 días',
  },
]

const duplicateAlerts = [
  {
    id: 'dup-1042',
    game: 'Heat: Pedal to the Metal',
    players: ['Ana', 'Luis', 'Claudia', 'Jorge'],
    detectedAt: 'Hace 12 min',
    similarity: 92,
    status: 'open' as DuplicateStatus,
  },
  {
    id: 'dup-1031',
    game: 'Earth',
    players: ['Marta', 'Lucía', 'Raúl'],
    detectedAt: 'Hace 35 min',
    similarity: 86,
    status: 'in_review' as DuplicateStatus,
  },
  {
    id: 'dup-995',
    game: 'Scout',
    players: ['Pablo', 'Irene', 'Claudia'],
    detectedAt: 'Hoy · 10:05',
    similarity: 78,
    status: 'resolved' as DuplicateStatus,
  },
]

const exportPresets = [
  {
    id: 'plays-day',
    label: 'Partidas del día',
    description: 'CSV con partidas confirmadas en la ventana 07:00–06:59.',
    size: '32 KB',
  },
  {
    id: 'players-active',
    label: 'Asistentes activos',
    description: 'Listado de asistentes con último acceso y partidas registradas.',
    size: '18 KB',
  },
  {
    id: 'library-full',
    label: 'Ludoteca completa',
    description: 'Exporta juegos con propietario, idioma y copias disponibles.',
    size: '45 KB',
  },
]

const auditLog = [
  {
    id: 1,
    message: 'Lucía aprobó la solicitud de staff.sala3@example.com',
    at: 'Hace 2 min',
  },
  {
    id: 2,
    message: 'Jorge marcó duplicado dup-1031 como “En revisión”',
    at: 'Hace 18 min',
  },
  {
    id: 3,
    message: 'Sistema generó exportación "Partidas del día"',
    at: 'Hoy · 09:00',
  },
]

const tabs: { key: PanelTab; label: string; icon: typeof Users }[] = [
  { key: 'attendees', label: 'Asistentes', icon: Users },
  { key: 'whitelist', label: 'Whitelist', icon: UserCheck },
  { key: 'duplicates', label: 'Duplicados', icon: ShieldAlert },
  { key: 'exports', label: 'Exportaciones', icon: ArrowDownToLine },
]

function getAttendeeStatusStyles(status: AttendeeStatus) {
  switch (status) {
    case 'online':
      return {
        label: 'Conectado',
        className: 'border-success/40 bg-success/10 text-success',
        Icon: CheckCircle2,
      }
    case 'pending':
      return {
        label: 'Invitación pendiente',
        className: 'border-secondary/40 bg-secondary/10 text-secondary',
        Icon: Clock4,
      }
    default:
      return {
        label: 'Desconectado',
        className: 'border-slate-300 bg-background text-text-secondary',
        Icon: Clock4,
      }
  }
}

function getWhitelistStatusStyles(status: WhitelistStatus) {
  switch (status) {
    case 'approved':
      return {
        label: 'Activo',
        className: 'border-success/40 bg-success/10 text-success',
        Icon: ShieldCheck,
      }
    case 'pending':
      return {
        label: 'Pendiente',
        className: 'border-secondary/40 bg-secondary/10 text-secondary',
        Icon: MailPlus,
      }
    default:
      return {
        label: 'Revocado',
        className: 'border-error/40 bg-error/10 text-error',
        Icon: Ban,
      }
  }
}

function getDuplicateStatusStyles(status: DuplicateStatus) {
  switch (status) {
    case 'open':
      return {
        label: 'Abierto',
        className: 'border-error/40 bg-error/10 text-error',
      }
    case 'in_review':
      return {
        label: 'En revisión',
        className: 'border-secondary/40 bg-secondary/10 text-secondary',
      }
    default:
      return {
        label: 'Resuelto',
        className: 'border-success/40 bg-success/10 text-success',
      }
  }
}

export function Organization() {
  const [activeTab, setActiveTab] = useState<PanelTab>('attendees')
  const day = getCurrentCongressDay()

  const onlineCount = useMemo(
    () => attendees.filter((attendee) => attendee.status === 'online').length,
    [],
  )

  const pendingWhitelist = useMemo(
    () => whitelistEntries.filter((entry) => entry.status === 'pending').length,
    [],
  )

  const openDuplicates = useMemo(
    () => duplicateAlerts.filter((item) => item.status === 'open').length,
    [],
  )

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="section-subtitle">Organización · {day.label}</p>
          <h2 className="section-title">Panel de control del evento</h2>
          <p className="text-sm text-text-secondary">
            Supervisa asistentes, gestiona la whitelist y resuelve posibles duplicados.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Volver al evento
          </Link>
          <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90">
            <UserCog className="h-4 w-4" />
            Configuración avanzada
          </button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">Asistentes conectados</p>
          <p className="text-2xl font-semibold text-text-primary">{onlineCount}</p>
          <p className="text-xs text-text-secondary">de {attendees.length} registrados hoy</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">Solicitudes whitelist</p>
          <p className="text-2xl font-semibold text-text-primary">{pendingWhitelist}</p>
          <p className="text-xs text-text-secondary">Pendientes de revisión</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">Duplicados abiertos</p>
          <p className="text-2xl font-semibold text-text-primary">{openDuplicates}</p>
          <p className="text-xs text-text-secondary">Requieren intervención</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">Partidas registradas</p>
          <p className="text-2xl font-semibold text-text-primary">26</p>
          <p className="text-xs text-text-secondary">Actualizado hace 8 minutos</p>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === key
                    ? 'bg-primary text-white shadow-card'
                    : 'bg-background text-text-secondary hover:bg-primary/10 hover:text-primary'
                }`}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <button className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <Filter className="h-4 w-4" />
            Ver filtros guardados
          </button>
        </div>

        {activeTab === 'attendees' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <label className="card flex flex-1 items-center gap-3 px-4 py-3 md:max-w-lg">
                <Search className="h-4 w-4 text-text-secondary" />
                <input
                  className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
                  placeholder="Buscar por alias o email"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white">
                  <ArrowDownToLine className="h-4 w-4" />
                  Descargar listado
                </button>
                <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90">
                  <MailPlus className="h-4 w-4" />
                  Invitar asistente
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {attendees.map((attendee) => {
                const statusStyles = getAttendeeStatusStyles(attendee.status)
                const StatusIcon = statusStyles.Icon
                return (
                  <article key={attendee.id} className="rounded-2xl border border-slate-200/60 bg-surface p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-text-primary">{attendee.alias}</h3>
                        <p className="text-sm text-text-secondary">{attendee.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusStyles.label}
                        </span>
                        <button className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
                          <ClipboardList className="h-3.5 w-3.5" />
                          Ver historial
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-text-secondary md:grid-cols-4">
                      <div className="rounded-xl bg-background px-3 py-2">
                        <p className="text-xs uppercase tracking-wide">Rol</p>
                        <p className="text-base font-semibold text-text-primary">{attendee.role}</p>
                      </div>
                      <div className="rounded-xl bg-background px-3 py-2">
                        <p className="text-xs uppercase tracking-wide">Juegos aportados</p>
                        <p className="text-base font-semibold text-text-primary">{attendee.games}</p>
                      </div>
                      <div className="rounded-xl bg-background px-3 py-2">
                        <p className="text-xs uppercase tracking-wide">Partidas registradas</p>
                        <p className="text-base font-semibold text-text-primary">{attendee.plays}</p>
                      </div>
                      <div className="rounded-xl bg-background px-3 py-2">
                        <p className="text-xs uppercase tracking-wide">Última actividad</p>
                        <p className="text-base font-semibold text-text-primary">{attendee.lastActive}</p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'whitelist' && (
          <div className="space-y-3">
            {whitelistEntries.map((entry) => {
              const statusStyles = getWhitelistStatusStyles(entry.status)
              const StatusIcon = statusStyles.Icon
              return (
                <article key={entry.email} className="rounded-2xl border border-slate-200/60 bg-surface p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-text-primary">{entry.email}</h3>
                      <p className="text-sm text-text-secondary">Rol: {entry.role}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles.className}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusStyles.label}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs text-text-secondary">
                        Invitado por {entry.invitedBy}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-secondary">
                    <span className="rounded-full bg-background px-3 py-1">Actualizado {entry.updatedAt}</span>
                    {entry.status !== 'revoked' ? (
                      <button className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Reenviar invitación
                      </button>
                    ) : (
                      <button className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Restaurar acceso
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
            <div className="rounded-2xl border border-dashed border-primary/40 bg-background px-4 py-5 text-sm text-text-secondary">
              <p className="font-semibold text-text-primary">Importar desde CSV</p>
              <p>Carga la whitelist inicial para múltiples asistentes de una sola vez.</p>
            </div>
          </div>
        )}

        {activeTab === 'duplicates' && (
          <div className="space-y-3">
            {duplicateAlerts.map((duplicate) => {
              const statusStyles = getDuplicateStatusStyles(duplicate.status)
              return (
                <article key={duplicate.id} className="rounded-2xl border border-slate-200/60 bg-surface p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">{duplicate.game}</h3>
                      <p className="text-sm text-text-secondary">
                        {duplicate.players.join(', ')} · Coincidencia {duplicate.similarity}%
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles.className}`}
                      >
                        {statusStyles.label}
                      </span>
                      <span className="rounded-full bg-background px-3 py-1 text-xs text-text-secondary">{duplicate.detectedAt}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-secondary">
                    <button className="inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Revisar partida
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirmar como válida
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
                      <Ban className="h-3.5 w-3.5" />
                      Descartar alerta
                    </button>
                  </div>
                </article>
              )
            })}
            <div className="rounded-2xl border border-secondary/40 bg-secondary/10 px-4 py-4 text-sm text-secondary">
              <p className="font-semibold text-text-primary">Consejo</p>
              <p>
                Si una alerta se marca como válida, se registrará en el histórico `playDuplicates` con la marca `forced=true` para trazabilidad.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'exports' && (
          <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
            <div className="space-y-3">
              {exportPresets.map((preset) => (
                <article key={preset.id} className="rounded-2xl border border-slate-200/60 bg-surface p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">{preset.label}</h3>
                      <p className="text-sm text-text-secondary">{preset.description}</p>
                    </div>
                    <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90">
                      <ArrowDownToLine className="h-4 w-4" />
                      Generar CSV
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-secondary">
                    <span className="rounded-full bg-background px-3 py-1">{preset.size}</span>
                    <button className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Compartir con organización
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <aside className="space-y-3">
              <div className="card space-y-2 p-4">
                <h3 className="text-base font-semibold text-text-primary">Historial de acciones</h3>
                <ul className="space-y-2 text-xs text-text-secondary">
                  {auditLog.map((entry) => (
                    <li key={entry.id} className="rounded-xl bg-background px-3 py-2">
                      <p className="font-semibold text-text-primary">{entry.message}</p>
                      <p>{entry.at}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm text-text-secondary">
                <p className="font-semibold text-text-primary">Recordatorio</p>
                <p>La exportación completa se almacena temporalmente 24h en Storage. Programa descargas recurrentes si es necesario.</p>
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  )
}
