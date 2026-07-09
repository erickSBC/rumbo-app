import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { requireRol } from "../../middleware/requireRol.js";
import { listarUsuarios, crearUsuario, editarUsuario } from "./usuarios.controller.js";

const router = Router();

router.use(verifyToken, requireRol("admin_empresa"));

router.get("/", listarUsuarios);
router.post("/", crearUsuario);
router.put("/:id", editarUsuario);

export default router;
