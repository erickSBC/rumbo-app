"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setEnviando(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await cred.user.getIdToken(true);
      const { claims } = await cred.user.getIdTokenResult();
      router.push(claims.isSuperAdmin === true ? "/superadmin" : "/dashboard");
    } catch {
      setError("Correo o contraseña incorrectos.");
      setEnviando(false);
    }
  }

  async function handleReset() {
    setError(null);
    setAviso(null);
    if (!email) {
      setError("Escribe tu correo para enviarte el enlace de recuperación.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setAviso("Te enviamos un correo para restablecer tu contraseña.");
    } catch {
      setError("No se pudo enviar el correo de recuperación.");
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
            href="/registro"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition"
          >
            Prueba gratis
          </Link>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Panel decorativo — solo desktop */}
        <div className="hidden lg:flex lg:w-2/5 items-center justify-center relative bg-gradient-to-br from-primary to-emerald-700 p-12">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 right-12 h-44 w-44 rounded-full bg-white/30 blur-2xl" />
            <div className="absolute bottom-16 left-10 h-52 w-52 rounded-full bg-white/20 blur-3xl" />
          </div>
          <div className="relative text-white max-w-sm">
            <h2 className="text-3xl font-bold leading-tight">Bienvenido de vuelta</h2>
            <p className="mt-4 text-white/80 leading-relaxed">
              Accede al panel de control de tu empresa y gestiona toda tu operación desde un solo lugar.
            </p>

            <div className="mt-10 space-y-5">
              <FeatureItem
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="14" rx="2" />
                    <path d="M3 10h18M7 17v2M17 17v2" />
                  </svg>
                }
                title="Gestiona tu flota"
                subtitle="Buses, rutas y salidas en tiempo real"
              />
              <FeatureItem
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 20V10M12 20V4M6 20v-6" />
                  </svg>
                }
                title="Reportes al instante"
                subtitle="Ventas del día, manifiestos y más"
              />
              <FeatureItem
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                    <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
                  </svg>
                }
                title="Asistente con IA"
                subtitle="Consulta tu operación en lenguaje natural"
              />
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm animate-fade-in-up">
            <h1 className="text-2xl font-bold">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-ink-muted">Accede al panel de tu empresa.</p>

            <form
              onSubmit={handleLogin}
              className="mt-8 space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm"
            >
              <label className="block">
                <span className="text-sm font-medium text-ink-secondary">Correo</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink-secondary">Contraseña</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>

              {error && (
                <p className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</p>
              )}
              {aviso && (
                <p className="rounded-lg bg-success-subtle px-3 py-2 text-sm text-success">{aviso}</p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md disabled:opacity-50 transition-all"
              >
                {enviando ? "Ingresando…" : "Ingresar"}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-ink-secondary hover:text-primary hover:underline transition"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-muted">
              ¿No tienes cuenta?{" "}
              <Link href="/" className="font-semibold text-primary hover:underline">
                Elige un plan
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function FeatureItem({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-white/70">{subtitle}</p>
      </div>
    </div>
  );
}
