"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { SalidaEnriquecida } from "@/types/domain";

interface Manifiesto {
  empresa: { razonSocial: string | null; ruc: string | null };
  salida: SalidaEnriquecida;
  pasajeros: { numAsiento: number; pasajeroNombre: string; pasajeroDoc: string }[];
  totalPasajeros: number;
}

/**
 * Manifiesto electrónico (RF-13): vista imprimible desde el navegador.
 * Contenido mínimo SUTRAN/MTC (§3.3): datos del vehículo, chofer y relación de
 * pasajeros con documento. Solo pasajes con estado "vendido".
 */
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

  if (error) return <main className="p-10 text-red-600">Error: {error}</main>;
  if (!m) return <main className="p-10 text-slate-500">Cargando…</main>;

  const fecha = new Date(m.salida.fechaHora).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Estilos de impresión: solo se imprime el manifiesto, sin controles. */}
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
            className="text-sm text-slate-500 hover:underline"
          >
            ← Volver al mapa
          </a>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Imprimir
          </button>
        </div>

        <header className="border-b-2 border-slate-900 pb-4">
          <h1 className="text-xl font-bold uppercase">Manifiesto de pasajeros</h1>
          <p className="text-sm text-slate-600">
            {m.empresa.razonSocial} — RUC {m.empresa.ruc}
          </p>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div className="flex justify-between border-b border-slate-200 py-1">
            <dt className="text-slate-500">Ruta</dt>
            <dd className="font-medium">
              {m.salida.rutaOrigen} → {m.salida.rutaDestino}
            </dd>
          </div>
          <div className="flex justify-between border-b border-slate-200 py-1">
            <dt className="text-slate-500">Fecha y hora</dt>
            <dd className="font-medium">{fecha}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-200 py-1">
            <dt className="text-slate-500">Placa del vehículo</dt>
            <dd className="font-medium">{m.salida.busPlaca}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-200 py-1">
            <dt className="text-slate-500">Conductor</dt>
            <dd className="font-medium">{m.salida.choferNombre}</dd>
          </div>
        </dl>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left">
              <th className="py-2 pr-4 w-20">Asiento</th>
              <th className="py-2 pr-4">Nombre del pasajero</th>
              <th className="py-2 w-32">Documento</th>
            </tr>
          </thead>
          <tbody>
            {m.pasajeros.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-slate-500">
                  Sin pasajeros vendidos.
                </td>
              </tr>
            ) : (
              m.pasajeros.map((p) => (
                <tr key={p.numAsiento} className="border-b border-slate-200">
                  <td className="py-1.5 pr-4">{p.numAsiento}</td>
                  <td className="py-1.5 pr-4">{p.pasajeroNombre}</td>
                  <td className="py-1.5">{p.pasajeroDoc}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <p className="mt-4 text-sm text-slate-600">
          Total de pasajeros: <strong>{m.totalPasajeros}</strong>
        </p>
      </section>
    </main>
  );
}
