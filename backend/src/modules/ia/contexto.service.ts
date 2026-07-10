/**
 * RecuperadorContexto (§6.2): verificación de plan + armado del briefing.
 *
 * - Verificación de plan (fragmento alt de §6.4): lee empresas/{id} →
 *   planes/{planId} de FIRESTORE (nunca fijo en código) y exige
 *   asistenteIA === true; si no, PlanSinIAError → 403 con mensaje de upgrade.
 * - Briefing fijo (§6.3 paso 2): ventas de hoy y últimos 7 días, top 5 rutas
 *   del mes, ocupación promedio por ruta, salidas de hoy y mañana, anulaciones
 *   del mes. TODAS las consultas filtradas por empresaId: el LLM nunca toca la
 *   base de datos; el backend decide qué entra al contexto (§2.3, §6.1).
 * - Formatos peruanos: montos S/ 1,234.56 y fechas DD/MM/AAAA.
 */
import admin from "firebase-admin";
import { getDb } from "../../config/firebase.js";
import { rangoDiaLima, fechaHoyLima } from "../../lib/fecha.js";

const DIA = 24 * 60 * 60 * 1000;

export class PlanSinIAError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanSinIAError";
  }
}

export interface ContextoIA {
  razonSocial: string;
  tablaResumen: string;
}

