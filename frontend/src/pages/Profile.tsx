import { useEffect, useMemo, useState } from 'react'
import { Languages, Loader2, LogOut, ShieldCheck, UserCog, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useAuth } from '../components/AuthProvider'
import { db } from '../utils/firebase'

const SUPPORT_EMAIL = 'soporte@juegoscongreso.com'

type PreferencesState = {
  notifications: boolean
  darkMode: boolean
  availableToPlay: boolean
}

export function Profile() {
  const { user, profile, profileLoading, authorized, signOut } = useAuth()
  const [alias, setAlias] = useState('')
  const [language, setLanguage] = useState<'es' | 'en'>('es')
  const [bio, setBio] = useState('')
  const [preferences, setPreferences] = useState<PreferencesState>({
    notifications: false,
    darkMode: false,
    availableToPlay: false,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!profileLoading) {
      setAlias(profile?.alias ?? '')
      setLanguage((profile?.language as 'es' | 'en' | undefined) ?? 'es')
      setBio(profile?.bio ?? '')
      setPreferences({
        notifications: profile?.preferences?.notifications ?? false,
        darkMode: profile?.preferences?.darkMode ?? false,
        availableToPlay: profile?.preferences?.availableToPlay ?? false,
      })
    }
  }, [profile, profileLoading])

  useEffect(() => {
    if (saveMessage) {
      const timeout = setTimeout(() => setSaveMessage(null), 4000)
      return () => clearTimeout(timeout)
    }
  }, [saveMessage])

  const initials = useMemo(() => {
    if (alias) {
      return alias
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
    }

    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase()
    }

    return '??'
  }, [alias, user?.email])

  const email = user?.email ?? 'Correo no disponible'
  const roleValue = authorized?.role ?? profile?.role ?? null
  const roleLabel = roleValue ? roleValue.charAt(0).toUpperCase() + roleValue.slice(1) : 'Asistente'

  const handlePreferenceChange = (key: keyof PreferencesState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setPreferences((current) => ({ ...current, [key]: event.target.checked }))
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) {
      return
    }

    setSaving(true)
    setSaveError(null)
    setSaveMessage(null)

    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          alias: alias.trim() || null,
          language,
          bio: bio.trim() || null,
          role: roleValue,
          preferences,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      setSaveMessage('Cambios guardados correctamente.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = () => {
    signOut().catch(() => undefined)
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="section-title">Tu perfil</h2>
          <p className="text-sm text-text-secondary">Gestiona datos personales, preferencias y accesos especiales.</p>
        </div>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-error/10"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </header>

      <form onSubmit={handleSave} className="grid gap-6 md:grid-cols-[1.5fr,1fr]">
        <div className="card space-y-5 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-semibold text-primary">
              {initials}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{alias || authorized?.displayName || 'Alias pendiente'}</h3>
              <p className="text-sm text-text-secondary">{email}</p>
              <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-secondary/20 px-3 py-1 text-xs font-semibold text-secondary">
                <ShieldCheck className="h-4 w-4" />
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Alias visible</span>
              <input
                className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
                value={alias}
                onChange={(event) => setAlias(event.target.value)}
                placeholder="Introduce un alias público"
                minLength={2}
                required
              />
            </label>
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Idioma preferido</span>
              <div className="mt-1 flex items-center gap-2">
                <Languages className="h-4 w-4 text-text-secondary" />
                <select
                  className="w-full bg-transparent text-base text-text-primary outline-none"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as 'es' | 'en')}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
            </label>
            <label className="rounded-2xl border border-dashed border-primary/40 px-4 py-3 text-sm text-text-secondary md:col-span-2">
              <span className="text-xs uppercase tracking-wide">Bio</span>
              <textarea
                className="mt-1 h-20 w-full resize-none bg-transparent text-sm text-text-secondary outline-none"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Cuéntale a la comunidad qué juegos te apasionan"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors disabled:cursor-not-allowed disabled:bg-primary/60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Guardar cambios
                </>
              )}
            </button>
            {saveMessage && <p className="text-sm text-text-secondary">{saveMessage}</p>}
          </div>
          {saveError && <p className="rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{saveError}</p>}
        </div>

        <aside className="card space-y-4 p-6">
          <h3 className="text-lg font-semibold text-text-primary">Preferencias</h3>
          <div className="space-y-3 text-sm text-text-secondary">
            <label className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
              <div>
                <p className="font-semibold text-text-primary">Notificaciones push</p>
                <p>Chat de partidas, tablón y recordatorios de agenda.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.notifications}
                onChange={handlePreferenceChange('notifications')}
                className="h-5 w-10 cursor-pointer rounded-full accent-primary"
              />
            </label>
            <label className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
              <div>
                <p className="font-semibold text-text-primary">Modo oscuro automático</p>
                <p>Se adapta al sistema de tu dispositivo.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.darkMode}
                onChange={handlePreferenceChange('darkMode')}
                className="h-5 w-10 cursor-pointer rounded-full accent-primary"
              />
            </label>
            <label className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
              <div>
                <p className="font-semibold text-text-primary">Mostrarme disponible</p>
                <p>Aparecerás en el tablón como persona abierta a nuevas partidas.</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.availableToPlay}
                onChange={handlePreferenceChange('availableToPlay')}
                className="h-5 w-10 cursor-pointer rounded-full accent-primary"
              />
            </label>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Centro de soporte</p>
            <p>
              ¿Dudas sobre privacidad o baja del evento? Escríbenos a{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </aside>
      </form>

      <section className="card space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Panel de organización</h3>
          <Link
            to="/organizacion"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
          >
            <UserCog className="h-4 w-4" />
            Abrir dashboard
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Asistentes activos</p>
            <p className="text-2xl font-semibold text-text-primary">--</p>
          </div>
          <div className="rounded-2xl bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Partidas hoy</p>
            <p className="text-2xl font-semibold text-text-primary">--</p>
          </div>
          <div className="rounded-2xl bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Duplicados pendientes</p>
            <p className="text-2xl font-semibold text-text-primary">--</p>
          </div>
        </div>
      </section>
    </div>
  )
}
