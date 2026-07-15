/**
 * Sembrador de datos realistas (dataset de demostración).
 *
 * Llena todas las entidades operativas con volumen y realismo inspirados en el
 * transporte interprovincial peruano (rutas, duraciones y tarifas reales:
 * Lima–Trujillo ~9 h S/55, Lima–Arequipa ~16 h S/90, Lima–Cusco ~21 h S/120,
 * etc.; empresas tipo Cruz del Sur, Civa, Oltursa, Movil Tours, Línea, Tepsa).
 *
 * Qué hace:
 *  - Preserva la colección `planes`, las `empresas` y sus usuarios admin.
 *  - Asegura 3 empresas nuevas (con cuenta admin en Auth) para enriquecer el
 *    multi-tenant.
 *  - LIMPIA datos operativos (rutas, buses, salidas + subcolección asientos,
 *    pasajes, auditoria) y los vendedores marcados como `seed:true`, para que el
 *    script sea idempotente.
 *  - Reseed: rutas, buses, vendedores, salidas (30 días atrás → +7) y pasajes
 *    con pasajeros peruanos. Respeta los límites de cada plan (maxBuses/maxUsuarios).
 *  - Consistencia con el Día 6: para salidas de hoy en adelante crea el
 *    doc-candado salidas/{id}/asientos/{numAsiento}, para que la ocupación
 *    sembrada no permita sobreventa.
 *
 * Uso: npm run seed:datos   (no requiere el backend levantado)
 */
import "dotenv/config";
import admin from "firebase-admin";
import { getAuth, getDb } from "../src/config/firebase.js";
import { rangoDiaLima } from "../src/lib/fecha.js";

const db = getDb();
const auth = getAuth();
const T = admin.firestore.Timestamp;
const DIA = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Utilidades aleatorias
const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const chance = (p: number) => Math.random() < p;
function sample<T>(arr: T[], n: number): T[] {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, Math.min(n, copia.length));
}

