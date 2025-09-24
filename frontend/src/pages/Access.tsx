import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
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

const AUTHORIZED_EMAILS = [
  'ulises1002048@gmail.com',
  'patricio1002048@gmail.com',
  'tomas1002048@gmail.com',
  'saul1002048@gmail.com',
  'alejandro.martin.millan@gmail.com',
].map((email) => email.toLowerCase())

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

const SUPPORT_EMAIL = 'soporte@juegoscongreso.com'

export function Access() {
  const [currentStep, setCurrentStep] = useState<StepKey>('welcome')
  const [email, setEmail] = useState('ulises1002048@gmail.com')
  const [password, setPassword] = useState('congreso2025')
  const [alias, setAlias] = useState('Ulises')
  const [fullName, setFullName] = useState('')
  const [language, setLanguage] = useState<LanguageOption>('es')
  const [consent, setConsent] = useState(false)
  const [showLoginErrors, setShowLoginErrors] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle')
  const [verificationAttempt, setVerificationAttempt] = useState(0)
  const [profileSaved, setProfileSaved] = useState(false)

  const activeIndex = onboardingSteps.findIndex((step) => step.key === currentStep)
  const activeStep = onboardingSteps[activeIndex]
  const progress = ((activeIndex + 1) / onboardingSteps.length) * 100

  const isEmailValid = useMemo(() => /.+@.+\..+/.test(email), [email])
  const isPasswordValid = password.trim().length >= 8
  const canSubmitLogin = isEmailValid && isPasswordValid
  const isAliasValid = alias.trim().length >= 2
  const canFinishProfile = isAliasValid && consent

  useEffect(() => {
    if (currentStep !== 'verification') {
      return
    }

    setVerificationStatus('checking')
    const normalizedEmail = email.trim().toLowerCase()
    const timeout = setTimeout(() => {
      const isAuthorized = AUTHORIZED_EMAILS.includes(normalizedEmail)
      setVerificationStatus(isAuthorized ? 'success' : 'error')
    }, 1200)

    return () => {
      clearTimeout(timeout)
    }
  }, [currentStep, email, verificationAttempt])

  useEffect(() => {
    if (showLoginErrors && canSubmitLogin) {
      setShowLoginErrors(false)
    }
  }, [showLoginErrors, canSubmitLogin])

  useEffect(() => {
    if (currentStep !== 'profile') {
      setProfileSaved(false)
    }
  }, [currentStep])

  useEffect(() => {
    setProfileSaved(false)
  }, [alias, fullName, language, consent])

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
  }

  const handleBackToLogin = () => {
    setVerificationStatus('idle')
    setCurrentStep('login')
  }

  const handleGoToProfile = () => {
    setCurrentStep('profile')
  }

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canFinishProfile) {
      return
    }

    setProfileSaved(true)
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
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <MailCheck className="h-4 w-4" />
              ¿Necesitas ayuda? Escríbenos
            </a>
          </div>
        </div>
      )
      break
    case 'login':
      mainContent = (
        <form onSubmit={handleLoginSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Correo electrónico</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
                placeholder="usuario@juegoscongreso.com"
                required
              />
            </label>
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
                placeholder="Mínimo 8 caracteres"
                required
              />
            </label>
          </div>
          <p className="text-xs text-text-secondary">
            Por seguridad, evitamos contraseñas comunes. Puedes cambiarla después desde tu perfil.
          </p>
          {showLoginErrors && !canSubmitLogin && (
            <div className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              Revisa el formato del correo e introduce una contraseña con al menos 8 caracteres.
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep('welcome')}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a la bienvenida
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
              disabled={!canSubmitLogin}
            >
              Continuar con whitelist
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      )
      break
    case 'verification':
      mainContent = (
        <div className="space-y-5" aria-live="polite">
          {verificationStatus === 'checking' && (
            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-semibold text-text-primary">Validando whitelist…</p>
                <p>Estamos comprobando que {email} esté autorizado para el evento.</p>
              </div>
            </div>
          )}
          {verificationStatus === 'success' && (
            <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success" role="status">
              <CheckCircle2 className="h-5 w-5" />
              <div>
                <p className="font-semibold text-text-primary">¡Acceso concedido!</p>
                <p className="text-text-secondary">{email} forma parte de la lista autorizada. Puedes completar tu perfil.</p>
              </div>
            </div>
          )}
          {verificationStatus === 'error' && (
            <div className="flex items-start gap-3 rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
              <ShieldAlert className="h-5 w-5" />
              <div>
                <p className="font-semibold text-text-primary">Correo no encontrado</p>
                <p className="text-text-secondary">
                  No localizamos {email} en la whitelist. Verifica que uses el correo invitado o contacta con la organización.
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Cambiar correo
            </button>
            {verificationStatus === 'success' ? (
              <button
                type="button"
                onClick={handleGoToProfile}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90"
              >
                Completar perfil inicial
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRetryVerification}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary px-5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
              >
                Reintentar verificación
              </button>
            )}
          </div>
        </div>
      )
      break
    case 'profile':
      mainContent = (
        <form onSubmit={handleProfileSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Alias visible</span>
              <input
                value={alias}
                onChange={(event) => setAlias(event.target.value)}
                className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
                placeholder="Ej. Alex, MeepleHero…"
                required
              />
            </label>
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Nombre (opcional)</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
                placeholder="Nombre y apellidos"
              />
            </label>
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Idioma preferido</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as LanguageOption)}
                className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="rounded-2xl border border-dashed border-primary/30 px-4 py-3 text-sm text-text-secondary md:col-span-2">
              <span className="text-xs uppercase tracking-wide">Consentimiento RGPD</span>
              <div className="mt-2 flex items-start justify-between gap-4">
                <p className="text-sm text-text-secondary">
                  Autorizo el tratamiento de mis datos personales durante el congreso y comprendo que puedo solicitar la baja en
                  cualquier momento.
                </p>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-1 h-5 w-10 cursor-pointer rounded-full accent-primary"
                />
              </div>
            </label>
          </div>
          {!isAliasValid && (
            <p className="text-xs text-error">El alias debe tener al menos 2 caracteres.</p>
          )}
          {!consent && (
            <p className="text-xs text-text-secondary">
              Debes aceptar el consentimiento para participar y recibir comunicaciones del evento.
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep('verification')}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Revisar whitelist
            </button>
            <button
              type="submit"
              disabled={!canFinishProfile}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
            >
              Guardar y entrar en la app
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {profileSaved && (
            <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success" role="status">
              <CheckCircle2 className="h-5 w-5" />
              <div>
                <p className="font-semibold text-text-primary">Perfil guardado</p>
                <p className="text-text-secondary">
                  ¡Todo listo! Serás redirigido a la Home del evento para comenzar a registrar partidas.
                </p>
                <Link to="/" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                  Ir ahora a la Home
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </form>
      )
      break
    default:
      mainContent = <div />
  }

  let asideContent: JSX.Element
  switch (currentStep) {
    case 'welcome':
      asideContent = (
        <div className="space-y-4 text-sm text-text-secondary">
          <div className="rounded-2xl bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">Horario del día</p>
            <p>07:00 – 06:59. Las estadísticas se agrupan usando esta frontera horaria.</p>
          </div>
          <div className="rounded-2xl bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">Documentación</p>
            <p>Consulta el PRD y las reglas del evento desde tu perfil una vez dentro.</p>
          </div>
        </div>
      )
      break
    case 'login':
      asideContent = (
        <div className="space-y-4 text-sm text-text-secondary">
          <div className="rounded-2xl bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">Correos autorizados</p>
            <ul className="mt-2 space-y-2">
              {AUTHORIZED_EMAILS.slice(0, 3).map((authorized) => (
                <li key={authorized}>• {authorized}</li>
              ))}
              <li>• alejandro.martin.millan@gmail.com (organización)</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">Consejo</p>
            <p>
              Si alguien no aparece en la whitelist, solicita a la organización que lo añada desde el panel administrativo.
            </p>
          </div>
        </div>
      )
      break
    case 'verification':
      asideContent = (
        <div className="space-y-4 text-sm text-text-secondary">
          <div className="rounded-2xl bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">Tiempo estimado</p>
            <p>La comprobación suele tardar menos de 2 segundos gracias al uso de Cloud Functions.</p>
          </div>
          <div className="rounded-2xl bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">Soporte</p>
            <p>
              ¿Error inesperado? Envía un correo a{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>{' '}
              con tu nombre y captura para revisarlo.
            </p>
          </div>
        </div>
      )
      break
    case 'profile':
      asideContent = (
        <div className="space-y-4 text-sm text-text-secondary">
          <div className="rounded-2xl bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">Resumen provisional</p>
            <ul className="mt-2 space-y-2">
              <li className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-primary" />
                <span className="text-text-primary">Alias:</span> {alias || '—'}
              </li>
              <li className="flex items-center gap-2">
                <MailCheck className="h-4 w-4 text-primary" />
                <span className="text-text-primary">Email:</span> {email}
              </li>
              <li>
                <span className="text-text-primary">Idioma:</span> {language === 'es' ? 'Español' : 'English'}
              </li>
              <li>
                <span className="text-text-primary">Consentimiento:</span> {consent ? 'Aceptado' : 'Pendiente'}
              </li>
            </ul>
          </div>
          <div className="rounded-2xl bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">Siguiente paso</p>
            <p>Una vez guardado, accederás a la Home con métricas del día y accesos rápidos.</p>
          </div>
        </div>
      )
      break
    default:
      asideContent = <div />
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10">
        <header className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            Acceso al congreso
          </span>
          <h1 className="text-3xl font-semibold text-text-primary">Completa el onboarding en cuatro pasos</h1>
          <p className="text-sm text-text-secondary">
            Usa tu email autorizado, valida la whitelist y establece tu perfil antes de entrar en la app.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la Home
          </Link>
        </header>

        <div className="card flex-1 space-y-6 p-6 md:p-8">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="text-left md:text-left">
                <p className="text-xs uppercase tracking-wide text-text-secondary">
                  Paso {activeIndex + 1} de {onboardingSteps.length}
                </p>
                <h2 className="text-xl font-semibold text-text-primary">{activeStep.title}</h2>
                <p className="text-sm text-text-secondary">{activeStep.description}</p>
              </div>
              <div className="min-w-[160px]">
                <div className="h-2 rounded-full bg-background">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-right text-xs text-text-secondary">{Math.round(progress)}% completado</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {onboardingSteps.map((step, index) => {
                const isComplete = index < activeIndex
                const isActive = index === activeIndex

                return (
                  <div
                    key={step.key}
                    className={clsx(
                      'rounded-2xl border px-3 py-3 text-left transition-colors',
                      isActive && 'border-primary bg-primary/10 text-primary',
                      isComplete && !isActive && 'border-primary/30 bg-background text-primary',
                      index > activeIndex && 'border-transparent bg-background text-text-secondary',
                    )}
                  >
                    <p className="text-xs uppercase tracking-wide">Paso {index + 1}</p>
                    <p className="text-sm font-semibold">{step.title}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid flex-1 gap-6 md:grid-cols-[1.6fr,1fr]">
            <section className="space-y-5">{mainContent}</section>
            <aside className="rounded-2xl bg-background px-4 py-4">{asideContent}</aside>
          </div>

          <footer className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Soporte del evento</p>
            <p>
              Ante cualquier incidencia durante el acceso, escribe a{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>
              . El equipo responde en menos de 12 horas.
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
