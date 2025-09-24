import { Languages, LogOut, ShieldCheck, UserCog } from 'lucide-react'

export function Profile() {
  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="section-title">Tu perfil</h2>
          <p className="text-sm text-text-secondary">Gestiona datos personales, preferencias y accesos especiales.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-error/10">
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </header>

      <section className="grid gap-6 md:grid-cols-[1.5fr,1fr]">
        <div className="card space-y-5 p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 text-2xl font-semibold text-primary flex items-center justify-center">
              AL
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Alejandro Martín</h3>
              <p className="text-sm text-text-secondary">alejandro.martin.millan@gmail.com</p>
              <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-secondary/20 px-3 py-1 text-xs font-semibold text-secondary">
                <ShieldCheck className="h-4 w-4" />
                Organización
              </span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Alias visible</span>
              <input className="mt-1 w-full bg-transparent text-base text-text-primary outline-none" defaultValue="Alex M." />
            </label>
            <label className="rounded-2xl border border-primary/20 px-4 py-3 text-sm text-text-secondary">
              <span className="text-xs uppercase tracking-wide">Idioma preferido</span>
              <div className="mt-1 flex items-center gap-2">
                <Languages className="h-4 w-4 text-text-secondary" />
                <select className="w-full bg-transparent text-base text-text-primary outline-none">
                  <option>Español</option>
                  <option>English</option>
                </select>
              </div>
            </label>
            <label className="rounded-2xl border border-dashed border-primary/40 px-4 py-3 text-sm text-text-secondary md:col-span-2">
              <span className="text-xs uppercase tracking-wide">Bio</span>
              <textarea
                className="mt-1 h-20 w-full resize-none bg-transparent text-sm text-text-secondary outline-none"
                placeholder="Cuéntale a la comunidad qué juegos te apasionan"
              />
            </label>
          </div>
        </div>

        <aside className="card space-y-4 p-6">
          <h3 className="text-lg font-semibold text-text-primary">Preferencias</h3>
          <div className="space-y-3 text-sm text-text-secondary">
            <label className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
              <div>
                <p className="font-semibold text-text-primary">Notificaciones push</p>
                <p>Chat de partidas, tablón y recordatorios de agenda.</p>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-10 cursor-pointer rounded-full accent-primary" />
            </label>
            <label className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
              <div>
                <p className="font-semibold text-text-primary">Modo oscuro automático</p>
                <p>Se adapta al sistema de tu dispositivo.</p>
              </div>
              <input type="checkbox" className="h-5 w-10 cursor-pointer rounded-full accent-primary" />
            </label>
            <label className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
              <div>
                <p className="font-semibold text-text-primary">Mostrarme disponible</p>
                <p>Aparecerás en el tablón como persona abierta a nuevas partidas.</p>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-10 cursor-pointer rounded-full accent-primary" />
            </label>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Centro de soporte</p>
            <p>¿Dudas sobre privacidad o baja del evento? Escríbenos a soporte@juegoscongreso.com</p>
          </div>
        </aside>
      </section>

      <section className="card space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Panel de organización</h3>
          <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-primary/90">
            <UserCog className="h-4 w-4" />
            Abrir dashboard
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Asistentes activos</p>
            <p className="text-2xl font-semibold text-text-primary">86</p>
          </div>
          <div className="rounded-2xl bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Partidas hoy</p>
            <p className="text-2xl font-semibold text-text-primary">22</p>
          </div>
          <div className="rounded-2xl bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-text-secondary">Duplicados pendientes</p>
            <p className="text-2xl font-semibold text-text-primary">3</p>
          </div>
        </div>
      </section>
    </div>
  )
}
