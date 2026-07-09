/**
 * Controlador de venta de pasajes (RF-10/11). empresaId y vendedorId salen del
 * token verificado, nunca del cliente (§4.2).
 */
import type { Request, Response } from "express";
import { venderSchema } from "./ventas.schemas.js";
import { venderPasajeService, anularPasajeService, VentaError } from "./ventas.service.js";

export async function venderPasaje(req: Request, res: Response): Promise<void> {
  const parsed = venderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos.", detalles: parsed.error.flatten().fieldErrors });
    return;
  }

  const empresaId = req.user!.empresaId!;
  const vendedorId = req.user!.uid; // ← del token, no del cliente

  try {
    const resultado = await venderPasajeService(empresaId, vendedorId, parsed.data);
    res.status(201).json({ ok: true, ...resultado });
  } catch (err) {
    if (err instanceof VentaError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Error en la venta:", err);
    res.status(500).json({ error: "No se pudo completar la venta." });
  }
}

/** PUT /api/pasajes/:id/anular — RF-12, solo admin_empresa. */
export async function anularPasaje(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const usuarioId = req.user!.uid;

  try {
    const resultado = await anularPasajeService(empresaId, usuarioId, String(req.params.id));
    res.json({ ok: true, ...resultado });
  } catch (err) {
    if (err instanceof VentaError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Error en la anulación:", err);
    res.status(500).json({ error: "No se pudo anular el pasaje." });
  }
}
