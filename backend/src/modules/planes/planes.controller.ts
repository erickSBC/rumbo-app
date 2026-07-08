/**
 * Módulo `planes` — catálogo público de planes (RF-01).
 * La colección `planes` es global y de lectura pública, por lo que este
 * endpoint no requiere autenticación.
 */
import type { Request, Response } from "express";
import { getDb } from "../../config/firebase.js";
import type { Plan } from "../../types/domain.js";

/** GET /api/planes — devuelve los tres planes ordenados por precio. */
export async function listarPlanes(_req: Request, res: Response): Promise<void> {
  try {
    const snapshot = await getDb().collection("planes").get();
    const planes: Plan[] = snapshot.docs
      .map((doc) => doc.data() as Plan)
      .sort((a, b) => a.precioMensual - b.precioMensual);

    res.json({ planes });
  } catch (err) {
    console.error("Error al listar planes:", err);
    res.status(500).json({ error: "No se pudieron obtener los planes." });
  }
}
