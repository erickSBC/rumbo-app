/**
 * Configuración de la aplicación Express: middlewares globales y montaje de
 * los routers de cada módulo de dominio. El arranque del servidor vive en
 * index.ts para separar configuración de ejecución (facilita tests futuros).
 */
import express, { type Express } from "express";
import cors from "cors";
import planesRouter from "./modules/planes/planes.routes.js";

export function createApp(): Express {
  const app = express();

  // CORS: en desarrollo se permite el origen del frontend Next.js.
  // En producción se restringe al dominio de Firebase Hosting (Día 10).
  const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());
  app.use(cors({ origin: allowedOrigins }));

  app.use(express.json());

  // Healthcheck (útil para Cloud Run y para verificar el arranque en local).
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "rumbo-backend", ts: new Date().toISOString() });
  });

  // Módulos de dominio.
  app.use("/api/planes", planesRouter);
  // Próximos días: /api/auth, /api/rutas, /api/buses, /api/salidas,
  // /api/pasajes, /api/ai — cada uno en su carpeta de src/modules.

  return app;
}
