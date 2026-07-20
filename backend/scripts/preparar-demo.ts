/**
 * Preparación quirúrgica de datos para la demo (NO re-siembra).
 *
 * Qué hace:
 *  1. Borra los artefactos de prueba: todas las encomiendas actuales (creadas
 *     por los scripts de verificación, con nombres tipo "Remitente A") y las
 *     salidas de prueba ("Chofer de prueba" / la creada a mano).
 *  2. Crea salidas PROGRAMADAS a futuro (relativas a hoy) para las empresas del
 *     guion, porque las sembradas quedaron en el pasado.
 *  3. Vende pasajes en algunas de ellas creando SIEMPRE el doc-candado
 *     `salidas/{id}/asientos/{n}` — sin el candado el mapa mostraría el asiento
 *     ocupado pero la transacción permitiría revenderlo (rompe el anti-sobreventa).
 *  4. Crea encomiendas realistas repartidas en todos los estados del ciclo.
 *  5. Fija el plan de la empresa principal en `flota`, para que el upgrade a
 *     Terminal se pueda hacer en vivo durante la demo.
 *
 * No toca: empresas, usuarios, rutas, buses ni el histórico de pasajes.
 * Uso: npx tsx scripts/preparar-demo.ts
 */
import "dotenv/config";
import admin from "firebase-admin";
import { getDb } from "../src/config/firebase.js";
import { rangoDiaLima } from "../src/lib/fecha.js";

const db = getDb();
const T = admin.firestore.Timestamp;
const DIA = 24 * 60 * 60 * 1000;

const EMPRESA_PRINCIPAL = "admin.flota@rumbo.pe"; // Cruz del Valle (guion)
const EMPRESA_RUTA = "admin.selvacentral@rumbo.pe"; // plan Ruta (demo de límites/403)

const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

