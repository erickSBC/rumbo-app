"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";

interface Mensaje {
  quien: "yo" | "ia";
  texto: string;
  esUpgrade?: boolean;
}

const SUGERENCIAS = [
  "¿Cuánto vendí hoy?",
  "¿Cuál es mi ruta más vendida?",
  "¿Cuántos asientos libres quedan en las salidas de hoy?",
];

export default function AsistentePage() {
  const router = useRouter();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.replace("/login");
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, pensando]);

  async function enviar(texto?: string) {
    const q = (texto ?? pregunta).trim();
    if (!q || pensando) return;
    setMensajes((m) => [...m, { quien: "yo", texto: q }]);
    setPregunta("");
    setPensando(true);
    try {
      const data = await apiFetch<{ respuesta: string }>("/api/ai/consulta", {
        method: "POST",
        body: JSON.stringify({ pregunta: q }),
      });
      setMensajes((m) => [...m, { quien: "ia", texto: data.respuesta }]);
    } catch (err) {
      const texto = (err as Error).message;
      const esUpgrade = texto.toLowerCase().includes("plan no incluye");
      setMensajes((m) => [...m, { quien: "ia", texto, esUpgrade }]);
    } finally {
      setPensando(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
        <div>
          <a href="/dashboard" className="text-sm text-ink-muted hover:text-primary hover:underline transition">
            ← Volver al panel
          </a>
          <h1 className="mt-3 text-2xl font-bold">Asistente IA</h1>
          <p className="text-sm text-ink-muted">
            Respuestas sobre tu operación, con los datos de tu empresa al momento.
          </p>
        </div>

        <div className="mt-6 flex-1 space-y-3 overflow-y-auto">
          {mensajes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                  <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
                </svg>
              </div>
              <p className="mt-3 text-sm text-ink-muted">Prueba con una de estas preguntas:</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-secondary hover:border-primary hover:text-primary transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensajes.map((m, i) =>
            m.esUpgrade ? (
              <div key={i} className="rounded-2xl border border-warning/30 bg-warning-subtle p-4">
                <p className="text-sm font-medium text-warning">{m.texto}</p>
                <p className="mt-1 text-sm text-warning/80">
                  El asistente IA es una capacidad exclusiva del plan Terminal.
                </p>
                <a
                  href="/dashboard/plan"
                  className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition"
                >
                  Cambiar de plan →
                </a>
              </div>
            ) : (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.quien === "yo"
                    ? "ml-auto bg-primary text-white"
                    : "border border-line bg-surface"
                }`}
              >
                {m.texto}
              </div>
            )
          )}

          {pensando && (
            <div className="flex w-fit items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40 [animation-delay:300ms]" />
              <span className="ml-1 text-sm text-ink-muted">Analizando tu operación…</span>
            </div>
          )}
          <div ref={finRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="mt-6 flex gap-2"
        >
          <input
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            maxLength={500}
            placeholder="Escribe tu pregunta (máx. 500 caracteres)…"
            className="flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={pensando}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60 transition"
          >
            Enviar
          </button>
        </form>
      </section>
    </main>
  );
}
