/**
 * Módulo de encomiendas (RF-17..RF-20 — §4.5, §7.1).
 *
 * Guía única por tenant: el correlativo vive en un DOCUMENTO DETERMINISTA
 * `contadores/{empresaId}` que se lee e incrementa DENTRO de la misma
 * transacción que crea la encomienda. Es el mismo patrón del candado
 * antisobreventa (ventas.service): de dos registros simultáneos, Firestore
 * confirma uno, el otro reintenta, relee el contador y obtiene el siguiente
 * correlativo — nunca dos guías iguales.
 *
 * Ciclo de estados (RF-18):
 *   registrada → en_viaje (despacho por salida) → en_destino (llegada) →
 *   entregada (recojo con documento). Alterno: registrada → anulada (admin).
 * Cada transición queda en auditoría.
 */
import admin from "firebase-admin";
import { getDb } from "../../config/firebase.js";
import { registrarAuditoria } from "../../lib/audit.js";
import type { RegistrarEncomiendaInput } from "./encomiendas.schemas.js";

export class EncomiendaError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "EncomiendaError";
  }
}

const COL = "encomiendas";

/** Formatea el correlativo como guía: 123 → "ENC-000123". */
function formatearCodigo(correlativo: number): string {
  return `ENC-${String(correlativo).padStart(6, "0")}`;
}

export interface ResultadoRegistro {
  id: string;
  codigo: string;
  estado: string;
}

/**
 * RF-17. Registra una encomienda contra una salida programada del tenant y le
 * asigna una guía correlativa única mediante transacción sobre el contador.
 */
export async function registrarEncomiendaService(
  empresaId: string,
  usuarioId: string,
  input: RegistrarEncomiendaInput
): Promise<ResultadoRegistro> {
  const db = getDb();

  // --- Validación sobre datos estables (fuera de la transacción) ---
  const salidaSnap = await db.collection("salidas").doc(input.salidaId).get();
  if (!salidaSnap.exists || salidaSnap.data()!.empresaId !== empresaId) {
    throw new EncomiendaError(404, "Salida no encontrada.");
  }
  if (salidaSnap.data()!.estado !== "programada") {
    throw new EncomiendaError(400, "Solo se registran encomiendas en salidas programadas.");
  }

  // --- Transacción atómica: contador del tenant + creación de la encomienda ---
  const contadorRef = db.collection("contadores").doc(empresaId);
  const encomiendaRef = db.collection(COL).doc();

  const codigo = await db.runTransaction(async (tx) => {
    const cont = await tx.get(contadorRef);
    const actual = cont.exists ? ((cont.data()!.encomiendas as number) ?? 0) : 0;
    const siguiente = actual + 1;
    const codigo = formatearCodigo(siguiente);

    tx.set(contadorRef, { encomiendas: siguiente }, { merge: true });
    tx.set(encomiendaRef, {
      id: encomiendaRef.id,
      empresaId,
      salidaId: input.salidaId,
      codigo,
      remitenteNombre: input.remitenteNombre,
      remitenteDoc: input.remitenteDoc,
      destinatarioNombre: input.destinatarioNombre,
      destinatarioDoc: input.destinatarioDoc,
      descripcion: input.descripcion,
      pesoKg: input.pesoKg,
      precio: input.precio,
      registradoPor: usuarioId,
      fechaRegistro: admin.firestore.Timestamp.now(),
      entregadaA: "",
      fechaEntrega: null,
      estado: "registrada",
    });

    return codigo;
  });

  await registrarAuditoria({
    evento: "registro_encomienda",
    empresaId,
    usuarioId,
    detalle: { encomiendaId: encomiendaRef.id, codigo, salidaId: input.salidaId, precio: input.precio },
  });

  return { id: encomiendaRef.id, codigo, estado: "registrada" };
}

/** Verifica que la salida exista y sea del tenant (para despacho/llegada). */
async function assertSalidaDelTenant(empresaId: string, salidaId: string): Promise<void> {
  const snap = await getDb().collection("salidas").doc(salidaId).get();
  if (!snap.exists || snap.data()!.empresaId !== empresaId) {
    throw new EncomiendaError(404, "Salida no encontrada.");
  }
}

