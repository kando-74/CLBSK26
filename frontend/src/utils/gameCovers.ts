const COVER_MAP: Record<string, string> = {
  'heat: pedal to the metal': '/covers/heat-pedal-to-the-metal.svg',
  'sky team': '/covers/sky-team.svg',
  'kutná hora': '/covers/kutna-hora.svg',
  'kutna hora': '/covers/kutna-hora.svg',
  'akropolis': '/covers/akropolis.svg',
  revive: '/covers/revive.svg',
  scout: '/covers/scout.svg',
  earth: '/covers/earth.svg',
  bohnanza: '/covers/bohnanza.svg',
  'dune: imperium': '/covers/dune-imperium.svg',
}

function normalize(name: string) {
  return name.trim().toLowerCase()
}

export function getGameCover(name: string) {
  return COVER_MAP[normalize(name)]
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function hashName(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function getGradientColors(hash: number) {
  const hue = hash % 360
  const secondaryHue = (hue + 35) % 360
  return {
    start: `hsl(${hue}, 70%, 48%)`,
    end: `hsl(${secondaryHue}, 70%, 58%)`,
  }
}

function getLines(name: string) {
  const words = name.split(/\s+/).filter(Boolean)

  if (words.length <= 2) {
    return [escapeXml(name), '']
  }

  const firstLine: string[] = []
  const secondLine: string[] = []

  for (const word of words) {
    if ((firstLine.join(' ') + ' ' + word).trim().length <= 16 || firstLine.length === 0) {
      firstLine.push(word)
    } else {
      secondLine.push(word)
    }
  }

  return [escapeXml(firstLine.join(' ')), escapeXml(secondLine.join(' '))]
}

export function generatePlaceholderCover(name: string) {
  const trimmed = name.trim() || 'Juego'
  const hash = hashName(trimmed)
  const gradientId = `grad-${hash}`
  const { start, end } = getGradientColors(hash)
  const initials = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3)
  const [line1, line2] = getLines(trimmed)

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 420" width="320" height="420" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${start}" />
      <stop offset="100%" stop-color="${end}" />
    </linearGradient>
  </defs>
  <rect width="320" height="420" rx="28" fill="url(#${gradientId})" />
  <circle cx="72" cy="70" r="36" fill="rgba(0,0,0,0.25)" />
  <text x="72" y="80" text-anchor="middle" font-family="'Inter', 'Helvetica Neue', Arial, sans-serif" font-size="38" font-weight="700" fill="white">${initials}</text>
  <text x="32" y="270" font-family="'Inter', 'Helvetica Neue', Arial, sans-serif" font-size="36" font-weight="700" fill="white">${line1}</text>
  ${line2 ? `<text x="32" y="318" font-family="'Inter', 'Helvetica Neue', Arial, sans-serif" font-size="28" font-weight="600" fill="rgba(255,255,255,0.85)">${line2}</text>` : ''}
</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function resolveGameCover(name: string, explicit?: string) {
  return explicit ?? getGameCover(name) ?? generatePlaceholderCover(name)
}
