import { z } from "zod";

/**
 * Validación de entrada del registro autoservicio (RF-02).
 * Los datos son los del §4.4 paso 4: RUC, razón social, correo y contraseña
 * del administrador, más el `planId` elegido en la landing (§4.4 paso 5).
 *
 * Nota multi-tenant: este esquema NO incluye `empresaId`. El tenant aún no
 * existe; su id se genera en el servidor. Ningún endpoint acepta `empresaId`
 * del cliente (§4.2).
 */
export const registroSchema = z.object({
  ruc: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "El RUC debe tener 11 dígitos."),
  razonSocial: z.string().trim().min(2, "La razón social es obligatoria.").max(120),
  email: z.string().trim().toLowerCase().email("Correo inválido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.").max(128),
  planId: z.string().trim().min(1, "Debes elegir un plan."),
});

export type RegistroInput = z.infer<typeof registroSchema>;
