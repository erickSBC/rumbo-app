/**
 * Cambio de plan (RF-04). El admin_empresa cambia su empresa a otro plan; el
 * cambio actualiza planId y los límites aplican DE INMEDIATO porque el
 * enforcement (RF-03) siempre lee el plan vigente de Firestore.
 *
 * Decisión de downgrade (documentada): se PERMITE bajar de plan aunque el
 * tenant exceda los límites del destino. No se borra nada; el enforcement
 * existente impide crear más recursos hasta volver bajo el límite. La
 * respuesta informa los excesos para que la UI los muestre.
 */
import type { Request, Response } from "express";
import { z } from "zod";
import { getDb } from "../../config/firebase.js";
import { getUso } from "../../lib/enforcement.js";
import { registrarAuditoria } from "../../lib/audit.js";

const cambioPlanSchema = z.object({
  planId: z.string().trim().min(1, "Debes indicar el plan destino."),
});

export async function cambiarPlan(req: Request, res: Response): Promise<void> {
  const parsed = cambioPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const empresaId = req.user!.empresaId!;
  const db = getDb();
  const { planId } = parsed.data;

  // El plan destino debe existir en el catálogo (leído de Firestore).
  const planSnap = await db.collection("planes").doc(planId).get();
  if (!planSnap.exists) {
    res.status(400).json({ error: `El plan "${planId}" no existe.` });
    return;
  }
  const plan = planSnap.data()!;

  const empresaRef = db.collection("empresas").doc(empresaId);
  const empresaSnap = await empresaRef.get();
  const planAnterior = empresaSnap.data()!.planId as string;
  if (planAnterior === planId) {
    res.status(400).json({ error: "Ya estás en ese plan." });
    return;
  }

  await empresaRef.update({ planId });

  await registrarAuditoria({
    evento: "cambio_plan",
    empresaId,
    usuarioId: req.user!.uid,
    detalle: { de: planAnterior, a: planId },
  });

  // Avisos de downgrade: recursos que quedaron sobre el nuevo límite.
  const [usoBuses, usoUsuarios] = await Promise.all([
    getUso("buses", empresaId),
    getUso("usuarios", empresaId),
  ]);
  const avisos: string[] = [];
  if (usoBuses.actual > usoBuses.max) {
    avisos.push(
      `Tienes ${usoBuses.actual} buses y el plan ${plan.nombre} permite ${usoBuses.max}: no podrás registrar más hasta estar bajo el límite.`
    );
  }
  if (usoUsuarios.actual > usoUsuarios.max) {
    avisos.push(
      `Tienes ${usoUsuarios.actual} usuarios y el plan ${plan.nombre} permite ${usoUsuarios.max}: no podrás crear más hasta estar bajo el límite.`
    );
  }

  res.json({ ok: true, planId, planNombre: plan.nombre, avisos });
}
