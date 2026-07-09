import { z } from "zod";

/** Bus (§4.5): placa y número de asientos (RF-08). */
export const crearBusSchema = z.object({
  placa: z.string().trim().min(6, "La placa es obligatoria.").max(10),
  numAsientos: z
    .number()
    .int()
    .min(1, "Debe tener al menos 1 asiento.")
    .max(90, "Número de asientos fuera de rango."),
});

export const editarBusSchema = z
  .object({
    placa: z.string().trim().min(6).max(10).optional(),
    numAsientos: z.number().int().min(1).max(90).optional(),
    estado: z.enum(["activo", "inactivo"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No hay campos para actualizar." });

export type CrearBusInput = z.infer<typeof crearBusSchema>;
