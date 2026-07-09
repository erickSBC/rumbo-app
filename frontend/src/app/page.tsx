import Link from "next/link";
import type { Plan } from "@/types/domain";

/**
 * Landing pública (RF-01) — versión Día 1.
 * Lee los tres planes desde el backend (GET /api/planes), que a su vez los lee
 * de la colección `planes` de Firestore: una única fuente de verdad.
 * En días posteriores se enriquece con el registro y la elección de plan (RF-02).
 */

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

export default async function Home() {
  const planes = await getPlanes();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <nav className="mb-8 flex justify-end">
          <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-slate-900">
            Iniciar sesión →
          </Link>
        </nav>

        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Rumbo</h1>
          <p className="mt-3 text-lg text-slate-600">
            Gestión para empresas de transporte interprovincial de pasajeros.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Elige tu plan y empieza con 14 días de prueba gratis, sin tarjeta.
          </p>
        </header>

        {planes.length === 0 ? (
          <p className="mt-16 text-center text-red-600">
            No se pudieron cargar los planes. ¿Está corriendo el backend en{" "}
            <code>{process.env.NEXT_PUBLIC_API_URL}</code>?
          </p>
        ) : (
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {planes.map((plan) => (
              <article
                key={plan.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h2 className="text-xl font-semibold">{plan.nombre}</h2>
                <p className="mt-2 text-3xl font-bold">
                  {precioSoles(plan.precioMensual)}
                  <span className="text-base font-normal text-slate-500">/mes</span>
                </p>
                <p className="text-sm text-slate-500">
                  o {precioSoles(plan.precioAnual)} al año
                </p>

                <ul className="mt-6 space-y-2 text-sm text-slate-700">
                  <li>Hasta {plan.maxBuses.toLocaleString("es-PE")} buses</li>
                  <li>Hasta {plan.maxUsuarios.toLocaleString("es-PE")} usuarios</li>
                  <li className={plan.asistenteIA ? "text-emerald-600" : "text-slate-400"}>
                    {plan.asistenteIA ? "✓ Asistente IA incluido" : "— Sin asistente IA"}
                  </li>
                </ul>

                <Link
                  href={`/registro?plan=${plan.id}`}
                  className="mt-8 rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-700"
                >
                  Empezar prueba de 14 días
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
