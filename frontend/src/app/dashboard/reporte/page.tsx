"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";

interface Reporte {
  fecha: string;
  totalPasajes: number;
  montoTotal: number;
  porRuta: { ruta: string; pasajes: number; monto: number }[];
}

/** Reporte de ventas del día (RF-14). Solo admin_empresa. */
export default function ReportePage() {
  const router = useRouter();
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.replace("/login");
      try {
        const data = await apiFetch<Reporte>("/api/reportes/dia");
        setReporte(data);
      } catch (e) {
        setError((e as Error).message);
      }
    });
    return () => unsub();
  }, [router]);

  if (error) return <main className="p-10 text-red-600">Error: {error}</main>;
  if (!reporte) return <main className="p-10 text-slate-500">Cargando…</main>;

  const soles = (n: number) =>
    `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <a href="/dashboard" className="text-sm text-slate-500 hover:underline">
          ← Volver al panel
        </a>
        <h1 className="mt-3 text-2xl font-bold">Reporte del día</h1>
        <p className="text-sm text-slate-500">Ventas del {reporte.fecha}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">Pasajes vendidos</p>
            <p className="text-3xl font-bold">{reporte.totalPasajes}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">Monto total</p>
            <p className="text-3xl font-bold">{soles(reporte.montoTotal)}</p>
          </div>
        </div>

        <h2 className="mt-8 text-lg font-semibold">Por ruta</h2>
        <table className="mt-3 w-full rounded-xl border border-slate-200 bg-white text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="p-3 font-medium">Ruta</th>
              <th className="p-3 font-medium">Pasajes</th>
              <th className="p-3 font-medium text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {reporte.porRuta.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-4 text-slate-500">
                  Sin ventas hoy.
                </td>
              </tr>
            ) : (
              reporte.porRuta.map((r) => (
                <tr key={r.ruta} className="border-b border-slate-100">
                  <td className="p-3">{r.ruta}</td>
                  <td className="p-3">{r.pasajes}</td>
                  <td className="p-3 text-right">{soles(r.monto)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
