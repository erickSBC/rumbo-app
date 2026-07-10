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

/**
 * Panel del superadministrador (RF-16). Lista los tenants con su plan y estado
 * y permite suspender / reactivar. El SA no accede a datos operativos de los
 * tenants (§4.2) — este panel solo consume /api/superadmin/*.
 */
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
      ? "bg-red-100 text-red-800"
      : estado === "prueba"
      ? "bg-amber-100 text-amber-800"
      : "bg-emerald-100 text-emerald-800";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel de Rumbo</h1>
            <p className="text-sm text-slate-500">Empresas registradas en la plataforma</p>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
          >
            Cerrar sesión
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="p-3 font-medium">Empresa</th>
                <th className="p-3 font-medium">RUC</th>
                <th className="p-3 font-medium">Plan</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Registro</th>
                <th className="p-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} className="p-4 text-slate-500">
                    Cargando…
                  </td>
                </tr>
              ) : (
                empresas.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100">
                    <td className="p-3">
                      <p className="font-medium">{e.razonSocial}</p>
                      <p className="text-xs text-slate-400">{e.email}</p>
                    </td>
                    <td className="p-3">{e.ruc}</td>
                    <td className="p-3 capitalize">{e.planId}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeEstado(e.estado)}`}>
                        {e.estado}
                      </span>
                    </td>
                    <td className="p-3">{fechaPe(e.fechaRegistro)}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => cambiarEstado(e)}
                        disabled={ocupadoId === e.id}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                          e.estado === "suspendida"
                            ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            : "border-red-300 text-red-700 hover:bg-red-50"
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
