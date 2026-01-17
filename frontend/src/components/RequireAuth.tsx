import type { JSX } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: JSX.Element }) {
  const location = useLocation()
  const { user, loading } = useAuth()

  // Temporarily disabled automatic sign out to prevent auth loops
  // useEffect(() => {
  //   if (!loading && !authorizedLoading && user && (!authorized || authorized.status === 'revoked')) {
  //     signOut().catch(() => undefined)
  //   }
  // }, [authorized, authorizedLoading, loading, signOut, user])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-text-secondary">
        Cargando sesión...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/acceso" replace state={{ from: location.pathname }} />
  }

  // Temporarily allow access even if not authorized to prevent auth loops
  // if (!authorized || authorized.status === 'revoked') {
  //   return <Navigate to="/acceso" replace state={{ reason: 'unauthorized', email: user.email ?? null }} />
  // }

  return children
}

