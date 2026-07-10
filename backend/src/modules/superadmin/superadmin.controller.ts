/**
 * Panel del superadministrador (RF-16, §4.2). El SA gestiona tenants y planes
 * pero NO accede a los datos operativos de los clientes (pasajes, salidas…):
 * este módulo solo toca `empresas` y `auditoria`, y las reglas de Firestore lo
 * refuerzan del lado del cliente.
 */
import type { Request, Response } from "express";
import { z } from "zod";
import admin from "firebase-admin";
import { getDb } from "../../config/firebase.js";
import { registrarAuditoria } from "../../lib/audit.js";

/** GET /api/superadmin/empresas — todas las empresas con plan y estado. */
export async function listarEmpresas(_req: Request, res: Response): Promise<void> {
  const snap = await getDb().collection("empresas").get();
  const empresas = snap.docs
    .map((d) => {
      const e = d.data();
      return {
        id: e.id as string,
        razonSocial: e.razonSocial as string,
        ruc: e.ruc as string,
        email: e.email as string,
        planId: e.planId as string,
        estado: e.estado as string,
        fechaRegistro:
          (e.fechaRegistro as admin.firestore.Timestamp | undefined)?.toDate().toISOString() ?? null,
      };
    })
    .sort((a, b) => (a.fechaRegistro ?? "").localeCompare(b.fechaRegistro ?? ""));
  res.json({ empresas });
}

const estadoSchema = z.object({
  estado: z.enum(["activa", "suspendida"]),
});

/** PUT /api/superadmin/empresas/:id/estado — suspender / reactivar. */
export async function cambiarEstadoEmpresa(req: Request, res: Response): Promise<void> {
  const parsed = estadoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'El estado debe ser "activa" o "suspendida".' });
    return;
  }
  const empresaId = String(req.params.id);
  const ref = getDb().collection("empresas").doc(empresaId);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "Empresa no encontrada." });
    return;
  }

  const { estado } = parsed.data;
  await ref.update({ estado });

  await registrarAuditoria({
    evento: estado === "suspendida" ? "suspension_empresa" : "reactivacion_empresa",
    empresaId,
    usuarioId: req.user!.uid,
    detalle: { estadoAnterior: snap.data()!.estado, estadoNuevo: estado },
  });

  res.json({ ok: true, empresaId, estado });
}
