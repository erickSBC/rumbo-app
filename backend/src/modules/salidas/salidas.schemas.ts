import { z } from "zod";

/**
 * Salida (§4.5): combina ruta, bus, fecha/hora, precio y chofer (RF-09).
 * `fechaHora` llega como string; su interpretación de zona horaria se hace en
 * el controlador (parseFechaHora, asume Lima si no trae offset).
 */
export const crearSalidaSchema = z.object({
  rutaId: z.string().trim().min(1, "Debes elegir una ruta."),
  busId: z.string().trim().min(1, "Debes elegir un bus."),
  fechaHora: z.string().trim().min(1, "La fecha y hora son obligatorias."),
  choferNombre: z.string().trim().min(2, "El nombre del chofer es obligatorio.").max(80),
  // Opcional: si no viene, se toma el precioBase de la ruta.
  precio: z.number().nonnegative("El precio no puede ser negativo.").optional(),
});

export const editarSalidaSchema = z
  .object({
    fechaHora: z.string().trim().min(1).optional(),
    precio: z.number().nonnegative().optional(),
    choferNombre: z.string().trim().min(2).max(80).optional(),
    estado: z.enum(["programada", "completada", "cancelada"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No hay campos para actualizar." });

export type CrearSalidaInput = z.infer<typeof crearSalidaSchema>;
