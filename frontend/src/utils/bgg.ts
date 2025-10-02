const API_BASE = 'https://boardgamegeek.com/xmlapi2'

const WAIT_TIME_MS = 2000
const MAX_RETRIES = 4

function buildUrl(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${API_BASE}${path}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  })

  const proxyBase = import.meta.env.VITE_BGG_PROXY
  if (proxyBase) {
    if (proxyBase.includes('{url}')) {
      return proxyBase.replace('{url}', encodeURIComponent(url.toString()))
    }
    const separator = proxyBase.endsWith('/') ? '' : '/'
    return `${proxyBase}${separator}${encodeURIComponent(url.toString())}`
  }

  return url.toString()
}

async function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function fetchXml(
  path: string,
  params: Record<string, string | number | undefined>,
  attempt = 0,
): Promise<Document> {
  const response = await fetch(buildUrl(path, params), {
    headers: {
      Accept: 'application/xml, text/xml, */*;q=0.1',
    },
  })

  if (response.status === 202) {
    if (attempt >= MAX_RETRIES) {
      throw new Error('La API de BGG está tardando en responder. Inténtalo más tarde.')
    }

    await delay(WAIT_TIME_MS)
    return fetchXml(path, params, attempt + 1)
  }

  if (!response.ok) {
    throw new Error(`Error ${response.status} al consultar la API de BGG`)
  }

  const text = await response.text()
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, 'text/xml')

  const parserError = xml.querySelector('parsererror')
  if (parserError) {
    throw new Error('No se pudo interpretar la respuesta de BGG')
  }

  return xml
}

function getAttribute(element: Element | null, attribute: string) {
  return element?.getAttribute(attribute) ?? undefined
}

function getTextContent(element: Element | null) {
  return element?.textContent ?? undefined
}

export interface BggSearchResult {
  id: number
  name: string
  yearPublished?: number
}

export interface BggGameDetails {
  id: number
  name: string
  description?: string
  minPlayers?: number
  maxPlayers?: number
  minPlaytime?: number
  maxPlaytime?: number
  playingTime?: number
  averageWeight?: number
  mechanics: string[]
  thumbnailUrl?: string
  imageUrl?: string
}

export async function searchBoardGames(query: string): Promise<BggSearchResult[]> {
  const xml = await fetchXml('/search', { query, type: 'boardgame' })
  const items = Array.from(xml.querySelectorAll('items > item'))

  const results: BggSearchResult[] = []

  for (const item of items) {
    const id = Number(item.getAttribute('id'))
    const nameValue = getAttribute(item.querySelector('name[type="primary"]') ?? item.querySelector('name'), 'value')
    const yearValue = getAttribute(item.querySelector('yearpublished'), 'value')

    if (!id || !nameValue) {
      continue
    }

    results.push({
      id,
      name: nameValue,
      yearPublished: yearValue ? Number(yearValue) : undefined,
    })
  }

  return results
}

export async function getBoardGameDetails(id: number): Promise<BggGameDetails> {
  const xml = await fetchXml('/thing', { id, stats: 1 })
  const item = xml.querySelector('items > item')

  if (!item) {
    throw new Error('Juego no encontrado en BGG')
  }

  const nameValue = getAttribute(item.querySelector('name[type="primary"]') ?? item.querySelector('name'), 'value')
  const minPlayers = Number(getAttribute(item.querySelector('minplayers'), 'value') ?? 0)
  const maxPlayers = Number(getAttribute(item.querySelector('maxplayers'), 'value') ?? 0)
  const minPlaytime = Number(getAttribute(item.querySelector('minplaytime'), 'value') ?? 0)
  const maxPlaytime = Number(getAttribute(item.querySelector('maxplaytime'), 'value') ?? 0)
  const playingTime = Number(getAttribute(item.querySelector('playingtime'), 'value') ?? 0)
  const averageWeight = Number(
    getAttribute(item.querySelector('statistics ratings averageweight'), 'value') ?? 0,
  )
  const mechanics = Array.from(item.querySelectorAll('link[type="boardgamemechanic"]'))
    .map((node) => getAttribute(node, 'value'))
    .filter((value): value is string => Boolean(value))

  if (!nameValue) {
    throw new Error('El juego no tiene nombre en BGG')
  }

  return {
    id,
    name: nameValue,
    description: getAttribute(item.querySelector('description'), 'value') ?? undefined,
    minPlayers: minPlayers || undefined,
    maxPlayers: maxPlayers || undefined,
    minPlaytime: minPlaytime || undefined,
    maxPlaytime: maxPlaytime || undefined,
    playingTime: playingTime || undefined,
    averageWeight: averageWeight || undefined,
    mechanics,
    thumbnailUrl: getTextContent(item.querySelector('thumbnail')) ?? undefined,
    imageUrl: getTextContent(item.querySelector('image')) ?? undefined,
  }
}