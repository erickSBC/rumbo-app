/**
 * Middleware de autorización por rol. Se usa después de verifyToken.
 * Ej.: gestionar rutas, buses y usuarios es exclusivo de `admin_empresa` (§4.1).
 */
import type { Request, Response, NextFunction } from "express";

export function requireRol(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rol = req.user?.rol;
    if (!rol || !roles.includes(rol)) {
      res.status(403).json({ error: "No tienes permiso para esta acción." });
      return;
    }
    next();
  };
}
