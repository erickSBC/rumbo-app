/**
 * Middleware de autenticación (RF-05, §4.2 capa de aplicación).
 *
 * Verifica el ID token de Firebase enviado en `Authorization: Bearer <token>`
 * y adjunta a `req.user` el uid y los custom claims (empresaId, rol,
 * isSuperAdmin). El resto del backend deriva el `empresaId` de aquí —
 * jamás del cliente.
 *
 * Además bloquea a los tenants suspendidos (RF-16, §4.2): si el usuario
 * pertenece a una empresa con estado "suspendida", TODA la API responde 403.
 * Cuesta una lectura extra por request; asumible en el free tier del MVP.
 */
import type { Request, Response, NextFunction } from "express";
import { getAuth, getDb } from "../config/firebase.js";

export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Falta el token de autenticación." });
    return;
  }

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch {
    res.status(401).json({ error: "Token inválido o expirado." });
    return;
  }

  req.user = {
    uid: decoded.uid,
    email: decoded.email,
    empresaId: decoded.empresaId as string | undefined,
    rol: decoded.rol as string | undefined,
    isSuperAdmin: decoded.isSuperAdmin as boolean | undefined,
  };

  // Bloqueo de tenant suspendido (el SA no porta empresaId y no pasa por aquí).
  if (req.user.empresaId) {
    try {
      const empresaSnap = await getDb().collection("empresas").doc(req.user.empresaId).get();
      if (empresaSnap.exists && empresaSnap.data()!.estado === "suspendida") {
        res.status(403).json({
          error: "Tu empresa está suspendida. Contacta al soporte de Rumbo.",
        });
        return;
      }
    } catch (err) {
      console.error("No se pudo verificar el estado del tenant:", err);
      res.status(500).json({ error: "No se pudo verificar la cuenta." });
      return;
    }
  }

  next();
}
