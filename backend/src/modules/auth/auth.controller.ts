/**
 * Controlador del módulo auth: registro (RF-02) y sesión actual (RF-05).
 */
import type { Request, Response } from "express";
import { getDb } from "../../config/firebase.js";
import { registroSchema } from "./auth.schemas.js";
import { registrarEmpresaService, RegistroError } from "./auth.service.js";

/** POST /api/auth/registro — público. Aprovisiona el tenant. */
export async function registrarEmpresa(req: Request, res: Response): Promise<void> {
  const parsed = registroSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Datos de registro inválidos.",
      detalles: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const resultado = await registrarEmpresaService(parsed.data);
    res.status(201).json({
      ok: true,
      empresaId: resultado.empresaId,
      uid: resultado.uid,
      planId: resultado.planId,
    });
  } catch (err) {
    if (err instanceof RegistroError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Error en el registro:", err);
    res.status(500).json({ error: "No se pudo completar el registro." });
  }
}

/**
 * GET /api/auth/me — protegido. Devuelve la sesión y los datos de la empresa.
 * El `empresaId` se toma de req.user (token verificado), NUNCA del cliente (§4.2).
 */
export async function obtenerSesion(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user?.empresaId) {
    res.status(403).json({ error: "El usuario no tiene una empresa asociada." });
    return;
  }

  try {
    const empresaSnap = await getDb().collection("empresas").doc(user.empresaId).get();
    if (!empresaSnap.exists) {
      res.status(404).json({ error: "Empresa no encontrada." });
      return;
    }

    const empresa = empresaSnap.data()!;
    const finPrueba = empresa.fechaFinPrueba?.toDate?.() as Date | undefined;
    const diasPruebaRestantes = finPrueba
      ? Math.max(0, Math.ceil((finPrueba.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

    res.json({
      usuario: { uid: user.uid, email: user.email, rol: user.rol },
      empresa: {
        id: empresa.id,
        razonSocial: empresa.razonSocial,
        ruc: empresa.ruc,
        planId: empresa.planId,
        estado: empresa.estado,
        fechaFinPrueba: finPrueba?.toISOString() ?? null,
        diasPruebaRestantes,
      },
    });
  } catch (err) {
    console.error("Error al obtener la sesión:", err);
    res.status(500).json({ error: "No se pudo obtener la sesión." });
  }
}
