"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { Plan } from "@/types/domain";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto max-w-4xl px-6 py-10">
        <a href="/dashboard" className="text-sm text-ink-muted hover:text-primary hover:underline transition">
          ← Volver al panel
        </a>
        <h1 className="mt-3 text-2xl font-bold">Mi plan</h1>
        <p className="text-sm text-ink-muted">
          Cambia de plan cuando quieras; los límites aplican de inmediato. (Sin cobro real en esta versión.)
        </p>

        {mensaje && (
          <p className="mt-4 rounded-lg bg-success-subtle p-3 text-sm text-success">{mensaje}</p>
        )}
        {avisos.map((a, i) => (
          <p key={i} className="mt-2 rounded-lg bg-warning-subtle p-3 text-sm text-warning">
            {a}
          </p>
        ))}
        {error && <p className="mt-4 rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {planes.map((p) => {
            const esActual = p.id === planActual;
            return (
              <article
                key={p.id}
                className={`group flex flex-col rounded-2xl border bg-surface p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                  esActual
                    ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10"
                    : "border-line hover:border-line-strong"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{p.nombre}</h2>
                  {esActual && (
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white">
                      Actual
                    </span>
                  )}
                </div>
                <p className="mt-2 text-3xl font-bold tabular">
                  S/ {p.precioMensual.toLocaleString("es-PE")}
                  <span className="text-base font-normal text-ink-muted">/mes</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-ink-secondary">
                  <li className="flex items-center gap-2">
                    <Check /> Hasta {p.maxBuses.toLocaleString("es-PE")} buses
                  </li>
                  <li className="flex items-center gap-2">
                    <Check /> Hasta {p.maxUsuarios.toLocaleString("es-PE")} usuarios
                  </li>
                  <li className="flex items-center gap-2">
                    {p.asistenteIA ? (
                      <>
                        <Check /> Asistente IA incluido
                      </>
                    ) : (
                      <span className="text-ink-muted">— Sin asistente IA</span>
                    )}
                  </li>
                </ul>
                <button
                  onClick={() => cambiar(p.id)}
                  disabled={esActual || cambiando}
                  className={`mt-6 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                    esActual
                      ? "bg-subtle text-ink-muted cursor-default"
                      : "bg-primary text-white hover:bg-primary-hover shadow-sm hover:shadow-md disabled:opacity-40"
                  }`}
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
