import { Router } from "express";
import { listarPlanes } from "./planes.controller.js";

const router = Router();

// GET /api/planes — catálogo público (RF-01)
router.get("/", listarPlanes);

export default router;
