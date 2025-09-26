import { CheckCircle2, FlagCheckered, Megaphone, Play, Sparkles, Trophy, X } from 'lucide-react'
import { useLiveEvents } from './LiveEventsProvider'

const EVENT_META = {
  'table:new': {
    icon: Megaphone,
    accent: 'text-primary',
    badge: 'bg-primary/10 text-primary',
  },
  'table:in-progress': {
    icon: Play,
    accent: 'text-secondary',
    badge: 'bg-secondary/10 text-secondary',
  },
  'table:completed': {
    icon: FlagCheckered,
    accent: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  'play:registered': {
    icon: Trophy,
    accent: 'text-primary',
    badge: 'bg-primary/10 text-primary',
  },
  'play:completed': {
    icon: CheckCircle2,
    accent: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
  },
} satisfies Record<string, { icon: typeof Megaphone; accent: string; badge: string }>

export function LiveEventToasts() {
  const { events, dismissEvent, formatRelativeTime } = useLiveEvents()

  if (events.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-4 top-24 z-[60] flex max-w-sm flex-col gap-3 sm:right-6">
      {events.map((event) => {
        const meta = EVENT_META[event.kind]
        const Icon = meta.icon
        return (
          <div
            key={event.id}
            className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.14)] backdrop-blur transition-transform"
            role="status"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-background ${meta.accent}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-text-primary">{event.title}</p>
                <p className="text-xs text-text-secondary">{event.description}</p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
                  <Sparkles className="h-3 w-3" />
                  {formatRelativeTime(event.timestamp)}
                </span>
              </div>
              <button
                onClick={() => dismissEvent(event.id)}
                className="text-text-secondary/60 transition-colors hover:text-text-secondary"
                aria-label="Cerrar aviso en vivo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
