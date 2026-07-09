/**
 * Middleware de autenticación (RF-05, §4.2 capa de aplicación).
 *
 * Verifica el ID token de Firebase enviado en `Authorization: Bearer <token>`
 * y adjunta a `req.user` el uid y los custom claims (empresaId, rol,
 * isSuperAdmin). El resto del backend deriva el `empresaId` de aquí —
 * jamás del cliente.
 */
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "../config/firebase.js";

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

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      empresaId: decoded.empresaId as string | undefined,
      rol: decoded.rol as string | undefined,
      isSuperAdmin: decoded.isSuperAdmin as boolean | undefined,
    };
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado." });
  }
}
