import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './components/AuthProvider'
import { LiveEventsProvider } from './components/LiveEventsProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <LiveEventsProvider>
        <App />
      </LiveEventsProvider>
    </AuthProvider>
  </StrictMode>,
)