const NOMBRES = ["José", "Carlos", "Luis", "Miguel", "Rosa", "Carmen", "Ana", "Julia", "Elena", "Víctor", "Percy", "Milagros", "Nancy", "Jorge", "Diana", "Raúl"];
const APELLIDOS = ["García", "Flores", "Quispe", "Mamani", "Huamán", "Rojas", "Vásquez", "Castro", "Torres", "Ramírez", "Chávez", "Vargas", "Espinoza", "Paredes", "Mendoza", "Salazar"];
const nombre = () => `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
const dni = () => String(randInt(10_000_000, 79_999_999));

const CONTENIDOS = [
  "Caja con repuestos de bus",
  "Sobre con documentos notariales",
  "Paquete de ropa",
  "Caja de productos lácteos",
  "Bolsa con muestras médicas",
  "Caja con artesanías",
  "Encomienda de libros",
  "Paquete de electrodomésticos pequeños",
];
const CHOFERES = ["Segundo Julca Ramos", "Wilfredo Ticona Apaza", "Elmer Cárdenas Ríos", "Percy Condori Choque", "Fredy Herrera Julca", "Edwin Ñahui Valdez"];

async function empresaPorEmail(email: string) {
  const snap = await db.collection("empresas").where("email", "==", email).limit(1).get();
  if (snap.empty) throw new Error(`No existe la empresa ${email}`);
  return snap.docs[0].data();
}

/** Borra una salida junto con su subcolección de candados. */
async function borrarSalida(id: string): Promise<void> {
  const asientos = await db.collection("salidas").doc(id).collection("asientos").get();
  for (const a of asientos.docs) await a.ref.delete();
  await db.collection("salidas").doc(id).delete();
}

async function main(): Promise<void> {
  const principal = await empresaPorEmail(EMPRESA_PRINCIPAL);
  const ruta = await empresaPorEmail(EMPRESA_RUTA);

  // --- 1) Limpieza de artefactos de prueba -----------------------------------
  const encomiendasPrev = await db.collection("encomiendas").get();
  for (const d of encomiendasPrev.docs) await d.ref.delete();
  console.log(`✓ ${encomiendasPrev.size} encomiendas de prueba eliminadas`);

  const salidasPrueba = await db.collection("salidas").get();
  let borradas = 0;
  for (const d of salidasPrueba.docs) {
    const chofer = String(d.data().choferNombre ?? "");
    if (/prueba|Juan Pérez Quispe/i.test(chofer)) {
      await borrarSalida(d.id);
      borradas++;
    }
  }
  console.log(`✓ ${borradas} salidas de prueba eliminadas`);

  // --- 2) Salidas futuras para el guion --------------------------------------
  const { inicio: inicioHoy } = rangoDiaLima();
  const horas = [6, 8, 13, 15, 21, 22];

  async function crearSalidasFuturas(emp: FirebaseFirestore.DocumentData, cuantas: number) {
    const [rutasSnap, busesSnap] = await Promise.all([
      db.collection("rutas").where("empresaId", "==", emp.id).get(),
      db.collection("buses").where("empresaId", "==", emp.id).get(),
    ]);
    const rutas = rutasSnap.docs.map((d) => d.data());
    const buses = busesSnap.docs.map((d) => d.data());
    if (!rutas.length || !buses.length) throw new Error(`${emp.razonSocial} sin rutas o buses`);

    const creadas: { id: string; numAsientos: number; precio: number; ms: number }[] = [];
    for (let i = 0; i < cuantas; i++) {
      const r = rutas[i % rutas.length];
      const b = buses[i % buses.length];
      // Reparte entre hoy y los próximos 6 días.
      const ms = inicioHoy.getTime() + (i % 7) * DIA + pick(horas) * 3600_000;
      const ref = db.collection("salidas").doc();
      const precio = (r.precioBase as number) + pick([0, 0, 10, 15]);
      await ref.set({
        id: ref.id,
        empresaId: emp.id,
        rutaId: r.id,
        busId: b.id,
        fechaHora: T.fromMillis(ms),
        precio,
        choferNombre: pick(CHOFERES),
        estado: "programada",
      });
      creadas.push({ id: ref.id, numAsientos: b.numAsientos as number, precio, ms });
    }
    return creadas;
  }

  const salidasPrincipal = await crearSalidasFuturas(principal, 8);
  const salidasRuta = await crearSalidasFuturas(ruta, 3);
  console.log(`✓ ${salidasPrincipal.length + salidasRuta.length} salidas programadas futuras creadas`);

  // --- 3) Pasajes + CANDADOS (consistencia anti-sobreventa) -------------------
  // Ocupación parcial: el mapa se ve vivo pero quedan asientos libres para vender
  // en vivo. La fecha de venta es hoy, para que el reporte del día tenga cifras.
  let pasajes = 0;
  for (const s of salidasPrincipal.slice(0, 5)) {
    const vendidos = Math.round(s.numAsientos * (randInt(25, 55) / 100));
    const elegidos = new Set<number>();
    while (elegidos.size < vendidos) elegidos.add(randInt(1, s.numAsientos));

    for (const numAsiento of elegidos) {
      const pRef = db.collection("pasajes").doc();
      await pRef.set({
        id: pRef.id,
        empresaId: principal.id,
        salidaId: s.id,
        numAsiento,
        pasajeroNombre: nombre(),
        pasajeroDoc: dni(),
        vendedorId: "seed-demo",
        fechaVenta: T.fromMillis(Date.now() - randInt(0, 8) * 3600_000),
        precioPagado: s.precio,
        estado: "vendido",
      });
      // CANDADO: imprescindible para que el asiento no se pueda revender.
      await db.collection("salidas").doc(s.id).collection("asientos").doc(String(numAsiento)).set({
        numAsiento,
        estado: "vendido",
        pasajeId: pRef.id,
      });
      pasajes++;
    }
  }
  console.log(`✓ ${pasajes} pasajes vendidos hoy (con su doc-candado)`);

  // --- 4) Encomiendas realistas en todos los estados -------------------------
  // El correlativo continúa desde el contador del tenant (no se reinicia).
  const contadorRef = db.collection("contadores").doc(principal.id);
  const contSnap = await contadorRef.get();
  let correlativo = contSnap.exists ? ((contSnap.data()!.encomiendas as number) ?? 0) : 0;

  const plan: { estado: string; cuantas: number }[] = [
    { estado: "registrada", cuantas: 4 },
    { estado: "en_viaje", cuantas: 2 },
    { estado: "en_destino", cuantas: 3 },
    { estado: "entregada", cuantas: 3 },
  ];

  let creadasEnc = 0;
  for (const { estado, cuantas } of plan) {
    for (let i = 0; i < cuantas; i++) {
      correlativo++;
      const ref = db.collection("encomiendas").doc();
      // Las registradas/en_viaje cuelgan de salidas futuras (van a bordo);
      // las ya entregadas/en destino se registraron días atrás.
      const salida = pick(salidasPrincipal);
      const registradaMs =
        estado === "registrada"
          ? Date.now() - randInt(0, 6) * 3600_000
          : Date.now() - randInt(1, 5) * DIA;

      await ref.set({
        id: ref.id,
        empresaId: principal.id,
        salidaId: salida.id,
        codigo: `ENC-${String(correlativo).padStart(6, "0")}`,
        remitenteNombre: nombre(),
        remitenteDoc: dni(),
        destinatarioNombre: nombre(),
        destinatarioDoc: dni(),
        descripcion: pick(CONTENIDOS),
        pesoKg: Number((randInt(5, 250) / 10).toFixed(1)),
        precio: randInt(10, 60),
        registradoPor: "seed-demo",
        fechaRegistro: T.fromMillis(registradaMs),
        entregadaA: estado === "entregada" ? dni() : "",
        fechaEntrega: estado === "entregada" ? T.fromMillis(registradaMs + DIA) : null,
        estado,
      });
      creadasEnc++;
    }
  }
  await contadorRef.set({ encomiendas: correlativo }, { merge: true });
  console.log(`✓ ${creadasEnc} encomiendas creadas (contador del tenant en ${correlativo})`);

  // --- 5) Plan de la empresa principal en Flota ------------------------------
  // Así el upgrade a Terminal (y el desbloqueo del asistente) se hace en vivo.
  await db.collection("empresas").doc(principal.id as string).update({ planId: "flota" });
  console.log(`✓ ${principal.razonSocial} fijada en plan Flota`);

  console.log("\n✅ Datos listos para la demo.");
}

main().then(() => process.exit(0)).catch((e) => { console.error("❌", e); process.exit(1); });
