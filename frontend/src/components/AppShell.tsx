import { Link, Outlet, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  CalendarDays,
  Home as HomeIcon,
  LibraryBig,
  Megaphone,
  PlusCircle,
  UserCircle2,
} from 'lucide-react'
import { LiveEventToasts } from './LiveEventToasts'

const navItems = [
  { label: 'Home', to: '/', icon: HomeIcon },
  { label: 'Ludoteca', to: '/ludoteca', icon: LibraryBig },
  { label: 'Registrar', to: '/registrar', icon: PlusCircle, isFab: true },
  { label: 'Tablón', to: '/tablon', icon: Megaphone },
  { label: 'Perfil', to: '/perfil', icon: UserCircle2 },
]

export function AppShell() {
  const location = useLocation()

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
              {navItems.map(({ to, label, icon: Icon, isFab }) => (
                <Link
                  key={to}
                  to={to}
                  className={clsx(
                    'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    isFab
                      ? 'bg-primary text-white shadow-card hover:bg-primary/90'
                      : 'text-text-secondary hover:bg-primary/10',
                    location.pathname === to && !isFab && 'bg-primary/10 text-primary',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 rounded-full bg-secondary/20 px-3 py-1 text-sm font-medium text-secondary">
                <CalendarDays className="h-4 w-4" />
                Día actual
              </span>
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
          <ul className="relative flex items-center justify-between">
            {navItems.map(({ to, label, icon: Icon, isFab }) => {
              const isActive = location.pathname === to
              if (isFab) {
                return (
                  <li key={to} className="absolute left-1/2 -translate-x-1/2">
                    <Link
                      to={to}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-card transition-transform duration-200 hover:-translate-y-1"
                      aria-label={label}
                    >
                      <Icon className="h-7 w-7" />
                    </Link>
                  </li>
                )
              }

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
