/**
 * Extiende Express.Request con el usuario autenticado que inyecta el
 * middleware verifyToken. Estos datos provienen SIEMPRE del ID token
 * verificado, nunca del cuerpo o los parámetros de la petición (§4.2).
 */
import "express";

declare global {
  namespace Express {
    interface AuthUser {
      uid: string;
      email?: string;
      empresaId?: string;
      rol?: string;
      isSuperAdmin?: boolean;
    }
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
