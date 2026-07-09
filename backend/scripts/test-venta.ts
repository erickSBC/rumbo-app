/**
 * Prueba real del Día 6: venta con transacción atómica (RF-10) y prevención de
 * sobreventa (RF-11). Script de verificación manual, no runtime.
 *
 * Rigor de concurrencia: la doble venta se lanza como dos POST en paralelo
 * (Promise.all) contra el backend real. Las verificaciones en Firestore se hacen
 * con el ADMIN SDK (no el cliente), para no leer de la caché local y que el
 * conteo de pasajes sea el estado real del servidor.
 *
 * Demuestra:
 *   1. Venta normal: el pasaje queda con los campos §4.5 y vendedorId === uid
 *      del vendedor (derivado del token).
 *   2. Doble venta simultánea: exactamente un 201 y un 409; en Firestore queda
 *      UN solo pasaje vendido para ese asiento. Se repite varias veces.
 *   3. Aislamiento: vender contra una salida de otro tenant es rechazado (404).
 *
 * Requiere el backend corriendo en http://localhost:4000.
 * Uso: npm run test:venta
 */
import "dotenv/config";
import admin from "firebase-admin";
import { getAuth, getDb } from "../src/config/firebase.js";

const API = process.env.API_URL ?? "http://localhost:4000";
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY ?? "AIzaSyD2KSC_e2aDrLrLPuzE--fH_Hb1G33qaDU";

async function idToken(uid: string): Promise<string> {
  const customToken = await getAuth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const data = (await res.json()) as { idToken?: string };
  if (!res.ok || !data.idToken) throw new Error(`token: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function empresaPorPlan(planId: string) {
  const snap = await getDb().collection("empresas").where("planId", "==", planId).limit(1).get();
  if (snap.empty) throw new Error(`No hay empresa con plan ${planId}.`);
  return snap.docs[0].data();
}

/** Crea (o reutiliza) un vendedor en la empresa vía el endpoint del Día 3. */
async function asegurarVendedor(adminToken: string, empresaId: string): Promise<string> {
  const email = "vendedor.flota@rumbo-demo.com";
  try {
    return (await getAuth().getUserByEmail(email)).uid;
  } catch {
    const res = await fetch(`${API}/api/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ nombre: "Vendedor Demo", email, password: "demo123456" }),
    });
    if (!res.ok) throw new Error(`No se pudo crear el vendedor: ${JSON.stringify(await res.json())}`);
    return (await getAuth().getUserByEmail(email)).uid;
  }
}

/** Asegura que la empresa tenga una salida; devuelve su id y numAsientos del bus. */
async function asegurarSalida(empresaId: string) {
  const db = getDb();
  const rutaSnap = await db.collection("rutas").where("empresaId", "==", empresaId).limit(1).get();
  const busSnap = await db.collection("buses").where("empresaId", "==", empresaId).limit(1).get();
  if (rutaSnap.empty || busSnap.empty) throw new Error("La empresa no tiene ruta o bus.");
  let salSnap = await db.collection("salidas").where("empresaId", "==", empresaId).limit(1).get();
  if (salSnap.empty) {
    const ref = db.collection("salidas").doc();
    await ref.set({
      id: ref.id, empresaId, rutaId: rutaSnap.docs[0].id, busId: busSnap.docs[0].id,
      fechaHora: admin.firestore.Timestamp.now(), precio: 60, choferNombre: "Demo", estado: "programada",
    });
    salSnap = await db.collection("salidas").where("empresaId", "==", empresaId).limit(1).get();
  }
  const salida = salSnap.docs[0].data();
  const bus = busSnap.docs.find((b) => b.id === salida.busId)?.data() ?? busSnap.docs[0].data();
  return { salidaId: salida.id as string, numAsientos: bus.numAsientos as number };
}

/** Libera un asiento (borra pasaje/candado) para poder repetir la prueba. */
async function liberarAsiento(salidaId: string, numAsiento: number, empresaId: string) {
  const db = getDb();
  await db.collection("salidas").doc(salidaId).collection("asientos").doc(String(numAsiento)).delete().catch(() => {});
  const pases = await db.collection("pasajes")
    .where("empresaId", "==", empresaId).where("salidaId", "==", salidaId).where("numAsiento", "==", numAsiento).get();
  await Promise.all(pases.docs.map((d) => d.ref.delete()));
}

