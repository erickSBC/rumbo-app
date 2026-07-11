"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { Bus, Uso } from "@/types/domain";

export default function BusesPage() {
  const router = useRouter();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [uso, setUso] = useState<Uso | null>(null);
  const [placa, setPlaca] = useState("");
  const [numAsientos, setNumAsientos] = useState("40");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const data = await apiFetch<{ buses: Bus[]; uso: Uso }>("/api/buses");
    setBuses(data.buses);
    setUso(data.uso);
    setCargando(false);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return router.replace("/login");
      cargar().catch((e) => setError((e as Error).message));
    });
    return () => unsub();
  }, [router, cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/buses", {
        method: "POST",
        body: JSON.stringify({ placa, numAsientos: Number(numAsientos) }),
      });
      setPlaca("");
      setNumAsientos("40");
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function eliminar(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/buses/${id}`, { method: "DELETE" });
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const enTope = uso ? uso.actual >= uso.max : false;

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <a href="/dashboard" className="text-sm text-ink-muted hover:text-primary hover:underline transition">
          ← Volver al panel
        </a>

        <div className="mt-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Buses</h1>
          {uso && (
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                enTope ? "bg-warning-subtle text-warning" : "bg-subtle text-ink-secondary"
              }`}
            >
              {uso.actual} de {uso.max} buses
            </span>
          )}
        </div>

        {enTope && (
          <p className="mt-3 rounded-lg bg-warning-subtle p-3 text-sm text-warning">
            Llegaste al límite de tu plan. Para agregar más buses, actualiza tu plan.
          </p>
        )}

        <form onSubmit={crear} className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-5">
          <label className="flex-1">
            <span className="text-sm font-medium text-ink-secondary">Placa</span>
            <input
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              placeholder="ABC-123"
              required
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="w-32">
            <span className="text-sm font-medium text-ink-secondary">Asientos</span>
            <input
              type="number"
              value={numAsientos}
              onChange={(e) => setNumAsientos(e.target.value)}
              min={1}
              max={90}
              required
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition"
          >
            Agregar bus
          </button>
        </form>

        {error && <p className="mt-3 rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</p>}

        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
          {cargando ? (
            <li className="p-4 text-sm text-ink-muted">Cargando…</li>
          ) : buses.length === 0 ? (
            <li className="p-4 text-sm text-ink-muted">Aún no hay buses.</li>
          ) : (
            buses.map((b) => (
              <li key={b.id} className="flex items-center justify-between p-4 hover:bg-subtle/50 transition">
                <span className="text-sm">
                  <strong>{b.placa}</strong> · {b.numAsientos} asientos
                </span>
                <button
                  onClick={() => eliminar(b.id)}
                  className="rounded-lg border border-danger/30 px-3 py-1 text-xs font-medium text-danger hover:bg-danger-subtle transition"
                >
                  Eliminar
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
