"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { Plan } from "@/types/domain";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Cambio de plan (RF-04). Muestra el catálogo con el plan actual resaltado;
 * cambiar actualiza planId y los límites aplican de inmediato (sin cobro en el
 * MVP). El downgrade se permite: si quedas sobre el límite, el backend lo avisa
 * y no podrás crear más recursos hasta volver bajo el límite.
 */
export default function PlanPage() {
  const router = useRouter();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [planActual, setPlanActual] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState(false);

  const cargar = useCallback(async () => {
    const [cat, sesion] = await Promise.all([
      fetch(`${API_URL}/api/planes`).then((r) => r.json()) as Promise<{ planes: Plan[] }>,
      apiFetch<{ empresa: { planId: string } }>("/api/auth/me"),
    ]);
    setPlanes(cat.planes ?? []);
    setPlanActual(sesion.empresa.planId);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return router.replace("/login");
      cargar().catch((e) => setError((e as Error).message));
    });
    return () => unsub();
  }, [router, cargar]);

  async function cambiar(planId: string) {
    setError(null);
    setMensaje(null);
    setAvisos([]);
    setCambiando(true);
    try {
      const r = await apiFetch<{ planNombre: string; avisos: string[] }>("/api/empresa/plan", {
        method: "PUT",
        body: JSON.stringify({ planId }),
      });
      setMensaje(`Tu empresa ahora está en el plan ${r.planNombre}. Los límites aplican de inmediato.`);
      setAvisos(r.avisos ?? []);
      setPlanActual(planId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCambiando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-4xl px-6 py-10">
        <a href="/dashboard" className="text-sm text-slate-500 hover:underline">
          ← Volver al panel
        </a>
        <h1 className="mt-3 text-2xl font-bold">Mi plan</h1>
        <p className="text-sm text-slate-500">
          Cambia de plan cuando quieras; los límites aplican de inmediato. (Sin cobro real en esta versión.)
        </p>

        {mensaje && (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{mensaje}</p>
        )}
        {avisos.map((a, i) => (
          <p key={i} className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {a}
          </p>
        ))}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {planes.map((p) => {
            const esActual = p.id === planActual;
            return (
              <article
                key={p.id}
                className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  esActual ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{p.nombre}</h2>
                  {esActual && (
                    <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-white">
                      Actual
                    </span>
                  )}
                </div>
                <p className="mt-2 text-3xl font-bold">
                  S/ {p.precioMensual.toLocaleString("es-PE")}
                  <span className="text-base font-normal text-slate-500">/mes</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
                  <li>Hasta {p.maxBuses.toLocaleString("es-PE")} buses</li>
                  <li>Hasta {p.maxUsuarios.toLocaleString("es-PE")} usuarios</li>
                  <li className={p.asistenteIA ? "text-emerald-600" : "text-slate-400"}>
                    {p.asistenteIA ? "✓ Asistente IA incluido" : "— Sin asistente IA"}
                  </li>
                </ul>
                <button
                  onClick={() => cambiar(p.id)}
                  disabled={esActual || cambiando}
                  className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
                >
                  {esActual ? "Tu plan actual" : cambiando ? "Cambiando…" : `Cambiar a ${p.nombre}`}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
