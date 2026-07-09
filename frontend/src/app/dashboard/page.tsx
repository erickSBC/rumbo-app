"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";

/** Forma de la respuesta de GET /api/auth/me. */
interface Sesion {
  usuario: { uid: string; email?: string; rol?: string };
  empresa: {
    id: string;
    razonSocial: string;
    ruc: string;
    planId: string;
    estado: string;
    fechaFinPrueba: string | null;
    diasPruebaRestantes: number | null;
  };
}

/**
 * Dashboard protegido (§4.4 paso 12): banner con el plan elegido y los días de
 * prueba restantes. Los datos vienen de GET /api/auth/me, que deriva el
 * empresaId del token verificado — no del cliente.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const data = await apiFetch<Sesion>("/api/auth/me");
        setSesion(data);
      } catch (err) {
        setError((err as Error).message);
      }
    });
    return () => unsub();
  }, [router]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-red-600">Error: {error}</p>
      </main>
    );
  }

  if (!sesion) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-slate-500">Cargando…</p>
      </main>
    );
  }

  const { usuario, empresa } = sesion;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{empresa.razonSocial}</h1>
          <button
            onClick={() => signOut(auth)}
            className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Banner del plan elegido y días de prueba restantes (§4.4 paso 12). */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Tu plan</p>
          <p className="text-xl font-semibold capitalize">{empresa.planId}</p>
          {empresa.estado === "prueba" && empresa.diasPruebaRestantes !== null && (
            <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800">
              Prueba: te quedan {empresa.diasPruebaRestantes} días
            </p>
          )}
        </div>

        <nav className="mt-6 grid gap-3 sm:grid-cols-2">
          <NavCard href="/dashboard/rutas" titulo="Rutas" desc="Origen, destino y precio" />
          <NavCard href="/dashboard/buses" titulo="Buses" desc="Flota y asientos" />
          <NavCard href="/dashboard/usuarios" titulo="Usuarios" desc="Vendedores del counter" />
          <NavCard href="/dashboard/salidas" titulo="Salidas" desc="Programación de salidas" />
          <NavCard href="/dashboard/reporte" titulo="Reporte del día" desc="Ventas y montos de hoy" />
        </nav>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <Dato label="RUC" valor={empresa.ruc} />
          <Dato label="Estado" valor={empresa.estado} />
          <Dato label="Administrador" valor={usuario.email ?? "—"} />
          <Dato label="Rol" valor={usuario.rol ?? "—"} />
        </dl>
      </section>
    </main>
  );
}

function NavCard({ href, titulo, desc }: { href: string; titulo: string; desc: string }) {
  return (
    <a
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-900 hover:shadow-sm"
    >
      <p className="font-semibold">{titulo}</p>
      <p className="text-sm text-slate-500">{desc}</p>
    </a>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{valor}</dd>
    </div>
  );
}
