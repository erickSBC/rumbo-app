import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { requireSuperAdmin } from "../../middleware/requireSuperAdmin.js";
import { listarEmpresas, cambiarEstadoEmpresa } from "./superadmin.controller.js";

const router = Router();

// RF-16 — panel del superadministrador (§4.1, §4.2).
router.use(verifyToken, requireSuperAdmin);

router.get("/empresas", listarEmpresas);
router.put("/empresas/:id/estado", cambiarEstadoEmpresa);

export default router;
