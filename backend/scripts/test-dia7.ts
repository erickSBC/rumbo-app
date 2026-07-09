/**
 * Prueba real del Día 7: anulación (RF-12), manifiesto (RF-13) y reporte del
 * día (RF-14). Script de verificación manual, no runtime.
 *
 * Demuestra:
 *   1. RF-12: un vendedor NO puede anular (403); el admin anula el asiento 12 →
 *      pasaje "anulado" + candado borrado (Admin SDK) + el mapa (mismo onSnapshot
 *      de la UI, app cliente propia) baja de ocupados POR EVENTO; luego el mismo
 *      asiento se REVENDE (201) y el mapa vuelve a subir.
 *   2. RF-13: el manifiesto lista solo vendidos (el 14 se anula sin revender y
 *      desaparece; el 12 revendido aparece) con cabecera correcta.
 *   3. RF-14: el reporte del día cuadra con Firestore y NO cuenta: anulados,
 *      ventas de AYER (insertada ad hoc) ni ventas de OTRO tenant (insertada ad
 *      hoc). Ambas se limpian al final.
 *
 * Requiere el backend corriendo en http://localhost:4000.
 * Uso: npm run test:dia7
 */
import "dotenv/config";
import admin from "firebase-admin";
import { getAuth, getDb } from "../src/config/firebase.js";
import { initializeApp } from "firebase/app";
import { getAuth as getClientAuth, signInWithCustomToken } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

const API = process.env.API_URL ?? "http://localhost:4000";
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY ?? "AIzaSyD2KSC_e2aDrLrLPuzE--fH_Hb1G33qaDU";

const clientApp = initializeApp(
  { apiKey: WEB_API_KEY, authDomain: "rumboapp-264ca.firebaseapp.com", projectId: "rumboapp-264ca" },
  "dia7-owner"
);
const clientAuth = getClientAuth(clientApp);
const clientDb = getFirestore(clientApp);

async function idToken(uid: string): Promise<string> {
  const customToken = await getAuth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
  );
  const data = (await res.json()) as { idToken?: string };
  if (!data.idToken) throw new Error("token");
  return data.idToken;
}

