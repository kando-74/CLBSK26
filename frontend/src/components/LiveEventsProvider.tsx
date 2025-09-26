import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  isRealtimePlaysEnabled,
  subscribePlays,
  type PlayRecord,
} from '../services/plays'
import {
  fetchTables,
  isRealtimeTablesEnabled,
  subscribeTables,
  type TableRecord,
} from '../services/tables'
import { getDayBoundaries } from '../utils/date'

type LiveEventKind =
  | 'table:new'
  | 'table:in-progress'
  | 'table:completed'
  | 'play:registered'
  | 'play:completed'

type LiveEventScope = 'table' | 'play'

type LiveEvent = {
  id: string
  kind: LiveEventKind
  scope: LiveEventScope
  entityId: string
  title: string
  description: string
  timestamp: number
}

type HighlightInfo = {
  timestamp: number
  label: string
}

type HighlightMap = Record<string, number>

type LiveEventsContextValue = {
  events: LiveEvent[]
  dismissEvent: (id: string) => void
  getTableHighlight: (tableId: string) => HighlightInfo | null
  getPlayHighlight: (playId: string) => HighlightInfo | null
  latestTableTimestamp: number | null
  latestPlayTimestamp: number | null
  formatRelativeTime: (timestamp: number) => string
}

const LiveEventsContext = createContext<LiveEventsContextValue | undefined>(undefined)

const EVENT_AUTO_DISMISS_MS = 7000
const HIGHLIGHT_TTL_MS = 3 * 60 * 1000

function formatRelativeTimeLabel(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 30_000) {
    return 'hace unos segundos'
  }
  if (diff < 90_000) {
    return 'hace 1 min'
  }
  if (diff < 3_600_000) {
    const minutes = Math.round(diff / 60_000)
    return `hace ${minutes} min`
  }
  const hours = Math.round(diff / 3_600_000)
  return `hace ${hours} h`
}

function generateEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `event-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

function isHighlightActive(timestamp: number): boolean {
  return Date.now() - timestamp < HIGHLIGHT_TTL_MS
}

export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [tableHighlights, setTableHighlights] = useState<HighlightMap>({})
  const [playHighlights, setPlayHighlights] = useState<HighlightMap>({})
  const [latestTableTimestamp, setLatestTableTimestamp] = useState<number | null>(null)
  const [latestPlayTimestamp, setLatestPlayTimestamp] = useState<number | null>(null)

  const tablesReadyRef = useRef(false)
  const playsReadyRef = useRef(false)
  const lastTablesRef = useRef(new Map<string, TableRecord>())
  const lastPlaysRef = useRef(new Map<string, PlayRecord>())
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const dismissEvent = useCallback((id: string) => {
    setEvents((current) => current.filter((event) => event.id !== id))
  }, [])

  const scheduleAutoDismiss = useCallback(
    (id: string) => {
      window.setTimeout(() => {
        if (!mountedRef.current) {
          return
        }
        dismissEvent(id)
      }, EVENT_AUTO_DISMISS_MS)
    },
    [dismissEvent],
  )

  const pushEvent = useCallback(
    (partial: Omit<LiveEvent, 'id' | 'timestamp'>) => {
      const id = generateEventId()
      const timestamp = Date.now()
      const event: LiveEvent = { ...partial, id, timestamp }

      setEvents((current) => [event, ...current].slice(0, 5))
      scheduleAutoDismiss(id)
    },
    [scheduleAutoDismiss],
  )

  const highlightTable = useCallback((tableId: string) => {
    const timestamp = Date.now()
    setTableHighlights((current) => ({ ...current, [tableId]: timestamp }))
    setLatestTableTimestamp(timestamp)
  }, [])

  const highlightPlay = useCallback((playId: string) => {
    const timestamp = Date.now()
    setPlayHighlights((current) => ({ ...current, [playId]: timestamp }))
    setLatestPlayTimestamp(timestamp)
  }, [])

  const handleTablesUpdate = useCallback(
    (tables: TableRecord[]) => {
      const nextMap = new Map<string, TableRecord>()
      tables.forEach((table) => {
        nextMap.set(table.id, table)
      })

      if (!tablesReadyRef.current) {
        tablesReadyRef.current = true
        lastTablesRef.current = nextMap
        return
      }

      const previous = lastTablesRef.current

      tables.forEach((table) => {
        const previousTable = previous.get(table.id)
        if (!previousTable) {
          pushEvent({
            kind: 'table:new',
            scope: 'table',
            entityId: table.id,
            title: 'Nueva mesa publicada',
            description: `${table.game} · Sala ${table.room}`,
          })
          highlightTable(table.id)
          return
        }

        if (previousTable.status !== table.status) {
          if (table.status === 'in-progress') {
            pushEvent({
              kind: 'table:in-progress',
              scope: 'table',
              entityId: table.id,
              title: 'Mesa en juego',
              description: `${table.game} está jugando ahora mismo.`,
            })
          } else if (table.status === 'completed') {
            pushEvent({
              kind: 'table:completed',
              scope: 'table',
              entityId: table.id,
              title: 'Mesa finalizada',
              description: `${table.game} ha cerrado su partida.`,
            })
          }
          highlightTable(table.id)
          return
        }
      })

      lastTablesRef.current = nextMap
    },
    [highlightTable, pushEvent],
  )

  const handlePlaysUpdate = useCallback(
    (plays: PlayRecord[]) => {
      const nextMap = new Map<string, PlayRecord>()
      plays.forEach((play) => {
        nextMap.set(play.id, play)
      })

      if (!playsReadyRef.current) {
        playsReadyRef.current = true
        lastPlaysRef.current = nextMap
        return
      }

      const previous = lastPlaysRef.current

      plays.forEach((play) => {
        const previousPlay = previous.get(play.id)
        if (!previousPlay) {
          pushEvent({
            kind: 'play:registered',
            scope: 'play',
            entityId: play.id,
            title: 'Partida registrada',
            description: `${play.game} · ${play.players.join(', ') || 'Jugadores por confirmar'}`,
          })
          highlightPlay(play.id)
          return
        }

        if (previousPlay.status !== play.status && play.status === 'completed') {
          pushEvent({
            kind: 'play:completed',
            scope: 'play',
            entityId: play.id,
            title: 'Partida finalizada',
            description: `${play.game} registró su resultado final.`,
          })
          highlightPlay(play.id)
        }
      })

      lastPlaysRef.current = nextMap
    },
    [highlightPlay, pushEvent],
  )

  useEffect(() => {
    if (!isRealtimeTablesEnabled()) {
      // Hidratar referencia en modo local para evitar falsos positivos al cambiar a remoto
      let cancelled = false
      void fetchTables().then((tables) => {
        if (cancelled) {
          return
        }
        const map = new Map<string, TableRecord>()
        tables.forEach((table) => {
          map.set(table.id, table)
        })
        lastTablesRef.current = map
        tablesReadyRef.current = true
      })
      return () => {
        cancelled = true
      }
    }

    const unsubscribe = subscribeTables(handleTablesUpdate, () => {})
    return () => {
      unsubscribe()
    }
  }, [handleTablesUpdate])

  useEffect(() => {
    if (!isRealtimePlaysEnabled()) {
      return
    }

    const { start: dayStart, end: dayEnd } = getDayBoundaries()
    const unsubscribe = subscribePlays({ dayStart, dayEnd }, handlePlaysUpdate)
    return () => {
      unsubscribe()
    }
  }, [handlePlaysUpdate])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTableHighlights((current) => {
        const entries = Object.entries(current)
        if (entries.length === 0) {
          return current
        }
        const now = Date.now()
        const next: HighlightMap = {}
        entries.forEach(([id, timestamp]) => {
          if (now - timestamp < HIGHLIGHT_TTL_MS) {
            next[id] = timestamp
          }
        })
        if (entries.length === Object.keys(next).length) {
          return current
        }
        return next
      })

      setPlayHighlights((current) => {
        const entries = Object.entries(current)
        if (entries.length === 0) {
          return current
        }
        const now = Date.now()
        const next: HighlightMap = {}
        entries.forEach(([id, timestamp]) => {
          if (now - timestamp < HIGHLIGHT_TTL_MS) {
            next[id] = timestamp
          }
        })
        if (entries.length === Object.keys(next).length) {
          return current
        }
        return next
      })
    }, 30_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  const getTableHighlight = useCallback(
    (tableId: string): HighlightInfo | null => {
      const timestamp = tableHighlights[tableId]
      if (!timestamp || !isHighlightActive(timestamp)) {
        return null
      }
      return { timestamp, label: formatRelativeTimeLabel(timestamp) }
    },
    [tableHighlights],
  )

  const getPlayHighlight = useCallback(
    (playId: string): HighlightInfo | null => {
      const timestamp = playHighlights[playId]
      if (!timestamp || !isHighlightActive(timestamp)) {
        return null
      }
      return { timestamp, label: formatRelativeTimeLabel(timestamp) }
    },
    [playHighlights],
  )

  const formatRelativeTime = useCallback((timestamp: number) => formatRelativeTimeLabel(timestamp), [])

  const value = useMemo(
    () => ({
      events,
      dismissEvent,
      getTableHighlight,
      getPlayHighlight,
      latestTableTimestamp,
      latestPlayTimestamp,
      formatRelativeTime,
    }),
    [
      dismissEvent,
      events,
      formatRelativeTime,
      getPlayHighlight,
      getTableHighlight,
      latestPlayTimestamp,
      latestTableTimestamp,
    ],
  )

  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLiveEvents(): LiveEventsContextValue {
  const context = useContext(LiveEventsContext)
  if (!context) {
    throw new Error('useLiveEvents debe usarse dentro de LiveEventsProvider')
  }
  return context
}
