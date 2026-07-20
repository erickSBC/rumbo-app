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

/**
 * Valor centinela de "sin tope" en la colección `planes`. OJO: es solo una
 * decisión de PRESENTACIÓN — el backend sigue leyendo y aplicando el 9999 real
 * como límite; aquí únicamente se muestra como "Ilimitado".
 */
const LIMITE_SIN_TOPE = 9999;

/** "5" | "Ilimitado" — para la tabla comparativa. */
function limite(valor: number): string {
  return valor >= LIMITE_SIN_TOPE ? "Ilimitado" : valor.toLocaleString("es-PE");
}

/** "Hasta 5 buses" | "Buses ilimitados" — para las tarjetas. */
function limiteFrase(valor: number, sustantivo: string): string {
  if (valor >= LIMITE_SIN_TOPE) {
    return `${sustantivo[0].toUpperCase()}${sustantivo.slice(1)} ilimitados`;
  }
  return `Hasta ${valor.toLocaleString("es-PE")} ${sustantivo}`;
}

/**
 * Características de cada plan. Lo que varía entre planes sale de los datos
 * (límites y los flags `encomiendas` / `asistenteIA`); el resto es común a
 * todos y corresponde a funcionalidades que el sistema realmente tiene.
 */
function caracteristicas(plan: Plan): { texto: string; incluido: boolean }[] {
  return [
    { texto: limiteFrase(plan.maxBuses, "buses"), incluido: true },
    { texto: limiteFrase(plan.maxUsuarios, "usuarios"), incluido: true },
    { texto: "Rutas y salidas ilimitadas", incluido: true },
    { texto: "Mapa de asientos en tiempo real", incluido: true },
    { texto: "Venta con bloqueo anti-doble venta", incluido: true },
    { texto: "Manifiesto electrónico imprimible", incluido: true },
    { texto: "Reporte de ventas del día", incluido: true },
    { texto: "Roles de administrador y vendedor", incluido: true },
    { texto: "Módulo de encomiendas con guías", incluido: plan.encomiendas },
    { texto: "Asistente con inteligencia artificial", incluido: plan.asistenteIA },
  ];
}

