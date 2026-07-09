"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { Plan } from "@/types/domain";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Registro autoservicio con elección de plan (RF-02, §4.4).
 * Flujo: POST /api/auth/registro → auto-login → REFRESCO FORZADO del token →
 * redirección al dashboard. El refresco (getIdToken(true)) es imprescindible
 * para que el ID token incluya los custom claims empresaId/rol recién asignados.
 */
function RegistroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [planes, setPlanes] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string>(searchParams.get("plan") ?? "");
  const [ruc, setRuc] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/planes`)
      .then((r) => r.json())
      .then((d: { planes: Plan[] }) => {
        setPlanes(d.planes ?? []);
        // Si no vino ?plan= o es inválido, selecciona el primero.
        setPlanId((prev) =>
          d.planes?.some((p) => p.id === prev) ? prev : d.planes?.[0]?.id ?? ""
        );
      })
      .catch(() => setError("No se pudieron cargar los planes."));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      // 1) Registrar la empresa (el backend crea Auth user, Empresa, Usuario y claims).
      const res = await fetch(`${API_URL}/api/auth/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruc, razonSocial, email, password, planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo completar el registro.");
      }

      // 2) Auto-login (§4.4 paso 11).
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // 3) REFRESCO FORZADO del token: los custom claims se asignaron en el
      //    servidor; sin forzar el refresco, el token en poder del cliente aún
      //    no los incluiría. getIdToken(true) obtiene uno nuevo con empresaId y rol.
      await cred.user.getIdToken(true);

      // 4) Ir al dashboard (ya con un token que lleva los claims).
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-lg px-6 py-12">
        <h1 className="text-2xl font-bold">Crea tu empresa</h1>
        <p className="mt-1 text-sm text-slate-500">
          14 días de prueba gratis, sin tarjeta.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Plan elegido</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {planes.map((p) => (
                <label
                  key={p.id}
                  className={`cursor-pointer rounded-lg border p-3 text-center text-sm ${
                    planId === p.id
                      ? "border-slate-900 bg-white ring-2 ring-slate-900"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={p.id}
                    checked={planId === p.id}
                    onChange={() => setPlanId(p.id)}
                    className="sr-only"
                  />
                  <span className="block font-semibold">{p.nombre}</span>
                  <span className="text-slate-500">S/ {p.precioMensual}/mes</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="RUC" value={ruc} onChange={setRuc} placeholder="11 dígitos" />
          <Field label="Razón social" value={razonSocial} onChange={setRazonSocial} />
          <Field label="Correo del administrador" type="email" value={email} onChange={setEmail} />
          <Field label="Contraseña" type="password" value={password} onChange={setPassword} />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={enviando || !planId}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {enviando ? "Creando empresa…" : "Empezar prueba de 14 días"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          ¿Ya tienes cuenta?{" "}
          <a href="/login" className="font-medium text-slate-900 hover:underline">
            Inicia sesión
          </a>
        </p>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
      />
    </label>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={null}>
      <RegistroForm />
    </Suspense>
  );
}
