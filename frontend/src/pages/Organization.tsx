import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
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
import { GameTitle } from '../components/GameTitle'
import {
  getClientDeviceId,
  isActivityLoggingEnabled,
  logActivity,
  subscribeActivityLogs,
  type ActivityLogRecord,
} from '../services/activity'
import { listActivePlays, summarizeRoomOccupancy, type PlayRecord, type RoomOccupancySummary } from '../services/plays'
import { UserLink } from '../components/UserLink'
import { useWhitelistManagement, type WhitelistEntryRecord } from '../services/whitelist'

type PanelTab = 'attendees' | 'whitelist' | 'duplicates' | 'exports'

type AttendeeStatus = 'online' | 'offline' | 'pending'

type WhitelistStatus = 'approved' | 'pending' | 'revoked'

type DuplicateStatus = 'open' | 'in_review' | 'resolved'

type WhitelistRole = 'asistente' | 'staff' | 'organizacion'

type Attendee = {
  id: number
  alias: string
  email: string
  role: string
  status: AttendeeStatus
  games: number
  plays: number
  lastActive: string
}

type WhitelistEntry = {
  email: string
  role: WhitelistRole
  status: WhitelistStatus
  invitedBy: string
  updatedAt: string
  displayName?: string | null
  notes?: string | null
}

type DuplicateAlert = {
  id: string
  game: string
  players: string[]
  detectedAt: string
  similarity: number
  status: DuplicateStatus
}

type ExportPreset = {
  id: string
  label: string
  description: string
  size: string
}

