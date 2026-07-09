/**
 * Auditoría de eventos sensibles (§7.2): registro de tenant, cambio de plan,
 * venta, anulación, consulta IA, suspensión. Se escribe en la colección
 * `auditoria`. Helper reutilizable por todos los módulos.
 *
 * La escritura es "best effort": si falla, se registra en consola pero no
 * interrumpe la operación principal (§6.3 paso 6: auditoría asíncrona sin
 * bloquear la respuesta).
 */
import { getDb } from "../config/firebase.js";
import admin from "firebase-admin";

export interface EventoAuditoria {
  evento: string;
  empresaId: string;
  usuarioId?: string;
  detalle?: Record<string, unknown>;
}

export async function registrarAuditoria(evento: EventoAuditoria): Promise<void> {
  try {
    await getDb().collection("auditoria").add({
      ...evento,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("No se pudo registrar la auditoría:", err);
  }
}
