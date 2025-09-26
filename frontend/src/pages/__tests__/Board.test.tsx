import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Board } from '../Board'
import { resetTablesForTests } from '../../services/tables'

vi.mock('../../components/AuthProvider', async () => {
  const actual = await vi.importActual<typeof import('../../components/AuthProvider')>(
    '../../components/AuthProvider',
  )

  return {
    ...actual,
    useAuth: () => ({
      user: {
        uid: 'test-user',
        email: 'test@example.com',
        displayName: 'Test User',
      },
      profile: {
        alias: 'Test User',
        fullName: 'Test User',
      },
      loading: false,
      profileLoading: false,
      authorized: null,
      signOut: vi.fn(),
    }),
  }
})

describe('Board page', () => {
  beforeEach(() => {
    localStorage.clear()
    resetTablesForTests()
  })

  it('allows joining a table and hides it when filtering joined games', async () => {
    const user = userEvent.setup()
    render(<Board />)

    const reviveHeading = await screen.findByRole('heading', { name: 'Revive' })
    const reviveCard = reviveHeading.closest('article')
    expect(reviveCard).not.toBeNull()
    const joinButton = within(reviveCard as HTMLElement).getByRole('button', { name: /Apuntarme/i })
    await user.click(joinButton)

    await screen.findByText('Revive: plaza reservada')

    await user.click(screen.getByRole('button', { name: /Gestionar filtros/i }))
    const hideJoinedCheckbox = await screen.findByLabelText('Ocultar mesas donde ya estás apuntado')
    await user.click(hideJoinedCheckbox)

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Revive' })).toBeNull()
    })
  })

  it('shows a validation message when description is missing', async () => {
    const user = userEvent.setup()
    render(<Board />)

    await screen.findByRole('heading', { name: 'Earth' })

    await user.click(screen.getByRole('button', { name: /Publicar anuncio/i }))

    const gameInput = screen.getByPlaceholderText('Nombre del juego')
    await user.type(gameInput, 'Heat: Pedal to the Metal')

    const submitButton = screen.getByRole('button', { name: 'Publicar mesa' })
    await user.click(submitButton)

    const errorMessage = await screen.findByText(
      'Describe la mesa para que otras personas sepan qué esperar.',
    )
    expect(errorMessage).toBeInTheDocument()
  })

  it('creates a table and reserves a seat for the current user', async () => {
    const user = userEvent.setup()
    render(<Board />)

    await screen.findByRole('heading', { name: 'Earth' })

    await user.click(screen.getByRole('button', { name: /Publicar anuncio/i }))

    await user.type(screen.getByPlaceholderText('Nombre del juego'), 'Heat: Pedal to the Metal')
    await user.clear(screen.getByPlaceholderText('Tu nombre o alias'))
    await user.type(screen.getByPlaceholderText('Tu nombre o alias'), 'Nerea')
    await user.type(screen.getByPlaceholderText('Sala o ubicación'), 'Sala Roja')
    await user.type(
      screen.getByPlaceholderText('Añade detalles relevantes: nivel, módulos, si explicas reglas...'),
      'Carrera rápida con explicación inicial.',
    )

    await user.click(screen.getByRole('button', { name: 'Publicar mesa' }))

    await screen.findByText('Mesa publicada y plaza reservada para ti.')

    const newTableHeading = await screen.findByRole('heading', { name: 'Heat: Pedal to the Metal' })
    const newTableCard = newTableHeading.closest('article')
    expect(newTableCard).not.toBeNull()

    const joinedButton = await within(newTableCard as HTMLElement).findByRole('button', { name: 'Apuntado' })
    expect(joinedButton).toBeDisabled()
  })
})
