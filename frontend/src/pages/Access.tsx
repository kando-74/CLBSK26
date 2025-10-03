import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { type AuthError as FirebaseAuthError } from 'firebase/auth'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, type DocumentData } from 'firebase/firestore'
import { auth, db } from '../utils/firebase'
import { useAuth } from '../components/AuthProvider'
import type { WhitelistStatus } from '../services/whitelist'

const onboardingSteps = [
  {
    key: 'welcome',
    title: 'Bienvenida',
    description: 'Descubre cómo funciona el evento privado antes de iniciar sesión.',
  },
  {
    key: 'login',
    title: 'Acceso seguro',
    description: 'Introduce tu correo autorizado y una contraseña válida.',
  },
  {
    key: 'verification',
    title: 'Verificación whitelist',
    description: 'Comprobamos que perteneces al listado aprobado por la organización.',
  },
  {
    key: 'profile',
    title: 'Perfil inicial',
    description: 'Define alias, idioma y consentimiento antes de entrar a la app.',
  },
] as const

type StepKey = (typeof onboardingSteps)[number]['key']
type LanguageOption = 'es' | 'en'

type VerificationStatus = 'idle' | 'checking' | 'success' | 'error'

type AuthorizedEntry = {
  email: string
  role?: string
  displayName?: string
  status?: WhitelistStatus
}

const SUPPORT_EMAIL = 'soporte@juegoscongreso.com'

