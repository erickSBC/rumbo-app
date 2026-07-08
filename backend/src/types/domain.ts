/**
 * Modelo de dominio de Rumbo (sección 4.5 del documento de arquitectura).
 * Correspondencia 1:1 con las colecciones de Firestore (sección 5.4).
 * El campo `empresaId` es el discriminador multi-tenant (presente en todas
 * las entidades operativas; ausente en `Plan`, que es global y público).
 */

/** Colección global `planes`. Única fuente de verdad de precios y límites. */
export interface Plan {
  id: string;
  nombre: string;
  precioMensual: number;
  precioAnual: number;
  maxBuses: number;
  maxUsuarios: number;
  asistenteIA: boolean;
}

export type EstadoEmpresa = "prueba" | "activa" | "suspendida";

/** Tenant del SaaS. */
export interface Empresa {
  id: string;
  ruc: string;
  razonSocial: string;
  email: string;
  planId: string;
  estado: EstadoEmpresa;
  fechaRegistro: Date;
  fechaFinPrueba: Date;
}

export type RolUsuario = "admin_empresa" | "vendedor";

export interface Usuario {
  id: string;
  empresaId: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  estado: string;
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

export type EstadoSalida = "programada" | "completada" | "cancelada";

export interface Salida {
  id: string;
  empresaId: string;
  rutaId: string;
  busId: string;
  fechaHora: Date;
  precio: number;
  choferNombre: string;
  estado: EstadoSalida;
}

export type EstadoPasaje = "vendido" | "anulado";

export interface Pasaje {
  id: string;
  empresaId: string;
  salidaId: string;
  numAsiento: number;
  pasajeroNombre: string;
  pasajeroDoc: string;
  vendedorId: string;
  fechaVenta: Date;
  precioPagado: number;
  estado: EstadoPasaje;
}
