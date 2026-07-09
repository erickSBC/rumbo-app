/**
 * CRUD de rutas (RF-07). Todo filtrado por el empresaId del token (§4.2):
 * ninguna operación acepta empresaId del cliente y ninguna toca documentos de
 * otro tenant.
 */
import type { Request, Response } from "express";
import { getDb } from "../../config/firebase.js";
import { crearRutaSchema, editarRutaSchema } from "./rutas.schemas.js";

const COL = "rutas";

export async function listarRutas(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const snap = await getDb().collection(COL).where("empresaId", "==", empresaId).get();
  const rutas = snap.docs.map((d) => d.data());
  res.json({ rutas });
}

export async function crearRuta(req: Request, res: Response): Promise<void> {
  const parsed = crearRutaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos.", detalles: parsed.error.flatten().fieldErrors });
    return;
  }
  const empresaId = req.user!.empresaId!;
  const ref = getDb().collection(COL).doc();
  const ruta = { id: ref.id, empresaId, ...parsed.data };
  await ref.set(ruta);
  res.status(201).json({ ruta });
}

export async function editarRuta(req: Request, res: Response): Promise<void> {
  const parsed = editarRutaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos.", detalles: parsed.error.flatten().fieldErrors });
    return;
  }
  const empresaId = req.user!.empresaId!;
  const ref = getDb().collection(COL).doc(String(req.params.id));
  const snap = await ref.get();
  // Aislamiento: solo se edita si el documento pertenece al tenant del token.
  if (!snap.exists || snap.data()!.empresaId !== empresaId) {
    res.status(404).json({ error: "Ruta no encontrada." });
    return;
  }
  await ref.update(parsed.data);
  const actualizado = await ref.get();
  res.json({ ruta: actualizado.data() });
}

export async function eliminarRuta(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const ref = getDb().collection(COL).doc(String(req.params.id));
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.empresaId !== empresaId) {
    res.status(404).json({ error: "Ruta no encontrada." });
    return;
  }
  await ref.delete();
  res.json({ ok: true });
}
