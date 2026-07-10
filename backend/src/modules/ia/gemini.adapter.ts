/**
 * AdaptadorGemini (§6.2): única pieza que habla con la API de Gemini.
 *
 * - HTTP simple (fetch nativo), sin SDK adicional (§2.4).
 * - API key SOLO desde process.env.GEMINI_API_KEY (local: backend/.env
 *   gitignored; producción: inyectada en Cloud Run desde Secret Manager, §7.2).
 *   Jamás en el código ni en la imagen Docker.
 * - Timeout de 15 s con AbortController (§6.3 paso 4).
 * - Ante timeout, cuota agotada o cualquier error: GeminiNoDisponibleError, que
 *   el controlador traduce al mensaje neutro de §6.3 paso 5. El detalle real se
 *   loguea en el servidor; nunca viaja al cliente.
 */

/**
 * Cadena de modelos: se intenta en orden y se cae al siguiente ante error
 * (503 por congestión, 404 por retiro, timeout, etc.), con una segunda pasada
 * de reintento porque los 503 del free tier son picos transitorios.
 *
 * gemini-2.5-flash-lite va primero: responde en ~2 s y es el más estable del
 * free tier; gemini-3.5-flash (recién lanzado, congestionado a ratos) queda de
 * respaldo. (gemini-2.5-flash fue retirado de generateContent; 2.0-flash ya no
 * tiene cuota gratuita.)
 */
const MODELOS = ["gemini-2.5-flash-lite", "gemini-3.5-flash"];
const PASADAS = 2;
const PAUSA_REINTENTO_MS = 1_200;
const TIMEOUT_MS = 15_000;

export class GeminiNoDisponibleError extends Error {
  constructor(detalle: string) {
    super(detalle);
    this.name = "GeminiNoDisponibleError";
  }
}

async function llamarModelo(modelo: string, apiKey: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
            // Sin razonamiento extendido: respuestas rápidas y baratas; el caso
            // de uso es resumir un contexto ya calculado, no razonar largo.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => "");
      throw new GeminiNoDisponibleError(`[${modelo}] HTTP ${res.status}: ${cuerpo.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const texto = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!texto) {
      throw new GeminiNoDisponibleError(`[${modelo}] Respuesta vacía del modelo.`);
    }
    return texto;
  } catch (err) {
    if (err instanceof GeminiNoDisponibleError) throw err;
    // AbortError (timeout) o error de red.
    throw new GeminiNoDisponibleError(`[${modelo}] ${(err as Error).name}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function enviarPromptAGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiNoDisponibleError("GEMINI_API_KEY no configurada.");
  }

  const detalles: string[] = [];
  for (let pasada = 1; pasada <= PASADAS; pasada++) {
    for (const modelo of MODELOS) {
      try {
        return await llamarModelo(modelo, apiKey, prompt);
      } catch (err) {
        detalles.push(`pasada ${pasada} ${(err as Error).message.slice(0, 160)}`);
        console.warn(`Gemini: fallo con ${modelo} (pasada ${pasada}); probando siguiente.`);
      }
    }
    if (pasada < PASADAS) await new Promise((r) => setTimeout(r, PAUSA_REINTENTO_MS));
  }
  throw new GeminiNoDisponibleError(detalles.join(" | "));
}
