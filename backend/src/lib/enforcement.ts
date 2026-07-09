/**
 * Enforcement de límites por plan (RF-03, §7.2).
 *
 * Regla de oro: los límites se verifican SIEMPRE en el backend y se LEEN del
 * documento del plan en Firestore — nunca están fijos en el código. Ocultar un
 * botón en la UI no es seguridad.
 */
import { getDb } from "../config/firebase.js";

/** Error de límite alcanzado; se mapea a HTTP 403 en el controlador. */
export class LimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitError";
  }
}

export interface Uso {
  actual: number;
  max: number;
}

interface EmpresaPlan {
  planId: string;
  planNombre: string;
  precioMensual: number;
  maxBuses: number;
  maxUsuarios: number;
}

/** Lee la empresa y su plan (fuente de los límites). */
async function getEmpresaYPlan(empresaId: string): Promise<EmpresaPlan> {
  const db = getDb();
  const empresaSnap = await db.collection("empresas").doc(empresaId).get();
  if (!empresaSnap.exists) {
    throw new LimitError("La empresa no existe.");
  }
  const planId = empresaSnap.data()!.planId as string;

  const planSnap = await db.collection("planes").doc(planId).get();
  if (!planSnap.exists) {
    throw new LimitError(`El plan "${planId}" del tenant no existe.`);
  }
  const plan = planSnap.data()!;
  return {
    planId,
    planNombre: plan.nombre as string,
    precioMensual: plan.precioMensual as number,
    maxBuses: plan.maxBuses as number,
    maxUsuarios: plan.maxUsuarios as number,
  };
}

/** Cuenta documentos del tenant en una colección con aggregate count(). */
async function contarDelTenant(coleccion: string, empresaId: string): Promise<number> {
  const snap = await getDb()
    .collection(coleccion)
    .where("empresaId", "==", empresaId)
    .count()
    .get();
  return snap.data().count;
}

/**
 * Sugiere el plan inmediatamente superior por precio. Devuelve null si el
 * tenant ya está en el plan más caro (p. ej. Terminal) — en ese caso no existe
 * un "plan siguiente" que ofrecer.
 */
async function sugerirPlanSuperior(precioActual: number): Promise<string | null> {
  const snap = await getDb()
    .collection("planes")
    .where("precioMensual", ">", precioActual)
    .orderBy("precioMensual", "asc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data().nombre as string;
}

type Recurso = "buses" | "usuarios";

const CONFIG: Record<Recurso, { coleccion: string; campoMax: keyof EmpresaPlan; etiqueta: string }> = {
  buses: { coleccion: "buses", campoMax: "maxBuses", etiqueta: "buses" },
  usuarios: { coleccion: "usuarios", campoMax: "maxUsuarios", etiqueta: "usuarios" },
};

/** Devuelve el uso actual vs. el límite del plan (para la UI: "4 de 5"). */
export async function getUso(recurso: Recurso, empresaId: string): Promise<Uso> {
  const { coleccion, campoMax } = CONFIG[recurso];
  const plan = await getEmpresaYPlan(empresaId);
  const actual = await contarDelTenant(coleccion, empresaId);
  return { actual, max: plan[campoMax] as number };
}

/**
 * Lanza LimitError si crear un recurso más excedería el límite del plan.
 * Se llama antes de cada creación de bus o usuario.
 */
export async function assertPuedeCrear(recurso: Recurso, empresaId: string): Promise<void> {
  const { coleccion, campoMax, etiqueta } = CONFIG[recurso];
  const plan = await getEmpresaYPlan(empresaId);
  const max = plan[campoMax] as number;
  const actual = await contarDelTenant(coleccion, empresaId);

  if (actual >= max) {
    const superior = await sugerirPlanSuperior(plan.precioMensual);
    const mensaje = superior
      ? `Alcanzaste el límite de ${etiqueta} de tu plan ${plan.planNombre}. Actualiza a ${superior} para agregar más.`
      : `Alcanzaste el límite de ${etiqueta} de tu plan actual (${plan.planNombre}).`;
    throw new LimitError(mensaje);
  }
}
