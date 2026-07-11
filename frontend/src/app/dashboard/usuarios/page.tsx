"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import type { Usuario, Uso } from "@/types/domain";

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
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <a href="/dashboard" className="text-sm text-ink-muted hover:text-primary hover:underline transition">
          ← Volver al panel
        </a>

        <div className="mt-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Usuarios</h1>
          {uso && (
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                enTope ? "bg-warning-subtle text-warning" : "bg-subtle text-ink-secondary"
              }`}
            >
              {uso.actual} de {uso.max} usuarios
            </span>
          )}
        </div>

        {enTope && (
          <p className="mt-3 rounded-lg bg-warning-subtle p-3 text-sm text-warning">
            Llegaste al límite de tu plan. Para agregar más usuarios, actualiza tu plan.
          </p>
        )}

        <form onSubmit={crear} className="mt-6 grid gap-3 sm:grid-cols-3 rounded-2xl border border-line bg-surface p-5">
          <Input label="Nombre" value={nombre} onChange={setNombre} />
          <Input label="Correo" type="email" value={email} onChange={setEmail} />
          <Input label="Contraseña" type="password" value={password} onChange={setPassword} />
          <button
            type="submit"
            className="sm:col-span-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition"
          >
            Agregar vendedor
          </button>
        </form>

        {error && <p className="mt-3 rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</p>}

        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
          {cargando ? (
            <li className="p-4 text-sm text-ink-muted">Cargando…</li>
          ) : (
            usuarios.map((u) => (
              <li key={u.id} className="flex items-center justify-between p-4 hover:bg-subtle/50 transition">
                <span className="text-sm">
                  <strong>{u.nombre}</strong> · {u.email}{" "}
                  <span className="text-ink-muted">({u.rol})</span>
                  {u.estado === "inactivo" && (
                    <span className="ml-2 text-warning">— inactivo</span>
                  )}
                </span>
                {u.rol === "vendedor" && (
                  <button
                    onClick={() => alternarEstado(u)}
                    className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                      u.estado === "activo"
                        ? "border-warning/30 text-warning hover:bg-warning-subtle"
                        : "border-success/30 text-success hover:bg-success-subtle"
                    }`}
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
      <span className="text-sm font-medium text-ink-secondary">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
