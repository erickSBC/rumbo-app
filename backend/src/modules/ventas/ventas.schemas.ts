import { z } from "zod";

/**
 * Venta de pasaje en counter (RF-10). El cliente solo envía estos campos.
 * empresaId y vendedorId NO se aceptan del cliente: salen del token (§4.2).
 * precioPagado tampoco: sale de la salida.
 */
export const venderSchema = z.object({
  salidaId: z.string().trim().min(1, "Falta la salida."),
  numAsiento: z.number().int().min(1, "Asiento inválido."),
  pasajeroNombre: z.string().trim().min(2, "El nombre del pasajero es obligatorio.").max(80),
  pasajeroDoc: z.string().trim().min(6, "Documento inválido.").max(20),
});

export type VenderInput = z.infer<typeof venderSchema>;
