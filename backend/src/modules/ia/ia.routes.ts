import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { requireRol } from "../../middleware/requireRol.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { consultarIA } from "./ia.controller.js";

const router = Router();

// Asistente IA: solo admin_empresa (§4.1), 10 consultas/min por usuario (§7.2).
router.post("/consulta", verifyToken, requireRol("admin_empresa"), rateLimit(10), consultarIA);

export default router;
