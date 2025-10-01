import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './components/AuthProvider'
import { LiveEventsProvider } from './components/LiveEventsProvider'

// Crea una instancia del cliente de React Query
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LiveEventsProvider>
          <App />
        </LiveEventsProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
