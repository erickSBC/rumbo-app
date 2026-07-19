import { Router } from "express";
import { verifyToken } from "../../middleware/verifyToken.js";
import { requireRol } from "../../middleware/requireRol.js";
import { requireCapacidad } from "../../middleware/requireCapacidad.js";
import {
  registrarEncomienda,
  listarPorSalida,
  buscarPorCodigo,
  listarPendientes,
  despacharSalida,
  marcarLlegada,
  entregarEncomienda,
  anularEncomienda,
} from "./encomiendas.controller.js";

const router = Router();

// Todas las rutas requieren token y la capacidad `encomiendas` del plan (§4.1,
// RF-03). El label alimenta el mensaje de upgrade ("Tu plan no incluye …").
const capEncomiendas = requireCapacidad("encomiendas", "el módulo de encomiendas");

router.use(verifyToken, capEncomiendas);

// Listados y búsqueda (rutas estáticas antes que las paramétricas).
router.get("/pendientes", requireRol("admin_empresa"), listarPendientes);
router.get("/buscar", requireRol("vendedor", "admin_empresa"), buscarPorCodigo);
router.get("/salida/:salidaId", requireRol("vendedor", "admin_empresa"), listarPorSalida);

// Transiciones por salida (RF-18).
router.post("/salida/:salidaId/despachar", requireRol("vendedor", "admin_empresa"), despacharSalida);
router.post("/salida/:salidaId/llegada", requireRol("vendedor", "admin_empresa"), marcarLlegada);

// Registro (RF-17) y transiciones por encomienda (RF-18).
router.post("/", requireRol("vendedor", "admin_empresa"), registrarEncomienda);
router.put("/:id/entregar", requireRol("vendedor", "admin_empresa"), entregarEncomienda);
router.put("/:id/anular", requireRol("admin_empresa"), anularEncomienda);

export default router;
