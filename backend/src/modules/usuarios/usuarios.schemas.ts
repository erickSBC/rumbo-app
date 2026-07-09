import { z } from "zod";

/** Alta de usuario interno con rol vendedor (RF-06). */
export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre es obligatorio.").max(80),
  email: z.string().trim().toLowerCase().email("Correo inválido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.").max(128),
});

/** Edición / desactivación de un vendedor. */
export const editarUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(2).max(80).optional(),
    estado: z.enum(["activo", "inactivo"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No hay campos para actualizar." });

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
