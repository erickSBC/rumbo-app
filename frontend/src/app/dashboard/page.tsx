"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";

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
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="rounded-2xl border border-danger-subtle bg-danger-subtle px-6 py-4">
          <p className="text-sm text-danger">Error: {error}</p>
        </div>
      </main>
    );
  }

  if (!sesion) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-ink-muted">Cargando…</p>
      </main>
    );
  }

  const { usuario, empresa } = sesion;

  return (
    <main className="min-h-screen bg-canvas text-ink">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white text-sm">R</span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">{empresa.razonSocial}</p>
              <p className="text-xs text-ink-muted">{usuario.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-subtle hover:text-ink transition"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-8">
        {/* Banner de plan */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Tu plan</p>
            <p className="mt-1 text-xl font-bold capitalize">{empresa.planId}</p>
            {empresa.estado === "prueba" && empresa.diasPruebaRestantes !== null && (
              <span className="mt-2 inline-block rounded-full bg-warning-subtle px-3 py-1 text-xs font-medium text-warning">
                Prueba: te quedan {empresa.diasPruebaRestantes} días
              </span>
            )}
          </div>
          <a
            href="/dashboard/plan"
            className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-secondary hover:border-primary hover:text-primary transition"
          >
            Cambiar de plan
          </a>
        </div>

        {/* Navegación */}
        <nav className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NavCard href="/dashboard/rutas" titulo="Rutas" desc="Origen, destino y precio" icon={<RouteIcon />} />
          <NavCard href="/dashboard/buses" titulo="Buses" desc="Flota y asientos" icon={<BusIcon />} />
          <NavCard href="/dashboard/usuarios" titulo="Usuarios" desc="Vendedores del counter" icon={<UsersIcon />} />
          <NavCard href="/dashboard/salidas" titulo="Salidas" desc="Programación de salidas" icon={<CalendarIcon />} />
          <NavCard href="/dashboard/reporte" titulo="Reporte del día" desc="Ventas y montos de hoy" icon={<ChartIcon />} />
          <NavCard href="/dashboard/asistente" titulo="Asistente IA" desc="Pregunta sobre tu operación" icon={<AIIcon />} />
        </nav>

        {/* Info de la empresa */}
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dato label="RUC" valor={empresa.ruc} />
          <Dato label="Estado" valor={empresa.estado} />
          <Dato label="Administrador" valor={usuario.email ?? "—"} />
          <Dato label="Rol" valor={usuario.rol ?? "—"} />
        </dl>
      </section>
    </main>
  );
}

function NavCard({ href, titulo, desc, icon }: { href: string; titulo: string; desc: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group flex items-start gap-4 rounded-xl border border-line bg-surface p-4 transition-all duration-150 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary transition-colors group-hover:bg-primary group-hover:text-white">
        {icon}
      </div>
      <div>
        <p className="font-semibold">{titulo}</p>
        <p className="text-sm text-ink-muted">{desc}</p>
      </div>
    </a>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium capitalize">{valor}</dd>
    </div>
  );
}

function RouteIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H12" />
    </svg>
  );
}
function BusIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="14" rx="2" /><path d="M3 10h18M7 17v2M17 17v2M7 7h0M17 7h0" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}
function AIIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" /><path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
    </svg>
  );
}
