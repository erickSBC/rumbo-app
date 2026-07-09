"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { Usuario, Uso } from "@/types/domain";

/**
 * Gestión de usuarios internos con rol vendedor (RF-06) + uso "X de Y usuarios"
 * (RF-03). El conteo incluye al admin.
 */
export default function UsuariosPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [uso, setUso] = useState<Uso | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const data = await apiFetch<{ usuarios: Usuario[]; uso: Uso }>("/api/usuarios");
    setUsuarios(data.usuarios);
    setUso(data.uso);
    setCargando(false);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return router.replace("/login");
      cargar().catch((e) => setError((e as Error).message));
    });
    return () => unsub();
  }, [router, cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/usuarios", {
        method: "POST",
        body: JSON.stringify({ nombre, email, password }),
      });
      setNombre("");
      setEmail("");
      setPassword("");
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function alternarEstado(u: Usuario) {
    setError(null);
    try {
      await apiFetch(`/api/usuarios/${u.id}`, {
        method: "PUT",
        body: JSON.stringify({ estado: u.estado === "activo" ? "inactivo" : "activo" }),
      });
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const enTope = uso ? uso.actual >= uso.max : false;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <a href="/dashboard" className="text-sm text-slate-500 hover:underline">
          ← Volver al panel
        </a>

        <div className="mt-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Usuarios</h1>
          {uso && (
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                enTope ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
              }`}
            >
              {uso.actual} de {uso.max} usuarios
            </span>
          )}
        </div>

        {enTope && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Llegaste al límite de tu plan. Para agregar más usuarios, actualiza tu plan.
          </p>
        )}

        <form onSubmit={crear} className="mt-6 grid gap-3 sm:grid-cols-3">
          <Input label="Nombre" value={nombre} onChange={setNombre} />
          <Input label="Correo" type="email" value={email} onChange={setEmail} />
          <Input label="Contraseña" type="password" value={password} onChange={setPassword} />
          <button
            type="submit"
            className="sm:col-span-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Agregar vendedor
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <ul className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {cargando ? (
            <li className="p-4 text-sm text-slate-500">Cargando…</li>
          ) : (
            usuarios.map((u) => (
              <li key={u.id} className="flex items-center justify-between p-4">
                <span className="text-sm">
                  <strong>{u.nombre}</strong> · {u.email}{" "}
                  <span className="text-slate-400">({u.rol})</span>
                  {u.estado === "inactivo" && (
                    <span className="ml-2 text-amber-700">— inactivo</span>
                  )}
                </span>
                {u.rol === "vendedor" && (
                  <button
                    onClick={() => alternarEstado(u)}
                    className="text-sm text-slate-600 hover:underline"
                  >
                    {u.estado === "activo" ? "Desactivar" : "Activar"}
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

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}
