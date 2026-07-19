import { z } from "zod";

/**
 * Registro de encomienda (RF-17). El cliente solo envía estos campos.
 * empresaId y registradoPor NO se aceptan del cliente: salen del token (§4.2).
 * El código de guía lo genera el backend (contador transaccional).
 */
export const registrarEncomiendaSchema = z.object({
  salidaId: z.string().trim().min(1, "Falta la salida."),
  remitenteNombre: z.string().trim().min(2, "Nombre del remitente obligatorio.").max(80),
  remitenteDoc: z.string().trim().min(6, "Documento del remitente inválido.").max(20),
  destinatarioNombre: z.string().trim().min(2, "Nombre del destinatario obligatorio.").max(80),
  destinatarioDoc: z.string().trim().min(6, "Documento del destinatario inválido.").max(20),
  descripcion: z.string().trim().min(2, "Describe el contenido.").max(160),
  pesoKg: z.number().positive("El peso debe ser mayor a 0.").max(1000, "Peso fuera de rango."),
  precio: z.number().min(0, "Precio inválido.").max(100000, "Precio fuera de rango."),
});

export type RegistrarEncomiendaInput = z.infer<typeof registrarEncomiendaSchema>;

/** Entrega de encomienda (RF-18): documento de quien recoge el paquete. */
export const entregarEncomiendaSchema = z.object({
  entregadaA: z.string().trim().min(6, "Documento de quien recoge inválido.").max(20),
});

export type EntregarEncomiendaInput = z.infer<typeof entregarEncomiendaSchema>;
