"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, type FirestoreError } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";

/**
 * Mapa de asientos de una salida. La ocupación se lee en TIEMPO REAL desde
 * Firestore con onSnapshot (§5.4): un asiento está ocupado si existe un Pasaje
 * con estado "vendido" para esta salidaId y ese numAsiento.
 *
 * Día 6: al hacer clic en un asiento LIBRE se abre un panel para vender (RF-10);
 * la venta va al backend, que la ejecuta en una transacción atómica (RF-11).
 * Tras vender, el asiento se marca ocupado SOLO por el onSnapshot (no se toca el
 * estado local a mano), garantizando que el mapa refleja el estado real.
 *
 * Aislamiento: la query filtra empresaId == <tenant>, reforzado por las reglas
 * del Anexo C (otra empresa recibe permission-denied, no vacío).
 */
interface PasajeAsiento {
  pasajeId: string;
  pasajeroNombre: string;
  pasajeroDoc: string;
}

export function MapaAsientos({
  salidaId,
  empresaId,
  numAsientos,
  precio,
  puedeAnular = false,
}: {
  salidaId: string;
  empresaId: string;
  numAsientos: number;
  precio: number;
  /** true solo para admin_empresa (RF-12). */
  puedeAnular?: boolean;
}) {
  const [ocupados, setOcupados] = useState<Map<number, PasajeAsiento>>(new Map());
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // Estado del panel de venta.
  const [pasajeroNombre, setPasajeroNombre] = useState("");
  const [pasajeroDoc, setPasajeroDoc] = useState("");
  const [vendiendo, setVendiendo] = useState(false);
  const [ventaError, setVentaError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "pasajes"),
      where("empresaId", "==", empresaId),
      where("salidaId", "==", salidaId),
      where("estado", "==", "vendido")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapa = new Map<number, PasajeAsiento>();
        snap.forEach((doc) => {
          const p = doc.data();
          mapa.set(p.numAsiento as number, {
            pasajeId: doc.id,
            pasajeroNombre: p.pasajeroNombre as string,
            pasajeroDoc: p.pasajeroDoc as string,
          });
        });
        setOcupados(mapa);
        setCargando(false);
      },
      (err: FirestoreError) => {
        // permission-denied = las reglas bloquearon la lectura (aislamiento).
        setError(`No se pudo leer la ocupación: ${err.code}`);
        setCargando(false);
      }
    );
    return () => unsub();
  }, [salidaId, empresaId]);

  const asientos = Array.from({ length: numAsientos }, (_, i) => i + 1);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-sm">
        <Leyenda color="bg-white border-slate-300" texto="Libre" />
        <Leyenda color="bg-slate-800 border-slate-800" texto="Ocupado" />
        <span className="text-slate-500">
          {cargando ? "Cargando…" : `${ocupados.size} de ${numAsientos} ocupados`}
        </span>
      </div>

      {/* Rejilla estilo bus: 2 asientos, pasillo, 2 asientos. */}
      <div className="inline-block rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-[repeat(2,2.5rem)_1rem_repeat(2,2.5rem)] gap-2">
          {asientos.map((n) => {
            const ocupado = ocupados.has(n);
            // Inserta el hueco del pasillo tras cada segundo asiento de la fila.
            const columnaPasillo = (n - 1) % 4 === 2;
            return (
              <span key={n} style={columnaPasillo ? { gridColumnStart: 4 } : undefined}>
                <button
                  type="button"
                  onClick={() => {
                    setSeleccionado(n);
                    setVentaError(null);
                    setPasajeroNombre("");
                    setPasajeroDoc("");
                  }}
                  title={`Asiento ${n}: ${ocupado ? "ocupado" : "libre"}`}
                  className={`h-10 w-10 rounded-lg border text-xs font-medium transition ${
                    ocupado
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-900"
                  }`}
                >
                  {n}
                </button>
              </span>
            );
          })}
        </div>
      </div>

      {seleccionado !== null && ocupados.has(seleccionado) && (
        <div className="mt-4 max-w-sm rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p>
            Asiento <strong>{seleccionado}</strong>: ocupado ·{" "}
            {ocupados.get(seleccionado)!.pasajeroNombre} (doc.{" "}
            {ocupados.get(seleccionado)!.pasajeroDoc})
          </p>
          {ventaError && <p className="mt-2 text-red-600">{ventaError}</p>}
          {puedeAnular && (
            <button
              type="button"
              onClick={() => anular(ocupados.get(seleccionado)!.pasajeId)}
              disabled={vendiendo}
              className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {vendiendo ? "Anulando…" : "Anular pasaje"}
            </button>
          )}
        </div>
      )}

      {seleccionado !== null && !ocupados.has(seleccionado) && (
        <form onSubmit={vender} className="mt-4 max-w-sm rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium">
            Vender asiento {seleccionado} · S/ {precio}
          </p>
          <label className="mt-3 block">
            <span className="text-sm text-slate-700">Nombre del pasajero</span>
            <input
              value={pasajeroNombre}
              onChange={(e) => setPasajeroNombre(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="mt-2 block">
            <span className="text-sm text-slate-700">Documento</span>
            <input
              value={pasajeroDoc}
              onChange={(e) => setPasajeroDoc(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          {ventaError && <p className="mt-2 text-sm text-red-600">{ventaError}</p>}

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={vendiendo}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {vendiendo ? "Vendiendo…" : "Confirmar venta"}
            </button>
            <button
              type="button"
              onClick={() => setSeleccionado(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );

  async function anular(pasajeId: string) {
    setVendiendo(true);
    setVentaError(null);
    try {
      await apiFetch(`/api/pasajes/${pasajeId}/anular`, { method: "PUT" });
      // El asiento vuelve a "libre" solo por el onSnapshot (tiempo real).
      setSeleccionado(null);
    } catch (err) {
      setVentaError((err as Error).message);
    } finally {
      setVendiendo(false);
    }
  }

  async function vender(e: React.FormEvent) {
    e.preventDefault();
    if (seleccionado === null) return;
    setVendiendo(true);
    setVentaError(null);
    try {
      await apiFetch("/api/pasajes", {
        method: "POST",
        body: JSON.stringify({
          salidaId,
          numAsiento: seleccionado,
          pasajeroNombre,
          pasajeroDoc,
        }),
      });
      // No marcamos el asiento ocupado a mano: el onSnapshot lo reflejará.
      setSeleccionado(null);
    } catch (err) {
      // Aquí llega el 409 de la transacción si otro vendedor tomó el asiento.
      setVentaError((err as Error).message);
    } finally {
      setVendiendo(false);
    }
  }
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-4 w-4 rounded border ${color}`} />
      {texto}
    </span>
  );
}
