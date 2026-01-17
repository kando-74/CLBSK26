import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  CheckCircle2,
  Languages,
  Loader2,
  LogOut,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserCog,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useAuth } from '../components/AuthProvider'
import { db } from '../utils/firebase'
import { deleteAvatarFile, uploadAvatarFile, validateAvatarFile } from '../services/profileAvatar'

const SUPPORT_EMAIL = 'soporte@juegoscongreso.com'

type PreferencesState = {
  notifications: boolean
  darkMode: boolean
  availableToPlay: boolean
  availabilityNote: string
  interestTags: string[]
  radarMode: 'manual' | 'auto'
}

const INTEREST_OPTIONS = [
  { id: 'filler', label: 'Filler' },
  { id: 'party', label: 'Party' },
  { id: 'eurogame', label: 'Eurogame' },
  { id: 'wargame', label: 'Wargame' },
  { id: 'ligero', label: 'Juego ligero' },
]

export function Profile() {
  const { user, profile, profileLoading, authorized, localAlias, updateLocalAlias, signOut } = useAuth()
  const [alias, setAlias] = useState('')
  const [language, setLanguage] = useState<'es' | 'en'>('es')
  const [bio, setBio] = useState('')
  const [preferences, setPreferences] = useState<PreferencesState>({
    notifications: false,
    darkMode: false,
    availableToPlay: false,
    availabilityNote: '',
    interestTags: [],
    radarMode: 'manual',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [localAliasInput, setLocalAliasInput] = useState(localAlias ?? '')
  const [localAliasMessage, setLocalAliasMessage] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!profileLoading && user) {
      setAlias(profile?.alias ?? '')
      setLanguage((profile?.language as 'es' | 'en' | undefined) ?? 'es')
      setBio(profile?.bio ?? '')
      setPreferences({
        notifications: profile?.preferences?.notifications ?? false,
        darkMode: profile?.preferences?.darkMode ?? false,
        availableToPlay: profile?.preferences?.availableToPlay ?? false,
        availabilityNote: profile?.preferences?.availabilityNote ?? '',
        interestTags: profile?.preferences?.interestTags ?? [],
        radarMode: (profile?.preferences?.radarMode as 'manual' | 'auto') ?? 'manual',
      })
    }
  }, [profile, profileLoading, user])

  useEffect(() => {
    setLocalAliasInput(localAlias ?? '')
  }, [localAlias])

  useEffect(() => {
    if (saveMessage) {
      const timeout = setTimeout(() => setSaveMessage(null), 4000)
      return () => clearTimeout(timeout)
    }
  }, [saveMessage])

  useEffect(() => {
    if (localAliasMessage) {
      const timeout = setTimeout(() => setLocalAliasMessage(null), 3000)
      return () => clearTimeout(timeout)
    }
  }, [localAliasMessage])

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null)
      return
    }

    const objectUrl = URL.createObjectURL(avatarFile)
    setAvatarPreview(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [avatarFile])

  useEffect(() => {
    if (!avatarMessage) {
      return
    }

    const timeout = setTimeout(() => setAvatarMessage(null), 4000)
    return () => clearTimeout(timeout)
  }, [avatarMessage])

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
  const currentAvatarUrl = avatarPreview ?? profile?.avatarUrl ?? user?.photoURL ?? null

  const handleAvatarTrigger = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const validationError = validateAvatarFile(file)
    if (validationError) {
      setAvatarError(validationError)
      setAvatarFile(null)
      setAvatarMessage(null)
      event.target.value = ''
      return
    }

    setAvatarFile(file)
    setAvatarError(null)
    setAvatarMessage(null)
    event.target.value = ''
  }

  const handleAvatarUpload = async () => {
    if (!user || !avatarFile) {
      setAvatarError('Selecciona una imagen antes de subirla.')
      return
    }

    setAvatarUploading(true)
    setAvatarError(null)
    setAvatarMessage(null)
    const previousPath = profile?.avatarStoragePath ?? null

    try {
      const result = await uploadAvatarFile(user.uid, avatarFile)
      await setDoc(
        doc(db, 'users', user.uid),
        {
          avatarUrl: result.downloadUrl,
          avatarStoragePath: result.path,
          avatarUpdatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      setAvatarMessage('Foto actualizada correctamente.')
      setAvatarFile(null)

      if (previousPath && previousPath !== result.path) {
        await deleteAvatarFile(previousPath).catch(() => undefined)
      }
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'No se pudo subir la imagen.')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleAvatarRemove = async () => {
    if (!user) {
      return
    }

    setAvatarUploading(true)
    setAvatarError(null)
    setAvatarMessage(null)
    const previousPath = profile?.avatarStoragePath ?? null

    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          avatarUrl: null,
          avatarStoragePath: null,
          avatarUpdatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      setAvatarFile(null)
      setAvatarMessage('Foto eliminada. Mostraremos tus iniciales por ahora.')

      if (previousPath) {
        await deleteAvatarFile(previousPath).catch(() => undefined)
      }
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'No se pudo eliminar la imagen.')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handlePreferenceChange = (key: keyof PreferencesState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setPreferences((current) => ({ ...current, [key]: event.target.checked }))
  }

  const handleInterestToggle = (tagId: string) => {
    setPreferences((prev) => {
      const current = prev.interestTags
      const next = current.includes(tagId)
        ? current.filter((t) => t !== tagId)
        : [...current, tagId]
      return { ...prev, interestTags: next }
    })
  }

  const handleRadarModeChange = (mode: 'manual' | 'auto') => {
    setPreferences((prev) => ({ ...prev, radarMode: mode }))
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

  const handleLocalAliasSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = localAliasInput.trim()
    if (!normalized) {
      setLocalAliasMessage('Introduce un alias antes de guardar.')
      return
    }

    updateLocalAlias(normalized)
    setLocalAliasMessage('Alias guardado para esta sesión local.')
  }

  if (!user) {
    return (
      <div className="space-y-6 pb-10">
        <header className="flex flex-col gap-2">
          <h2 className="section-title">Tu alias en este dispositivo</h2>
          <p className="text-sm text-text-secondary">
            Mientras la autenticación real no esté disponible, define un nombre que identifique tus acciones en la app.
          </p>
        </header>

        <form onSubmit={handleLocalAliasSave} className="card space-y-4 p-6 max-w-xl">
          <label className="flex flex-col gap-2 text-sm text-text-secondary">
            <span className="text-xs uppercase tracking-wide">Alias visible</span>
            <input
              className="rounded-2xl border border-primary/20 px-4 py-3 text-base text-text-primary outline-none"
              value={localAliasInput}
              onChange={(event) => setLocalAliasInput(event.currentTarget.value)}
              placeholder="Introduce un alias público"
              minLength={2}
              required
            />
          </label>
          <p className="text-xs text-text-secondary">
            Guardamos este alias únicamente en tu dispositivo para que aparezca en la ludoteca, el tablón y el chat.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
            >
              Guardar alias local
            </button>
            <button
              type="button"
              onClick={() => {
                setLocalAliasInput('')
                updateLocalAlias('')
                setLocalAliasMessage('Alias local borrado.')
              }}
              className="rounded-full px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
            >
              Borrar
            </button>
          </div>
          {localAliasMessage && <p className="text-sm text-text-secondary">{localAliasMessage}</p>}
        </form>
      </div>
    )
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
          <div className="space-y-3">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-primary/20 bg-primary/5">
                  {currentAvatarUrl ? (
                    <img
                      src={currentAvatarUrl}
                      alt={`Avatar de ${alias || authorized?.displayName || email}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-primary">
                      {initials}
                    </span>
                  )}
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
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
                <button
                  type="button"
                  onClick={handleAvatarTrigger}
                  disabled={avatarUploading}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Camera className="h-4 w-4" />
                  Seleccionar imagen
                </button>
                {avatarFile && (
                  <button
                    type="button"
                    onClick={handleAvatarUpload}
                    disabled={avatarUploading}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
                  >
                    {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {avatarUploading ? 'Subiendo...' : 'Guardar foto'}
                  </button>
                )}
                {currentAvatarUrl && !avatarFile && (
                  <button
                    type="button"
                    onClick={handleAvatarRemove}
                    disabled={avatarUploading}
                    className="inline-flex items-center gap-2 rounded-full border border-error/30 px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar foto
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-text-secondary">
              Formatos admitidos: JPG, PNG, WEBP o AVIF. Tamaño máximo 2 MB.
            </p>
            {avatarFile && (
              <p className="text-xs text-text-secondary">Previsualiza la imagen arriba antes de confirmar.</p>
            )}
            {avatarError && (
              <p className="rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{avatarError}</p>
            )}
            {avatarMessage && (
              <p className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">{avatarMessage}</p>
            )}
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

            <div className="rounded-2xl bg-background px-4 py-3 space-y-3">
              <p className="font-semibold text-text-primary">Modo del Radar</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRadarModeChange('manual')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition-colors ${preferences.radarMode === 'manual' ? 'bg-primary text-white border-primary' : 'bg-surface-elevation-1 text-text-secondary border-primary/10'}`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => handleRadarModeChange('auto')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition-colors ${preferences.radarMode === 'auto' ? 'bg-primary text-white border-primary' : 'bg-surface-elevation-1 text-text-secondary border-primary/10'}`}
                >
                  Siempre listo
                </button>
              </div>
              <p className="text-[10px] text-text-secondary italic">
                {preferences.radarMode === 'auto'
                  ? 'Te pondremos en el radar automáticamente cuando no estés en una partida.'
                  : 'Tú controlas cuándo aparecer en el radar manualmente.'}
              </p>
            </div>

            <div className="rounded-2xl bg-background px-4 py-3 space-y-3">
              <p className="font-semibold text-text-primary">Intereses / Categorías</p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleInterestToggle(opt.id)}
                    className={`py-1.5 px-3 rounded-full border text-xs font-medium transition-colors ${preferences.interestTags.includes(opt.id) ? 'bg-secondary text-white border-secondary' : 'bg-surface-elevation-1 text-text-secondary border-primary/10'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {preferences.availableToPlay && (
              <label className="flex flex-col gap-2 rounded-2xl bg-background px-4 py-3">
                <span className="font-semibold text-text-primary">Nota de disponibilidad</span>
                <textarea
                  value={preferences.availabilityNote}
                  onChange={(e) => {
                    const value = e.target.value
                    setPreferences(prev => ({ ...prev, availabilityNote: value }))
                  }}
                  placeholder="Ej. Busco partida de Ark Nova o Terraforming Mars..."
                  className="h-20 w-full resize-none bg-transparent text-sm text-text-secondary outline-none border-b border-primary/10 focus:border-primary"
                />
              </label>
            )}
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