export function Access() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [currentStep, setCurrentStep] = useState<StepKey>('welcome')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [alias, setAlias] = useState('')
  const [fullName, setFullName] = useState('')
  const [language, setLanguage] = useState<LanguageOption>('es')
  const [consent, setConsent] = useState(false)
  const [showLoginErrors, setShowLoginErrors] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle')
  const [verificationAttempt, setVerificationAttempt] = useState(0)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [profileSaved, setProfileSaved] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [authorizedEntry, setAuthorizedEntry] = useState<AuthorizedEntry | null>(null)
  const [profilePrefilled, setProfilePrefilled] = useState(false)
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resetError, setResetError] = useState<string | null>(null)

  const activeIndex = onboardingSteps.findIndex((step) => step.key === currentStep)
  const activeStep = onboardingSteps[activeIndex]
  const progress = ((activeIndex + 1) / onboardingSteps.length) * 100

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])
  const isEmailValid = useMemo(() => /.+@.+\..+/.test(email), [email])
  const isPasswordValid = password.trim().length >= 8
  const canSubmitLogin = isEmailValid && isPasswordValid
  const isAliasValid = alias.trim().length >= 2
  const canFinishProfile = isAliasValid && consent && !savingProfile

  useEffect(() => {
    if (user?.email && currentStep === 'welcome') {
      setEmail(user.email)
      setCurrentStep('profile')
    }
  }, [currentStep, user])

  useEffect(() => {
    if (currentStep !== 'verification') {
      return
    }

    let cancelled = false

    async function verifyWhitelist() {
      setVerificationStatus('checking')
      setVerificationError(null)

      try {
        if (!canSubmitLogin) {
          throw new Error('Revisa el correo y la contraseña antes de continuar.')
        }

        const whitelistRef = doc(db, 'authorizedEmails', normalizedEmail)
        const whitelistSnap = await getDoc(whitelistRef)

        if (!whitelistSnap.exists()) {
          throw new Error('Tu correo no forma parte de la whitelist habilitada para el evento.')
        }

        const whitelistData = whitelistSnap.data()
        const entry = mapAuthorizedEntry(normalizedEmail, whitelistData)

        if (!cancelled) {
          setAuthorizedEntry(entry)
        }

        if (entry.status === 'revoked') {
          throw new Error('Tu acceso ha sido revocado por la organización. Si crees que es un error, contacta con el equipo.')
        }

        if (entry.status === 'pending') {
          throw new Error('Tu invitación todavía está pendiente de aprobación. Vuelve a intentarlo cuando la organización la active.')
        }

        // 2. Si está autorizado, intentar el login o crear el usuario
        let currentUser = auth.currentUser
        const isDifferentUser = currentUser?.email?.toLowerCase() !== normalizedEmail

        if (!currentUser || isDifferentUser) {
          try {
            const { user: signedUser } = await signInWithEmailAndPassword(auth, normalizedEmail, password)
            currentUser = signedUser
          } catch (error) {
            const mapped = mapAuthError(error)
            if (mapped.code === 'auth/user-not-found') {
              const { user: createdUser } = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
              currentUser = createdUser
            } else {
              throw new Error(mapped.message)
            }
          }
        }

        if (!currentUser) {
          throw new Error('No se pudo establecer tu sesión. Intenta de nuevo en unos segundos.')
        }

        const profileRef = doc(db, 'users', currentUser.uid)
        const profileSnap = await getDoc(profileRef)

        if (!cancelled) {
          if (profileSnap.exists()) {
            const data = profileSnap.data()
            setAlias((prev) => prev || data.alias || entry.displayName || normalizedEmail.split('@')[0])
            setFullName(data.fullName ?? '')
            setLanguage((data.language as LanguageOption | undefined) ?? 'es')
            setConsent(Boolean(data.consentAt))
          } else {
            setAlias((prev) => prev || entry.displayName || normalizedEmail.split('@')[0])
            setFullName('')
            setConsent(false)
          }

          setProfilePrefilled(false)
          setVerificationStatus('success')
          setCurrentStep('profile')
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        setVerificationStatus('error')
        setVerificationError(error instanceof Error ? error.message : 'No se pudo validar tu acceso. Intenta nuevamente.')
        if (auth.currentUser && auth.currentUser.email?.toLowerCase() !== normalizedEmail) {
          signOut(auth).catch(() => undefined)
        }
      }
    }

    verifyWhitelist()

    return () => {
      cancelled = true
    }
  }, [canSubmitLogin, currentStep, normalizedEmail, password, verificationAttempt])

  useEffect(() => {
    if (showLoginErrors && canSubmitLogin) {
      setShowLoginErrors(false)
    }
  }, [showLoginErrors, canSubmitLogin])

  useEffect(() => {
    setResetStatus('idle')
    setResetError(null)
  }, [normalizedEmail])

  useEffect(() => {
    if (currentStep !== 'profile') {
      setProfileSaved(false)
      setProfilePrefilled(false)
      return
    }

    if (profilePrefilled) {
      return
    }

    if (profile) {
      setAlias((prev) => (prev ? prev : profile.alias ?? authorizedEntry?.displayName ?? normalizedEmail.split('@')[0]))
      setFullName(profile.fullName ?? '')
      setLanguage((profile.language as LanguageOption | undefined) ?? 'es')
      setConsent(Boolean(profile.consentAt))
      setProfilePrefilled(true)
      return
    }

    if (authorizedEntry?.displayName) {
      setAlias((prev) => prev || authorizedEntry.displayName || '')
    } else if (normalizedEmail) {
      setAlias((prev) => prev || normalizedEmail.split('@')[0])
    }

    setProfilePrefilled(true)
  }, [authorizedEntry, currentStep, normalizedEmail, profile, profilePrefilled])

  useEffect(() => {
    setProfileSaved(false)
  }, [alias, fullName, language, consent])

  async function handlePasswordReset() {
    if (!isEmailValid) {
      setShowLoginErrors(true)
      setResetStatus('error')
      setResetError('Introduce un correo válido antes de solicitar el reinicio de contraseña.')
      return
    }

    try {
      setResetStatus('sending')
      setResetError(null)
      await sendPasswordResetEmail(auth, normalizedEmail)
      setResetStatus('sent')
    } catch (error) {
      const mapped = mapAuthError(error)
      setResetStatus('error')
      if (mapped.code === 'auth/user-not-found') {
        setResetError('Aún no existe una cuenta con este correo. Completa el registro creando tu contraseña.')
      } else {
        setResetError(mapped.message)
      }
    }
  }

  const handleStart = () => {
    setCurrentStep('login')
  }

  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSubmitLogin) {
      setShowLoginErrors(true)
      return
    }

    setCurrentStep('verification')
    setVerificationAttempt((attempt) => attempt + 1)
  }

  const handleRetryVerification = () => {
    setVerificationAttempt((attempt) => attempt + 1)
    setVerificationStatus('idle')
  }

  const handleBackToLogin = () => {
    setVerificationStatus('idle')
    setVerificationError(null)
    signOut(auth).catch(() => undefined)
    setCurrentStep('login')
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canFinishProfile || !auth.currentUser) {
      return
    }

    setSavingProfile(true)
    setSaveError(null)

    try {
      const profileRef = doc(db, 'users', auth.currentUser.uid)
      await setDoc(
        profileRef,
        {
          alias: alias.trim(),
          fullName: fullName.trim() || null,
          language,
          bio: profile?.bio ?? null,
          consentAt: consent ? serverTimestamp() : null,
          role: authorizedEntry?.role ?? profile?.role ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      setProfileSaved(true)
      navigate('/')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el perfil. Vuelve a intentarlo más tarde.')
    } finally {
      setSavingProfile(false)
    }
  }

  let mainContent: JSX.Element
  switch (currentStep) {
    case 'welcome':
      mainContent = (
        <div className="space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm text-text-secondary">
            <p className="text-base font-semibold text-text-primary">Evento privado Congreso Juegos de Mesa</p>
            <p>
              Mantén tus credenciales a mano: solo el personal invitado puede completar el acceso. El proceso dura menos de dos
              minutos.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-text-secondary md:grid-cols-2">
            <div className="rounded-2xl bg-background px-4 py-3">
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Sparkles className="h-4 w-4 text-secondary" />
                Qué podrás hacer
              </p>
              <ul className="space-y-2">
                <li>• Registrar partidas y compartir enlace con tu mesa.</li>
                <li>• Añadir tus juegos a la ludoteca común.</li>
                <li>• Apuntarte a mesas abiertas desde el tablón.</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-background px-4 py-3">
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Antes de empezar
              </p>
              <ul className="space-y-2">
                <li>• Correo autorizado por la organización.</li>
                <li>• Contraseña mínima de 8 caracteres.</li>
                <li>• Alias público para mostrar en las partidas.</li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={handleStart}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
            >
              Comenzar acceso
              <ArrowRight className="h-4 w-4" />
            </button>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              <MailCheck className="h-4 w-4" />
              ¿Necesitas ayuda? Escríbenos
            </a>
          </div>
        </div>
      )
      break
    case 'login':
      mainContent = (
        <form onSubmit={handleLoginSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary">Correo autorizado</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={clsx(
                'w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20',
                showLoginErrors && !isEmailValid ? 'border-error text-error' : 'border-slate-200 text-text-primary',
              )}
              placeholder="tucorreo@organizacion.com"
              autoComplete="email"
              required
            />
            {showLoginErrors && !isEmailValid && <p className="text-sm text-error">Introduce un correo válido.</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={clsx(
                'w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20',
                showLoginErrors && !isPasswordValid ? 'border-error text-error' : 'border-slate-200 text-text-primary',
              )}
              placeholder="Mínimo 8 caracteres"
              autoComplete="current-password"
              required
            />
            {showLoginErrors && !isPasswordValid && (
              <p className="text-sm text-error">La contraseña debe tener al menos 8 caracteres.</p>
            )}
          </div>
          <div className="space-y-1 text-xs text-text-secondary">
            <button
              type="button"
              onClick={handlePasswordReset}
              className="text-xs font-semibold text-primary hover:underline"
              disabled={resetStatus === 'sending'}
            >
              {resetStatus === 'sending' ? 'Enviando enlace de recuperación…' : '¿Olvidaste tu contraseña?'}
            </button>
            {resetStatus === 'sent' && (
              <p className="text-text-secondary">Te enviamos un correo con instrucciones para restablecerla.</p>
            )}
            {resetStatus === 'error' && resetError && <p className="text-error">{resetError}</p>}
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
          >
            Continuar
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-xs text-text-secondary">
            Si todavía no tienes credenciales, solicita el alta a la organización del congreso.
          </p>
        </form>
      )
      break
    case 'verification':
      mainContent = (
        <div className="space-y-6">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm text-text-secondary">
            <p className="flex items-center gap-2 text-base font-semibold text-text-primary">
              {verificationStatus === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-secondary" />
              ) : verificationStatus === 'error' ? (
                <ShieldAlert className="h-5 w-5 text-error" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
              Verificando acceso para <span className="font-mono text-primary">{normalizedEmail}</span>
            </p>
            <p>
              {verificationStatus === 'checking' && 'Consultando la whitelist y tus credenciales en Firebase Auth...'}
              {verificationStatus === 'success' && 'Tu correo está autorizado. Vamos a completar tu perfil inicial.'}
              {verificationStatus === 'error' && verificationError}
            </p>
          </div>
          {verificationStatus === 'error' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={handleRetryVerification}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
              >
                Reintentar
              </button>
              <button
                onClick={handleBackToLogin}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-background"
              >
                <ArrowLeft className="h-4 w-4" />
                Cambiar datos
              </button>
            </div>
          )}
        </div>
      )
      break
    case 'profile':
      mainContent = (
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
            <p className="text-base font-semibold text-text-primary">Datos autorizados</p>
            <p>
              <span className="font-medium text-text-primary">Correo:</span> {normalizedEmail || user?.email || 'Pendiente'}
            </p>
            {authorizedEntry?.role && (
              <p>
                <span className="font-medium text-text-primary">Rol asignado:</span> {authorizedEntry.role}
              </p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Alias visible *</span>
              <input
                className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
                value={alias}
                onChange={(event) => setAlias(event.target.value)}
                minLength={2}
                required
              />
            </label>
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Nombre completo (opcional)</span>
              <input
                className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nombre y apellidos"
              />
            </label>
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Idioma preferido</span>
              <div className="mt-1 flex items-center gap-2">
                <select
                  className="w-full rounded-xl bg-background px-3 py-2 text-base text-text-primary outline-none"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as LanguageOption)}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
            </label>
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Consentimiento *</span>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="h-5 w-5 rounded-md border border-slate-200 text-primary focus:ring-primary"
                  required
                />
                <span>Acepto participar en el evento y que se registren mis partidas durante el congreso.</span>
              </div>
            </label>
          </div>
          {saveError && (
            <p className="rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{saveError}</p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={!canFinishProfile}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors disabled:cursor-not-allowed disabled:bg-primary/60"
            >
              {savingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  Finalizar acceso
                  <CheckCircle2 className="h-4 w-4" />
                </>
              )}
            </button>
            {profileSaved && (
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-background"
              >
                <UserRound className="h-4 w-4" />
                Entrar a la app
              </Link>
            )}
          </div>
        </form>
      )
      break
    default:
      mainContent = <div />
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="mx-auto flex min-h-screen max-w-screen-md flex-col px-4 pb-16 pt-10 sm:px-8">
        <header className="mb-10 space-y-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
            <span className="rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold text-primary">Acceso privado</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Acceso al evento</h1>
            <p className="text-sm text-text-secondary">
              Completa los pasos para verificar tu invitación y activar tu cuenta en la plataforma del congreso.
            </p>
          </div>
          <div className="rounded-full bg-background shadow-card">
            <div className="relative h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="absolute inset-y-0 left-0 w-[var(--progress-width)] bg-primary transition-all"
                style={{ '--progress-width': `${progress}%` } as React.CSSProperties}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-text-secondary">
              {onboardingSteps.map((step, index) => (
                <div key={step.key} className="flex flex-col items-center">
                  <span className={clsx('mb-1 h-2 w-2 rounded-full', index <= activeIndex ? 'bg-primary' : 'bg-slate-300')} />
                  <span>{step.title}</span>
                </div>
              ))}
            </div>
          </div>
        </header>
        <main className="flex-1">
          <div className="card space-y-6 p-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-secondary">Paso actual</p>
              <h2 className="mt-1 text-xl font-semibold text-text-primary">{activeStep.title}</h2>
              <p className="text-sm text-text-secondary">{activeStep.description}</p>
            </div>
            {mainContent}
          </div>
        </main>
      </div>
    </div>
  )
}

function mapAuthorizedEntry(email: string, data: DocumentData | undefined): AuthorizedEntry {
  return {
    email,
    role: data?.role ?? undefined,
    displayName: data?.displayName ?? undefined,
    status: typeof data?.status === 'string' ? (data.status as WhitelistStatus) : undefined,
  }
}

type AuthError = {
  code: string
  message: string
}

function mapAuthError(error: unknown): AuthError {
  if (typeof error === 'object' && error && 'code' in error && 'message' in error) {
    const firebaseError = error as FirebaseAuthError
    switch (firebaseError.code) {
      case 'auth/invalid-email':
        return { code: firebaseError.code, message: 'El formato de correo no es válido.' }
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return { code: firebaseError.code, message: 'La contraseña no es correcta para este usuario.' }
      case 'auth/too-many-requests':
        return {
          code: firebaseError.code,
          message: 'Hemos bloqueado temporalmente tu acceso por múltiples intentos fallidos. Prueba nuevamente en unos minutos.',
        }
      case 'auth/user-disabled':
        return { code: firebaseError.code, message: 'Esta cuenta ha sido deshabilitada. Contacta con la organización.' }
      case 'auth/user-not-found':
        return { code: firebaseError.code, message: 'No encontramos una cuenta activa. Crearemos una nueva para ti.' }
      default:
        return { code: firebaseError.code, message: firebaseError.message }
    }
  }

  return { code: 'unknown', message: 'Ocurrió un error inesperado al validar tus credenciales.' }
}
