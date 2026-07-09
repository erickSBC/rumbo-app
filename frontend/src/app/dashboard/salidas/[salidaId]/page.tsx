"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import { MapaAsientos } from "@/components/MapaAsientos";
import type { SalidaEnriquecida } from "@/types/domain";

/**
 * Página del mapa de asientos de una salida (Día 5). Obtiene el meta de la
 * salida del backend (tenant-checked) para saber cuántos asientos dibujar, y el
 * empresaId del token para la suscripción en tiempo real del componente.
 */
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
        // empresaId y rol desde los claims del token (no del cliente arbitrariamente).
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
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-red-600">Error: {error}</p>
        <a href="/dashboard/salidas" className="mt-4 inline-block text-sm text-slate-600 hover:underline">
          ← Volver a salidas
        </a>
      </main>
    );
  }

  if (!salida || !empresaId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-slate-500">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <a href="/dashboard/salidas" className="text-sm text-slate-500 hover:underline">
            ← Volver a salidas
          </a>
          <a
            href={`/dashboard/salidas/${salida.id}/manifiesto`}
            className="text-sm font-medium text-slate-700 hover:underline"
          >
            Manifiesto →
          </a>
        </div>

        <h1 className="mt-3 text-2xl font-bold">
          {salida.rutaOrigen} → {salida.rutaDestino}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
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
            <p className="text-sm text-red-600">La salida no tiene un bus con asientos asignados.</p>
          )}
        </div>
      </section>
    </main>
  );
}
