import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { requireRol } from "../../middleware/requireRol.js";
import { listarRutas, crearRuta, editarRuta, eliminarRuta } from "./rutas.controller.js";

const router = Router();

// Gestión de rutas: exclusiva del admin_empresa (§4.1).
router.use(verifyToken, requireRol("admin_empresa"));

router.get("/", listarRutas);
router.post("/", crearRuta);
router.put("/:id", editarRuta);
router.delete("/:id", eliminarRuta);

export default router;
