/**
 * Modelo de dominio compartido con el backend (sección 4.5).
 * En el MVP se mantiene una copia sincronizada en cada app; si crece, se
 * puede extraer a un paquete compartido del monorepo.
 */

export interface Plan {
  id: string;
  nombre: string;
  precioMensual: number;
  precioAnual: number;
  maxBuses: number;
  maxUsuarios: number;
  encomiendas: boolean;
  asistenteIA: boolean;
}

export interface Ruta {
  id: string;
  empresaId: string;
  origen: string;
  destino: string;
  duracionMin: number;
  precioBase: number;
}

export interface Bus {
  id: string;
  empresaId: string;
  placa: string;
  numAsientos: number;
  estado: string;
}

export interface Usuario {
  id: string;
  empresaId: string;
  nombre: string;
  email: string;
  rol: string;
  estado: string;
}

export interface Salida {
  id: string;
  empresaId: string;
  rutaId: string;
  busId: string;
  fechaHora: string; // ISO
  precio: number;
  choferNombre: string;
  estado: "programada" | "completada" | "cancelada";
}

/** Salida con datos de ruta y bus resueltos, tal como la devuelve el listado. */
export interface SalidaEnriquecida extends Salida {
  rutaOrigen: string | null;
  rutaDestino: string | null;
  busPlaca: string | null;
  busNumAsientos: number | null;
}

export interface Pasaje {
  id: string;
  empresaId: string;
  salidaId: string;
  numAsiento: number;
  pasajeroNombre: string;
  pasajeroDoc: string;
  vendedorId: string;
  fechaVenta: string; // ISO
  precioPagado: number;
  estado: "vendido" | "anulado";
}

export type EstadoEncomienda =
  | "registrada"
  | "en_viaje"
  | "en_destino"
  | "entregada"
  | "anulada";

export interface Encomienda {
  id: string;
  empresaId: string;
  salidaId: string;
  codigo: string;
  remitenteNombre: string;
  remitenteDoc: string;
  destinatarioNombre: string;
  destinatarioDoc: string;
  descripcion: string;
  pesoKg: number;
  precio: number;
  registradoPor: string;
  fechaRegistro: string | null; // ISO
  entregadaA: string;
  fechaEntrega: string | null; // ISO
  estado: EstadoEncomienda;
}

/** Uso actual vs. límite del plan (para "X de Y"). */
export interface Uso {
  actual: number;
  max: number;
}