function formatRelativeMoment(date: Date | null): string {
  if (!date) {
    return 'Sin registros'
  }

  const now = Date.now()
  const timestamp = date.getTime()
  const diffMs = Math.max(0, now - timestamp)
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) {
    return 'Hace unos segundos'
  }
  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} min`
  }
  if (diffHours < 24) {
    return `Hoy · ${date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }
  if (diffDays === 1) {
    return `Ayer · ${date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mapWhitelistRecordToEntry(record: WhitelistEntryRecord): WhitelistEntry {
  return {
    email: record.email,
    role: record.role,
    status: record.status,
    invitedBy: record.invitedBy ?? 'Organización',
    updatedAt: formatRelativeMoment(record.updatedAt),
    displayName: record.displayName ?? null,
    notes: record.notes ?? null,
  }
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  if (typeof document === 'undefined' || !document.body) {
    throw new Error('El portapapeles no está disponible en este contexto.')
  }

  const input = document.createElement('textarea')
  input.setAttribute('readonly', '')
  input.value = text
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)

  try {
    input.select()
    input.setSelectionRange(0, text.length)
    const successful = document.execCommand('copy')
    if (!successful) {
      throw new Error('No se pudo acceder al portapapeles del navegador.')
    }
  } finally {
    document.body.removeChild(input)
  }
}

const initialAttendees: Attendee[] = [
  {
    id: 1,
    alias: 'Ana G.',
    email: 'ana.galvez@example.com',
    role: 'Asistente',
    status: 'online',
    games: 4,
    plays: 7,
    lastActive: 'Hace 5 min',
  },
  {
    id: 2,
    alias: 'Luis R.',
    email: 'luis.romero@example.com',
    role: 'Asistente',
    status: 'offline',
    games: 2,
    plays: 5,
    lastActive: 'Hace 42 min',
  },
  {
    id: 3,
    alias: 'Claudia P.',
    email: 'claudia.perez@example.com',
    role: 'Staff',
    status: 'online',
    games: 6,
    plays: 11,
    lastActive: 'En sala azul',
  },
  {
    id: 4,
    alias: 'Jorge L.',
    email: 'jorge.lopez@example.com',
    role: 'Organización',
    status: 'pending',
    games: 1,
    plays: 3,
    lastActive: 'Sin actividad registrada',
  },
]

const initialDuplicateAlerts: DuplicateAlert[] = [
  {
    id: 'dup-1042',
    game: 'Heat: Pedal to the Metal',
    players: ['Ana', 'Luis', 'Claudia', 'Jorge'],
    detectedAt: 'Hace 12 min',
    similarity: 92,
    status: 'open',
  },
  {
    id: 'dup-1031',
    game: 'Earth',
    players: ['Marta', 'Lucía', 'Raúl'],
    detectedAt: 'Hace 35 min',
    similarity: 86,
    status: 'in_review',
  },
  {
    id: 'dup-995',
    game: 'Scout',
    players: ['Pablo', 'Irene', 'Claudia'],
    detectedAt: 'Hoy · 10:05',
    similarity: 78,
    status: 'resolved',
  },
]

const initialExportPresets: ExportPreset[] = [
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

function formatWhitelistRole(role: WhitelistRole) {
  switch (role) {
    case 'organizacion':
      return 'Organización'
    case 'staff':
      return 'Staff'
    default:
      return 'Asistente'
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

const activityDateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatActivityMessage(entry: ActivityLogRecord) {
  if (entry.message) {
    return entry.message
  }

  switch (entry.type) {
    case 'table:create':
      return `Nueva mesa publicada: ${entry.entityName}`
    case 'table:join':
      return `Reserva en la mesa ${entry.entityName}`
    case 'library:add':
      return `Juego añadido a la ludoteca: ${entry.entityName}`
    default:
      return entry.entityName
  }
}

function formatActivitySubtitle(entry: ActivityLogRecord) {
  const actorName = entry.actor?.displayName ?? entry.actor?.email ?? 'Sistema'
  const timestamp = entry.createdAt ? activityDateFormatter.format(entry.createdAt) : 'Sincronizando…'
  const device = entry.deviceId ? ` · ${entry.deviceId}` : ''
  return `${actorName} · ${timestamp}${device}`
}

export function Organization() {
  const [activeTab, setActiveTab] = useState<PanelTab>('attendees')
  const [attendeeList] = useState<Attendee[]>(initialAttendees)
  const [attendeeSearch, setAttendeeSearch] = useState('')
  const [duplicateList, setDuplicateList] = useState<DuplicateAlert[]>(initialDuplicateAlerts)
  const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>([])
  const [activityError, setActivityError] = useState<string | null>(null)
  const [panelMessage, setPanelMessage] = useState<
    { type: 'success' | 'error' | 'info'; message: string } | null
  >(null)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState<{ email: string; role: WhitelistRole }>({
    email: '',
    role: 'asistente',
  })
  const {
    entries: whitelistEntries,
    loading: whitelistLoading,
    error: whitelistError,
    addEntry: addWhitelistEntry,
    updateEntry: updateWhitelistEntry,
  } = useWhitelistManagement()
  const whitelistList = useMemo(() => whitelistEntries.map(mapWhitelistRecordToEntry), [whitelistEntries])
  const [processingExport, setProcessingExport] = useState<string | null>(null)
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null)
  const [activePlays, setActivePlays] = useState<PlayRecord[]>([])
  const [roomSummary, setRoomSummary] = useState<RoomOccupancySummary>({})
  const day = getCurrentCongressDay()

  const filteredAttendees = useMemo(() => {
    const term = attendeeSearch.trim().toLowerCase()

    if (!term) {
      return attendeeList
    }

    return attendeeList.filter((attendee) =>
      `${attendee.alias} ${attendee.email}`.toLowerCase().includes(term),
    )
  }, [attendeeList, attendeeSearch])

  const onlineCount = useMemo(
    () => attendeeList.filter((attendee) => attendee.status === 'online').length,
    [attendeeList],
  )

  const pendingWhitelist = useMemo(
    () => whitelistList.filter((entry) => entry.status === 'pending').length,
    [whitelistList],
  )

  const openDuplicates = useMemo(
    () => duplicateList.filter((item) => item.status === 'open').length,
    [duplicateList],
  )

  const totalActivePlayers = useMemo(
    () => activePlays.reduce((accumulator, play) => accumulator + play.players.length, 0),
    [activePlays],
  )

  const roomSummaryEntries = useMemo(
    () =>
      Object.entries(roomSummary).sort(([, first], [, second]) => second.players - first.players),
    [roomSummary],
  )

  const renderPlayersInline = useCallback(
    (names: string[]) =>
      names
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .map((name, index) => (
          <span key={`${name}-${index}`}>
            {index > 0 && ', '}
            <UserLink name={name} />
          </span>
        )),
    [],
  )

  useEffect(() => {
    if (!panelMessage) {
      return
    }

    const timeout = setTimeout(() => setPanelMessage(null), 4000)
    return () => clearTimeout(timeout)
  }, [panelMessage])

  const updateLivePlays = useCallback(async () => {
    try {
      const active = await listActivePlays()
      setActivePlays(active)
      setRoomSummary(summarizeRoomOccupancy(active))
    } catch (error) {
      console.error('No se pudieron actualizar las partidas en vivo', error)
    }
  }, [])

  useEffect(() => {
    if (!selectedAttendee) {
      return
    }

    if (!filteredAttendees.some((attendee) => attendee.id === selectedAttendee.id)) {
      setSelectedAttendee(null)
    }
  }, [filteredAttendees, selectedAttendee])

  useEffect(() => {
    if (!isActivityLoggingEnabled) {
      return
    }

    const unsubscribe = subscribeActivityLogs(
      40,
      (logs) => {
        setActivityError(null)
        setActivityLogs(logs)
      },
      (message) => {
        setActivityError(message)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    void updateLivePlays()
    if (typeof window === 'undefined') {
      return
    }

    const interval = window.setInterval(() => {
      void updateLivePlays()
    }, 10000)

    const handler = (event: StorageEvent) => {
      if (event.key === 'clbsk_event_plays_v1') {
        void updateLivePlays()
      }
    }

    window.addEventListener('storage', handler)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('storage', handler)
    }
  }, [updateLivePlays])

  const addAuditEntry = useCallback((message: string) => {
    const deviceId = getClientDeviceId()

    if (isActivityLoggingEnabled) {
      void logActivity(
        {
          type: 'organization:note',
          entityId: 'organization-panel',
          entityName: 'Panel de organización',
          message,
        },
        { deviceId },
      )
    } else {
      setActivityLogs((current) => [
        {
          id: `local-${Date.now()}`,
          type: 'organization:note',
          entityId: 'organization-panel',
          entityName: 'Panel de organización',
          message,
          metadata: null,
          actor: null,
          deviceId,
          createdAt: new Date(),
        },
        ...current,
      ].slice(0, 40))
    }
  }, [])

  const handleDownloadAttendees = useCallback(() => {
    try {
      const rows = [
        ['Alias', 'Email', 'Rol', 'Estado', 'Juegos aportados', 'Partidas registradas', 'Última actividad'],
        ...attendeeList.map((attendee) => [
          attendee.alias,
          attendee.email,
          attendee.role,
          attendee.status,
          String(attendee.games),
          String(attendee.plays),
          attendee.lastActive,
        ]),
      ]

      const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `asistentes-clbsk-${day.label.replace(/\s+/g, '-').toLowerCase()}.csv`
      link.click()
      URL.revokeObjectURL(url)

      setPanelMessage({ type: 'success', message: 'Listado de asistentes exportado correctamente.' })
      addAuditEntry('Se descargó el listado de asistentes.')
    } catch (error) {
      setPanelMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo exportar el listado de asistentes.',
      })
    }
  }, [addAuditEntry, attendeeList, day.label])

  const handleInviteSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const email = inviteForm.email.trim().toLowerCase()

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setPanelMessage({ type: 'error', message: 'Introduce un correo válido para la invitación.' })
        return
      }

      if (whitelistList.some((entry) => entry.email.toLowerCase() === email)) {
        setPanelMessage({ type: 'error', message: 'Ese correo ya está en la whitelist.' })
        return
      }

      try {
        await addWhitelistEntry({ email, role: inviteForm.role })
        setInviteForm({ email: '', role: inviteForm.role })
        setInviteModalOpen(false)
        setPanelMessage({ type: 'success', message: `Invitación enviada a ${email}.` })
        addAuditEntry(`Se invitó a ${email}.`)
      } catch (error) {
        console.error('No se pudo registrar la invitación en la whitelist', error)
        setPanelMessage({
          type: 'error',
          message: error instanceof Error ? error.message : 'No se pudo registrar el correo en la whitelist.',
        })
      }
    },
    [addAuditEntry, addWhitelistEntry, inviteForm.role, inviteForm.email, whitelistList],
  )

  const handleResendInvitation = useCallback(async (email: string) => {
    try {
      const current = whitelistList.find((entry) => entry.email === email)
      const nextStatus = current?.status === 'revoked' ? 'pending' : current?.status
      await updateWhitelistEntry({ email, status: nextStatus })
      setPanelMessage({ type: 'info', message: `Invitación reenviada a ${email}.` })
      addAuditEntry(`Se reenviaron credenciales a ${email}.`)
    } catch (error) {
      console.error('No se pudo reenviar la invitación', error)
      setPanelMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo reenviar la invitación en este momento.',
      })
    }
  }, [addAuditEntry, updateWhitelistEntry, whitelistList])

  const handleRestoreAccess = useCallback(async (email: string) => {
    try {
      await updateWhitelistEntry({ email, status: 'approved' })
      setPanelMessage({ type: 'success', message: `Acceso restaurado para ${email}.` })
      addAuditEntry(`Se restauró el acceso de ${email}.`)
    } catch (error) {
      console.error('No se pudo restaurar el acceso', error)
      setPanelMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo restaurar el acceso en este momento.',
      })
    }
  }, [addAuditEntry, updateWhitelistEntry])

  const handleUpdateDuplicate = useCallback(
    (id: string, status: DuplicateStatus, customMessage?: string) => {
      setDuplicateList((current) =>
        current.map((duplicate) =>
          duplicate.id === id ? { ...duplicate, status } : duplicate,
        ),
      )

      const messages: Record<DuplicateStatus, string> = {
        open: 'La alerta se marcó como abierta nuevamente.',
        in_review: 'Alerta movida a revisión.',
        resolved: 'Alerta cerrada y partida validada.',
      }

      setPanelMessage({ type: 'success', message: customMessage ?? messages[status] })
      addAuditEntry(`Se actualizó el duplicado ${id} a estado ${status}.`)
    },
    [addAuditEntry],
  )

  const handleGenerateExport = useCallback(
    (preset: ExportPreset) => {
      setProcessingExport(preset.id)

      try {
        const rows = [
          ['Exportación', preset.label],
          ['Descripción', preset.description],
          ['Generado', day.label],
          [],
          ['Alias', 'Partidas registradas', 'Tiempo estimado (min)'],
          ...attendeeList.map((attendee) => [
            attendee.alias,
            String(attendee.plays),
            String(attendee.plays * 60),
          ]),
        ]

        const csv = rows
          .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
          .join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${preset.id}-${day.label.replace(/\s+/g, '-').toLowerCase()}.csv`
        link.click()
        URL.revokeObjectURL(url)

        setPanelMessage({ type: 'success', message: `Exportación "${preset.label}" generada.` })
        addAuditEntry(`Se generó la exportación ${preset.label}.`)
      } catch (error) {
        setPanelMessage({
          type: 'error',
          message: error instanceof Error ? error.message : 'No se pudo generar la exportación.',
        })
      } finally {
        setProcessingExport(null)
      }
    },
    [addAuditEntry, attendeeList, day.label],
  )

  const handleSharePreset = useCallback(async (preset: ExportPreset) => {
    const shareUrl = `https://clbsk26.app/exports/${preset.id}`

    try {
      await copyToClipboard(shareUrl)
      setPanelMessage({ type: 'success', message: 'Enlace copiado al portapapeles.' })
    } catch (error) {
      setPanelMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo copiar el enlace.',
      })
    }
  }, [])

  return (
    <>
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
          <button
            onClick={() => setPanelMessage({ type: 'info', message: 'La configuración avanzada llegará en la siguiente iteración.' })}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
          >
            <UserCog className="h-4 w-4" />
            Configuración avanzada
          </button>
        </div>
      </header>

      {panelMessage && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            panelMessage.type === 'success'
              ? 'border-success/40 bg-success/10 text-success'
              : panelMessage.type === 'error'
              ? 'border-error/40 bg-error/10 text-error'
              : 'border-secondary/40 bg-secondary/10 text-secondary'
          }`}
        >
          {panelMessage.message}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-4">
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-text-secondary">Asistentes conectados</p>
          <p className="text-2xl font-semibold text-text-primary">{onlineCount}</p>
          <p className="text-xs text-text-secondary">de {attendeeList.length} registrados hoy</p>
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
          <p className="text-xs uppercase tracking-wide text-text-secondary">Partidas en juego</p>
          <p className="text-2xl font-semibold text-text-primary">{activePlays.length}</p>
          <p className="text-xs text-text-secondary">{totalActivePlayers} personas jugando ahora mismo</p>
        </div>
      </section>

      <section className="card space-y-3 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">Ocupación por salas</h3>
          <p className="text-xs text-text-secondary">
            Datos en vivo · actualizamos cada pocos segundos
          </p>
        </div>
        {roomSummaryEntries.length === 0 ? (
          <p className="text-sm text-text-secondary">No hay partidas en curso en este momento.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            {roomSummaryEntries.map(([roomName, stats]) => (
              <div
                key={`room-${roomName}`}
                className="rounded-2xl border border-primary/20 bg-background px-4 py-3 text-sm text-text-secondary"
              >
                <p className="text-xs uppercase tracking-wide text-text-secondary">{roomName}</p>
                <p className="text-base font-semibold text-text-primary">{stats.players} personas jugando</p>
                <p className="text-xs text-text-secondary">{stats.activePlays} partidas activas</p>
              </div>
            ))}
          </div>
        )}
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
          <button
            onClick={() => setPanelMessage({ type: 'info', message: 'Gestiona los filtros desde cada módulo para aplicarlos en contexto.' })}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
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
                  value={attendeeSearch}
                  onChange={(event) => {
                    const { value } = event.currentTarget
                    setAttendeeSearch(value)
                  }}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownloadAttendees}
                  className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  Descargar listado
                </button>
                <button
                  onClick={() => setInviteModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
                >
                  <MailPlus className="h-4 w-4" />
                  Invitar asistente
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredAttendees.map((attendee) => {
                const statusStyles = getAttendeeStatusStyles(attendee.status)
                const StatusIcon = statusStyles.Icon
                return (
                  <article key={attendee.id} className="rounded-2xl border border-slate-200/60 bg-surface p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-text-primary">
                          <UserLink name={attendee.alias} className="text-text-primary hover:text-primary/80" />
                        </h3>
                        <p className="text-sm text-text-secondary">{attendee.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusStyles.label}
                        </span>
                        <button
                          onClick={() => setSelectedAttendee(attendee)}
                          className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary"
                        >
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
              {filteredAttendees.length === 0 && (
                <p className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
                  No se encontraron asistentes con ese criterio.
                </p>
              )}
              {selectedAttendee && (
                <article className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-text-secondary">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-text-primary">
                      Historial rápido de{' '}
                      <UserLink name={selectedAttendee.alias} className="text-text-primary hover:text-primary/80" />
                    </h3>
                    <button
                      onClick={() => setSelectedAttendee(null)}
                      className="text-xs font-semibold text-primary"
                    >
                      Cerrar
                    </button>
                  </div>
                  <p className="mt-2">Email: {selectedAttendee.email}</p>
                  <p>Rol: {selectedAttendee.role}</p>
                  <p>
                    Resumen: {selectedAttendee.plays} partidas registradas, {selectedAttendee.games} juegos aportados.
                  </p>
                  <p>Última actividad: {selectedAttendee.lastActive}</p>
                </article>
              )}
            </div>
          </div>
        )}

        {activeTab === 'whitelist' && (
          <div className="space-y-3">
            {whitelistLoading && (
              <p className="text-sm text-text-secondary">Sincronizando la whitelist…</p>
            )}
            {whitelistError && (
              <p className="rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">
                {whitelistError}
              </p>
            )}
            {whitelistList.map((entry) => {
              const statusStyles = getWhitelistStatusStyles(entry.status)
              const StatusIcon = statusStyles.Icon
              return (
                <article key={entry.email} className="rounded-2xl border border-slate-200/60 bg-surface p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-text-primary">{entry.email}</h3>
                      <p className="text-sm text-text-secondary">Rol: {formatWhitelistRole(entry.role)}</p>
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
                      <button
                        onClick={() => handleResendInvitation(entry.email)}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Reenviar invitación
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestoreAccess(entry.email)}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary"
                      >
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
            {duplicateList.map((duplicate) => {
              const statusStyles = getDuplicateStatusStyles(duplicate.status)
              return (
                <article key={duplicate.id} className="rounded-2xl border border-slate-200/60 bg-surface p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <GameTitle
                      name={duplicate.game}
                      size="sm"
                      textClassName="text-lg"
                      className="items-start"
                      role="heading"
                      aria-level={3}
                    >
                      <p className="text-sm font-normal text-text-secondary">
                        {renderPlayersInline(duplicate.players)} · Coincidencia {duplicate.similarity}%
                      </p>
                    </GameTitle>
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
                    <button
                      onClick={() => handleUpdateDuplicate(duplicate.id, 'in_review')}
                      className="inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Revisar partida
                    </button>
                    <button
                      onClick={() => handleUpdateDuplicate(duplicate.id, 'resolved')}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirmar como válida
                    </button>
                    <button
                      onClick={() => handleUpdateDuplicate(duplicate.id, 'resolved', 'Alerta descartada.')}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary"
                    >
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
              {initialExportPresets.map((preset) => (
                <article key={preset.id} className="rounded-2xl border border-slate-200/60 bg-surface p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">{preset.label}</h3>
                      <p className="text-sm text-text-secondary">{preset.description}</p>
                    </div>
                    <button
                      onClick={() => handleGenerateExport(preset)}
                      disabled={processingExport === preset.id}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
                    >
                      <ArrowDownToLine className="h-4 w-4" />
                      {processingExport === preset.id ? 'Generando...' : 'Generar CSV'}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-secondary">
                    <span className="rounded-full bg-background px-3 py-1">{preset.size}</span>
                    <button
                      onClick={() => void handleSharePreset(preset)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-xs font-semibold text-primary"
                    >
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
                  {activityError && (
                    <li className="rounded-xl bg-error/10 px-3 py-2 text-error">
                      {activityError}
                    </li>
                  )}
                  {!activityError && activityLogs.length === 0 && (
                    <li className="rounded-xl bg-background px-3 py-2 text-text-secondary">
                      Sin registros todavía.
                    </li>
                  )}
                  {activityLogs.map((entry) => (
                    <li key={entry.id} className="rounded-xl bg-background px-3 py-2">
                      <p className="font-semibold text-text-primary">{formatActivityMessage(entry)}</p>
                      <p className="text-[11px] text-text-secondary">{formatActivitySubtitle(entry)}</p>
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
      {inviteModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface p-6 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Invitar asistente</h3>
              <p className="text-sm text-text-secondary">
                Envía una invitación por correo. La cuenta quedará marcada como pendiente de verificación.
              </p>
            </div>
            <button
              onClick={() => setInviteModalOpen(false)}
              className="text-sm font-semibold text-primary"
            >
              Cerrar
            </button>
          </div>
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Correo electrónico</span>
              <input
                className="w-full bg-transparent text-base text-text-primary outline-none"
                value={inviteForm.email}
                onChange={(event) => {
                  const { value } = event.currentTarget
                  setInviteForm((current) => ({ ...current, email: value }))
                }}
                placeholder="persona@example.com"
                required
              />
            </label>
            <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Rol asignado</span>
              <select
                className="w-full bg-transparent text-base text-text-primary outline-none"
                value={inviteForm.role}
                onChange={(event) => {
                  const { value } = event.currentTarget
                  setInviteForm((current) => ({ ...current, role: value as WhitelistRole }))
                }}
              >
                <option value="asistente">Asistente</option>
                <option value="staff">Staff</option>
                <option value="organizacion">Organización</option>
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
              >
                <MailPlus className="h-4 w-4" />
                Enviar invitación
              </button>
            </div>
          </form>
        </div>
      </div>
      )}
    </>
  )
}
