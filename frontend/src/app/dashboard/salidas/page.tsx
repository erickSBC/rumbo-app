"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { Ruta, Bus, SalidaEnriquecida } from "@/types/domain";

/** Fecha de hoy en Lima como YYYY-MM-DD (para el filtro por defecto). */
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

/**
 * Programación de salidas (RF-09) y listado por día. La vista por defecto es
 * "hoy", que en el Día 5 será la puerta de entrada a la venta de pasajes.
 * Aún NO se muestran asientos ocupados: eso llega en el Día 5/6.
 */
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

  // Al elegir ruta, autollenar el precio con su precioBase (editable).
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <a href="/dashboard" className="text-sm text-slate-500 hover:underline">
          ← Volver al panel
        </a>
        <h1 className="mt-3 text-2xl font-bold">Salidas</h1>

        {/* Formulario de programación */}
        <form onSubmit={programar} className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Ruta</span>
            <select
              value={rutaId}
              onChange={(e) => elegirRuta(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
            <span className="text-sm font-medium text-slate-700">Bus</span>
            <select
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
            <span className="text-sm font-medium text-slate-700">Fecha y hora</span>
            <input
              type="datetime-local"
              value={fechaHora}
              onChange={(e) => setFechaHora(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Precio (S/)</span>
            <input
              type="number"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="Toma el de la ruta si lo dejas vacío"
              min={0}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Chofer</span>
            <input
              value={choferNombre}
              onChange={(e) => setChoferNombre(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            className="sm:col-span-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Programar salida
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {/* Filtro por día */}
        <div className="mt-8 flex items-center gap-3">
          <h2 className="text-lg font-semibold">Salidas del día</h2>
          <input
            type="date"
            value={fecha}
            onChange={(e) => cambiarFecha(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            onClick={() => cambiarFecha(hoyLima())}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
          >
            Hoy
          </button>
        </div>

        <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {cargando ? (
            <li className="p-4 text-sm text-slate-500">Cargando…</li>
          ) : salidas.length === 0 ? (
            <li className="p-4 text-sm text-slate-500">No hay salidas para esta fecha.</li>
          ) : (
            salidas.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-4">
                <span className="text-sm">
                  <strong>{formatoHora(s.fechaHora)}</strong> · {s.rutaOrigen} → {s.rutaDestino} ·{" "}
                  bus {s.busPlaca} · S/ {s.precio} · chofer {s.choferNombre}
                  {s.estado !== "programada" && (
                    <span className="ml-2 text-amber-700">— {s.estado}</span>
                  )}
                </span>
                <span className="flex items-center gap-4">
                  <a
                    href={`/dashboard/salidas/${s.id}`}
                    className="text-sm font-medium text-slate-700 hover:underline"
                  >
                    Ver mapa
                  </a>
                  {s.estado === "programada" && (
                    <button
                      onClick={() => cancelar(s.id)}
                      className="text-sm text-red-600 hover:underline"
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
