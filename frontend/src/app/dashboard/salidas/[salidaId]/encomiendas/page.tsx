"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import { BadgeEncomienda } from "@/components/BadgeEncomienda";
import type { Encomienda, SalidaEnriquecida } from "@/types/domain";

export default function EncomiendasSalidaPage() {
  const router = useRouter();
  const params = useParams<{ salidaId: string }>();
  const salidaId = params.salidaId;

  const [salida, setSalida] = useState<SalidaEnriquecida | null>(null);
  const [encomiendas, setEncomiendas] = useState<Encomienda[]>([]);
  const [esAdmin, setEsAdmin] = useState(false);
  const [sinPlan, setSinPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // Formulario de registro (RF-17).
  const [form, setForm] = useState({
    remitenteNombre: "",
    remitenteDoc: "",
    destinatarioNombre: "",
    destinatarioDoc: "",
    descripcion: "",
    pesoKg: "",
    precio: "",
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const cargar = useCallback(async () => {
    const [s, e] = await Promise.all([
      apiFetch<{ salida: SalidaEnriquecida }>(`/api/salidas/${salidaId}`),
      apiFetch<{ encomiendas: Encomienda[] }>(`/api/encomiendas/salida/${salidaId}`),
    ]);
    setSalida(s.salida);
    setEncomiendas(e.encomiendas);
    setCargando(false);
  }, [salidaId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.replace("/login");
      const { claims } = await user.getIdTokenResult();
      setEsAdmin(claims.rol === "admin_empresa");
      cargar().catch((err) => {
        const msg = (err as Error).message;
        if (msg.toLowerCase().includes("no incluye")) setSinPlan(msg);
        else setError(msg);
        setCargando(false);
      });
    });
    return () => unsub();
  }, [router, cargar]);

  async function registrar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/encomiendas", {
        method: "POST",
        body: JSON.stringify({
          salidaId,
          remitenteNombre: form.remitenteNombre,
          remitenteDoc: form.remitenteDoc,
          destinatarioNombre: form.destinatarioNombre,
          destinatarioDoc: form.destinatarioDoc,
          descripcion: form.descripcion,
          pesoKg: Number(form.pesoKg),
          precio: Number(form.precio),
        }),
      });
      setForm({ remitenteNombre: "", remitenteDoc: "", destinatarioNombre: "", destinatarioDoc: "", descripcion: "", pesoKg: "", precio: "" });
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function accionSalida(accion: "despachar" | "llegada") {
    setError(null);
    try {
      await apiFetch(`/api/encomiendas/salida/${salidaId}/${accion}`, { method: "POST" });
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function anular(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/encomiendas/${id}/anular`, { method: "PUT" });
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (sinPlan) {
    return (
      <main className="min-h-screen bg-canvas text-ink">
        <section className="mx-auto max-w-2xl px-6 py-10">
          <a href={`/dashboard/salidas/${salidaId}`} className="text-sm text-ink-muted hover:text-primary hover:underline transition">
            ← Volver a la salida
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

  const activas = encomiendas.filter((e) => e.estado !== "anulada");
  const hayRegistradas = activas.some((e) => e.estado === "registrada");
  const hayEnViaje = activas.some((e) => e.estado === "en_viaje");

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <a href={`/dashboard/salidas/${salidaId}`} className="text-sm text-ink-muted hover:text-primary hover:underline transition">
          ← Volver a la salida
        </a>
        <h1 className="mt-3 text-2xl font-bold">Encomiendas</h1>
        {salida && (
          <p className="mt-1 text-sm text-ink-muted">
            {salida.rutaOrigen} → {salida.rutaDestino} · bus {salida.busPlaca} ·{" "}
            {salida.fechaHora && new Date(salida.fechaHora).toLocaleString("es-PE", { timeZone: "America/Lima" })}
          </p>
        )}

        {/* Registro */}
        <form onSubmit={registrar} className="mt-6 grid gap-3 sm:grid-cols-2 rounded-2xl border border-line bg-surface p-5">
          <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Registrar encomienda</p>
          <Campo label="Remitente" value={form.remitenteNombre} onChange={set("remitenteNombre")} />
          <Campo label="Doc. remitente" value={form.remitenteDoc} onChange={set("remitenteDoc")} />
          <Campo label="Destinatario" value={form.destinatarioNombre} onChange={set("destinatarioNombre")} />
          <Campo label="Doc. destinatario" value={form.destinatarioDoc} onChange={set("destinatarioDoc")} />
          <Campo label="Descripción del contenido" value={form.descripcion} onChange={set("descripcion")} className="sm:col-span-2" />
          <Campo label="Peso (kg)" type="number" value={form.pesoKg} onChange={set("pesoKg")} />
          <Campo label="Precio (S/)" type="number" value={form.precio} onChange={set("precio")} />
          <button type="submit" className="sm:col-span-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition">
            Registrar y generar guía
          </button>
        </form>

        {error && <p className="mt-3 rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</p>}

        {/* Acciones por salida */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">A bordo</h2>
          <div className="flex gap-2">
            <button
              onClick={() => accionSalida("despachar")}
              disabled={!hayRegistradas}
              className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-secondary hover:border-primary hover:text-primary disabled:opacity-40 transition"
            >
              Despachar registradas
            </button>
            <button
              onClick={() => accionSalida("llegada")}
              disabled={!hayEnViaje}
              className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-secondary hover:border-primary hover:text-primary disabled:opacity-40 transition"
            >
              Marcar llegada
            </button>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {cargando ? (
            <li className="p-4 text-sm text-ink-muted">Cargando…</li>
          ) : encomiendas.length === 0 ? (
            <li className="p-4 text-sm text-ink-muted">Aún no hay encomiendas en esta salida.</li>
          ) : (
            encomiendas.map((e) => (
              <li key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4">
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <strong className="tabular">{e.codigo}</strong>
                    <BadgeEncomienda estado={e.estado} />
                  </div>
                  <p className="mt-0.5 text-ink-secondary">
                    {e.remitenteNombre} → {e.destinatarioNombre} · {e.descripcion} · {e.pesoKg} kg · S/ {e.precio}
                  </p>
                </div>
                {esAdmin && e.estado === "registrada" && (
                  <button
                    onClick={() => anular(e.id)}
                    className="shrink-0 rounded-lg border border-danger/30 px-3 py-1 text-xs font-medium text-danger hover:bg-danger-subtle transition"
                  >
                    Anular
                  </button>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-ink-secondary">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? 0 : undefined}
        className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
