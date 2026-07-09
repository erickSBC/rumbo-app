import { z } from "zod";

/** Ruta (§4.5): origen, destino, duración estimada y precio base (RF-07). */
export const crearRutaSchema = z.object({
  origen: z.string().trim().min(2, "El origen es obligatorio.").max(80),
  destino: z.string().trim().min(2, "El destino es obligatorio.").max(80),
  duracionMin: z.number().int().positive("La duración debe ser mayor a 0."),
  precioBase: z.number().nonnegative("El precio base no puede ser negativo."),
});

/** En edición todos los campos son opcionales, pero al menos uno debe venir. */
export const editarRutaSchema = crearRutaSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "No hay campos para actualizar." }
);

export type CrearRutaInput = z.infer<typeof crearRutaSchema>;