const soles = (n: number) =>
  `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fechaPe(d: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function horaPe(d: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Paso 1 (parte de autorización por plan): confirma que el plan del tenant
 * incluye el asistente. Lanza PlanSinIAError con mensaje de upgrade si no.
 */
export async function verificarPlanConIA(empresaId: string): Promise<{ razonSocial: string }> {
  const db = getDb();
  const empresaSnap = await db.collection("empresas").doc(empresaId).get();
  if (!empresaSnap.exists) throw new PlanSinIAError("Empresa no encontrada.");
  const empresa = empresaSnap.data()!;

  const planSnap = await db.collection("planes").doc(empresa.planId as string).get();
  const plan = planSnap.data();
  if (!plan || plan.asistenteIA !== true) {
    // Sugerencia de upgrade: plan más barato que sí incluye IA. Se filtra y
    // ordena en memoria (son 3 planes) para no exigir índice compuesto.
    const todos = await db.collection("planes").get();
    const conIA = todos.docs
      .map((d) => d.data())
      .filter((p) => p.asistenteIA === true)
      .sort((a, b) => (a.precioMensual as number) - (b.precioMensual as number));
    const sugerido = conIA.length ? (conIA[0].nombre as string) : null;
    throw new PlanSinIAError(
      sugerido
        ? `Tu plan no incluye el asistente. Actualiza a ${sugerido}.`
        : "Tu plan no incluye el asistente."
    );
  }

  return { razonSocial: empresa.razonSocial as string };
}

/** Paso 2: briefing operativo del tenant (§6.3). */
export async function obtenerContexto(empresaId: string): Promise<ContextoIA> {
  const { razonSocial } = await verificarPlanConIA(empresaId);
  const db = getDb();

  const { inicio: inicioHoy, fin: finHoy } = rangoDiaLima();
  const hace7d = inicioHoy.getTime() - 7 * DIA;
  const inicioMes = inicioHoy.getTime() - 30 * DIA;
  const finManana = finHoy.getTime() + DIA;

  // --- Pasajes del tenant (vendidos y anulados) ---
  const pasajesSnap = await db.collection("pasajes").where("empresaId", "==", empresaId).get();
  const pasajes = pasajesSnap.docs.map((d) => d.data());
  const ventaMs = (p: FirebaseFirestore.DocumentData) =>
    (p.fechaVenta as admin.firestore.Timestamp).toDate().getTime();

  const vendidos = pasajes.filter((p) => p.estado === "vendido");
  const hoy = vendidos.filter((p) => ventaMs(p) >= inicioHoy.getTime() && ventaMs(p) < finHoy.getTime());
  const ult7 = vendidos.filter((p) => ventaMs(p) >= hace7d);
  const mes = vendidos.filter((p) => ventaMs(p) >= inicioMes);
  const anuladosMes = pasajes.filter((p) => p.estado === "anulado" && ventaMs(p) >= inicioMes);

  const suma = (arr: FirebaseFirestore.DocumentData[]) =>
    arr.reduce((s, p) => s + (p.precioPagado as number), 0);

  // --- Salidas y rutas del tenant (para top rutas, ocupación y agenda) ---
  const [salidasSnap, rutasSnap, busesSnap] = await Promise.all([
    db.collection("salidas").where("empresaId", "==", empresaId).get(),
    db.collection("rutas").where("empresaId", "==", empresaId).get(),
    db.collection("buses").where("empresaId", "==", empresaId).get(),
  ]);
  const salidas = new Map(salidasSnap.docs.map((d) => [d.id, d.data()]));
  const rutas = new Map(rutasSnap.docs.map((d) => [d.id, d.data()]));
  const buses = new Map(busesSnap.docs.map((d) => [d.id, d.data()]));
  const nombreRuta = (rutaId: string) => {
    const r = rutas.get(rutaId);
    return r ? `${r.origen} – ${r.destino}` : "Ruta desconocida";
  };

  // Top 5 rutas del mes por pasajes vendidos (fecha de venta en el mes).
  const porRuta = new Map<string, { pasajes: number; monto: number }>();
  for (const p of mes) {
    const rutaId = (salidas.get(p.salidaId as string)?.rutaId as string) ?? "?";
    const acc = porRuta.get(rutaId) ?? { pasajes: 0, monto: 0 };
    acc.pasajes += 1;
    acc.monto += p.precioPagado as number;
    porRuta.set(rutaId, acc);
  }
  const top5 = [...porRuta.entries()]
    .sort((a, b) => b[1].pasajes - a[1].pasajes)
    .slice(0, 5);

  // Ocupación promedio por ruta: asientos vendidos / capacidad, en salidas del
  // último mes ya realizadas (no canceladas).
  const vendidosPorSalida = new Map<string, number>();
  for (const p of vendidos) {
    const sid = p.salidaId as string;
    vendidosPorSalida.set(sid, (vendidosPorSalida.get(sid) ?? 0) + 1);
  }
  const ocupPorRuta = new Map<string, { ocupadas: number; capacidad: number }>();
  for (const [sid, s] of salidas) {
    const fh = (s.fechaHora as admin.firestore.Timestamp).toDate().getTime();
    if (s.estado === "cancelada" || fh < inicioMes || fh >= finHoy.getTime()) continue;
    const cap = (buses.get(s.busId as string)?.numAsientos as number) ?? 0;
    if (!cap) continue;
    const acc = ocupPorRuta.get(s.rutaId as string) ?? { ocupadas: 0, capacidad: 0 };
    acc.ocupadas += vendidosPorSalida.get(sid) ?? 0;
    acc.capacidad += cap;
    ocupPorRuta.set(s.rutaId as string, acc);
  }

  // Salidas de hoy y mañana (programadas), ordenadas por hora.
  const agenda = [...salidas.values()]
    .filter((s) => {
      const fh = (s.fechaHora as admin.firestore.Timestamp).toDate().getTime();
      return fh >= inicioHoy.getTime() && fh < finManana && s.estado !== "cancelada";
    })
    .sort(
      (a, b) =>
        (a.fechaHora as admin.firestore.Timestamp).toMillis() -
        (b.fechaHora as admin.firestore.Timestamp).toMillis()
    );

  // --- Tabla resumen en texto plano para el prompt ---
  const lineas: string[] = [];
  lineas.push(`VENTAS DE HOY (${fechaPe(inicioHoy)}): ${hoy.length} pasajes por ${soles(suma(hoy))}.`);
  lineas.push(`VENTAS DE LOS ÚLTIMOS 7 DÍAS: ${ult7.length} pasajes por ${soles(suma(ult7))}.`);

  lineas.push(`TOP RUTAS DEL ÚLTIMO MES (por pasajes vendidos):`);
  if (top5.length === 0) lineas.push(`  (sin ventas en el último mes)`);
  top5.forEach(([rutaId, v], i) =>
    lineas.push(`  ${i + 1}. ${nombreRuta(rutaId)}: ${v.pasajes} pasajes, ${soles(v.monto)}.`)
  );

  lineas.push(`OCUPACIÓN PROMEDIO POR RUTA (salidas del último mes):`);
  if (ocupPorRuta.size === 0) lineas.push(`  (sin salidas realizadas en el último mes)`);
  for (const [rutaId, v] of ocupPorRuta) {
    const pct = v.capacidad ? Math.round((v.ocupadas / v.capacidad) * 100) : 0;
    lineas.push(`  - ${nombreRuta(rutaId)}: ${pct}% (${v.ocupadas} de ${v.capacidad} asientos).`);
  }

  lineas.push(`SALIDAS DE HOY Y MAÑANA (${agenda.length}):`);
  if (agenda.length === 0) lineas.push(`  (ninguna programada)`);
  for (const s of agenda) {
    const d = (s.fechaHora as admin.firestore.Timestamp).toDate();
    const vend = vendidosPorSalida.get(s.id as string) ?? 0;
    const cap = (buses.get(s.busId as string)?.numAsientos as number) ?? 0;
    lineas.push(
      `  - ${fechaPe(d)} ${horaPe(d)} ${nombreRuta(s.rutaId as string)}, bus ${
        buses.get(s.busId as string)?.placa ?? "?"
      }: ${vend} vendidos, ${Math.max(0, cap - vend)} asientos libres, precio ${soles(s.precio as number)}.`
    );
  }

  lineas.push(`ANULACIONES DEL ÚLTIMO MES: ${anuladosMes.length} pasajes anulados.`);

  return { razonSocial, tablaResumen: lineas.join("\n") };
}

/** Paso 3: plantilla EXACTA de la sección 6.3. */
export function armarPrompt(ctx: ContextoIA, pregunta: string): string {
  const ahora = new Date();
  const fechaHoraActual = `${fechaPe(ahora)} ${horaPe(ahora)} (hora de Perú, ${fechaHoyLima()})`;
  return `Eres el asistente ejecutivo de la empresa de transporte ${ctx.razonSocial}.
Respondes preguntas al administrador sobre el estado de su operación.

REGLAS ESTRICTAS:
- Responde en español peruano, tono profesional y directo.
- Usa únicamente los datos del CONTEXTO. Si el dato no está, responde
  "No tengo ese dato disponible en este momento".
- No inventes cifras. Máximo 3 párrafos. Sin saludos ni despedidas.
- Fechas DD/MM/AAAA. Montos S/ 1,234.56.

CONTEXTO OPERATIVO (al ${fechaHoraActual}):
${ctx.tablaResumen}

PREGUNTA DEL ADMINISTRADOR:
${pregunta}`;
}
