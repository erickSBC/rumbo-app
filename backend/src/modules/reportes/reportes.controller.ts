/**
 * Reporte de ventas del día (RF-14). Solo admin_empresa.
 *
 * "Día" = día en curso en America/Lima (lib/fecha.ts), medido sobre fechaVenta
 * (cuándo se vendió, no cuándo sale el bus). Los pasajes anulados no cuentan.
 * Consulta por empresaId + filtro de rango en memoria (patrón anti-índice del
 * Día 4; agregación en el backend según §5.4 "limitación reconocida").
 */
import type { Request, Response } from "express";
import admin from "firebase-admin";
import { getDb } from "../../config/firebase.js";
import { rangoDiaLima } from "../../lib/fecha.js";

export async function reporteDia(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const db = getDb();
  const { inicio, fin, fecha } = rangoDiaLima();

  const snap = await db
    .collection("pasajes")
    .where("empresaId", "==", empresaId)
    .where("estado", "==", "vendido")
    .get();

  const delDia = snap.docs
    .map((d) => d.data())
    .filter((p) => {
      const t = (p.fechaVenta as admin.firestore.Timestamp).toDate().getTime();
      return t >= inicio.getTime() && t < fin.getTime();
    });

  const totalPasajes = delDia.length;
  const montoTotal = delDia.reduce((sum, p) => sum + (p.precioPagado as number), 0);

  // Desglose por ruta: pasaje → salida → ruta (resolución en lote).
  const salidaIds = [...new Set(delDia.map((p) => p.salidaId as string))];
  const salidaDocs = salidaIds.length
    ? await db.getAll(...salidaIds.map((id) => db.collection("salidas").doc(id)))
    : [];
  const salidaARuta = new Map(
    salidaDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!.rutaId as string])
  );

  const rutaIds = [...new Set([...salidaARuta.values()])];
  const rutaDocs = rutaIds.length
    ? await db.getAll(...rutaIds.map((id) => db.collection("rutas").doc(id)))
    : [];
  const rutas = new Map(rutaDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));

  const porRuta = new Map<string, { ruta: string; pasajes: number; monto: number }>();
  for (const p of delDia) {
    const rutaId = salidaARuta.get(p.salidaId as string) ?? "desconocida";
    const rutaData = rutas.get(rutaId);
    const nombre = rutaData ? `${rutaData.origen} → ${rutaData.destino}` : "Ruta desconocida";
    const acc = porRuta.get(rutaId) ?? { ruta: nombre, pasajes: 0, monto: 0 };
    acc.pasajes += 1;
    acc.monto += p.precioPagado as number;
    porRuta.set(rutaId, acc);
  }

  res.json({
    fecha,
    totalPasajes,
    montoTotal,
    porRuta: [...porRuta.values()].sort((a, b) => b.monto - a.monto),
  });
}
