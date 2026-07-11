import Link from "next/link";
import type { Plan } from "@/types/domain";

async function getPlanes(): Promise<Plan[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${apiUrl}/api/planes`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { planes: Plan[] };
    return data.planes ?? [];
  } catch {
    return [];
  }
}

function precioSoles(monto: number): string {
  return `S/ ${monto.toLocaleString("es-PE")}`;
}

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white">
        R
      </span>
      <span className="text-lg font-bold tracking-tight text-ink">Rumbo</span>
    </span>
  );
}

export default async function Home() {
  const planes = await getPlanes();

  return (
    <main className="min-h-screen bg-canvas text-ink">
      {/* Barra superior */}
      <header className="border-b border-line bg-surface/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle hover:text-ink transition"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="hidden sm:inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition"
            >
              Prueba gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero con gradiente decorativo */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-subtle via-canvas to-canvas" />
        <div className="absolute top-10 -right-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-10 -left-20 h-60 w-60 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
          <span className="animate-fade-in-up inline-block rounded-full bg-primary-subtle px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            14 días de prueba gratis · sin tarjeta
          </span>
          <h1 className="animate-fade-in-up-d1 mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            El sistema para tu empresa de{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
              transporte interprovincial
            </span>
          </h1>
          <p className="animate-fade-in-up-d2 mx-auto mt-5 max-w-2xl text-lg text-ink-secondary leading-relaxed">
            Vende pasajes con mapa de asientos en tiempo real, controla tu flota y consulta tu
            operación con inteligencia artificial. Todo en un solo lugar.
          </p>
          <div className="animate-fade-in-up-d3 mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/registro"
              className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover hover:shadow-primary/30 transition-all"
            >
              Empezar prueba gratis
            </Link>
            <Link
              href="#planes"
              className="rounded-xl border border-line-strong px-6 py-3 text-sm font-semibold text-ink hover:bg-subtle transition"
            >
              Ver planes
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-3xl font-bold tabular text-primary">100%</p>
            <p className="mt-1 text-sm text-ink-muted">Tiempo real</p>
          </div>
          <div>
            <p className="text-3xl font-bold tabular text-primary">0</p>
            <p className="mt-1 text-sm text-ink-muted">Doble venta</p>
          </div>
          <div>
            <p className="text-3xl font-bold tabular text-primary">24/7</p>
            <p className="mt-1 text-sm text-ink-muted">Disponibilidad</p>
          </div>
          <div>
            <p className="text-3xl font-bold tabular text-primary">IA</p>
            <p className="mt-1 text-sm text-ink-muted">Asistente integrado</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Funcionalidades</h2>
          <p className="mt-2 text-2xl font-bold sm:text-3xl">Todo lo que necesitas para operar</p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<BusIcon />}
            title="Gestión de flota"
            description="Registra buses, rutas y salidas. Controla la capacidad y disponibilidad de cada unidad."
          />
          <FeatureCard
            icon={<SeatIcon />}
            title="Mapa de asientos"
            description="Venta visual en tiempo real. Anti-doble venta atómica: si dos vendedores eligen el mismo asiento, solo uno gana."
          />
          <FeatureCard
            icon={<ChartIcon />}
            title="Reportes diarios"
            description="Ventas del día, ingresos por ruta y manifiestos de pasajeros listos para imprimir."
          />
          <FeatureCard
            icon={<ShieldIcon />}
            title="Multi-empresa seguro"
            description="Cada empresa ve solo sus datos. Aislamiento total verificado a nivel de base de datos."
          />
          <FeatureCard
            icon={<AIIcon />}
            title="Asistente con IA"
            description="Pregunta sobre tu operación en lenguaje natural. Analiza tendencias y sugiere mejoras."
          />
          <FeatureCard
            icon={<UsersIcon />}
            title="Roles y permisos"
            description="Administradores y vendedores con acceso diferenciado. Control total de quién hace qué."
          />
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="bg-surface border-y border-line">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Precios</h2>
            <p className="mt-2 text-2xl font-bold sm:text-3xl">Elige tu plan</p>
            <p className="mt-2 text-ink-muted">Sin permanencia. Cambia o cancela cuando quieras.</p>
          </div>

          {planes.length === 0 ? (
            <p className="mx-auto mt-8 max-w-md rounded-xl border border-danger-subtle bg-danger-subtle p-4 text-center text-sm text-danger">
              No se pudieron cargar los planes en este momento. Vuelve a intentarlo más tarde.
            </p>
          ) : (
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {planes.map((plan, i) => {
                const destacado = i === 1;
                return (
                  <article
                    key={plan.id}
                    className={`group relative flex flex-col rounded-2xl border bg-surface p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                      destacado
                        ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10"
                        : "border-line hover:border-line-strong"
                    }`}
                  >
                    {destacado && (
                      <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow-sm">
                        Recomendado
                      </span>
                    )}
                    <h3 className="text-lg font-semibold">{plan.nombre}</h3>
                    <p className="mt-3 text-4xl font-bold tabular">
                      {precioSoles(plan.precioMensual)}
                      <span className="text-base font-normal text-ink-muted">/mes</span>
                    </p>
                    <p className="text-sm text-ink-muted">o {precioSoles(plan.precioAnual)} al año</p>

                    <ul className="mt-6 space-y-3 text-sm text-ink-secondary">
                      <li className="flex items-center gap-2">
                        <Check /> Hasta {plan.maxBuses.toLocaleString("es-PE")} buses
                      </li>
                      <li className="flex items-center gap-2">
                        <Check /> Hasta {plan.maxUsuarios.toLocaleString("es-PE")} usuarios
                      </li>
                      <li className="flex items-center gap-2">
                        {plan.asistenteIA ? (
                          <>
                            <Check /> Asistente con inteligencia artificial
                          </>
                        ) : (
                          <span className="text-ink-muted">— Sin asistente IA</span>
                        )}
                      </li>
                    </ul>

                    <Link
                      href={`/registro?plan=${plan.id}`}
                      className={`mt-8 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-all ${
                        destacado
                          ? "bg-primary text-white hover:bg-primary-hover shadow-sm"
                          : "border border-line-strong text-ink hover:bg-subtle hover:border-primary hover:text-primary"
                      }`}
                    >
                      Empezar prueba de 14 días
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-canvas to-primary/5" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Lleva tu empresa al siguiente nivel</h2>
          <p className="mt-3 text-ink-secondary max-w-xl mx-auto">
            Únete a las empresas de transporte que ya gestionan sus operaciones con Rumbo.
            Sin tarjeta, sin compromiso.
          </p>
          <Link
            href="/registro"
            className="mt-8 inline-flex rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover hover:shadow-primary/30 transition-all"
          >
            Crear cuenta gratis
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-ink-muted">
          <span>© {new Date().getFullYear()} Rumbo · Gestión de transporte interprovincial.</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-ink transition">Iniciar sesión</Link>
            <Link href="/registro" className="hover:text-ink transition">Registrarse</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ---- Componentes auxiliares ---- */

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group rounded-2xl border border-line bg-surface p-6 transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-subtle text-primary transition-colors group-hover:bg-primary group-hover:text-white">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-ink-secondary leading-relaxed">{description}</p>
    </div>
  );
}

function Check() {
  return (
    <svg className="h-4 w-4 shrink-0 text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function BusIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 17v2M17 17v2M7 7h0M17 7h0" />
    </svg>
  );
}

function SeatIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 18v-5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v5" />
      <path d="M7 18h10M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" />
      <path d="M4 13H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1M20 13h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function AIIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
      <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
      <circle cx="9" cy="7" r=".5" fill="currentColor" />
      <circle cx="15" cy="7" r=".5" fill="currentColor" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
