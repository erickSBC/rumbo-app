"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { Bus, Uso } from "@/types/domain";

/**
 * CRUD de buses (RF-08). Muestra el uso "X de Y buses" (RF-03, lado UI) leído
 * del backend. El límite real lo impone el backend: aquí solo se informa y, al
 * llegar al tope, se avisa amablemente sin bloquear por cuenta propia.
 */
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
      // Aquí aterriza el mensaje de límite del backend (RF-03).
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <a href="/dashboard" className="text-sm text-slate-500 hover:underline">
          ← Volver al panel
        </a>

        <div className="mt-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Buses</h1>
          {uso && (
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                enTope ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
              }`}
            >
              {uso.actual} de {uso.max} buses
            </span>
          )}
        </div>

        {enTope && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Llegaste al límite de tu plan. Para agregar más buses, actualiza tu plan.
          </p>
        )}

        <form onSubmit={crear} className="mt-6 flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="text-sm font-medium text-slate-700">Placa</span>
            <input
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              placeholder="ABC-123"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="w-32">
            <span className="text-sm font-medium text-slate-700">Asientos</span>
            <input
              type="number"
              value={numAsientos}
              onChange={(e) => setNumAsientos(e.target.value)}
              min={1}
              max={90}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Agregar bus
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <ul className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {cargando ? (
            <li className="p-4 text-sm text-slate-500">Cargando…</li>
          ) : buses.length === 0 ? (
            <li className="p-4 text-sm text-slate-500">Aún no hay buses.</li>
          ) : (
            buses.map((b) => (
              <li key={b.id} className="flex items-center justify-between p-4">
                <span className="text-sm">
                  <strong>{b.placa}</strong> · {b.numAsientos} asientos
                </span>
                <button
                  onClick={() => eliminar(b.id)}
                  className="text-sm text-red-600 hover:underline"
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
