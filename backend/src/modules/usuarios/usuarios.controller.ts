/**
 * Gestión de usuarios internos con rol vendedor (RF-06) y enforcement de
 * maxUsuarios (RF-03). El conteo incluye al admin (decisión de diseño: el
 * límite del plan cuenta todos los usuarios del tenant).
 *
 * Filtrado por empresaId del token (§4.2). Crear un vendedor implica crear la
 * cuenta en Firebase Auth + custom claims + doc Usuario, con rollback (mismo
 * patrón que el registro del tenant).
 */
import type { Request, Response } from "express";
import { getAuth, getDb } from "../../config/firebase.js";
import { assertPuedeCrear, getUso, LimitError } from "../../lib/enforcement.js";
import { crearUsuarioSchema, editarUsuarioSchema } from "./usuarios.schemas.js";

const COL = "usuarios";

export async function listarUsuarios(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const snap = await getDb().collection(COL).where("empresaId", "==", empresaId).get();
  const usuarios = snap.docs.map((d) => d.data());
  const uso = await getUso("usuarios", empresaId); // incluye al admin
  res.json({ usuarios, uso });
}

export async function crearUsuario(req: Request, res: Response): Promise<void> {
  const parsed = crearUsuarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos.", detalles: parsed.error.flatten().fieldErrors });
    return;
  }
  const empresaId = req.user!.empresaId!;

  // RF-03: enforcement ANTES de crear (cuenta admin + vendedores).
  try {
    await assertPuedeCrear("usuarios", empresaId);
  } catch (err) {
    if (err instanceof LimitError) {
      res.status(403).json({ error: err.message });
      return;
    }
    throw err;
  }

  const auth = getAuth();
  const db = getDb();
  const { nombre, email, password } = parsed.data;

  // Correo no repetido.
  try {
    await auth.getUserByEmail(email);
    res.status(409).json({ error: "Ese correo ya está registrado." });
    return;
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
  }

  const userRecord = await auth.createUser({ email, password, displayName: nombre });
  const uid = userRecord.uid;

  try {
    await db.collection(COL).doc(uid).set({
      id: uid,
      empresaId,
      nombre,
      email,
      rol: "vendedor",
      estado: "activo",
    });
    // Custom claims: mismo empresaId del admin que lo crea (del token), rol vendedor.
    await auth.setCustomUserClaims(uid, { empresaId, rol: "vendedor" });

    const usuario = { id: uid, empresaId, nombre, email, rol: "vendedor", estado: "activo" };
    res.status(201).json({ usuario });
  } catch (err) {
    await auth.deleteUser(uid).catch(() => undefined); // rollback
    throw err;
  }
}

export async function editarUsuario(req: Request, res: Response): Promise<void> {
  const parsed = editarUsuarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos.", detalles: parsed.error.flatten().fieldErrors });
    return;
  }
  const empresaId = req.user!.empresaId!;
  const uid = String(req.params.id);
  const ref = getDb().collection(COL).doc(uid);
  const snap = await ref.get();

  // Aislamiento + alcance: solo usuarios del tenant y solo vendedores.
  if (!snap.exists || snap.data()!.empresaId !== empresaId) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }
  if (snap.data()!.rol !== "vendedor") {
    res.status(403).json({ error: "Solo se pueden editar usuarios con rol vendedor." });
    return;
  }

  await ref.update(parsed.data);

  // Al desactivar/activar, refleja el estado también en Firebase Auth.
  if (parsed.data.estado) {
    await getAuth().updateUser(uid, { disabled: parsed.data.estado === "inactivo" });
  }

  const actualizado = await ref.get();
  res.json({ usuario: actualizado.data() });
}
