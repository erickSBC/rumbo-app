import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { requireRol } from "../../middleware/requireRol.js";
import { listarBuses, crearBus, editarBus, eliminarBus } from "./buses.controller.js";

const router = Router();

router.use(verifyToken, requireRol("admin_empresa"));

router.get("/", listarBuses);
router.post("/", crearBus);
router.put("/:id", editarBus);
router.delete("/:id", eliminarBus);

export default router;
