import { Router } from "express";
import { registrarEmpresa, obtenerSesion } from "./auth.controller.js";
import { verifyToken } from "../../middleware/verifyToken.js";

const router = Router();

// RF-02 — registro autoservicio con elección de plan (público).
router.post("/registro", registrarEmpresa);

// RF-05 — sesión actual (protegido; empresaId derivado del token).
router.get("/me", verifyToken, obtenerSesion);

export default router;
