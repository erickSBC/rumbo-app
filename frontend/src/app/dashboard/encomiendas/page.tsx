"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import { BadgeEncomienda } from "@/components/BadgeEncomienda";
import type { Encomienda } from "@/types/domain";

export default function EncomiendasPage() {
  const router = useRouter();
  const [pendientes, setPendientes] = useState<Encomienda[]>([]);
  const [sinPlan, setSinPlan] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // Búsqueda + entrega.
  const [codigo, setCodigo] = useState("");
  const [hallada, setHallada] = useState<Encomienda | null>(null);
  const [docReceptor, setDocReceptor] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargarPendientes = useCallback(async () => {
    const data = await apiFetch<{ encomiendas: Encomienda[] }>("/api/encomiendas/pendientes");
    setPendientes(data.encomiendas);
    setCargando(false);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return router.replace("/login");
      cargarPendientes().catch((err) => {
        const msg = (err as Error).message;
        if (msg.toLowerCase().includes("no incluye")) setSinPlan(msg);
        else setError(msg);
        setCargando(false);
      });
    });
    return () => unsub();
  }, [router, cargarPendientes]);

  async function buscar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setAviso(null);
    setHallada(null);
    setDocReceptor("");
    if (!codigo.trim()) return;
    setBuscando(true);
    try {
      const data = await apiFetch<{ encomienda: Encomienda }>(
        `/api/encomiendas/buscar?codigo=${encodeURIComponent(codigo.trim())}`
      );
      setHallada(data.encomienda);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  async function entregar() {
    if (!hallada) return;
    setError(null);
    setAviso(null);
    try {
      await apiFetch(`/api/encomiendas/${hallada.id}/entregar`, {
        method: "PUT",
        body: JSON.stringify({ entregadaA: docReceptor }),
      });
      setAviso(`Encomienda ${hallada.codigo} entregada correctamente.`);
      setHallada(null);
      setCodigo("");
      setDocReceptor("");
      await cargarPendientes();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (sinPlan) {
    return (
      <main className="min-h-screen bg-canvas text-ink">
        <section className="mx-auto max-w-2xl px-6 py-10">
          <a href="/dashboard" className="text-sm text-ink-muted hover:text-primary hover:underline transition">
            ← Volver al panel
          </a>
          <div className="mt-6 rounded-2xl border border-warning/30 bg-warning-subtle p-6">
            <h1 className="text-lg font-semibold text-warning">Módulo de encomiendas</h1>
            <p className="mt-1 text-sm text-warning/90">{sinPlan}</p>
            <a href="/dashboard/plan" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition">
              Cambiar de plan →
            </a>
          </div>
        </section>
      </main>
    );
  }

  const entregable = hallada && (hallada.estado === "en_viaje" || hallada.estado === "en_destino");

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <a href="/dashboard" className="text-sm text-ink-muted hover:text-primary hover:underline transition">
          ← Volver al panel
        </a>
        <h1 className="mt-3 text-2xl font-bold">Encomiendas</h1>
        <p className="text-sm text-ink-muted">Entrega paquetes por código de guía y gestiona la bodega de destino.</p>

        {/* Entrega por código */}
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Entregar por código</p>
          <form onSubmit={buscar} className="mt-3 flex gap-2">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="ENC-000123"
              className="flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm tabular outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <button type="submit" disabled={buscando} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60 transition">
              {buscando ? "Buscando…" : "Buscar"}
            </button>
          </form>

          {hallada && (
            <div className="mt-4 rounded-xl border border-line bg-canvas p-4 text-sm">
              <div className="flex items-center gap-2">
                <strong className="tabular">{hallada.codigo}</strong>
                <BadgeEncomienda estado={hallada.estado} />
              </div>
              <p className="mt-1 text-ink-secondary">
                {hallada.remitenteNombre} → {hallada.destinatarioNombre} (doc. {hallada.destinatarioDoc})
              </p>
              <p className="text-ink-muted">{hallada.descripcion} · {hallada.pesoKg} kg · S/ {hallada.precio}</p>

              {entregable ? (
                <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end">
                  <label className="flex-1">
                    <span className="text-sm font-medium text-ink-secondary">Documento de quien recoge</span>
                    <input
                      value={docReceptor}
                      onChange={(e) => setDocReceptor(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                  <button
                    onClick={entregar}
                    disabled={docReceptor.trim().length < 6}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-40 transition"
                  >
                    Registrar entrega
                  </button>
                </div>
              ) : (
                <p className="mt-3 rounded-lg bg-subtle px-3 py-2 text-ink-muted">
                  Esta encomienda no está disponible para entrega (estado: {hallada.estado}).
                </p>
              )}
            </div>
          )}

          {error && <p className="mt-3 rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</p>}
          {aviso && <p className="mt-3 rounded-lg bg-success-subtle px-3 py-2 text-sm text-success">{aviso}</p>}
        </div>

        {/* Pendientes de entrega (RF-20) */}
        <h2 className="mt-8 text-lg font-semibold">Pendientes de entrega</h2>
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
          {cargando ? (
            <li className="p-4 text-sm text-ink-muted">Cargando…</li>
          ) : pendientes.length === 0 ? (
            <li className="p-4 text-sm text-ink-muted">No hay encomiendas pendientes de entrega.</li>
          ) : (
            pendientes.map((e) => (
              <li key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4">
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <strong className="tabular">{e.codigo}</strong>
                    <BadgeEncomienda estado={e.estado} />
                  </div>
                  <p className="mt-0.5 text-ink-secondary">
                    Para {e.destinatarioNombre} (doc. {e.destinatarioDoc}) · {e.descripcion} · {e.pesoKg} kg
                  </p>
                </div>
                <button
                  onClick={() => { setCodigo(e.codigo); setHallada(e); setDocReceptor(""); setError(null); setAviso(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="shrink-0 rounded-lg bg-primary-subtle px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition"
                >
                  Entregar
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
