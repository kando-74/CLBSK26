import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { Download, Loader2, Search, Star } from 'lucide-react'
import type { BggSearchResult } from '../utils/bgg'
import { getBoardGameDetails, searchBoardGames } from '../utils/bgg'
import { GameTitle } from './GameTitle'

const functions = getFunctions()
const addLibraryEntry = httpsCallable(functions, 'addLibraryEntry')

function useAddGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      eventId: string
      language: string
      bggId?: number
      bggData?: { name: string; thumbnail?: string; yearPublished?: number }
      manualTitle?: string
      entry?: {
        yearPublished?: number | null
        durationMinutes?: number | null
        weightValue?: number | null
      }
    }) => addLibraryEntry(data),
    onSuccess: () => {
      // Invalida la caché de la ludoteca para que se actualice automáticamente
      queryClient.invalidateQueries({ queryKey: ['library'] })
    },
  })
}

export function AddGameForm({ eventId = 'main-event' }: { eventId?: string }) {
  const [bggQuery, setBggQuery] = useState('')
  const [bggResults, setBggResults] = useState<BggSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [language, setLanguage] = useState('ES')

  const addGameMutation = useAddGame()

  async function handleBggSearch(event: FormEvent) {
    event.preventDefault()
    if (bggQuery.length < 3) {
      setSearchError('Introduce al menos 3 caracteres para buscar.')
      return
    }
    setIsSearching(true)
    setSearchError(null)
    addGameMutation.reset()

    try {
      const results = await searchBoardGames(bggQuery)
      setBggResults(results.slice(0, 10))
      if (results.length === 0) {
        setSearchError('No se encontraron juegos en BGG.')
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Error en la búsqueda.')
    } finally {
      setIsSearching(false)
    }
  }

  async function handleImport(bggId: number, name: string, yearPublished?: number) {
    addGameMutation.reset()
    try {
      // La función 'addLibraryEntry' ya se encarga de buscar detalles y cachear.
      // Le pasamos los datos básicos para una respuesta optimista y para la búsqueda en el backend.
      await addGameMutation.mutateAsync({
        eventId,
        language,
        bggId,
        bggData: {
          name,
          // El thumbnail y otros detalles se enriquecerán en el backend.
          yearPublished: yearPublished ?? undefined,
        },
        entry: {
          yearPublished: resolvedYear ?? null,
          durationMinutes: resolvedDuration ?? null,
          weightValue: resolvedWeight ?? null,
        },
      })
    } catch (error) {
      // El hook `useMutation` ya gestiona el estado de error
    }
  }

  return (
    <section className="card space-y-4 p-5">
      <h3 className="inline-flex items-center gap-2 text-lg font-semibold">
        <Star className="h-5 w-5 text-secondary" />
        Añadir un juego a la ludoteca
      </h3>

      {/* Mensajes de estado de la mutación */}
      {addGameMutation.isSuccess && (
        <div className="rounded-lg bg-success/10 p-3 text-sm font-medium text-success">
          ¡Juego añadido con éxito! La ludoteca se ha actualizado.
        </div>
      )}
      {addGameMutation.isError && (
        <div className="rounded-lg bg-error/10 p-3 text-sm font-medium text-error">
          {(addGameMutation.error as Error).message || 'Error al añadir el juego.'}
        </div>
      )}

      {/* Formulario de búsqueda */}
      <form onSubmit={handleBggSearch} className="flex flex-col gap-3 md:flex-row">
        <input
          value={bggQuery}
          onChange={(e) => setBggQuery(e.target.value)}
          placeholder="Buscar en BoardGameGeek (ej. Ark Nova)"
          className="input flex-grow"
        />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="input"
          aria-label="Idioma del juego"
        >
          <option value="ES">Español</option>
          <option value="EN">Inglés</option>
          <option value="FR">Francés</option>
          <option value="DE">Alemán</option>
          <option value="MULTI">Multidioma</option>
        </select>
        <button type="submit" disabled={isSearching} className="btn-primary inline-flex items-center justify-center gap-2">
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </button>
      </form>

      {searchError && <p className="text-sm text-error">{searchError}</p>}

      {/* Resultados de la búsqueda */}
      {bggResults.length > 0 && (
        <div className="space-y-2 border-t border-primary/10 pt-4">
          <h4 className="text-sm font-semibold text-text-secondary">Resultados de la búsqueda:</h4>
          {bggResults.map((result) => {
            const isImportingThis = addGameMutation.isPending && (addGameMutation.variables as any)?.bggId === result.id

            return (
              <div
                key={result.id}
                className="flex flex-col items-start gap-3 rounded-lg bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-grow">
                  <GameTitle name={result.name} size="sm" />
                  <p className="text-xs text-text-secondary">
                    BGG #{result.id}
                    {result.yearPublished && ` • ${result.yearPublished}`}
                  </p>
                </div>
                <button
                  onClick={() => handleImport(result.id, result.name, result.yearPublished)}
                  disabled={isImportingThis || addGameMutation.isSuccess}
                  className="btn-secondary inline-flex items-center justify-center gap-2 text-xs"
                >
                  {isImportingThis ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Añadiendo...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Añadir este juego
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