async function vender(token: string, salidaId: string, numAsiento: number) {
  const res = await fetch(`${API}/api/pasajes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ salidaId, numAsiento, pasajeroNombre: "Pasajero Prueba", pasajeroDoc: "12345678" }),
  });
  return { status: res.status, body: (await res.json()) as { pasajeId?: string; error?: string } };
}

async function contarPasajes(salidaId: string, numAsiento: number, empresaId: string): Promise<number> {
  const snap = await getDb().collection("pasajes")
    .where("empresaId", "==", empresaId).where("salidaId", "==", salidaId)
    .where("numAsiento", "==", numAsiento).where("estado", "==", "vendido").get();
  return snap.size;
}

async function main(): Promise<void> {
  const flota = await empresaPorPlan("flota");
  const ruta = await empresaPorPlan("ruta");
  const empresaId = flota.id as string;

  const adminUid = (await getAuth().getUserByEmail(flota.email as string)).uid;
  const adminToken = await idToken(adminUid);
  const vendedorUid = await asegurarVendedor(adminToken, empresaId);
  const vendedorToken = await idToken(vendedorUid);

  const { salidaId, numAsientos } = await asegurarSalida(empresaId);
  console.log(`Empresa Flota ${empresaId}, salida ${salidaId} (bus ${numAsientos} asientos)`);
  console.log(`Vendedor uid: ${vendedorUid}\n`);

  // ---------------------------------------------------------------------------
  console.log("1) Venta normal (como VENDEDOR)");
  await liberarAsiento(salidaId, 5, empresaId);
  const venta = await vender(vendedorToken, salidaId, 5);
  console.log(`   POST /api/pasajes asiento 5 → HTTP ${venta.status}`);
  const pasajeSnap = await getDb().collection("pasajes").doc(venta.body.pasajeId ?? "x").get();
  const p = pasajeSnap.data();
  console.log("   pasaje en Firestore:", JSON.stringify(p ? {
    numAsiento: p.numAsiento, estado: p.estado, precioPagado: p.precioPagado,
    empresaId: p.empresaId, vendedorId: p.vendedorId, pasajeroNombre: p.pasajeroNombre,
  } : null, null, 2));
  const ventaOk = venta.status === 201 && p?.vendedorId === vendedorUid && p?.empresaId === empresaId && p?.estado === "vendido";
  console.log(`   ${ventaOk ? "✅ Pasaje creado con vendedorId derivado del token" : "❌ Venta normal falló"}\n`);

  // ---------------------------------------------------------------------------
  console.log("2) Doble venta SIMULTÁNEA del mismo asiento (RF-11) — 4 rondas");
  let dobleOk = true;
  for (let ronda = 1; ronda <= 4; ronda++) {
    const asiento = 10 + ronda;
    await liberarAsiento(salidaId, asiento, empresaId);
    // Dos intentos concurrentes de verdad por el mismo asiento.
    const [a, b] = await Promise.all([
      vender(adminToken, salidaId, asiento),
      vender(vendedorToken, salidaId, asiento),
    ]);
    const exitos = [a, b].filter((r) => r.status === 201).length;
    const rechazos = [a, b].filter((r) => r.status === 409).length;
    const cuenta = await contarPasajes(salidaId, asiento, empresaId);
    const rondaOk = exitos === 1 && rechazos === 1 && cuenta === 1;
    dobleOk = dobleOk && rondaOk;
    console.log(
      `   ronda ${ronda} (asiento ${asiento}): 201=${exitos} 409=${rechazos} | pasajes en Firestore=${cuenta} ` +
        `${rondaOk ? "✅" : "❌"}  [${a.status}/${b.status}]`
    );
  }
  console.log(`   ${dobleOk ? "✅ Siempre exactamente una venta gana; nunca sobreventa" : "❌ Hubo una ronda inconsistente"}\n`);

  // ---------------------------------------------------------------------------
  console.log("3) Aislamiento: Flota intenta vender contra una salida de Ruta");
  const salidaRuta = await asegurarSalida(ruta.id as string);
  const intruso = await vender(adminToken, salidaRuta.salidaId, 1);
  console.log(`   POST contra salida ajena → HTTP ${intruso.status} "${intruso.body.error ?? ""}"`);
  const aislado = intruso.status === 404;
  console.log(`   ${aislado ? "✅ Rechazado (no se vende contra otro tenant)" : "❌ No se aisló"}\n`);

  const ok = ventaOk && dobleOk && aislado;
  console.log(ok ? "✅ TODO OK (RF-10 + RF-11 + aislamiento)" : "❌ Alguna verificación falló");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Error en la prueba:", err);
  process.exit(1);
});
