import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { requireRol } from "../../middleware/requireRol.js";
import { cambiarPlan } from "./empresas.controller.js";

const router = Router();

// RF-04 — cambio de plan: solo el admin de la empresa (§4.1).
router.put("/plan", verifyToken, requireRol("admin_empresa"), cambiarPlan);

export default router;