// ---------------------------------------------------------------------------
// Pools realistas (Perú)
const NOMBRES = [
  "José", "Juan", "Carlos", "Luis", "Miguel", "Jorge", "Pedro", "Manuel", "Víctor", "César",
  "Walter", "Raúl", "Julio", "Óscar", "Percy", "Wilfredo", "Segundo", "Elmer", "Edwin", "Fredy",
  "María", "Rosa", "Carmen", "Ana", "Julia", "Elena", "Luz", "Yolanda", "Gloria", "Flor",
  "Mercedes", "Juana", "Nancy", "Sonia", "Milagros", "Katherine", "Diana", "Rocío", "Betty", "Norma",
];
const APELLIDOS = [
  "García", "Rodríguez", "Flores", "Gonzales", "López", "Díaz", "Sánchez", "Rojas", "Vásquez", "Castro",
  "Rivera", "Torres", "Ramírez", "Cruz", "Chávez", "Vargas", "Espinoza", "Ríos", "Paredes", "Mendoza",
  "Salazar", "Quispe", "Mamani", "Huamán", "Condori", "Apaza", "Ccahuana", "Cconislla", "Ticona", "Choque",
  "Aguilar", "Cárdenas", "Fernández", "Gutiérrez", "Herrera", "Julca", "Ñahui", "Valdez", "Zamora", "Ramos",
];
const nombreCompleto = () => `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
const dni = () => String(randInt(10_000_000, 79_999_999));

/** Plantillas de rutas peruanas con duración (min) y tarifa base (S/) realistas. */
const RUTAS_BASE: { origen: string; destino: string; duracionMin: number; precioBase: number }[] = [
  { origen: "Lima", destino: "Trujillo", duracionMin: 540, precioBase: 55 },
  { origen: "Lima", destino: "Chiclayo", duracionMin: 720, precioBase: 70 },
  { origen: "Lima", destino: "Piura", duracionMin: 900, precioBase: 90 },
  { origen: "Lima", destino: "Arequipa", duracionMin: 960, precioBase: 90 },
  { origen: "Lima", destino: "Cusco", duracionMin: 1260, precioBase: 120 },
  { origen: "Lima", destino: "Tacna", duracionMin: 1080, precioBase: 110 },
  { origen: "Lima", destino: "Huancayo", duracionMin: 360, precioBase: 45 },
  { origen: "Lima", destino: "Ayacucho", duracionMin: 540, precioBase: 60 },
  { origen: "Lima", destino: "Puno", duracionMin: 1200, precioBase: 130 },
  { origen: "Lima", destino: "Ica", duracionMin: 270, precioBase: 35 },
  { origen: "Lima", destino: "Nazca", duracionMin: 420, precioBase: 45 },
  { origen: "Lima", destino: "Chimbote", duracionMin: 400, precioBase: 40 },
  { origen: "Lima", destino: "Cajamarca", duracionMin: 840, precioBase: 80 },
  { origen: "Lima", destino: "Tumbes", duracionMin: 1140, precioBase: 120 },
  { origen: "Lima", destino: "Huaraz", duracionMin: 480, precioBase: 50 },
  { origen: "Lima", destino: "Pucallpa", duracionMin: 1080, precioBase: 100 },
  { origen: "Lima", destino: "Tarapoto", duracionMin: 1560, precioBase: 140 },
  { origen: "Arequipa", destino: "Cusco", duracionMin: 600, precioBase: 60 },
  { origen: "Arequipa", destino: "Tacna", duracionMin: 360, precioBase: 40 },
  { origen: "Arequipa", destino: "Puno", duracionMin: 300, precioBase: 40 },
  { origen: "Cusco", destino: "Puno", duracionMin: 420, precioBase: 45 },
  { origen: "Trujillo", destino: "Chiclayo", duracionMin: 210, precioBase: 25 },
  { origen: "Chiclayo", destino: "Piura", duracionMin: 180, precioBase: 25 },
  { origen: "Trujillo", destino: "Cajamarca", duracionMin: 360, precioBase: 40 },
  { origen: "Huancayo", destino: "Ayacucho", duracionMin: 300, precioBase: 45 },
];
const CONFIG_ASIENTOS = [40, 40, 44, 44, 44, 48, 50]; // ponderado hacia cama/semicama

function generarPlaca(usadas: Set<string>): string {
  const L = "ABCDEFGHJKLMNPRSTUVWXYZ";
  let placa = "";
  do {
    placa = `${pick([...L])}${pick([...L])}${pick([...L])}-${randInt(100, 999)}`;
  } while (usadas.has(placa));
  usadas.add(placa);
  return placa;
}

// ---------------------------------------------------------------------------
// Batcher con auto-flush (límite de 500 ops por commit de Firestore)
class Batcher {
  private batch = db.batch();
  private ops = 0;
  total = 0;
  set(ref: FirebaseFirestore.DocumentReference, data: FirebaseFirestore.DocumentData): Promise<void> {
    this.batch.set(ref, data);
    return this.tick();
  }
  del(ref: FirebaseFirestore.DocumentReference): Promise<void> {
    this.batch.delete(ref);
    return this.tick();
  }
  private async tick(): Promise<void> {
    this.ops++;
    this.total++;
    if (this.ops >= 450) await this.flush();
  }
  async flush(): Promise<void> {
    if (this.ops === 0) return;
    await this.batch.commit();
    this.batch = db.batch();
    this.ops = 0;
  }
}

// ---------------------------------------------------------------------------
interface Plan { maxBuses: number; maxUsuarios: number; }
interface EmpresaCtx {
  id: string;
  planId: string;
  razonSocial: string;
  usuarioIds: string[]; // vendedores + admin, para asignar ventas
}

async function cargarPlanes(): Promise<Map<string, Plan>> {
  const snap = await db.collection("planes").get();
  const m = new Map<string, Plan>();
  snap.forEach((d) => m.set(d.id, { maxBuses: d.data().maxBuses, maxUsuarios: d.data().maxUsuarios }));
  return m;
}

/** Crea una empresa nueva (con admin en Auth) si no existe ya por email. */
async function asegurarEmpresa(input: {
  razonSocial: string; ruc: string; email: string; planId: string; estado: string;
}): Promise<void> {
  const existe = await db.collection("empresas").where("email", "==", input.email).limit(1).get();
  if (!existe.empty) return;

  let uid: string;
  try {
    uid = (await auth.getUserByEmail(input.email)).uid;
  } catch {
    uid = (await auth.createUser({ email: input.email, password: "rumbo123", displayName: input.razonSocial })).uid;
  }
  const ref = db.collection("empresas").doc();
  const now = T.now();
  await ref.set({
    id: ref.id, ruc: input.ruc, razonSocial: input.razonSocial, email: input.email,
    planId: input.planId, estado: input.estado,
    fechaRegistro: now, fechaFinPrueba: T.fromMillis(now.toMillis() + 14 * DIA),
  });
  await auth.setCustomUserClaims(uid, { empresaId: ref.id, rol: "admin_empresa" });
  await db.collection("usuarios").doc(uid).set({
    id: uid, empresaId: ref.id, nombre: "Administrador", email: input.email, rol: "admin_empresa", estado: "activo",
  });
}

/** Borra todos los docs de una colección en lotes. */
async function wipe(nombre: string, batcher: Batcher): Promise<number> {
  const snap = await db.collection(nombre).get();
  for (const d of snap.docs) await batcher.del(d.ref);
  return snap.size;
}

async function main(): Promise<void> {
  console.log("→ Asegurando empresas nuevas…");
  await asegurarEmpresa({ razonSocial: "Turismo Andino Express S.A.C.", ruc: "20554839217", email: "admin.andino@rumbo.pe", planId: "flota", estado: "activa" });
  await asegurarEmpresa({ razonSocial: "Expreso Costa Norte E.I.R.L.", ruc: "20487651203", email: "admin.costanorte@rumbo.pe", planId: "flota", estado: "activa" });
  await asegurarEmpresa({ razonSocial: "Transportes Selva Central S.A.C.", ruc: "20601234785", email: "admin.selvacentral@rumbo.pe", planId: "ruta", estado: "prueba" });

  const planes = await cargarPlanes();
  const empresasSnap = await db.collection("empresas").get();

  // --- Limpieza de datos operativos (idempotencia) ---
  console.log("→ Limpiando datos operativos previos…");
  const wipeBatch = new Batcher();
  // Subcolección asientos de cada salida.
  const salidasPrev = await db.collection("salidas").get();
  for (const s of salidasPrev.docs) {
    const asientos = await s.ref.collection("asientos").get();
    for (const a of asientos.docs) await wipeBatch.del(a.ref);
  }
  await wipe("salidas", wipeBatch);
  await wipe("rutas", wipeBatch);
  await wipe("buses", wipeBatch);
  await wipe("pasajes", wipeBatch);
  await wipe("auditoria", wipeBatch);
  // Vendedores sembrados (marcados con seed:true); preserva admins y usuarios reales.
  const seedUsers = await db.collection("usuarios").where("seed", "==", true).get();
  for (const u of seedUsers.docs) await wipeBatch.del(u.ref);
  await wipeBatch.flush();
  console.log(`  limpiados ${wipeBatch.total} documentos.`);

  const { inicio: inicioHoy } = rangoDiaLima();
  const ahora = Date.now();
  const placasUsadas = new Set<string>();
  const b = new Batcher();
  const conteo = { rutas: 0, buses: 0, vendedores: 0, salidas: 0, pasajes: 0, candados: 0, anulados: 0, auditoria: 0 };

  const CHOFERES_POR_EMPRESA = 12;

  for (const empDoc of empresasSnap.docs) {
    const emp = empDoc.data();
    const plan = planes.get(emp.planId) ?? { maxBuses: 5, maxUsuarios: 3 };

    // Tamaños objetivo por plan (acotados por los límites reales del plan).
    const tam = emp.planId === "terminal"
      ? { buses: 24, usuarios: 14, rutas: 12, salPast: 30, salFut: 9 }
      : emp.planId === "flota"
      ? { buses: 18, usuarios: 12, rutas: 9, salPast: 26, salFut: 8 }
      : { buses: 5, usuarios: 3, rutas: 4, salPast: 13, salFut: 4 };
    const nBuses = Math.min(tam.buses, plan.maxBuses);
    const maxUsuarios = Math.min(tam.usuarios, plan.maxUsuarios);

    const ctx: EmpresaCtx = { id: emp.id, planId: emp.planId, razonSocial: emp.razonSocial, usuarioIds: [] };

    // Usuarios existentes (admin + reales) que se conservan.
    const existentes = await db.collection("usuarios").where("empresaId", "==", emp.id).get();
    ctx.usuarioIds.push(...existentes.docs.map((d) => d.id));

    // Vendedores nuevos hasta completar el cupo del plan.
    const porCrear = Math.max(0, maxUsuarios - existentes.size);
    for (let i = 0; i < porCrear; i++) {
      const ref = db.collection("usuarios").doc();
      const nombre = nombreCompleto();
      await b.set(ref, {
        id: ref.id, empresaId: emp.id, nombre,
        email: `vendedor${i + 1}.${emp.id.slice(0, 5).toLowerCase()}@rumbo.pe`,
        rol: "vendedor", estado: chance(0.9) ? "activo" : "inactivo", seed: true,
      });
      ctx.usuarioIds.push(ref.id);
      conteo.vendedores++;
    }

    // Rutas.
    const rutasElegidas = sample(RUTAS_BASE, tam.rutas);
    const rutas: { id: string; precioBase: number }[] = [];
    for (const r of rutasElegidas) {
      // ~30% en sentido inverso para variar orígenes/destinos.
      const dir = chance(0.3) ? { origen: r.destino, destino: r.origen } : { origen: r.origen, destino: r.destino };
      const ref = db.collection("rutas").doc();
      await b.set(ref, { id: ref.id, empresaId: emp.id, origen: dir.origen, destino: dir.destino, duracionMin: r.duracionMin, precioBase: r.precioBase });
      rutas.push({ id: ref.id, precioBase: r.precioBase });
      conteo.rutas++;
    }

    // Buses.
    const buses: { id: string; numAsientos: number }[] = [];
    for (let i = 0; i < nBuses; i++) {
      const ref = db.collection("buses").doc();
      const numAsientos = pick(CONFIG_ASIENTOS);
      await b.set(ref, { id: ref.id, empresaId: emp.id, placa: generarPlaca(placasUsadas), numAsientos, estado: chance(0.9) ? "activo" : "inactivo" });
      buses.push({ id: ref.id, numAsientos });
      conteo.buses++;
    }

    const choferes = Array.from({ length: CHOFERES_POR_EMPRESA }, () => nombreCompleto());
    const horas = [5, 6, 8, 10, 13, 15, 20, 21, 22, 23];

    // Salidas (pasadas y futuras) con sus pasajes.
    const totalSal = tam.salPast + tam.salFut;
    for (let i = 0; i < totalSal; i++) {
      const esFutura = i >= tam.salPast;
      const offsetDias = esFutura ? randInt(0, 7) : -randInt(1, 30);
      const fechaHoraMs = inicioHoy.getTime() + offsetDias * DIA + pick(horas) * 3600_000 + pick([0, 30]) * 60_000;
      const ruta = pick(rutas);
      const bus = pick(buses);
      const cancelada = chance(0.05);
      const estadoSalida = cancelada ? "cancelada" : esFutura ? "programada" : "completada";
      // Precio de la salida: base de la ruta con variación de servicio (±).
      const precio = Math.max(20, ruta.precioBase + pick([-5, 0, 0, 10, 15, 25]));

      const salRef = db.collection("salidas").doc();
      await b.set(salRef, {
        id: salRef.id, empresaId: emp.id, rutaId: ruta.id, busId: bus.id,
        fechaHora: T.fromMillis(fechaHoraMs), precio, choferNombre: pick(choferes), estado: estadoSalida,
      });
      conteo.salidas++;
      if (cancelada) continue;

      // Ocupación: alta en el pasado, más holgada a futuro (deja asientos libres).
      const frac = esFutura ? randInt(15, 55) / 100 : randInt(50, 92) / 100;
      const vendidos = Math.max(1, Math.round(bus.numAsientos * frac));
      const asientos = sample(Array.from({ length: bus.numAsientos }, (_, k) => k + 1), vendidos);

      for (const numAsiento of asientos) {
        const anulado = chance(0.05);
        const precioPagado = precio - (chance(0.15) && precio > 45 ? 10 : 0);
        // fechaVenta: pasado → antes de la salida; futuro → compra reciente.
        const ventaMs = esFutura
          ? ahora - randInt(0, 6) * DIA - randInt(0, 20) * 3600_000
          : Math.min(ahora - DIA, fechaHoraMs - randInt(1, 96) * 3600_000);
        const pasRef = db.collection("pasajes").doc();
        await b.set(pasRef, {
          id: pasRef.id, empresaId: emp.id, salidaId: salRef.id, numAsiento,
          pasajeroNombre: nombreCompleto(), pasajeroDoc: dni(),
          vendedorId: pick(ctx.usuarioIds), fechaVenta: T.fromMillis(Math.min(ventaMs, ahora)),
          precioPagado, estado: anulado ? "anulado" : "vendido",
        });
        conteo.pasajes++;
        if (anulado) { conteo.anulados++; continue; }
        // Candado solo para salidas de hoy en adelante (consistencia antisobreventa).
        if (fechaHoraMs >= inicioHoy.getTime()) {
          const candRef = salRef.collection("asientos").doc(String(numAsiento));
          await b.set(candRef, { numAsiento, estado: "vendido", pasajeId: pasRef.id });
          conteo.candados++;
        }
      }
    }

    // Auditoría de muestra.
    for (let i = 0; i < 6; i++) {
      const ref = db.collection("auditoria").doc();
      await b.set(ref, {
        evento: pick(["venta_pasaje", "venta_pasaje", "anulacion_pasaje", "cambio_plan"]),
        empresaId: emp.id, usuarioId: pick(ctx.usuarioIds),
        timestamp: T.fromMillis(ahora - randInt(0, 30) * DIA), seed: true,
      });
      conteo.auditoria++;
    }

    console.log(`  ${emp.razonSocial} (${emp.planId}): listo`);
  }

  await b.flush();

  console.log("\n✅ Dataset sembrado:");
  console.log(`   empresas totales : ${empresasSnap.size}`);
  console.log(`   rutas            : ${conteo.rutas}`);
  console.log(`   buses            : ${conteo.buses}`);
  console.log(`   vendedores nuevos: ${conteo.vendedores}`);
  console.log(`   salidas          : ${conteo.salidas}`);
  console.log(`   pasajes          : ${conteo.pasajes} (anulados: ${conteo.anulados})`);
  console.log(`   candados asiento : ${conteo.candados}`);
  console.log(`   auditoría        : ${conteo.auditoria}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error("❌", err); process.exit(1); });
