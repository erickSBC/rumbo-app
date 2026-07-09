import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { requireRol } from "../../middleware/requireRol.js";
import {
  listarSalidas,
  listarSalidasHoy,
  obtenerSalida,
  manifiestoSalida,
  crearSalida,
  editarSalida,
} from "./salidas.controller.js";

const router = Router();

// Todos los usuarios del tenant (admin y vendedor) pueden LISTAR salidas:
// el vendedor las necesita para vender (Día 5).
router.use(verifyToken);
router.get("/hoy", listarSalidasHoy); // antes de /:id para no colisionar
router.get("/", listarSalidas);
router.get("/:id/manifiesto", manifiestoSalida); // RF-13: admin y vendedor
router.get("/:id", obtenerSalida);

// Programar / editar / cancelar: solo admin_empresa (§4.1).
router.post("/", requireRol("admin_empresa"), crearSalida);
router.put("/:id", requireRol("admin_empresa"), editarSalida);

export default router;
