import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { requireRol } from "../../middleware/requireRol.js";
import { venderPasaje, anularPasaje } from "./ventas.controller.js";

const router = Router();

// Vender pasaje: vendedor o admin_empresa (§4.1).
router.post("/", verifyToken, requireRol("vendedor", "admin_empresa"), venderPasaje);

// Anular pasaje: solo admin_empresa (§4.1).
router.put("/:id/anular", verifyToken, requireRol("admin_empresa"), anularPasaje);

export default router;
