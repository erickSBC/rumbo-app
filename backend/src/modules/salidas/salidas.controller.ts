/**
 * CRUD de salidas (RF-09). Filtrado por empresaId del token (§4.2).
 * Al programar, valida que la ruta y el bus pertenezcan al MISMO tenant, para
 * que no se pueda programar con recursos de otra empresa.
 *
 * Fuera de alcance (Día 5/6): mapa de asientos y venta. Aquí no se calculan
 * asientos ocupados ni se crean pasajes.
 */
import type { Request, Response } from "express";
import admin from "firebase-admin";
import { getDb } from "../../config/firebase.js";
import { esFechaValida, fechaHoyLima, parseFechaHora, rangoDiaLima } from "../../lib/fecha.js";
import { crearSalidaSchema, editarSalidaSchema } from "./salidas.schemas.js";

const COL = "salidas";

interface SalidaDoc {
  id: string;
  empresaId: string;
  rutaId: string;
  busId: string;
  fechaHora: admin.firestore.Timestamp;
  precio: number;
  choferNombre: string;
  estado: string;
}

/** Convierte el Timestamp a ISO para la respuesta JSON. */
function serializar(data: SalidaDoc) {
  return { ...data, fechaHora: data.fechaHora.toDate().toISOString() };
}

/** Enriquece las salidas con origen/destino de la ruta y placa del bus. */
async function enriquecer(salidas: SalidaDoc[]) {
  const db = getDb();
  const rutaIds = [...new Set(salidas.map((s) => s.rutaId))];
  const busIds = [...new Set(salidas.map((s) => s.busId))];

  const rutaRefs = rutaIds.map((id) => db.collection("rutas").doc(id));
  const busRefs = busIds.map((id) => db.collection("buses").doc(id));
  const refs = [...rutaRefs, ...busRefs];
  const docs = refs.length ? await db.getAll(...refs) : [];

  const mapa = new Map(docs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));

  return salidas.map((s) => {
    const ruta = mapa.get(s.rutaId);
    const bus = mapa.get(s.busId);
    return {
      ...serializar(s),
      rutaOrigen: ruta?.origen ?? null,
      rutaDestino: ruta?.destino ?? null,
      busPlaca: bus?.placa ?? null,
      busNumAsientos: bus?.numAsientos ?? null,
    };
  });
}

/** Lógica común de listado, con filtro opcional por día (en memoria). */
async function listarConFecha(empresaId: string, fecha: string | undefined, res: Response) {
  const snap = await getDb().collection(COL).where("empresaId", "==", empresaId).get();
  let salidas = snap.docs.map((d) => d.data() as SalidaDoc);

  let fechaFiltro: string | null = null;
  if (fecha) {
    if (!esFechaValida(fecha)) {
      res.status(400).json({ error: "Fecha inválida (usa YYYY-MM-DD)." });
      return;
    }
    const { inicio, fin } = rangoDiaLima(fecha);
    salidas = salidas.filter((s) => {
      const t = s.fechaHora.toDate().getTime();
      return t >= inicio.getTime() && t < fin.getTime();
    });
    fechaFiltro = fecha;
  }

  salidas.sort((a, b) => a.fechaHora.toMillis() - b.fechaHora.toMillis());
  const enriquecidas = await enriquecer(salidas);
  res.json({ fecha: fechaFiltro, salidas: enriquecidas });
}

export async function listarSalidas(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const fecha = typeof req.query.fecha === "string" ? req.query.fecha : undefined;
  await listarConFecha(empresaId, fecha, res);
}

/** GET /api/salidas/hoy — puerta de entrada a la venta del Día 5. */
export async function listarSalidasHoy(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  await listarConFecha(empresaId, fechaHoyLima(), res);
}

/**
 * GET /api/salidas/:id — una salida del tenant, enriquecida. Verifica que la
 * salida pertenezca al tenant del token (aislamiento). La usa el mapa de
 * asientos para saber cuántos asientos dibujar (numAsientos del bus).
 */
export async function obtenerSalida(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const snap = await getDb().collection(COL).doc(String(req.params.id)).get();
  if (!snap.exists || snap.data()!.empresaId !== empresaId) {
    res.status(404).json({ error: "Salida no encontrada." });
    return;
  }
  const [enriquecida] = await enriquecer([snap.data() as SalidaDoc]);
  res.json({ salida: enriquecida });
}

/**
 * GET /api/salidas/:id/manifiesto — RF-13 + RF-19. Manifiesto electrónico:
 * cabecera de la salida (ruta, fecha/hora, bus, chofer, empresa) + relación de
 * pasajeros con estado "vendido" + declaración de carga (encomiendas a bordo:
 * registrada o en_viaje) con total de bultos y peso, contenido mínimo
 * SUTRAN/MTC (§3.3). Accesible por admin y vendedor del tenant.
 */
