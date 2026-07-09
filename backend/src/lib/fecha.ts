/**
 * Utilidades de fecha en zona horaria de Perú (America/Lima, UTC−5 sin horario
 * de verano). "Hoy" debe ser el día peruano, no el UTC del servidor. Reutilizable
 * por salidas (Día 4) y el reporte del día (Día 7).
 */
const TZ = "America/Lima";
const OFFSET = "-05:00";

/** Fecha de hoy en Lima como YYYY-MM-DD. */
export function fechaHoyLima(): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Valida el formato YYYY-MM-DD. */
export function esFechaValida(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(Date.parse(`${fecha}T00:00:00${OFFSET}`));
}

/**
 * Rango [inicio, fin) que cubre un día completo en Lima. Si no se pasa fecha,
 * usa hoy en Lima.
 */
export function rangoDiaLima(fecha?: string): { inicio: Date; fin: Date; fecha: string } {
  const f = fecha ?? fechaHoyLima();
  const inicio = new Date(`${f}T00:00:00${OFFSET}`);
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  return { inicio, fin, fecha: f };
}

/**
 * Interpreta la fechaHora recibida del cliente. Si no trae zona horaria
 * (p. ej. el valor de un <input type="datetime-local">: "2026-07-08T14:30"),
 * se asume hora de Lima. Devuelve un Date válido o null.
 */
export function parseFechaHora(valor: string): Date | null {
  const tieneTz = /(Z|[+-]\d{2}:\d{2})$/.test(valor);
  const normalizado = tieneTz ? valor : `${valor}${OFFSET}`;
  const d = new Date(normalizado);
  return Number.isNaN(d.getTime()) ? null : d;
}
