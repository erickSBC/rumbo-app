/**
 * Rate limit simple por usuario (§7.2: 10 consultas IA por minuto por usuario).
 *
 * Ventana deslizante en memoria: suficiente para el MVP con una sola instancia
 * de Cloud Run. Para multi-instancia (v2) migrar a un contador compartido
 * (Redis / Firestore).
 */
import type { Request, Response, NextFunction } from "express";

const ventanas = new Map<string, number[]>();

export function rateLimit(maxPorMinuto: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const uid = req.user?.uid ?? req.ip ?? "anon";
    const ahora = Date.now();
    const desde = ahora - 60_000;

    const marcas = (ventanas.get(uid) ?? []).filter((t) => t > desde);
    if (marcas.length >= maxPorMinuto) {
      res.status(429).json({ error: "Demasiadas consultas. Espera un momento e intenta de nuevo." });
      return;
    }
    marcas.push(ahora);
    ventanas.set(uid, marcas);
    next();
  };
}
