import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import {
  CalendarDays,
  Home as HomeIcon,
  LibraryBig,
  LogOut,
  Megaphone,
  PlusCircle,
  UserCircle2,
  Users,
} from 'lucide-react'
import { LiveEventToasts } from './LiveEventToasts'
import { useAuth } from './AuthProvider'
import { getDisplayName } from '../utils/user'

const navItems = [
  { label: 'Home', to: '/', icon: HomeIcon },
  { label: 'Ludoteca', to: '/ludoteca', icon: LibraryBig },
  { label: 'Registrar', to: '/registrar', icon: PlusCircle },
  { label: 'Tabl\u00f3n', to: '/tablon', icon: Megaphone },
  { label: 'Usuarios', to: '/usuarios', icon: Users },
  { label: 'Perfil', to: '/perfil', icon: UserCircle2 },
]

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, localAlias, authorized, signOut } = useAuth()
  const [switchingAccount, setSwitchingAccount] = useState(false)

  const displayName = useMemo(
    () => getDisplayName(profile, user, localAlias),
    [localAlias, profile, user],
  )
  const emailLabel = user?.email ?? authorized?.displayName ?? 'Sin correo'
  const roleLabel = authorized?.role ?? 'Participante'

  async function handleSwitchAccount() {
    setSwitchingAccount(true)
    try {
      await signOut()
      navigate('/acceso')
    } finally {
      setSwitchingAccount(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <LiveEventToasts />
      <div className="mx-auto flex min-h-screen max-w-screen-xl flex-col">
        <header className="sticky top-0 z-30 hidden bg-background/80 backdrop-blur md:block">
          <div className="flex items-center justify-between border-b border-slate-200 px-8 py-5">
            <div>
              <p className="text-sm text-text-secondary">Evento privado</p>
              <h1 className="text-2xl font-semibold text-text-primary">Congreso Juegos de Mesa</h1>
            </div>
            <nav className="flex gap-2">
              {navItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={clsx(
                    'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    location.pathname === to
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-secondary hover:bg-primary/10',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <div className="hidden text-right md:flex md:flex-col">
                <span className="text-sm font-semibold text-text-primary">{displayName}</span>
                <span className="text-xs text-text-secondary">{emailLabel}</span>
                <span className="text-xs text-text-secondary">{roleLabel}</span>
              </div>
              <span className="flex items-center gap-2 rounded-full bg-secondary/20 px-3 py-1 text-sm font-medium text-secondary">
                <CalendarDays className="h-4 w-4" />
                D\u00eda actual
              </span>
              <button
                type="button"
                onClick={handleSwitchAccount}
                disabled={switchingAccount}
                className="flex items-center gap-2 rounded-full border border-primary/20 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-primary/60"
              >
                <LogOut className="h-4 w-4" />
                {switchingAccount ? 'Cerrando...' : 'Cambiar usuario'}
              </button>
              <Link
                to="/organizacion"
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
              >
                Abrir panel org.
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 md:px-10 md:pb-8">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-surface/95 px-4 pb-4 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
          <div className="mb-2 flex items-center justify-between rounded-xl bg-background px-3 py-2 text-xs">
            <div className="flex flex-col">
              <span className="font-semibold text-text-primary">{displayName}</span>
              <span className="text-[10px] text-text-secondary">{emailLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleSwitchAccount}
              disabled={switchingAccount}
              className="flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-primary/60"
            >
              <LogOut className="h-3 w-3" />
              {switchingAccount ? 'Cerrando...' : 'Cambiar'}
            </button>
          </div>
          <ul className="flex items-center justify-between">
            {navItems.map(({ to, label, icon: Icon }) => {
              const isActive = location.pathname === to
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={clsx(
                      'flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-xs font-medium transition-colors',
                      isActive ? 'text-primary' : 'text-text-secondary hover:text-primary',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </div>
  )
}