/**
 * Transición masiva por salida (despacho y llegada). Pasa todas las encomiendas
 * del tenant en esa salida que están en `desde` al estado `hacia`, en un batch.
 * Devuelve cuántas se movieron.
 */
async function transicionarSalida(
  empresaId: string,
  usuarioId: string,
  salidaId: string,
  desde: string,
  hacia: string,
  evento: string
): Promise<{ cantidad: number }> {
  const db = getDb();
  await assertSalidaDelTenant(empresaId, salidaId);

  // Dos filtros de igualdad (empresaId + salidaId); el estado se filtra en
  // memoria para no exigir índices y ser consistente con el resto del backend.
  const snap = await db
    .collection(COL)
    .where("empresaId", "==", empresaId)
    .where("salidaId", "==", salidaId)
    .get();
  const aMover = snap.docs.filter((d) => d.data().estado === desde);

  if (aMover.length > 0) {
    const batch = db.batch();
    for (const d of aMover) batch.update(d.ref, { estado: hacia });
    await batch.commit();
  }

  await registrarAuditoria({
    evento,
    empresaId,
    usuarioId,
    detalle: { salidaId, cantidad: aMover.length, desde, hacia },
  });

  return { cantidad: aMover.length };
}

/** RF-18. Despacho por salida: registrada → en_viaje. */
export function despacharSalidaService(empresaId: string, usuarioId: string, salidaId: string) {
  return transicionarSalida(empresaId, usuarioId, salidaId, "registrada", "en_viaje", "despacho_encomiendas");
}

/** RF-18. Llegada de la salida al destino: en_viaje → en_destino. */
export function marcarLlegadaSalidaService(empresaId: string, usuarioId: string, salidaId: string) {
  return transicionarSalida(empresaId, usuarioId, salidaId, "en_viaje", "en_destino", "llegada_encomiendas");
}

export interface ResultadoTransicion {
  id: string;
  codigo: string;
  estado: string;
}

/**
 * RF-18. Entrega: la encomienda (en_viaje o en_destino) pasa a entregada,
 * registrando el documento de quien recoge y la fecha. Transacción para que la
 * verificación de estado y la escritura sean atómicas.
 */
export async function entregarEncomiendaService(
  empresaId: string,
  usuarioId: string,
  encomiendaId: string,
  entregadaA: string
): Promise<ResultadoTransicion> {
  const db = getDb();
  const ref = db.collection(COL).doc(encomiendaId);

  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()!.empresaId !== empresaId) {
      throw new EncomiendaError(404, "Encomienda no encontrada.");
    }
    const enc = snap.data()!;
    if (enc.estado !== "en_viaje" && enc.estado !== "en_destino") {
      throw new EncomiendaError(400, `No se puede entregar una encomienda en estado "${enc.estado}".`);
    }
    tx.update(ref, {
      estado: "entregada",
      entregadaA,
      fechaEntrega: admin.firestore.Timestamp.now(),
    });
    return { id: encomiendaId, codigo: enc.codigo as string, estado: "entregada" };
  });

  // Evento más sensible del módulo (momento de posible disputa): quién entregó,
  // a qué documento y cuándo.
  await registrarAuditoria({
    evento: "entrega_encomienda",
    empresaId,
    usuarioId,
    detalle: { encomiendaId, codigo: resultado.codigo, entregadaA },
  });

  return resultado;
}

/** RF-18. Anulación (solo admin, solo desde registrada): registrada → anulada. */
export async function anularEncomiendaService(
  empresaId: string,
  usuarioId: string,
  encomiendaId: string
): Promise<ResultadoTransicion> {
  const db = getDb();
  const ref = db.collection(COL).doc(encomiendaId);

  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()!.empresaId !== empresaId) {
      throw new EncomiendaError(404, "Encomienda no encontrada.");
    }
    const enc = snap.data()!;
    if (enc.estado !== "registrada") {
      throw new EncomiendaError(400, "Solo se puede anular una encomienda aún no despachada.");
    }
    tx.update(ref, { estado: "anulada" });
    return { id: encomiendaId, codigo: enc.codigo as string, estado: "anulada" };
  });

  await registrarAuditoria({
    evento: "anulacion_encomienda",
    empresaId,
    usuarioId,
    detalle: { encomiendaId, codigo: resultado.codigo },
  });

  return resultado;
}
