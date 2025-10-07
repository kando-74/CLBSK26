import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { clsx } from 'clsx'
import { MessageCircle, ShieldCheck, Users } from 'lucide-react'
import {
  type SendTableChatInput,
  type TableChatChannel,
  type TableChatMessage,
  useTableChat,
} from '../services/tableChat'
import { UserLink } from './UserLink'

type ViewMode = 'all' | 'participants'

type TableChatProps = {
  tableId: string
  currentUserName: string
  currentUserId: string | null
  canUsePrivateChannel: boolean
  className?: string
}

type ChannelToggleProps = {
  value: TableChatChannel
  onChange: (channel: TableChatChannel) => void
  disabled?: boolean
}

type ViewToggleProps = {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  participantsDisabled: boolean
}

function ChannelToggle({ value, onChange, disabled }: ChannelToggleProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-background px-2 py-1 text-xs font-medium text-text-secondary">
      <span>Enviar a:</span>
      <button
        type="button"
        onClick={() => onChange('public')}
        className={clsx(
          'rounded-full px-3 py-1 transition-colors',
          value === 'public' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-primary/10 hover:text-primary',
        )}
      >
        Para todos
      </button>
      <button
        type="button"
        onClick={() => onChange('participants')}
        disabled={disabled}
        className={clsx(
          'rounded-full px-3 py-1 transition-colors',
          disabled
            ? 'cursor-not-allowed text-text-secondary/60'
            : value === 'participants'
            ? 'bg-primary text-white'
            : 'text-text-secondary hover:bg-primary/10 hover:text-primary',
        )}
      >
        Participantes
      </button>
    </div>
  )
}

function ViewToggle({ value, onChange, participantsDisabled }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-background px-2 py-1 text-xs font-medium text-text-secondary">
      <span>Escuchar:</span>
      <button
        type="button"
        onClick={() => onChange('all')}
        className={clsx(
          'rounded-full px-3 py-1 transition-colors',
          value === 'all' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-primary/10 hover:text-primary',
        )}
      >
        A todos
      </button>
      <button
        type="button"
        onClick={() => onChange('participants')}
        disabled={participantsDisabled}
        className={clsx(
          'rounded-full px-3 py-1 transition-colors',
          participantsDisabled
            ? 'cursor-not-allowed text-text-secondary/60'
            : value === 'participants'
            ? 'bg-primary text-white'
            : 'text-text-secondary hover:bg-primary/10 hover:text-primary',
        )}
      >
        Participantes
      </button>
    </div>
  )
}

