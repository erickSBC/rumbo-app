import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { requireRol } from "../../middleware/requireRol.js";
import { reporteDia } from "./reportes.controller.js";

const router = Router();

// Reporte del día: solo admin_empresa (§4.1).
router.get("/dia", verifyToken, requireRol("admin_empresa"), reporteDia);

export default router;
