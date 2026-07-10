/**
 * Autorización del superadministrador (§4.2): exige el custom claim
 * isSuperAdmin en el token verificado. El SA no pertenece a ningún tenant
 * (no porta empresaId).
 */
import type { Request, Response, NextFunction } from "express";

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.isSuperAdmin !== true) {
    res.status(403).json({ error: "Solo el superadministrador puede hacer esto." });
    return;
  }
  next();
}
