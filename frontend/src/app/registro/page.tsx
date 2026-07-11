"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { Plan } from "@/types/domain";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
      const res = await fetch(`${API_URL}/api/auth/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruc, razonSocial, email, password, planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo completar el registro.");
      }

      const cred = await signInWithEmailAndPassword(auth, email, password);
      await cred.user.getIdToken(true);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="border-b border-line bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white">
              R
            </span>
            <span className="text-lg font-bold tracking-tight">Rumbo</span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-subtle hover:text-ink transition"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Panel decorativo — solo desktop */}
        <div className="hidden lg:flex lg:w-2/5 items-center justify-center relative bg-gradient-to-br from-primary to-emerald-700 p-12">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-16 left-12 h-40 w-40 rounded-full bg-white/30 blur-2xl" />
            <div className="absolute bottom-20 right-8 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
          </div>
          <div className="relative text-white max-w-sm">
            <h2 className="text-3xl font-bold leading-tight">Comienza a operar en minutos</h2>
            <p className="mt-4 text-white/80 leading-relaxed">
              Registra tu empresa, configura tu primera ruta y vende tu primer pasaje hoy mismo.
            </p>
            <div className="mt-10 space-y-4">
              <StepItem number={1} text="Crea tu cuenta de empresa" />
              <StepItem number={2} text="Registra buses y rutas" />
              <StepItem number={3} text="Vende pasajes con mapa de asientos" />
            </div>
            <div className="mt-10 flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div className="text-sm">
                <p className="font-semibold">14 días de prueba gratis</p>
                <p className="text-white/70">Sin tarjeta de crédito requerida</p>
              </div>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div className="flex flex-1 items-start justify-center px-6 py-12 lg:items-center">
          <div className="w-full max-w-lg animate-fade-in-up">
            <h1 className="text-2xl font-bold">Crea tu empresa</h1>
            <p className="mt-1 text-sm text-ink-muted">14 días de prueba gratis, sin tarjeta.</p>

            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-6 rounded-2xl border border-line bg-surface p-6 shadow-sm"
            >
              <fieldset>
                <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Plan elegido
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {planes.map((p) => (
                    <label
                      key={p.id}
                      className={`cursor-pointer rounded-xl border p-3 text-center text-sm transition-all duration-150 ${
                        planId === p.id
                          ? "border-primary bg-primary-subtle ring-2 ring-primary/20 shadow-sm"
                          : "border-line bg-surface hover:border-line-strong hover:-translate-y-0.5"
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
                      <span className="text-ink-muted">S/ {p.precioMensual}/mes</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <Field label="RUC" value={ruc} onChange={setRuc} placeholder="11 dígitos" />
              <Field label="Razón social" value={razonSocial} onChange={setRazonSocial} />
              <Field label="Correo del administrador" type="email" value={email} onChange={setEmail} />
              <Field label="Contraseña" type="password" value={password} onChange={setPassword} />

              {error && (
                <p className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</p>
              )}

              <button
                type="submit"
                disabled={enviando || !planId}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md disabled:opacity-50 transition-all"
              >
                {enviando ? "Creando empresa…" : "Empezar prueba de 14 días"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-muted">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function StepItem({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
        {number}
      </span>
      <span className="text-sm text-white/90">{text}</span>
    </div>
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
      <span className="text-sm font-medium text-ink-secondary">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
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
