/**
 * Servicio de aprovisionamiento del tenant (RF-02, §4.2 y §4.4).
 *
 * Ejecuta el recuadro "Aprovisionamiento del tenant" del diagrama de
 * actividades (§4.4 pasos 7–10): crea la cuenta del admin en Firebase Auth,
 * el documento Empresa, el documento Usuario, asigna los custom claims y
 * registra la auditoría.
 *
 * Fuera de alcance del Día 2: no valida ni aplica límites de plan (RF-03).
 * Aquí solo se comprueba que el `planId` exista para no crear una empresa
 * apuntando a un plan inexistente.
 */
import admin from "firebase-admin";
import { getAuth, getDb } from "../../config/firebase.js";
import { registrarAuditoria } from "../../lib/audit.js";
import type { RegistroInput } from "./auth.schemas.js";

const DIAS_PRUEBA = 14;

export interface ResultadoRegistro {
  uid: string;
  empresaId: string;
  planId: string;
}

/** Error de negocio con código HTTP asociado para mapear en el controlador. */
export class RegistroError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "RegistroError";
  }
}

export async function registrarEmpresaService(
  input: RegistroInput
): Promise<ResultadoRegistro> {
  const auth = getAuth();
  const db = getDb();

  // (a) El plan elegido debe existir (una empresa no puede apuntar a un plan
  //     inexistente). No es enforcement de límites: solo integridad referencial.
  const planSnap = await db.collection("planes").doc(input.planId).get();
  if (!planSnap.exists) {
    throw new RegistroError(400, `El plan "${input.planId}" no existe.`);
  }

  // (b) El correo no debe estar ya registrado (§4.4 paso 6).
  try {
    await auth.getUserByEmail(input.email);
    throw new RegistroError(409, "Ese correo ya está registrado.");
  } catch (err) {
    if (err instanceof RegistroError) throw err;
    // auth/user-not-found es lo esperado: el correo está libre. Cualquier otro
    // error se propaga.
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
  }

  // (c) Crear la cuenta del administrador en Firebase Auth (§4.4 paso 7).
  const userRecord = await auth.createUser({
    email: input.email,
    password: input.password,
    displayName: input.razonSocial,
  });
  const uid = userRecord.uid;

  try {
    // (d) Crear el documento Empresa (§4.4 paso 8).
    //     empresaId = id del documento, para casar con la regla /empresas/{empresaId}.
    const empresaRef = db.collection("empresas").doc();
    const empresaId = empresaRef.id;

    const ahora = admin.firestore.Timestamp.now();
    const finPrueba = admin.firestore.Timestamp.fromMillis(
      ahora.toMillis() + DIAS_PRUEBA * 24 * 60 * 60 * 1000
    );

    await empresaRef.set({
      id: empresaId,
      ruc: input.ruc,
      razonSocial: input.razonSocial,
      email: input.email,
      planId: input.planId,
      estado: "prueba",
      fechaRegistro: ahora,
      fechaFinPrueba: finPrueba,
    });

    // (e) Crear el documento Usuario del admin (§4.5). id del doc = uid de Auth.
    await db.collection("usuarios").doc(uid).set({
      id: uid,
      empresaId,
      nombre: "Administrador",
      email: input.email,
      rol: "admin_empresa",
      estado: "activo",
    });

    // (f) Asignar custom claims (§4.4 paso 9). Estos viajan en el ID token y son
    //     la fuente del empresaId/rol para el backend — nunca el cliente (§4.2).
    await auth.setCustomUserClaims(uid, {
      empresaId,
      rol: "admin_empresa",
    });

    // (g) Auditoría del alta del tenant (§4.4 paso 10).
    await registrarAuditoria({
      evento: "registro_tenant",
      empresaId,
      usuarioId: uid,
      detalle: { planId: input.planId, ruc: input.ruc },
    });

    return { uid, empresaId, planId: input.planId };
  } catch (err) {
    // Rollback: si algo falla tras crear el usuario de Auth, lo borramos para
    // no dejar cuentas huérfanas sin empresa.
    await auth.deleteUser(uid).catch(() => undefined);
    throw err;
  }
}
