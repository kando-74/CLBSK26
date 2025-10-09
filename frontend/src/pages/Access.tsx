import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type AuthError as FirebaseAuthError,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { ArrowLeft, Loader2, LogOut, ShieldAlert, ShieldCheck, UserRound } from 'lucide-react'
import { auth, db } from '../utils/firebase'
import { useAuth } from '../components/AuthProvider'

type LanguageOption = 'es' | 'en'

export function Access() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading, profile, profileLoading, authorized, authorizedLoading } = useAuth()

  const [googleError, setGoogleError] = useState<string | null>(null)
  const [redirectHandled, setRedirectHandled] = useState(false)
  const [googleTriggered, setGoogleTriggered] = useState(false)

  const [alias, setAlias] = useState('')
  const [fullName, setFullName] = useState('')
  const [language, setLanguage] = useState<LanguageOption>('es')
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [prefilled, setPrefilled] = useState(false)

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: string } | undefined
    return state?.from ?? '/'
  }, [location.state])

  const profileComplete = Boolean(profile?.alias && profile?.consentAt)
  const profileRole = profile?.role ?? null
  const hasWhitelistEntry = Boolean(authorized)
  const whitelistStatus = authorized?.status ?? null
  const isOrgRole =
    profileRole === 'organizacion' ||
    profileRole === 'staff' ||
    profileRole === 'admin' ||
    profileRole === 'organización'
  const isApproved =
    whitelistStatus === 'approved' ||
    (hasWhitelistEntry && whitelistStatus !== 'revoked' && whitelistStatus !== 'pending') ||
    isOrgRole
  const isPending = whitelistStatus === 'pending' && !isOrgRole
  const isRevoked = whitelistStatus === 'revoked'
  const isUnauthorized =
    Boolean(user) && !authorizedLoading && !profileLoading && ((!isApproved && !isPending) || isRevoked)

  const startGoogleSignIn = useCallback(
    async (forceSelect = false) => {
      try {
        setGoogleError(null)
        setGoogleTriggered(true)
        const provider = new GoogleAuthProvider()
        if (forceSelect) {
          provider.setCustomParameters({ prompt: 'select_account' })
        }
        await signInWithRedirect(auth, provider)
      } catch (error) {
        console.error('Google sign-in failed', error)
        setGoogleError(mapGoogleSignInError(error))
      }
    },
    [],
  )

  useEffect(() => {
    if (redirectHandled) {
      return
    }

    getRedirectResult(auth)
      .then(() => {
        setRedirectHandled(true)
      })
      .catch((error) => {
        if (isFirebaseAuthError(error) && error.code === 'auth/no-auth-event') {
          setRedirectHandled(true)
          return
        }
        console.error('Google redirect error', error)
        setGoogleError(mapGoogleSignInError(error))
        setRedirectHandled(true)
      })
  }, [redirectHandled])

  useEffect(() => {
    if (!loading && !user && !googleTriggered) {
      void startGoogleSignIn()
    }
  }, [loading, user, googleTriggered, startGoogleSignIn])

  useEffect(() => {
    if (
      !user ||
      loading ||
      profileLoading ||
      authorizedLoading ||
      !isApproved ||
      !profileComplete
    ) {
      return
    }

    navigate(redirectTo, { replace: true })
  }, [
    authorizedLoading,
    isApproved,
    loading,
    navigate,
    profileComplete,
    profileLoading,
    redirectTo,
    user,
  ])

  useEffect(() => {
    if (!user) {
      setPrefilled(false)
      setAlias('')
      setFullName('')
      setConsent(false)
      return
    }

    if (profileLoading || profileComplete || prefilled) {
      return
    }

    const suggestedAlias =
      profile?.alias ??
      authorized?.displayName ??
      user.displayName ??
      user.email?.split('@')[0] ??
      ''

    setAlias((current) => current || suggestedAlias)
    setFullName(profile?.fullName ?? user.displayName ?? '')
    setLanguage((profile?.language as LanguageOption | undefined) ?? 'es')
    setConsent(Boolean(profile?.consentAt))
    setPrefilled(true)
  }, [
    authorized?.displayName,
    prefilled,
    profile?.alias,
    profile?.consentAt,
    profile?.fullName,
    profile?.language,
    profileComplete,
    profileLoading,
    user,
  ])

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || saving) {
      return
    }

    if (!alias.trim()) {
      setSaveError('Indica un alias para que podamos mostrarte en las listas.')
      return
    }

    if (!consent) {
      setSaveError('Debes aceptar el tratamiento de datos para continuar.')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const profileRef = doc(db, 'users', user.uid)
      const preferences = {
        notifications: profile?.preferences?.notifications ?? false,
        darkMode: profile?.preferences?.darkMode ?? false,
        availableToPlay: profile?.preferences?.availableToPlay ?? false,
      }

      await setDoc(
        profileRef,
        {
          alias: alias.trim(),
          fullName: fullName.trim() || null,
          language,
          bio: profile?.bio ?? null,
          consentAt: profile?.consentAt ?? serverTimestamp(),
          preferences,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } catch (error) {
      console.error('Failed to save onboarding profile', error)
      setSaveError('No se pudo guardar tu perfil. IntÃ©ntalo de nuevo en unos segundos.')
    } finally {
      setSaving(false)
    }
  }

  const handleSwitchAccount = async () => {
    setGoogleError(null)
    setPrefilled(false)
    setAlias('')
    setFullName('')
    setConsent(false)
    try {
      await firebaseSignOut(auth)
    } catch (error) {
      console.error('Error while signing out', error)
    } finally {
      setGoogleTriggered(false)
      void startGoogleSignIn(true)
    }
  }

  const showProfileForm =
    Boolean(user) &&
    !profileLoading &&
    !authorizedLoading &&
    isApproved &&
    !profileComplete

  const showPending = Boolean(user) && !authorizedLoading && !profileLoading && isPending

  const showLoadingState =
    loading ||
    profileLoading ||
    authorizedLoading ||
    (user && !isApproved && !isPending && !isUnauthorized && !isRevoked)

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col px-4 py-10 sm:px-8">
        <header className="mb-8 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          {user ? (
            <button
              onClick={handleSwitchAccount}
              className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <LogOut className="h-4 w-4" />
              Cambiar de cuenta
            </button>
          ) : null}
        </header>

        <main className="flex-1">
          <div className="card space-y-6 p-6">
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-text-primary">Acceso al evento</h1>
              <p className="text-sm text-text-secondary">
                Usamos tu cuenta de Google para validar la invitaciÃ³n y entrar directamente sin contraseÃ±as adicionales.
              </p>
            </div>

            {googleError ? (
              <div className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
                {googleError}
              </div>
            ) : null}

            {!user ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div>
                  <p className="font-semibold text-text-primary">Conectando con tu cuenta de Googleâ€¦</p>
                  <p className="text-sm text-text-secondary">
                    AsegÃºrate de tener una sesiÃ³n activa en tu dispositivo. Si no aparece la selecciÃ³n de cuenta, toca el botÃ³n para reintentar.
                  </p>
                </div>
                <button
                  onClick={() => void startGoogleSignIn(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
                >
                  Reintentar con Google
                </button>
              </div>
            ) : null}

            {isUnauthorized ? (
              <div className="space-y-3 rounded-2xl border border-error/30 bg-error/10 p-5 text-sm text-error">
                <div className="flex items-center gap-2 text-base font-semibold text-error">
                  <ShieldAlert className="h-5 w-5" />
                  Acceso no autorizado
                </div>
                <p>
                  El correo {user?.email ?? 'desconocido'} no estÃ¡ en la lista de invitaciones del evento. Si crees que es un error,
                  contacta con la organizaciÃ³n para habilitar tu acceso.
                </p>
                <button
                  onClick={handleSwitchAccount}
                  className="inline-flex items-center gap-2 rounded-full border border-error/40 px-4 py-2 text-xs font-semibold text-error transition-colors hover:bg-error/10"
                >
                  <LogOut className="h-4 w-4" />
                  Probar con otra cuenta
                </button>
              </div>
            ) : null}

            {showPending ? (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                <div className="flex items-center gap-2 text-base font-semibold text-amber-900">
                  <ShieldCheck className="h-5 w-5" />
                  InvitaciÃ³n en revisiÃ³n
                </div>
                <p>
                  Hemos encontrado tu correo ({user?.email ?? 'desconocido'}) pero todavÃ­a estÃ¡ pendiente de aprobaciÃ³n. RecibirÃ¡s
                  un aviso cuando la organizaciÃ³n confirme tu acceso.
                </p>
                <p className="text-xs text-amber-800">
                  Si necesitas entrar con urgencia, avisa al equipo de organizaciÃ³n para que validen tu invitaciÃ³n.
                </p>
              </div>
            ) : null}

            {showProfileForm ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Ãšltimo paso: configura tu perfil</h2>
                  <p className="text-sm text-text-secondary">
                    Usaremos estos datos para mostrarte en las mesas, rankings y listados del congreso. Puedes cambiarlos mÃ¡s adelante.
                  </p>
                </div>

                <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
                  <span className="text-xs uppercase tracking-wide">Alias visible</span>
                  <input
                    value={alias}
                    onChange={(event) => setAlias(event.currentTarget.value)}
                    className="w-full bg-transparent text-base text-text-primary outline-none"
                    placeholder="CÃ³mo quieres que te vean en la app"
                    required
                    minLength={2}
                  />
                </label>

                <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
                  <span className="text-xs uppercase tracking-wide">Nombre completo (opcional)</span>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.currentTarget.value)}
                    className="w-full bg-transparent text-base text-text-primary outline-none"
                    placeholder="Nombre y apellidos"
                  />
                </label>

                <label className="flex flex-col gap-2 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
                  <span className="text-xs uppercase tracking-wide">Idioma preferido</span>
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.currentTarget.value as LanguageOption)}
                    className="w-full bg-transparent text-base text-text-primary outline-none"
                  >
                    <option value="es">EspaÃ±ol</option>
                    <option value="en">InglÃ©s</option>
                  </select>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.currentTarget.checked)}
                    className="mt-1"
                    required
                  />
                  <span>
                    Acepto el tratamiento de mis datos personales para gestionar mi participaciÃ³n en el congreso, segÃºn la polÃ­tica de privacidad del evento.
                  </span>
                </label>

                {saveError ? <p className="rounded-xl bg-error/10 px-3 py-2 text-sm text-error">{saveError}</p> : null}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/60"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Guardando perfil...
                      </>
                    ) : (
                      <>
                        Finalizar y entrar
                        <UserRound className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-background"
                  >
                    Usar otra cuenta
                  </button>
                </div>
              </form>
            ) : null}

            {user && isApproved && profileComplete ? (
              <div className="flex flex-col items-center gap-3 text-center text-text-secondary">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p>Preparando tu experiencia...</p>
              </div>
            ) : null}

            {showLoadingState && !showProfileForm && !isUnauthorized && !showPending && user ? (
              <div className="flex flex-col items-center gap-3 text-center text-text-secondary">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p>Validando tu invitaciÃ³n...</p>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}

type AuthErrorLike = {
  code: string
  message: string
}

function isFirebaseAuthError(error: unknown): error is AuthErrorLike {
  return Boolean(error && typeof error === 'object' && 'code' in error && 'message' in error)
}

function mapGoogleSignInError(error: unknown): string {
  if (isFirebaseAuthError(error)) {
    const firebaseError = error as FirebaseAuthError
    switch (firebaseError.code) {
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Parece que se cerrÃ³ la ventana de Google antes de completar el inicio de sesiÃ³n. IntÃ©ntalo de nuevo.'
      case 'auth/network-request-failed':
        return 'No se pudo conectar con Google. Comprueba tu conexiÃ³n y vuelve a intentarlo.'
      case 'auth/unauthorized-domain':
        return 'Este dominio no estÃ¡ autorizado para iniciar sesiÃ³n con Google. Contacta con la organizaciÃ³n.'
      case 'auth/account-exists-with-different-credential':
        return 'Ya existe una cuenta asociada a este correo con un proveedor diferente. Usa la cuenta original o contacta con soporte.'
      default:
        return firebaseError.message || 'No se pudo iniciar sesiÃ³n con Google.'
    }
  }

  return 'No se pudo iniciar sesiÃ³n con Google. IntÃ©ntalo de nuevo en unos instantes.'
}

