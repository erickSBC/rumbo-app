/**
 * ControladorIA (§6.2): POST /api/ai/consulta. Orquesta los 6 pasos de §6.3.
 */
import type { Request, Response } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../../lib/audit.js";
import { obtenerContexto, armarPrompt, PlanSinIAError } from "./contexto.service.js";
import { enviarPromptAGemini, GeminiNoDisponibleError } from "./gemini.adapter.js";

// §7.2: la pregunta no excede 500 caracteres.
const consultaSchema = z.object({
  pregunta: z.string().trim().min(3, "Escribe una pregunta.").max(500, "La pregunta no puede exceder 500 caracteres."),
});

const MENSAJE_NEUTRO = "El asistente no está disponible en este momento.";

export async function consultarIA(req: Request, res: Response): Promise<void> {
  // Paso 1 — auth ya pasó (verifyToken + requireRol + rateLimit); valida entrada.
  const parsed = consultaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Pregunta inválida." });
    return;
  }
  const empresaId = req.user!.empresaId!;
  const usuarioId = req.user!.uid;
  const inicio = Date.now();

  try {
    // Pasos 1b y 2 — verificación de plan (asistenteIA) + briefing del tenant.
    const ctx = await obtenerContexto(empresaId);

    // Paso 3 — prompt con la plantilla de §6.3.
    const prompt = armarPrompt(ctx, parsed.data.pregunta);

    // Paso 4 — Gemini (timeout 15 s).
    const respuesta = await enviarPromptAGemini(prompt);

    // Paso 6 — auditoría asíncrona: no bloquea la respuesta.
    void registrarAuditoria({
      evento: "consulta_ia",
      empresaId,
      usuarioId,
      detalle: { latenciaMs: Date.now() - inicio, chars: parsed.data.pregunta.length },
    });

    res.json({ respuesta });
  } catch (err) {
    if (err instanceof PlanSinIAError) {
      // Fragmento alt de §6.4: el plan no incluye el asistente.
      res.status(403).json({ error: err.message });
      return;
    }
    if (err instanceof GeminiNoDisponibleError) {
      // Paso 5 — mensaje neutro; el detalle real solo al log del servidor.
      console.error("Gemini no disponible:", err.message);
      void registrarAuditoria({
        evento: "consulta_ia_error",
        empresaId,
        usuarioId,
        detalle: { latenciaMs: Date.now() - inicio },
      });
      res.json({ respuesta: MENSAJE_NEUTRO });
      return;
    }
    console.error("Error en la consulta IA:", err);
    res.status(500).json({ error: "No se pudo procesar la consulta." });
  }
}
