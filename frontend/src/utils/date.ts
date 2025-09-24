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

export function formatHour(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
