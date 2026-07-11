"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, type FirestoreError } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";

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
  puedeAnular?: boolean;
}) {
  const [ocupados, setOcupados] = useState<Map<number, PasajeAsiento>>(new Map());
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

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
        setError(`No se pudo leer la ocupación: ${err.code}`);
        setCargando(false);
      }
    );
    return () => unsub();
  }, [salidaId, empresaId]);

  const asientos = Array.from({ length: numAsientos }, (_, i) => i + 1);

  if (error) {
    return <p className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-sm">
        <Leyenda color="bg-surface border-line-strong" texto="Libre" />
        <Leyenda color="bg-seat-occupied border-seat-occupied" texto="Ocupado" />
        <span className="text-ink-muted">
          {cargando ? "Cargando…" : `${ocupados.size} de ${numAsientos} ocupados`}
        </span>
      </div>

      <div className="inline-block rounded-2xl border border-line bg-subtle/50 p-4">
        <div className="grid grid-cols-[repeat(2,2.5rem)_1rem_repeat(2,2.5rem)] gap-2">
          {asientos.map((n) => {
            const ocupado = ocupados.has(n);
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
                  className={`h-10 w-10 rounded-lg border text-xs font-medium transition-all ${
                    ocupado
                      ? "border-seat-occupied bg-seat-occupied text-white"
                      : seleccionado === n
                      ? "border-primary bg-primary-subtle text-primary ring-2 ring-primary/30"
                      : "border-line-strong bg-surface text-ink-secondary hover:border-primary hover:text-primary"
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
        <div className="mt-4 max-w-sm rounded-xl border border-line bg-surface p-4 text-sm">
          <p>
            Asiento <strong>{seleccionado}</strong>: ocupado ·{" "}
            {ocupados.get(seleccionado)!.pasajeroNombre} (doc.{" "}
            {ocupados.get(seleccionado)!.pasajeroDoc})
          </p>
          {ventaError && <p className="mt-2 rounded-lg bg-danger-subtle px-3 py-2 text-danger">{ventaError}</p>}
          {puedeAnular && (
            <button
              type="button"
              onClick={() => anular(ocupados.get(seleccionado)!.pasajeId)}
              disabled={vendiendo}
              className="mt-3 rounded-lg border border-danger/30 px-4 py-2 text-sm font-medium text-danger hover:bg-danger-subtle disabled:opacity-60 transition"
            >
              {vendiendo ? "Anulando…" : "Anular pasaje"}
            </button>
          )}
        </div>
      )}

      {seleccionado !== null && !ocupados.has(seleccionado) && (
        <form onSubmit={vender} className="mt-4 max-w-sm rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold">
            Vender asiento {seleccionado} · S/ {precio}
          </p>
          <label className="mt-3 block">
            <span className="text-sm text-ink-secondary">Nombre del pasajero</span>
            <input
              value={pasajeroNombre}
              onChange={(e) => setPasajeroNombre(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="mt-2 block">
            <span className="text-sm text-ink-secondary">Documento</span>
            <input
              value={pasajeroDoc}
              onChange={(e) => setPasajeroDoc(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>

          {ventaError && <p className="mt-2 rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{ventaError}</p>}

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={vendiendo}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60 transition"
            >
              {vendiendo ? "Vendiendo…" : "Confirmar venta"}
            </button>
            <button
              type="button"
              onClick={() => setSeleccionado(null)}
              className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle transition"
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
      setSeleccionado(null);
    } catch (err) {
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
