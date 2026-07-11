"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import { MapaAsientos } from "@/components/MapaAsientos";
import type { SalidaEnriquecida } from "@/types/domain";

export default function MapaSalidaPage() {
  const router = useRouter();
  const params = useParams<{ salidaId: string }>();
  const salidaId = params.salidaId;

  const [salida, setSalida] = useState<SalidaEnriquecida | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.replace("/login");
      try {
        const { claims } = await user.getIdTokenResult();
        setEmpresaId(claims.empresaId as string);
        setEsAdmin(claims.rol === "admin_empresa");

        const data = await apiFetch<{ salida: SalidaEnriquecida }>(`/api/salidas/${salidaId}`);
        setSalida(data.salida);
      } catch (e) {
        setError((e as Error).message);
      }
    });
    return () => unsub();
  }, [router, salidaId]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <p className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-danger">{error}</p>
          <a href="/dashboard/salidas" className="mt-4 inline-block text-sm text-ink-muted hover:text-primary hover:underline transition">
            ← Volver a salidas
          </a>
        </div>
      </main>
    );
  }

  if (!salida || !empresaId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-ink-muted">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <a href="/dashboard/salidas" className="text-sm text-ink-muted hover:text-primary hover:underline transition">
            ← Volver a salidas
          </a>
          <a
            href={`/dashboard/salidas/${salida.id}/manifiesto`}
            className="rounded-lg bg-primary-subtle px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition"
          >
            Manifiesto →
          </a>
        </div>

        <h1 className="mt-3 text-2xl font-bold">
          {salida.rutaOrigen} → {salida.rutaDestino}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Bus {salida.busPlaca} · {salida.busNumAsientos} asientos · S/ {salida.precio} ·{" "}
          {new Date(salida.fechaHora).toLocaleString("es-PE", { timeZone: "America/Lima" })}
        </p>

        <div className="mt-8">
          {salida.busNumAsientos ? (
            <MapaAsientos
              salidaId={salida.id}
              empresaId={empresaId}
              numAsientos={salida.busNumAsientos}
              precio={salida.precio}
              puedeAnular={esAdmin}
            />
          ) : (
            <p className="text-sm text-danger">La salida no tiene un bus con asientos asignados.</p>
          )}
        </div>
      </section>
    </main>
  );
}