function formatTimestamp(value: number) {
  try {
    const date = new Date(value)
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function ChatMessageItem({ message }: { message: TableChatMessage }) {
  const timeLabel = formatTimestamp(message.createdAt)
  const isPrivate = message.channel === 'participants'

  return (
    <li className="rounded-2xl border border-primary/10 bg-background px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Users className="h-3.5 w-3.5 text-primary/70" />
          <UserLink player={{ uid: message.authorName, alias: message.authorName }} />
        </div>
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          {isPrivate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
              <ShieldCheck className="h-3 w-3" />
              Participantes
            </span>
          )}
          {timeLabel && <span>{timeLabel}</span>}
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{message.content}</p>
    </li>
  )
}

function EmptyState({
  canUsePrivateChannel,
  hasHiddenMessages,
}: {
  canUsePrivateChannel: boolean
  hasHiddenMessages: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-background px-4 py-6 text-center text-sm text-text-secondary">
      <MessageCircle className="h-5 w-5 text-primary" />
      <p>{hasHiddenMessages ? 'Los mensajes de participantes son privados.' : 'El chat aún no tiene mensajes. ¡Empieza la conversación!'}</p>
      {!canUsePrivateChannel && (
        <p className="text-xs text-text-secondary/60">
          Apúntate a la mesa para activar el canal privado de participantes.
        </p>
      )}
    </div>
  )
}

export function TableChat({
  tableId,
  currentUserName,
  currentUserId,
  canUsePrivateChannel,
  className,
}: TableChatProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [targetChannel, setTargetChannel] = useState<TableChatChannel>('public')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const { messages, loading, error, sendMessage } = useTableChat({ tableId })

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  useEffect(() => {
    if (!canUsePrivateChannel && viewMode === 'participants') {
      setViewMode('all')
    }
  }, [canUsePrivateChannel, viewMode])

  useEffect(() => {
    if (!canUsePrivateChannel && targetChannel === 'participants') {
      setTargetChannel('public')
    }
  }, [canUsePrivateChannel, targetChannel])

  useEffect(() => {
    if (!feedback) {
      return
    }
    const timeout = setTimeout(() => setFeedback(null), 3000)
    return () => clearTimeout(timeout)
  }, [feedback])

  const filteredMessages = useMemo(() => {
    const visibleMessages = canUsePrivateChannel
      ? messages
      : messages.filter((item) => item.channel === 'public')

    if (viewMode === 'participants') {
      return visibleMessages.filter((item) => item.channel === 'participants')
    }

    return visibleMessages
  }, [canUsePrivateChannel, messages, viewMode])

  const hasHiddenParticipantMessages = useMemo(
    () => !canUsePrivateChannel && messages.some((item) => item.channel === 'participants'),
    [canUsePrivateChannel, messages],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message.trim()) {
      setFeedback('Escribe un mensaje antes de enviarlo.')
      return
    }

    setSending(true)
    const result = await sendMessage({
      content: message,
      channel: targetChannel,
      authorName: currentUserName,
      authorId: currentUserId ?? null,
    } satisfies Omit<SendTableChatInput, 'tableId'>)

    if (result.status === 'success') {
      setMessage('')
      setFeedback(targetChannel === 'participants' ? 'Mensaje enviado a participantes.' : 'Mensaje publicado.')
    } else {
      setFeedback(result.message ?? 'No se pudo enviar el mensaje.')
    }

    setSending(false)
  }

  return (
    <section className={clsx('space-y-3 rounded-2xl border border-primary/20 bg-white p-4 shadow-card', className)}>
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span>Chat de la mesa</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle
            value={viewMode}
            onChange={setViewMode}
            participantsDisabled={!canUsePrivateChannel}
          />
          <ChannelToggle
            value={targetChannel}
            onChange={setTargetChannel}
            disabled={!canUsePrivateChannel}
          />
        </div>
      </header>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl bg-surface px-2 py-3">
        {loading && <p className="px-2 text-xs text-text-secondary">Sincronizando chat...</p>}
        {!loading && filteredMessages.length === 0 && (
          <EmptyState
            canUsePrivateChannel={canUsePrivateChannel}
            hasHiddenMessages={hasHiddenParticipantMessages}
          />
        )}
        {filteredMessages.map((item) => (
          <ChatMessageItem key={item.id} message={item} />
        ))}
        <div ref={scrollAnchorRef} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-text-secondary">Tu mensaje</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.currentTarget.value)}
            placeholder={
              targetChannel === 'participants'
                ? 'Mensaje privado para las personas apuntadas…'
                : 'Saluda, haz una pregunta o coordina el inicio de la partida…'
            }
            className="h-20 w-full resize-none rounded-2xl border border-primary/20 bg-background px-4 py-2 text-sm text-text-secondary outline-none focus:border-primary focus:text-text-primary"
            maxLength={500}
          />
        </label>
        {feedback && <p className="text-xs text-text-secondary">{feedback}</p>}
        {!canUsePrivateChannel && targetChannel === 'participants' && (
          <p className="text-xs text-error">Apúntate a la mesa para enviar mensajes solo a participantes.</p>
        )}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={sending || (!canUsePrivateChannel && targetChannel === 'participants')}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
          >
            {sending ? 'Enviando…' : 'Enviar mensaje'}
          </button>
        </div>
      </form>
    </section>
  )
}
