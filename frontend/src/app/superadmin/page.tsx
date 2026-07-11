"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";

interface EmpresaFila {
  id: string;
  razonSocial: string;
  ruc: string;
  email: string;
  planId: string;
  estado: string;
  fechaRegistro: string | null;
}

export default function SuperadminPage() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<EmpresaFila[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const data = await apiFetch<{ empresas: EmpresaFila[] }>("/api/superadmin/empresas");
    setEmpresas(data.empresas);
    setCargando(false);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.replace("/login");
      const { claims } = await user.getIdTokenResult();
      if (claims.isSuperAdmin !== true) return router.replace("/dashboard");
      cargar().catch((e) => {
        setError((e as Error).message);
        setCargando(false);
      });
    });
    return () => unsub();
  }, [router, cargar]);

  async function cambiarEstado(e: EmpresaFila) {
    const nuevo = e.estado === "suspendida" ? "activa" : "suspendida";
    if (
      nuevo === "suspendida" &&
      !confirm(`¿Suspender a ${e.razonSocial}? Sus usuarios no podrán operar.`)
    ) {
      return;
    }
    setOcupadoId(e.id);
    setError(null);
    try {
      await apiFetch(`/api/superadmin/empresas/${e.id}/estado`, {
        method: "PUT",
        body: JSON.stringify({ estado: nuevo }),
      });
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOcupadoId(null);
    }
  }

  const fechaPe = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", dateStyle: "short" }).format(
          new Date(iso)
        )
      : "—";

  const badgeEstado = (estado: string) =>
    estado === "suspendida"
      ? "bg-danger-subtle text-danger"
      : estado === "prueba"
      ? "bg-warning-subtle text-warning"
      : "bg-success-subtle text-success";

  return (
    <main className="min-h-screen bg-canvas text-ink">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white text-sm">R</span>
            <div>
              <p className="text-sm font-semibold">Panel de Rumbo</p>
              <p className="text-xs text-ink-muted">Superadministrador</p>
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
        <h1 className="text-2xl font-bold">Empresas registradas</h1>
        <p className="text-sm text-ink-muted">Gestiona los tenants de la plataforma</p>

        {error && <p className="mt-4 rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Empresa</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">RUC</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Plan</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Estado</th>
                <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Registro</th>
                <th className="p-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Acción</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} className="p-4 text-ink-muted">
                    Cargando…
                  </td>
                </tr>
              ) : (
                empresas.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0 hover:bg-subtle/50 transition">
                    <td className="p-3">
                      <p className="font-medium">{e.razonSocial}</p>
                      <p className="text-xs text-ink-muted">{e.email}</p>
                    </td>
                    <td className="p-3 tabular">{e.ruc}</td>
                    <td className="p-3 capitalize">{e.planId}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeEstado(e.estado)}`}>
                        {e.estado}
                      </span>
                    </td>
                    <td className="p-3 tabular">{fechaPe(e.fechaRegistro)}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => cambiarEstado(e)}
                        disabled={ocupadoId === e.id}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 transition ${
                          e.estado === "suspendida"
                            ? "border-success/30 text-success hover:bg-success-subtle"
                            : "border-danger/30 text-danger hover:bg-danger-subtle"
                        }`}
                      >
                        {ocupadoId === e.id
                          ? "…"
                          : e.estado === "suspendida"
                          ? "Reactivar"
                          : "Suspender"}
                      </button>
                    </td>
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
