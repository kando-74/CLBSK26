const DAY_BOUNDARY_HOUR = 7

export function getCurrentCongressDay(date = new Date()) {
  const current = new Date(date)
  const hours = current.getHours()

  if (hours < DAY_BOUNDARY_HOUR) {
    current.setDate(current.getDate() - 1)
  }

  const formatter = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return {
    raw: current,
    label: formatter.format(current),
  }
}

export function getDayBoundaries(reference: Date = new Date()) {
  const base = new Date(reference)
  const currentDay = getCurrentCongressDay(base).raw

  const start = new Date(currentDay)
  start.setHours(DAY_BOUNDARY_HOUR, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 1)
  end.setMilliseconds(end.getMilliseconds() - 1)

  return { start, end }
}

export function formatHour(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
