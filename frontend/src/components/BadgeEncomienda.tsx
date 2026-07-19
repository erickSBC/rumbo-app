import type { EstadoEncomienda } from "@/types/domain";

const ESTILOS: Record<EstadoEncomienda, { clase: string; texto: string }> = {
  registrada: { clase: "bg-subtle text-ink-secondary", texto: "Registrada" },
  en_viaje: { clase: "bg-primary-subtle text-primary", texto: "En viaje" },
  en_destino: { clase: "bg-warning-subtle text-warning", texto: "En destino" },
  entregada: { clase: "bg-success-subtle text-success", texto: "Entregada" },
  anulada: { clase: "bg-danger-subtle text-danger", texto: "Anulada" },
};

/** Etiqueta de estado de una encomienda, con el color del design system. */
export function BadgeEncomienda({ estado }: { estado: EstadoEncomienda }) {
  const e = ESTILOS[estado] ?? ESTILOS.registrada;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${e.clase}`}>{e.texto}</span>
  );
}
