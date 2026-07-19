/**
 * Middleware de enforcement de CAPACIDADES por plan (RF-03, §7.2).
 *
 * Igual que los límites (buses/usuarios), las capacidades funcionales se leen
 * del documento del plan en Firestore — nunca fijas en código. Si el plan del
 * tenant no incluye la capacidad, responde 403 sugiriendo el plan de MENOR
 * precio que sí la incluye (derivado del catálogo). Mismo patrón que la
 * verificación de `asistenteIA` del asistente (§6.2).
 *
 * Se usa después de verifyToken.
 */
import type { Request, Response, NextFunction } from "express";
import { getDb } from "../config/firebase.js";

export function requireCapacidad(campo: string, etiqueta: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const empresaId = req.user!.empresaId!;
      const db = getDb();

      const empresaSnap = await db.collection("empresas").doc(empresaId).get();
      if (!empresaSnap.exists) {
        res.status(404).json({ error: "Empresa no encontrada." });
        return;
      }
      const planId = empresaSnap.data()!.planId as string;
      const planSnap = await db.collection("planes").doc(planId).get();
      const plan = planSnap.data();

      if (!plan || plan[campo] !== true) {
        // Sugerencia de upgrade: plan más barato con la capacidad (catálogo).
        const todos = await db.collection("planes").get();
        const conCapacidad = todos.docs
          .map((d) => d.data())
          .filter((p) => p[campo] === true)
          .sort((a, b) => (a.precioMensual as number) - (b.precioMensual as number));
        const sugerido = conCapacidad.length ? (conCapacidad[0].nombre as string) : null;
        res.status(403).json({
          error: sugerido
            ? `Tu plan no incluye ${etiqueta}. Actualiza a ${sugerido}.`
            : `Tu plan no incluye ${etiqueta}.`,
        });
        return;
      }

      next();
    } catch (err) {
      console.error("Error verificando la capacidad del plan:", err);
      res.status(500).json({ error: "No se pudo verificar el plan." });
    }
  };
}
