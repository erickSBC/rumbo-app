/**
 * Controlador de encomiendas (RF-17..RF-20). empresaId y registradoPor salen
 * del token verificado, nunca del cliente (§4.2). El enforcement de la
 * capacidad `encomiendas` lo aplica el middleware requireCapacidad en las rutas.
 */
import type { Request, Response } from "express";
import admin from "firebase-admin";
import { getDb } from "../../config/firebase.js";
import { registrarEncomiendaSchema, entregarEncomiendaSchema } from "./encomiendas.schemas.js";
import {
  registrarEncomiendaService,
  despacharSalidaService,
  marcarLlegadaSalidaService,
  entregarEncomiendaService,
  anularEncomiendaService,
  EncomiendaError,
} from "./encomiendas.service.js";

const COL = "encomiendas";

/** Serializa Timestamps a ISO para el JSON de respuesta. */
function serializar(data: FirebaseFirestore.DocumentData): Record<string, unknown> {
  const ts = (v: unknown) =>
    v instanceof admin.firestore.Timestamp ? v.toDate().toISOString() : null;
  return {
    ...data,
    fechaRegistro: ts(data.fechaRegistro),
    fechaEntrega: ts(data.fechaEntrega),
  };
}

/** POST /api/encomiendas — RF-17. Registrar (vendedor o admin). */
export async function registrarEncomienda(req: Request, res: Response): Promise<void> {
  const parsed = registrarEncomiendaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos.", detalles: parsed.error.flatten().fieldErrors });
    return;
  }
  const empresaId = req.user!.empresaId!;
  const usuarioId = req.user!.uid;
  try {
    const resultado = await registrarEncomiendaService(empresaId, usuarioId, parsed.data);
    res.status(201).json({ ok: true, ...resultado });
  } catch (err) {
    if (err instanceof EncomiendaError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Error registrando encomienda:", err);
    res.status(500).json({ error: "No se pudo registrar la encomienda." });
  }
}

/** GET /api/encomiendas/salida/:salidaId — listado del tenant para esa salida. */
export async function listarPorSalida(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const snap = await getDb()
    .collection(COL)
    .where("empresaId", "==", empresaId)
    .where("salidaId", "==", String(req.params.salidaId))
    .get();
  const encomiendas = snap.docs
    .map((d) => serializar(d.data()))
    .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  res.json({ encomiendas });
}

/** GET /api/encomiendas/buscar?codigo=ENC-000123 — para la entrega (RF-18). */
export async function buscarPorCodigo(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const codigo = typeof req.query.codigo === "string" ? req.query.codigo.trim().toUpperCase() : "";
  if (!codigo) {
    res.status(400).json({ error: "Indica el código de guía." });
    return;
  }
  const snap = await getDb()
    .collection(COL)
    .where("empresaId", "==", empresaId)
    .where("codigo", "==", codigo)
    .limit(1)
    .get();
  if (snap.empty) {
    res.status(404).json({ error: "No existe una encomienda con ese código." });
    return;
  }
  res.json({ encomienda: serializar(snap.docs[0].data()) });
}

/** GET /api/encomiendas/pendientes — RF-20. Pendientes de entrega (solo admin). */
export async function listarPendientes(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const snap = await getDb().collection(COL).where("empresaId", "==", empresaId).get();
  const pendientes = snap.docs
    .map((d) => d.data())
    .filter((e) => e.estado === "en_viaje" || e.estado === "en_destino")
    .map(serializar)
    .sort((a, b) => String(a.fechaRegistro).localeCompare(String(b.fechaRegistro)));
  res.json({ encomiendas: pendientes, total: pendientes.length });
}

/** POST /api/encomiendas/salida/:salidaId/despachar — RF-18. registrada → en_viaje. */
export async function despacharSalida(req: Request, res: Response): Promise<void> {
  await ejecutarTransicionSalida(req, res, despacharSalidaService, "No se pudo despachar.");
}

/** POST /api/encomiendas/salida/:salidaId/llegada — RF-18. en_viaje → en_destino. */
export async function marcarLlegada(req: Request, res: Response): Promise<void> {
  await ejecutarTransicionSalida(req, res, marcarLlegadaSalidaService, "No se pudo marcar la llegada.");
}

async function ejecutarTransicionSalida(
  req: Request,
  res: Response,
  service: (e: string, u: string, s: string) => Promise<{ cantidad: number }>,
  errMsg: string
): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const usuarioId = req.user!.uid;
  try {
    const resultado = await service(empresaId, usuarioId, String(req.params.salidaId));
    res.json({ ok: true, ...resultado });
  } catch (err) {
    if (err instanceof EncomiendaError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(errMsg, err);
    res.status(500).json({ error: errMsg });
  }
}

/** PUT /api/encomiendas/:id/entregar — RF-18. Entrega con documento del receptor. */
export async function entregarEncomienda(req: Request, res: Response): Promise<void> {
  const parsed = entregarEncomiendaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos.", detalles: parsed.error.flatten().fieldErrors });
    return;
  }
  const empresaId = req.user!.empresaId!;
  const usuarioId = req.user!.uid;
  try {
    const resultado = await entregarEncomiendaService(
      empresaId,
      usuarioId,
      String(req.params.id),
      parsed.data.entregadaA
    );
    res.json({ ok: true, ...resultado });
  } catch (err) {
    if (err instanceof EncomiendaError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Error entregando encomienda:", err);
    res.status(500).json({ error: "No se pudo registrar la entrega." });
  }
}

/** PUT /api/encomiendas/:id/anular — RF-18. Solo admin, solo desde registrada. */
export async function anularEncomienda(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const usuarioId = req.user!.uid;
  try {
    const resultado = await anularEncomiendaService(empresaId, usuarioId, String(req.params.id));
    res.json({ ok: true, ...resultado });
  } catch (err) {
    if (err instanceof EncomiendaError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Error anulando encomienda:", err);
    res.status(500).json({ error: "No se pudo anular la encomienda." });
  }
}
