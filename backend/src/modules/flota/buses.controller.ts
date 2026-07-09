/**
 * CRUD de buses (RF-08) con enforcement de maxBuses (RF-03).
 * Filtrado por empresaId del token (§4.2). El límite se lee del plan en
 * Firestore vía el helper de enforcement, nunca fijo en código (§7.2).
 */
import type { Request, Response } from "express";
import { getDb } from "../../config/firebase.js";
import { assertPuedeCrear, getUso, LimitError } from "../../lib/enforcement.js";
import { crearBusSchema, editarBusSchema } from "./buses.schemas.js";

const COL = "buses";

export async function listarBuses(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const snap = await getDb().collection(COL).where("empresaId", "==", empresaId).get();
  const buses = snap.docs.map((d) => d.data());
  const uso = await getUso("buses", empresaId); // { actual, max } para "X de Y"
  res.json({ buses, uso });
}

export async function crearBus(req: Request, res: Response): Promise<void> {
  const parsed = crearBusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos.", detalles: parsed.error.flatten().fieldErrors });
    return;
  }
  const empresaId = req.user!.empresaId!;

  // RF-03: enforcement ANTES de crear. Se hace en el backend siempre.
  try {
    await assertPuedeCrear("buses", empresaId);
  } catch (err) {
    if (err instanceof LimitError) {
      res.status(403).json({ error: err.message });
      return;
    }
    throw err;
  }

  const ref = getDb().collection(COL).doc();
  const bus = { id: ref.id, empresaId, estado: "activo", ...parsed.data };
  await ref.set(bus);
  res.status(201).json({ bus });
}

export async function editarBus(req: Request, res: Response): Promise<void> {
  const parsed = editarBusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos.", detalles: parsed.error.flatten().fieldErrors });
    return;
  }
  const empresaId = req.user!.empresaId!;
  const ref = getDb().collection(COL).doc(String(req.params.id));
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.empresaId !== empresaId) {
    res.status(404).json({ error: "Bus no encontrado." });
    return;
  }
  await ref.update(parsed.data);
  const actualizado = await ref.get();
  res.json({ bus: actualizado.data() });
}

export async function eliminarBus(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const ref = getDb().collection(COL).doc(String(req.params.id));
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.empresaId !== empresaId) {
    res.status(404).json({ error: "Bus no encontrado." });
    return;
  }
  await ref.delete();
  res.json({ ok: true });
}
