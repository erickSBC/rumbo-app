"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { SalidaEnriquecida } from "@/types/domain";

interface EncomiendaCarga {
  codigo: string;
  remitenteNombre: string;
  destinatarioNombre: string;
  destinatarioDoc: string;
  descripcion: string;
  pesoKg: number;
}

interface Manifiesto {
  empresa: { razonSocial: string | null; ruc: string | null };
  salida: SalidaEnriquecida;
  pasajeros: { numAsiento: number; pasajeroNombre: string; pasajeroDoc: string }[];
  totalPasajeros: number;
  encomiendas: EncomiendaCarga[];
  totalBultos: number;
  pesoTotal: number;
}

export default function ManifiestoPage() {
  const router = useRouter();
  const params = useParams<{ salidaId: string }>();
  const [m, setM] = useState<Manifiesto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.replace("/login");
      try {
        const data = await apiFetch<{ manifiesto: Manifiesto }>(
          `/api/salidas/${params.salidaId}/manifiesto`
        );
        setM(data.manifiesto);
      } catch (e) {
        setError((e as Error).message);
      }
    });
    return () => unsub();
  }, [router, params.salidaId]);

  if (error) return <main className="flex min-h-screen items-center justify-center bg-canvas"><p className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-danger">{error}</p></main>;
  if (!m) return <main className="flex min-h-screen items-center justify-center bg-canvas"><p className="text-sm text-ink-muted">Cargando…</p></main>;

  const fecha = new Date(m.salida.fechaHora).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <main className="min-h-screen bg-surface text-ink">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          main { padding: 0 !important; }
        }
      `}</style>

      <section className="mx-auto max-w-2xl px-8 py-10">
        <div className="no-print mb-6 flex items-center justify-between">
          <a
            href={`/dashboard/salidas/${params.salidaId}`}
            className="text-sm text-ink-muted hover:text-primary hover:underline transition"
          >
            ← Volver al mapa
          </a>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition"
          >
            Imprimir
          </button>
        </div>

        <header className="border-b-2 border-ink pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white text-sm">R</span>
            <h1 className="text-xl font-bold uppercase">Manifiesto de pasajeros</h1>
          </div>
          <p className="mt-1 text-sm text-ink-secondary">
            {m.empresa.razonSocial} — RUC {m.empresa.ruc}
          </p>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="flex justify-between border-b border-line py-1.5">
            <dt className="text-ink-muted">Ruta</dt>
            <dd className="font-medium">
              {m.salida.rutaOrigen} → {m.salida.rutaDestino}
            </dd>
          </div>
          <div className="flex justify-between border-b border-line py-1.5">
            <dt className="text-ink-muted">Fecha y hora</dt>
            <dd className="font-medium">{fecha}</dd>
          </div>
          <div className="flex justify-between border-b border-line py-1.5">
            <dt className="text-ink-muted">Placa del vehículo</dt>
            <dd className="font-medium">{m.salida.busPlaca}</dd>
          </div>
          <div className="flex justify-between border-b border-line py-1.5">
            <dt className="text-ink-muted">Conductor</dt>
            <dd className="font-medium">{m.salida.choferNombre}</dd>
          </div>
        </dl>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left">
                <th className="py-2 pr-4 w-20 text-xs font-semibold uppercase tracking-wide text-ink-muted">Asiento</th>
                <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Nombre del pasajero</th>
                <th className="py-2 w-32 text-xs font-semibold uppercase tracking-wide text-ink-muted">Documento</th>
              </tr>
            </thead>
            <tbody>
              {m.pasajeros.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-ink-muted">
                    Sin pasajeros vendidos.
                  </td>
                </tr>
              ) : (
                m.pasajeros.map((p) => (
                  <tr key={p.numAsiento} className="border-b border-line">
                    <td className="py-1.5 pr-4 tabular">{p.numAsiento}</td>
                    <td className="py-1.5 pr-4">{p.pasajeroNombre}</td>
                    <td className="py-1.5 tabular">{p.pasajeroDoc}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm text-ink-secondary">
          Total de pasajeros: <strong className="text-ink">{m.totalPasajeros}</strong>
        </p>

        {/* Declaración de carga (RF-19): encomiendas a bordo */}
        <h2 className="mt-8 border-b-2 border-ink pb-2 text-lg font-bold uppercase">Declaración de carga</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left">
                <th className="py-2 pr-4 w-28 text-xs font-semibold uppercase tracking-wide text-ink-muted">Guía</th>
                <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Remitente → Destinatario</th>
                <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Contenido</th>
                <th className="py-2 w-20 text-xs font-semibold uppercase tracking-wide text-ink-muted text-right">Peso</th>
              </tr>
            </thead>
            <tbody>
              {m.encomiendas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-ink-muted">
                    Sin encomiendas a bordo.
                  </td>
                </tr>
              ) : (
                m.encomiendas.map((e) => (
                  <tr key={e.codigo} className="border-b border-line">
                    <td className="py-1.5 pr-4 tabular">{e.codigo}</td>
                    <td className="py-1.5 pr-4">
                      {e.remitenteNombre} → {e.destinatarioNombre}{" "}
                      <span className="text-ink-muted">(doc. {e.destinatarioDoc})</span>
                    </td>
                    <td className="py-1.5 pr-4">{e.descripcion}</td>
                    <td className="py-1.5 tabular text-right">{e.pesoKg} kg</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm text-ink-secondary">
          Total de bultos: <strong className="text-ink">{m.totalBultos}</strong> · Peso total:{" "}
          <strong className="text-ink tabular">{m.pesoTotal.toFixed(1)} kg</strong>
        </p>
      </section>
    </main>
  );
}
