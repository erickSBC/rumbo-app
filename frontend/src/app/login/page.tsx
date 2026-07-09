"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * Login (RF-05). Autenticación con correo y contraseña vía Firebase Auth
 * (Web SDK, del lado del cliente). El backend solo verifica el token.
 * Incluye recuperación de contraseña por correo.
 */
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
      // Refresca el token para asegurar claims al día antes de entrar.
      await cred.user.getIdToken(true);
      router.push("/dashboard");
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-sm px-6 py-16">
        <h1 className="text-2xl font-bold">Iniciar sesión</h1>

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Correo</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {aviso && <p className="text-sm text-emerald-600">{aviso}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {enviando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <button
          onClick={handleReset}
          className="mt-4 text-sm text-slate-600 hover:text-slate-900 hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </button>

        <p className="mt-6 text-sm text-slate-500">
          ¿No tienes cuenta?{" "}
          <a href="/" className="font-medium text-slate-900 hover:underline">
            Elige un plan
          </a>
        </p>
      </section>
    </main>
  );
}
