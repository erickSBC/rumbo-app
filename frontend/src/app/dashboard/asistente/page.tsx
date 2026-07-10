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

/**
 * Asistente IA (RF-15) — ChatUI del Día 9: historial en pantalla, indicador de
 * "pensando" y manejo visual del mensaje de upgrade (403 por plan) con botón
 * que lleva al cambio de plan (RF-04), cerrando el círculo del guion de demo.
 */
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
      // El 403 de plan llega con el mensaje "Tu plan no incluye el asistente…".
      const esUpgrade = texto.toLowerCase().includes("plan no incluye");
      setMensajes((m) => [...m, { quien: "ia", texto, esUpgrade }]);
    } finally {
      setPensando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
        <div>
          <a href="/dashboard" className="text-sm text-slate-500 hover:underline">
            ← Volver al panel
          </a>
          <h1 className="mt-3 text-2xl font-bold">Asistente IA</h1>
          <p className="text-sm text-slate-500">
            Respuestas sobre tu operación, con los datos de tu empresa al momento.
          </p>
        </div>

        <div className="mt-6 flex-1 space-y-3 overflow-y-auto">
          {mensajes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
              <p className="text-sm text-slate-500">Prueba con una de estas preguntas:</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-slate-900"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensajes.map((m, i) =>
            m.esUpgrade ? (
              <div key={i} className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">{m.texto}</p>
                <p className="mt-1 text-sm text-amber-800">
                  El asistente IA está disponible en los planes Flota y Terminal.
                </p>
                <a
                  href="/dashboard/plan"
                  className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Cambiar de plan →
                </a>
              </div>
            ) : (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.quien === "yo"
                    ? "ml-auto bg-slate-900 text-white"
                    : "border border-slate-200 bg-white"
                }`}
              >
                {m.texto}
              </div>
            )
          )}

          {pensando && (
            <div className="flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
              <span className="ml-1 text-sm text-slate-500">Analizando tu operación…</span>
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
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pensando}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Enviar
          </button>
        </form>
      </section>
    </main>
  );
}
