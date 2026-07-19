/**
 * Configuración de la aplicación Express: middlewares globales y montaje de
 * los routers de cada módulo de dominio. El arranque del servidor vive en
 * index.ts para separar configuración de ejecución (facilita tests futuros).
 */
import express, { type Express } from "express";
import cors from "cors";
import planesRouter from "./modules/planes/planes.routes.js";
import authRouter from "./modules/auth/auth.routes.js";
import rutasRouter from "./modules/rutas/rutas.routes.js";
import busesRouter from "./modules/flota/buses.routes.js";
import usuariosRouter from "./modules/usuarios/usuarios.routes.js";
import salidasRouter from "./modules/salidas/salidas.routes.js";
import ventasRouter from "./modules/ventas/ventas.routes.js";
import encomiendasRouter from "./modules/encomiendas/encomiendas.routes.js";
import reportesRouter from "./modules/reportes/reportes.routes.js";
import iaRouter from "./modules/ia/ia.routes.js";
import empresasRouter from "./modules/empresas/empresas.routes.js";
import superadminRouter from "./modules/superadmin/superadmin.routes.js";

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
  app.use("/api/auth", authRouter);
  app.use("/api/rutas", rutasRouter);
  app.use("/api/buses", busesRouter);
  app.use("/api/usuarios", usuariosRouter);
  app.use("/api/salidas", salidasRouter);
  app.use("/api/pasajes", ventasRouter);
  app.use("/api/encomiendas", encomiendasRouter);
  app.use("/api/reportes", reportesRouter);
  app.use("/api/ai", iaRouter);
  app.use("/api/empresa", empresasRouter);
  app.use("/api/superadmin", superadminRouter);

  return app;
}
