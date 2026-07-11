"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { Ruta, Bus, SalidaEnriquecida } from "@/types/domain";

function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

function formatoHora(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function SalidasPage() {
  const router = useRouter();
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [salidas, setSalidas] = useState<SalidaEnriquecida[]>([]);
  const [fecha, setFecha] = useState(hoyLima());

  const [rutaId, setRutaId] = useState("");
  const [busId, setBusId] = useState("");
  const [fechaHora, setFechaHora] = useState("");
  const [choferNombre, setChoferNombre] = useState("");
  const [precio, setPrecio] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarCatalogos = useCallback(async () => {
    const [rr, bb] = await Promise.all([
      apiFetch<{ rutas: Ruta[] }>("/api/rutas"),
      apiFetch<{ buses: Bus[] }>("/api/buses"),
    ]);
    setRutas(rr.rutas);
    setBuses(bb.buses);
  }, []);

  const cargarSalidas = useCallback(async (f: string) => {
    const data = await apiFetch<{ salidas: SalidaEnriquecida[] }>(`/api/salidas?fecha=${f}`);
    setSalidas(data.salidas);
    setCargando(false);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return router.replace("/login");
      Promise.all([cargarCatalogos(), cargarSalidas(fecha)]).catch((e) =>
        setError((e as Error).message)
      );
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function elegirRuta(id: string) {
    setRutaId(id);
    const r = rutas.find((x) => x.id === id);
    if (r) setPrecio(String(r.precioBase));
  }

  async function programar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/salidas", {
        method: "POST",
        body: JSON.stringify({
          rutaId,
          busId,
          fechaHora,
          choferNombre,
          precio: precio === "" ? undefined : Number(precio),
        }),
      });
      setRutaId("");
      setBusId("");
      setFechaHora("");
      setChoferNombre("");
      setPrecio("");
      await cargarSalidas(fecha);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function cancelar(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/salidas/${id}`, {
        method: "PUT",
        body: JSON.stringify({ estado: "cancelada" }),
      });
      await cargarSalidas(fecha);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function cambiarFecha(f: string) {
    setFecha(f);
    setCargando(true);
    cargarSalidas(f).catch((e) => setError((e as Error).message));
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <a href="/dashboard" className="text-sm text-ink-muted hover:text-primary hover:underline transition">
          ← Volver al panel
        </a>
        <h1 className="mt-3 text-2xl font-bold">Salidas</h1>

        <form onSubmit={programar} className="mt-6 grid gap-3 sm:grid-cols-2 rounded-2xl border border-line bg-surface p-5">
          <label className="block">
            <span className="text-sm font-medium text-ink-secondary">Ruta</span>
            <select
              value={rutaId}
              onChange={(e) => elegirRuta(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Elige una ruta…</option>
              {rutas.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.origen} → {r.destino} (S/ {r.precioBase})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink-secondary">Bus</span>
            <select
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Elige un bus…</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.placa} ({b.numAsientos} asientos)
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink-secondary">Fecha y hora</span>
            <input
              type="datetime-local"
              value={fechaHora}
              onChange={(e) => setFechaHora(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink-secondary">Precio (S/)</span>
            <input
              type="number"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="Toma el de la ruta si lo dejas vacío"
              min={0}
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-ink-secondary">Chofer</span>
            <input
              value={choferNombre}
              onChange={(e) => setChoferNombre(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <button
            type="submit"
            className="sm:col-span-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition"
          >
            Programar salida
          </button>
        </form>

        {error && <p className="mt-3 rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</p>}

        {/* Filtro por día */}
        <div className="mt-8 flex items-center gap-3">
          <h2 className="text-lg font-semibold">Salidas del día</h2>
          <input
            type="date"
            value={fecha}
            onChange={(e) => cambiarFecha(e.target.value)}
            className="rounded-lg border border-line-strong px-2 py-1 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={() => cambiarFecha(hoyLima())}
            className="rounded-lg border border-line-strong px-3 py-1 text-sm font-medium text-ink-secondary hover:bg-subtle hover:text-ink transition"
          >
            Hoy
          </button>
        </div>

        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {cargando ? (
            <li className="p-4 text-sm text-ink-muted">Cargando…</li>
          ) : salidas.length === 0 ? (
            <li className="p-4 text-sm text-ink-muted">No hay salidas para esta fecha.</li>
          ) : (
            salidas.map((s) => (
              <li key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 hover:bg-subtle/50 transition">
                <span className="text-sm">
                  <strong>{formatoHora(s.fechaHora)}</strong> · {s.rutaOrigen} → {s.rutaDestino} ·{" "}
                  bus {s.busPlaca} · S/ {s.precio} · chofer {s.choferNombre}
                  {s.estado !== "programada" && (
                    <span className="ml-2 text-warning">— {s.estado}</span>
                  )}
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <a
                    href={`/dashboard/salidas/${s.id}`}
                    className="rounded-lg bg-primary-subtle px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition"
                  >
                    Ver mapa
                  </a>
                  {s.estado === "programada" && (
                    <button
                      onClick={() => cancelar(s.id)}
                      className="rounded-lg border border-danger/30 px-3 py-1 text-xs font-medium text-danger hover:bg-danger-subtle transition"
                    >
                      Cancelar
                    </button>
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
