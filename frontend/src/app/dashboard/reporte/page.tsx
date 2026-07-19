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
  encomiendas?: { registradasHoy: number; montoEncomiendas: number; pendientesEntrega: number };
}

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

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-danger">{error}</p>
      </main>
    );
  }
  if (!reporte) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-ink-muted">Cargando…</p>
      </main>
    );
  }

  const soles = (n: number) =>
    `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <a href="/dashboard" className="text-sm text-ink-muted hover:text-primary hover:underline transition">
          ← Volver al panel
        </a>
        <h1 className="mt-3 text-2xl font-bold">Reporte del día</h1>
        <p className="text-sm text-ink-muted">Ventas del {reporte.fecha}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Pasajes vendidos</p>
            <p className="mt-2 text-3xl font-bold tabular">{reporte.totalPasajes}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Monto total (pasajes)</p>
            <p className="mt-2 text-3xl font-bold tabular text-primary">{soles(reporte.montoTotal)}</p>
          </div>
        </div>

        {/* Desglose de encomiendas (RF-20) — solo si el plan incluye el módulo */}
        {reporte.encomiendas && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Encomiendas hoy</p>
              <p className="mt-2 text-3xl font-bold tabular">{reporte.encomiendas.registradasHoy}</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Monto encomiendas</p>
              <p className="mt-2 text-3xl font-bold tabular text-primary">{soles(reporte.encomiendas.montoEncomiendas)}</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Pendientes de entrega</p>
              <p className="mt-2 text-3xl font-bold tabular text-warning">{reporte.encomiendas.pendientesEntrega}</p>
            </div>
          </div>
        )}

        <h2 className="mt-8 text-lg font-semibold">Por ruta</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="p-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Ruta</th>
                <th className="p-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Pasajes</th>
                <th className="p-3 text-xs font-semibold uppercase tracking-wide text-ink-muted text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {reporte.porRuta.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-ink-muted">
                    Sin ventas hoy.
                  </td>
                </tr>
              ) : (
                reporte.porRuta.map((r) => (
                  <tr key={r.ruta} className="border-b border-line last:border-0 hover:bg-subtle/50 transition">
                    <td className="p-3 font-medium">{r.ruta}</td>
                    <td className="p-3 tabular">{r.pasajes}</td>
                    <td className="p-3 tabular text-right">{soles(r.monto)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