async function api(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const db = getDb();
  const flotaSnap = await db.collection("empresas").where("planId", "==", "flota").limit(1).get();
  const rutaSnap = await db.collection("empresas").where("planId", "==", "ruta").limit(1).get();
  const flota = flotaSnap.docs[0].data();
  const rutaEmpresa = rutaSnap.docs[0].data();
  const empresaId = flota.id as string;

  const adminUid = (await getAuth().getUserByEmail(flota.email as string)).uid;
  const adminToken = await idToken(adminUid);
  const vendedorUid = (await getAuth().getUserByEmail("vendedor.flota@rumbo-demo.com")).uid;
  const vendedorToken = await idToken(vendedorUid);

  // Salida de Flota con asientos vendidos (5,11,12,13,14 del Día 6).
  const salidasSnap = await db.collection("salidas").where("empresaId", "==", empresaId).limit(1).get();
  const salidaId = salidasSnap.docs[0].id;
  console.log(`Empresa Flota ${empresaId}, salida ${salidaId}\n`);

  // Suscripción en tiempo real (misma query de la UI) para observar 12: ocupado→libre→ocupado.
  await signInWithCustomToken(clientAuth, await getAuth().createCustomToken(adminUid));
  const eventos: number[] = [];
  const qOcupados = query(
    collection(clientDb, "pasajes"),
    where("empresaId", "==", empresaId),
    where("salidaId", "==", salidaId),
    where("estado", "==", "vendido")
  );
  const unsub = onSnapshot(qOcupados, (snap) => {
    const asientos = snap.docs.map((d) => d.data().numAsiento as number).sort((a, b) => a - b);
    eventos.push(snap.size);
    console.log(`   [mapa] ocupados=${snap.size} [${asientos.join(",")}]`);
  });
  await espera(1500);
  const ocupadosInicial = eventos[eventos.length - 1];

  // ---------------------------------------------------------------------------
  console.log("\n1) RF-12 Anulación del asiento 12");
  const pasaje12Snap = await db.collection("pasajes")
    .where("empresaId", "==", empresaId).where("salidaId", "==", salidaId)
    .where("numAsiento", "==", 12).where("estado", "==", "vendido").limit(1).get();
  if (pasaje12Snap.empty) throw new Error("No hay pasaje vendido en el asiento 12; corre antes test:venta.");
  const pasaje12Id = pasaje12Snap.docs[0].id;

  const intentoVendedor = await api("PUT", `/api/pasajes/${pasaje12Id}/anular`, vendedorToken);
  console.log(`   vendedor intenta anular → HTTP ${intentoVendedor.status} (esperado 403)`);

  const anulacion = await api("PUT", `/api/pasajes/${pasaje12Id}/anular`, adminToken);
  console.log(`   admin anula → HTTP ${anulacion.status}`);
  await espera(2000); // dejar llegar el evento del mapa

  const pasaje12Despues = (await db.collection("pasajes").doc(pasaje12Id).get()).data();
  const candado12 = await db.collection("salidas").doc(salidaId).collection("asientos").doc("12").get();
  console.log(`   pasaje.estado="${pasaje12Despues?.estado}" | candado existe=${candado12.exists}`);

  console.log("   Revendiendo el asiento 12…");
  const reventa = await api("POST", "/api/pasajes", vendedorToken, {
    salidaId, numAsiento: 12, pasajeroNombre: "Pasajero Nuevo", pasajeroDoc: "87654321",
  });
  console.log(`   reventa → HTTP ${reventa.status}`);
  await espera(2000);

  const bajoYSubio =
    eventos.includes(ocupadosInicial - 1) && eventos[eventos.length - 1] === ocupadosInicial;
  const anulacionOk =
    intentoVendedor.status === 403 && anulacion.status === 200 &&
    pasaje12Despues?.estado === "anulado" && !candado12.exists && reventa.status === 201;
  console.log(`   ${anulacionOk ? "✅ Anulado + candado liberado + revendido" : "❌ Falló la anulación"}`);
  console.log(`   ${bajoYSubio ? "✅ El mapa bajó y volvió a subir POR EVENTO (tiempo real)" : "❌ El mapa no reflejó los cambios"}\n`);

  // ---------------------------------------------------------------------------
  console.log("2) RF-13 Manifiesto (anulo el 14 sin revender; el 12 revendido debe aparecer)");
  const pasaje14Snap = await db.collection("pasajes")
    .where("empresaId", "==", empresaId).where("salidaId", "==", salidaId)
    .where("numAsiento", "==", 14).where("estado", "==", "vendido").limit(1).get();
  if (!pasaje14Snap.empty) {
    await api("PUT", `/api/pasajes/${pasaje14Snap.docs[0].id}/anular`, adminToken);
  }

  const manifiestoRes = await api("GET", `/api/salidas/${salidaId}/manifiesto`, vendedorToken);
  const m = manifiestoRes.body.manifiesto as {
    empresa: { razonSocial: string; ruc: string };
    salida: { rutaOrigen: string; rutaDestino: string; busPlaca: string; choferNombre: string; fechaHora: string };
    pasajeros: { numAsiento: number; pasajeroNombre: string; pasajeroDoc: string }[];
    totalPasajeros: number;
  };
  console.log(`   HTTP ${manifiestoRes.status} (pedido como VENDEDOR)`);
  console.log(`   cabecera: ${m.empresa.razonSocial} (RUC ${m.empresa.ruc}) · ${m.salida.rutaOrigen}→${m.salida.rutaDestino} · bus ${m.salida.busPlaca} · chofer ${m.salida.choferNombre}`);
  console.log(`   pasajeros (${m.totalPasajeros}):`);
  for (const p of m.pasajeros) console.log(`     asiento ${p.numAsiento} · ${p.pasajeroNombre} · doc ${p.pasajeroDoc}`);
  const asientosManif = m.pasajeros.map((p) => p.numAsiento);
  const manifiestoOk =
    manifiestoRes.status === 200 && asientosManif.includes(12) && !asientosManif.includes(14) &&
    m.salida.busPlaca !== null && m.salida.choferNombre !== null;
  console.log(`   ${manifiestoOk ? "✅ Solo vendidos (12 revendido sí, 14 anulado no) con cabecera completa" : "❌ Manifiesto incorrecto"}\n`);

  // ---------------------------------------------------------------------------
  console.log("3) RF-14 Reporte del día (con señuelos: venta de AYER y de OTRO tenant)");
  const ayer = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
  const señueloAyer = db.collection("pasajes").doc();
  await señueloAyer.set({
    id: señueloAyer.id, empresaId, salidaId, numAsiento: 99,
    pasajeroNombre: "Señuelo Ayer", pasajeroDoc: "11111111", vendedorId: "test",
    fechaVenta: ayer, precioPagado: 500, estado: "vendido",
  });
  const señueloAjeno = db.collection("pasajes").doc();
  await señueloAjeno.set({
    id: señueloAjeno.id, empresaId: rutaEmpresa.id, salidaId: "salida-ajena", numAsiento: 1,
    pasajeroNombre: "Señuelo Ajeno", pasajeroDoc: "22222222", vendedorId: "test",
    fechaVenta: admin.firestore.Timestamp.now(), precioPagado: 900, estado: "vendido",
  });

  const reporteRes = await api("GET", "/api/reportes/dia", adminToken);
  const rep = reporteRes.body as unknown as {
    fecha: string; totalPasajes: number; montoTotal: number;
    porRuta: { ruta: string; pasajes: number; monto: number }[];
  };
  console.log(`   HTTP ${reporteRes.status} · fecha ${rep.fecha}`);
  console.log(`   total pasajes: ${rep.totalPasajes} · monto: S/ ${rep.montoTotal}`);
  for (const r of rep.porRuta) console.log(`     ${r.ruta}: ${r.pasajes} pasajes · S/ ${r.monto}`);

  // Verificación independiente con Admin SDK: vendidos HOY del tenant.
  const inicioHoy = new Date(`${rep.fecha}T00:00:00-05:00`).getTime();
  const finHoy = inicioHoy + 24 * 60 * 60 * 1000;
  const vendidosSnap = await db.collection("pasajes")
    .where("empresaId", "==", empresaId).where("estado", "==", "vendido").get();
  const esperados = vendidosSnap.docs.map((d) => d.data()).filter((p) => {
    const t = (p.fechaVenta as admin.firestore.Timestamp).toDate().getTime();
    return t >= inicioHoy && t < finHoy;
  });
  const montoEsperado = esperados.reduce((s, p) => s + (p.precioPagado as number), 0);
  console.log(`   verificación Admin SDK: ${esperados.length} pasajes · S/ ${montoEsperado}`);
  const reporteOk =
    reporteRes.status === 200 && rep.totalPasajes === esperados.length &&
    rep.montoTotal === montoEsperado && rep.montoTotal < 500 + 900; // señuelos fuera

  // Vendedor no accede al reporte.
  const repVendedor = await api("GET", "/api/reportes/dia", vendedorToken);
  console.log(`   vendedor pide el reporte → HTTP ${repVendedor.status} (esperado 403)`);

  // Limpieza de señuelos.
  await señueloAyer.delete();
  await señueloAjeno.delete();

  console.log(`   ${reporteOk && repVendedor.status === 403 ? "✅ Reporte cuadra; ayer/otro-tenant/anulados fuera; solo admin" : "❌ Reporte incorrecto"}\n`);

  unsub();
  const ok = anulacionOk && bajoYSubio && manifiestoOk && reporteOk && repVendedor.status === 403;
  console.log(ok ? "✅ TODO OK (RF-12 + RF-13 + RF-14)" : "❌ Alguna verificación falló");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Error en la prueba:", err);
  process.exit(1);
});
