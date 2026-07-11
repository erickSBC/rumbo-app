"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { Ruta } from "@/types/domain";

export default function RutasPage() {
  const router = useRouter();
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [duracionMin, setDuracionMin] = useState("300");
  const [precioBase, setPrecioBase] = useState("60");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const data = await apiFetch<{ rutas: Ruta[] }>("/api/rutas");
    setRutas(data.rutas);
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
      await apiFetch("/api/rutas", {
        method: "POST",
        body: JSON.stringify({
          origen,
          destino,
          duracionMin: Number(duracionMin),
          precioBase: Number(precioBase),
        }),
      });
      setOrigen("");
      setDestino("");
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function eliminar(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/rutas/${id}`, { method: "DELETE" });
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <a href="/dashboard" className="text-sm text-ink-muted hover:text-primary hover:underline transition">
          ← Volver al panel
        </a>
        <h1 className="mt-3 text-2xl font-bold">Rutas</h1>

        <form onSubmit={crear} className="mt-6 grid gap-3 sm:grid-cols-2 rounded-2xl border border-line bg-surface p-5">
          <Input label="Origen" value={origen} onChange={setOrigen} placeholder="Lima" />
          <Input label="Destino" value={destino} onChange={setDestino} placeholder="Arequipa" />
          <Input label="Duración (min)" type="number" value={duracionMin} onChange={setDuracionMin} />
          <Input label="Precio base (S/)" type="number" value={precioBase} onChange={setPrecioBase} />
          <button
            type="submit"
            className="sm:col-span-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition"
          >
            Agregar ruta
          </button>
        </form>

        {error && <p className="mt-3 rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</p>}

        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
          {cargando ? (
            <li className="p-4 text-sm text-ink-muted">Cargando…</li>
          ) : rutas.length === 0 ? (
            <li className="p-4 text-sm text-ink-muted">Aún no hay rutas.</li>
          ) : (
            rutas.map((r) => (
              <li key={r.id} className="flex items-center justify-between p-4 hover:bg-subtle/50 transition">
                <span className="text-sm">
                  <strong>
                    {r.origen} → {r.destino}
                  </strong>{" "}
                  · {r.duracionMin} min · S/ {r.precioBase}
                </span>
                <button
                  onClick={() => eliminar(r.id)}
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

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-secondary">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