/** Filas de la tabla comparativa (booleano → ✓/—, texto → se imprime). */
const COMPARATIVA: { etiqueta: string; valor: (p: Plan) => boolean | string }[] = [
  { etiqueta: "Buses", valor: (p) => limite(p.maxBuses) },
  { etiqueta: "Usuarios", valor: (p) => limite(p.maxUsuarios) },
  { etiqueta: "Rutas y salidas", valor: () => "Ilimitadas" },
  { etiqueta: "Mapa de asientos en tiempo real", valor: () => true },
  { etiqueta: "Bloqueo anti-doble venta", valor: () => true },
  { etiqueta: "Manifiesto electrónico", valor: () => true },
  { etiqueta: "Reporte de ventas del día", valor: () => true },
  { etiqueta: "Roles y permisos", valor: () => true },
  { etiqueta: "Módulo de encomiendas", valor: (p) => p.encomiendas },
  { etiqueta: "Asistente con IA", valor: (p) => p.asistenteIA },
];

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

  // Nombres derivados del catálogo: si mañana cambias qué plan incluye qué,
  // el FAQ se actualiza solo (no queda una afirmación falsa escrita a mano).
  const planesCon = (tiene: (p: Plan) => boolean) =>
    planes.filter(tiene).map((p) => p.nombre).join(" y ") || "los planes superiores";

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

                    <ul className="mt-6 space-y-2.5 text-sm">
                      {caracteristicas(plan).map((c) => (
                        <li
                          key={c.texto}
                          className={`flex items-start gap-2 ${
                            c.incluido ? "text-ink-secondary" : "text-ink-muted"
                          }`}
                        >
                          {c.incluido ? <Check /> : <Dash />}
                          <span className={c.incluido ? "" : "line-through decoration-line-strong"}>
                            {c.texto}
                          </span>
                        </li>
                      ))}
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

          {/* Tabla comparativa: la misma fuente de datos que las tarjetas */}
          {planes.length > 0 && (
            <div className="mt-14">
              <h3 className="text-center text-lg font-semibold">Comparación detallada</h3>
              <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Funcionalidad
                      </th>
                      {planes.map((p) => (
                        <th
                          key={p.id}
                          className="p-4 text-center text-xs font-semibold uppercase tracking-wide text-ink-muted"
                        >
                          {p.nombre}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARATIVA.map((fila) => (
                      <tr key={fila.etiqueta} className="border-b border-line last:border-0">
                        <td className="p-4 text-ink-secondary">{fila.etiqueta}</td>
                        {planes.map((p) => {
                          const v = fila.valor(p);
                          return (
                            <td key={p.id} className="p-4 text-center">
                              {typeof v === "string" ? (
                                <span className="font-medium tabular">{v}</span>
                              ) : v ? (
                                <span className="inline-flex justify-center text-primary">
                                  <Check />
                                </span>
                              ) : (
                                <span className="inline-flex justify-center">
                                  <Dash />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Quiénes somos */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Quiénes somos</h2>
            <p className="mt-2 text-2xl font-bold sm:text-3xl">
              Software hecho para el transporte interprovincial peruano
            </p>
            <p className="mt-4 text-ink-secondary leading-relaxed">
              Rumbo nace de un problema concreto: muchas empresas de transporte siguen llevando la
              venta de pasajes en cuadernos y hojas de cálculo. El resultado son asientos vendidos
              dos veces, manifiestos armados a mano contra el reloj y encomiendas anotadas en un
              cuaderno aparte, sin rastro de quién recibió el paquete.
            </p>
            <p className="mt-4 text-ink-secondary leading-relaxed">
              Construimos una herramienta que resuelve exactamente eso: un counter que no puede
              sobrevender, un manifiesto que se imprime en un clic y encomiendas con guía y control
              de entrega. Sin instalaciones y sin cambiar cómo trabaja tu equipo.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Pilar
              titulo="Enfocados en el rubro"
              texto="No es un ERP genérico adaptado: rutas, salidas, asientos, manifiesto y encomiendas son el modelo del producto."
            />
            <Pilar
              titulo="Tus datos, solo tuyos"
              texto="Cada empresa opera aislada. El acceso se valida en el servidor y en la base de datos, no solo en la pantalla."
            />
            <Pilar
              titulo="Sin instalaciones"
              texto="Funciona en el navegador del counter. Sin servidores propios ni mantenimiento de tu lado."
            />
            <Pilar
              titulo="Empiezas hoy"
              texto="Registras tu empresa, cargas tus rutas y buses, y vendes el primer pasaje el mismo día."
            />
          </div>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section className="bg-surface border-y border-line">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Preguntas frecuentes</h2>
            <p className="mt-2 text-2xl font-bold sm:text-3xl">Lo que suelen preguntarnos</p>
          </div>

          <div className="mt-10 divide-y divide-line rounded-2xl border border-line">
            <Faq
              pregunta="¿Necesito tarjeta de crédito para probar?"
              respuesta="No. La prueba dura 14 días y no se solicita tarjeta ni se cobra nada durante ese período."
            />
            <Faq
              pregunta="¿Puedo cambiar de plan más adelante?"
              respuesta="Sí, desde tu panel y cuando quieras; los límites del nuevo plan aplican de inmediato. Si bajas a un plan menor no se borra información: conservas todos tus datos, pero no podrás crear nuevos registros hasta volver por debajo del límite."
            />
            <Faq
              pregunta="¿Los datos de mi empresa están separados de los de otras?"
              respuesta="Sí. Cada empresa opera completamente aislada: toda consulta se filtra por empresa en el servidor y las reglas de la base de datos rechazan cualquier intento de acceso cruzado."
            />
            <Faq
              pregunta="¿Qué pasa si dos vendedores venden el mismo asiento al mismo tiempo?"
              respuesta="No puede ocurrir. Cada venta se confirma dentro de una transacción atómica sobre el asiento: si dos vendedores intentan el mismo asiento a la vez, solo una venta se confirma y la otra recibe un aviso para elegir otro asiento."
            />
            <Faq
              pregunta="¿El manifiesto sirve para SUTRAN/MTC?"
              respuesta="Incluye el contenido mínimo exigido: datos del vehículo, del conductor, la relación de pasajeros con su documento y la declaración de carga con las encomiendas a bordo. Se imprime directamente desde el navegador."
            />
            <Faq
              pregunta="¿En qué planes está el módulo de encomiendas?"
              respuesta={`El módulo de encomiendas —con guía única por envío, despacho por salida y entrega validando el documento de quien recoge— está disponible en ${planesCon((p) => p.encomiendas)}.`}
            />
            <Faq
              pregunta="¿Y el asistente con inteligencia artificial?"
              respuesta={`El asistente, que responde preguntas sobre tu operación en lenguaje natural con los datos reales de tu empresa, es exclusivo del plan ${planesCon((p) => p.asistenteIA)}.`}
            />
            <Faq
              pregunta="¿Emiten comprobantes electrónicos ante SUNAT?"
              respuesta="Todavía no. La facturación electrónica está en la hoja de ruta, pero no forma parte de esta versión."
            />
            <Faq
              pregunta="¿Necesito instalar algo o tener un servidor?"
              respuesta="No. Rumbo funciona en el navegador desde cualquier computadora del counter. Nosotros nos encargamos de la infraestructura, las copias de seguridad y las actualizaciones."
            />
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-canvas to-primary/5" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Lleva tu empresa al siguiente nivel</h2>
          <p className="mt-3 text-ink-secondary max-w-xl mx-auto">
            Prueba Rumbo 14 días con tu operación real: carga tus rutas, vende en el mapa de
            asientos y mira el manifiesto listo. Sin tarjeta, sin compromiso.
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

function Pilar({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-semibold">{titulo}</h3>
      <p className="mt-1.5 text-sm text-ink-secondary leading-relaxed">{texto}</p>
    </div>
  );
}

/** Ítem de FAQ desplegable. Usa <details> nativo: funciona sin JavaScript. */
function Faq({ pregunta, respuesta }: { pregunta: string; respuesta: string }) {
  return (
    <details className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium">
        {pregunta}
        <svg
          className="h-5 w-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.42Z"
            clipRule="evenodd"
          />
        </svg>
      </summary>
      <p className="mt-3 text-sm text-ink-secondary leading-relaxed">{respuesta}</p>
    </details>
  );
}

/** Marca de "no incluido" en el plan. */
function Dash() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M4 10a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z" clipRule="evenodd" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
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
