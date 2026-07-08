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
  asistenteIA: boolean;
}
