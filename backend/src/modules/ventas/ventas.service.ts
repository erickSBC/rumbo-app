/**
 * Venta de pasaje con transacción atómica (RF-10, RF-11 — §7.1).
 *
 * Prevención de sobreventa: Firestore NO protege contra "phantom reads" (una
 * query vacía dentro de una transacción no bloquea nada). Por eso el candado es
 * un DOCUMENTO DETERMINISTA por asiento —`salidas/{salidaId}/asientos/{numAsiento}`—
 * cuya sola existencia marca "ocupado". Leer/escribir ese doc concreto dentro de
 * la transacción sí es serializable: de dos ventas simultáneas del mismo asiento,
 * Firestore deja confirmar una y la otra reintenta, relee "existe" y es rechazada.
 *
 * El candado y el pasaje se escriben en la MISMA transacción. El pasaje mantiene
 * id autogenerado (historial, §4.5); el candado lo toca solo el backend.
 */
import admin from "firebase-admin";
import { getDb } from "../../config/firebase.js";
import { registrarAuditoria } from "../../lib/audit.js";
import type { VenderInput } from "./ventas.schemas.js";

export class VentaError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "VentaError";
  }
}

export interface ResultadoVenta {
  pasajeId: string;
  numAsiento: number;
  precioPagado: number;
}

export async function venderPasajeService(
  empresaId: string,
  vendedorId: string,
  input: VenderInput
): Promise<ResultadoVenta> {
  const db = getDb();
  const { salidaId, numAsiento, pasajeroNombre, pasajeroDoc } = input;

  // --- Validaciones sobre datos estables (fuera de la transacción) ---
  const salidaSnap = await db.collection("salidas").doc(salidaId).get();
  // Aislamiento: la salida debe ser del tenant del token (§4.2).
  if (!salidaSnap.exists || salidaSnap.data()!.empresaId !== empresaId) {
    throw new VentaError(404, "Salida no encontrada.");
  }
  const salida = salidaSnap.data()!;
  if (salida.estado === "cancelada") {
    throw new VentaError(400, "La salida está cancelada; no se puede vender.");
  }

  const busSnap = await db.collection("buses").doc(salida.busId as string).get();
  if (!busSnap.exists) {
    throw new VentaError(400, "El bus de la salida no existe.");
  }
  const numAsientos = busSnap.data()!.numAsientos as number;
  if (numAsiento < 1 || numAsiento > numAsientos) {
    throw new VentaError(400, `Asiento fuera de rango (1–${numAsientos}).`);
  }

  const precioPagado = salida.precio as number;

  // --- Transacción atómica: candado determinista del asiento + pasaje ---
  const candadoRef = db.collection("salidas").doc(salidaId).collection("asientos").doc(String(numAsiento));
  const pasajeRef = db.collection("pasajes").doc();

  await db.runTransaction(async (tx) => {
    const candado = await tx.get(candadoRef);
    if (candado.exists && candado.data()!.estado === "vendido") {
      // Otro vendedor tomó el asiento entre la selección y la confirmación.
      throw new VentaError(409, "Ese asiento acaba de venderse. Elige otro.");
    }

    tx.set(pasajeRef, {
      id: pasajeRef.id,
      empresaId,
      salidaId,
      numAsiento,
      pasajeroNombre,
      pasajeroDoc,
      vendedorId,
      fechaVenta: admin.firestore.Timestamp.now(),
      precioPagado,
      estado: "vendido",
    });

    // Candado: enlaza al pasaje para que la anulación (Día 7) pueda liberarlo.
    tx.set(candadoRef, { numAsiento, estado: "vendido", pasajeId: pasajeRef.id });
  });

  // Auditoría best-effort (no bloquea la respuesta).
  await registrarAuditoria({
    evento: "venta_pasaje",
    empresaId,
    usuarioId: vendedorId,
    detalle: { salidaId, numAsiento, pasajeId: pasajeRef.id, precioPagado },
  });

  return { pasajeId: pasajeRef.id, numAsiento, precioPagado };
}

/**
 * Anulación de pasaje (RF-12). En la MISMA transacción: el pasaje pasa a
 * "anulado" y se borra el doc-candado del asiento, liberándolo para revender.
 * Nunca quedan en estados contradictorios. El candado solo se borra si apunta a
 * este pasaje (protege contra liberar un asiento ya revendido).
 */
export async function anularPasajeService(
  empresaId: string,
  usuarioId: string,
  pasajeId: string
): Promise<{ pasajeId: string; numAsiento: number; salidaId: string }> {
  const db = getDb();
  const pasajeRef = db.collection("pasajes").doc(pasajeId);

  const resultado = await db.runTransaction(async (tx) => {
    const pasajeSnap = await tx.get(pasajeRef);
    // Aislamiento: solo pasajes del tenant del token.
    if (!pasajeSnap.exists || pasajeSnap.data()!.empresaId !== empresaId) {
      throw new VentaError(404, "Pasaje no encontrado.");
    }
    const pasaje = pasajeSnap.data()!;
    if (pasaje.estado !== "vendido") {
      throw new VentaError(400, "El pasaje ya está anulado.");
    }

    const salidaId = pasaje.salidaId as string;
    const numAsiento = pasaje.numAsiento as number;
    const candadoRef = db
      .collection("salidas")
      .doc(salidaId)
      .collection("asientos")
      .doc(String(numAsiento));
    const candadoSnap = await tx.get(candadoRef);

    tx.update(pasajeRef, { estado: "anulado" });
    // Libera el asiento solo si el candado corresponde a este pasaje.
    if (candadoSnap.exists && candadoSnap.data()!.pasajeId === pasajeId) {
      tx.delete(candadoRef);
    }

    return { pasajeId, numAsiento, salidaId };
  });

  await registrarAuditoria({
    evento: "anulacion_pasaje",
    empresaId,
    usuarioId,
    detalle: resultado,
  });

  return resultado;
}