export async function manifiestoSalida(req: Request, res: Response): Promise<void> {
  const empresaId = req.user!.empresaId!;
  const db = getDb();

  const salidaSnap = await db.collection(COL).doc(String(req.params.id)).get();
  if (!salidaSnap.exists || salidaSnap.data()!.empresaId !== empresaId) {
    res.status(404).json({ error: "Salida no encontrada." });
    return;
  }
  const [salida] = await enriquecer([salidaSnap.data() as SalidaDoc]);

  const empresaSnap = await db.collection("empresas").doc(empresaId).get();
  const razonSocial = empresaSnap.data()?.razonSocial ?? null;
  const ruc = empresaSnap.data()?.ruc ?? null;

  // Solo pasajeros con pasaje VENDIDO (los anulados no van al manifiesto).
  const pasajesSnap = await db
    .collection("pasajes")
    .where("empresaId", "==", empresaId)
    .where("salidaId", "==", salidaSnap.id)
    .where("estado", "==", "vendido")
    .get();

  const pasajeros = pasajesSnap.docs
    .map((d) => {
      const p = d.data();
      return {
        numAsiento: p.numAsiento as number,
        pasajeroNombre: p.pasajeroNombre as string,
        pasajeroDoc: p.pasajeroDoc as string,
      };
    })
    .sort((a, b) => a.numAsiento - b.numAsiento);

  // Declaración de carga (RF-19): encomiendas a bordo (registrada o en_viaje).
  // El estado se filtra en memoria (dos igualdades: empresaId + salidaId).
  const encSnap = await db
    .collection("encomiendas")
    .where("empresaId", "==", empresaId)
    .where("salidaId", "==", salidaSnap.id)
    .get();
  const encomiendas = encSnap.docs
    .map((d) => d.data())
    .filter((e) => e.estado === "registrada" || e.estado === "en_viaje")
    .map((e) => ({
      codigo: e.codigo as string,
      remitenteNombre: e.remitenteNombre as string,
      destinatarioNombre: e.destinatarioNombre as string,
      destinatarioDoc: e.destinatarioDoc as string,
      descripcion: e.descripcion as string,
      pesoKg: e.pesoKg as number,
    }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const pesoTotal = encomiendas.reduce((s, e) => s + e.pesoKg, 0);

  res.json({
    manifiesto: {
      empresa: { razonSocial, ruc },
      salida,
      pasajeros,
      totalPasajeros: pasajeros.length,
      encomiendas,
      totalBultos: encomiendas.length,
      pesoTotal,
    },
  });
}

export async function crearSalida(req: Request, res: Response): Promise<void> {
  const parsed = crearSalidaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos.", detalles: parsed.error.flatten().fieldErrors });
    return;
  }
  const empresaId = req.user!.empresaId!;
  const db = getDb();
  const { rutaId, busId, fechaHora, choferNombre, precio } = parsed.data;

  const fecha = parseFechaHora(fechaHora);
  if (!fecha) {
    res.status(400).json({ error: "Fecha y hora inválidas." });
    return;
  }

  // Aislamiento: ruta y bus deben ser del mismo tenant que el token.
  const rutaSnap = await db.collection("rutas").doc(rutaId).get();
  if (!rutaSnap.exists || rutaSnap.data()!.empresaId !== empresaId) {
    res.status(400).json({ error: "La ruta no pertenece a tu empresa." });
    return;
  }
  const busSnap = await db.collection("buses").doc(busId).get();
  if (!busSnap.exists || busSnap.data()!.empresaId !== empresaId) {
    res.status(400).json({ error: "El bus no pertenece a tu empresa." });
    return;
  }

  // precio: por defecto el precioBase de la ruta, editable.
  const precioFinal = precio ?? (rutaSnap.data()!.precioBase as number);

  const ref = db.collection(COL).doc();
  const salida: SalidaDoc = {
    id: ref.id,
    empresaId,
    rutaId,
    busId,
    fechaHora: admin.firestore.Timestamp.fromDate(fecha),
    precio: precioFinal,
    choferNombre,
    estado: "programada",
  };
  await ref.set(salida);
  res.status(201).json({ salida: serializar(salida) });
}

export async function editarSalida(req: Request, res: Response): Promise<void> {
  const parsed = editarSalidaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos.", detalles: parsed.error.flatten().fieldErrors });
    return;
  }
  const empresaId = req.user!.empresaId!;
  const ref = getDb().collection(COL).doc(String(req.params.id));
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.empresaId !== empresaId) {
    res.status(404).json({ error: "Salida no encontrada." });
    return;
  }

  const cambios: Record<string, unknown> = {};
  if (parsed.data.precio !== undefined) cambios.precio = parsed.data.precio;
  if (parsed.data.choferNombre !== undefined) cambios.choferNombre = parsed.data.choferNombre;
  if (parsed.data.estado !== undefined) cambios.estado = parsed.data.estado;
  if (parsed.data.fechaHora !== undefined) {
    const fecha = parseFechaHora(parsed.data.fechaHora);
    if (!fecha) {
      res.status(400).json({ error: "Fecha y hora inválidas." });
      return;
    }
    cambios.fechaHora = admin.firestore.Timestamp.fromDate(fecha);
  }

  await ref.update(cambios);
  const actualizado = (await ref.get()).data() as SalidaDoc;
  res.json({ salida: serializar(actualizado) });
}
