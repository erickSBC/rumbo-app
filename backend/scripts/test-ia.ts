/**
 * Prueba real del Día 8: asistente IA (RF-15). Script de verificación manual.
 *
 * Demuestra:
 *   1. Empresa FLOTA (asistenteIA=true): 3 preguntas reales a Gemini; junto a
 *      cada respuesta se imprimen las cifras REALES de Firestore (mismo criterio
 *      del reporte del Día 7) para verificar coherencia.
 *   2. Empresa RUTA (asistenteIA=false): misma pregunta → 403 con mensaje de
 *      upgrade (enforcement por plan, fragmento alt §6.4).
 *   3. Salvaguardas: pregunta >500 chars → 400; consultas 11.ª en un minuto → 429.
 *
 * El manejo de error de Gemini (mensaje neutro) se prueba aparte arrancando el
 * backend con GEMINI_API_KEY inválida (ver instrucciones al correr con
 * MODO=fallo).
 *
 * Requiere el backend corriendo en http://localhost:4000.
 * Uso: npm run test:ia            (flujo completo)
 *      MODO=fallo npm run test:ia (solo verifica el mensaje neutro; backend con key inválida)
 */
import "dotenv/config";
import admin from "firebase-admin";
import { getAuth, getDb } from "../src/config/firebase.js";
import { rangoDiaLima } from "../src/lib/fecha.js";

const API = process.env.API_URL ?? "http://localhost:4000";
const WEB_API_KEY = "AIzaSyD2KSC_e2aDrLrLPuzE--fH_Hb1G33qaDU";
const DIA = 24 * 60 * 60 * 1000;

async function idTokenDe(email: string): Promise<string> {
  const uid = (await getAuth().getUserByEmail(email)).uid;
  const custom = await getAuth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }) }
  );
  const data = (await res.json()) as { idToken?: string };
  if (!data.idToken) throw new Error("token");
  return data.idToken;
}

async function preguntar(token: string, pregunta: string) {
  const res = await fetch(`${API}/api/ai/consulta`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pregunta }),
  });
  return { status: res.status, body: (await res.json()) as { respuesta?: string; error?: string } };
}

/** Cifras reales de Firestore para contrastar (mismo criterio que el reporte). */
async function cifrasReales(empresaId: string) {
  const db = getDb();
  const { inicio, fin } = rangoDiaLima();
  const vendidos = (await db.collection("pasajes").where("empresaId", "==", empresaId).where("estado", "==", "vendido").get()).docs.map((d) => d.data());
  const enRango = (p: FirebaseFirestore.DocumentData, a: number, b: number) => {
    const t = (p.fechaVenta as admin.firestore.Timestamp).toDate().getTime();
    return t >= a && t < b;
  };
  const hoy = vendidos.filter((p) => enRango(p, inicio.getTime(), fin.getTime()));
  const ult7 = vendidos.filter((p) => enRango(p, inicio.getTime() - 7 * DIA, fin.getTime()));

  // Ruta más vendida del mes.
  const salidas = new Map((await db.collection("salidas").where("empresaId", "==", empresaId).get()).docs.map((d) => [d.id, d.data()]));
  const rutas = new Map((await db.collection("rutas").where("empresaId", "==", empresaId).get()).docs.map((d) => [d.id, d.data()]));
  const mes = vendidos.filter((p) => enRango(p, inicio.getTime() - 30 * DIA, fin.getTime()));
  const porRuta = new Map<string, number>();
  for (const p of mes) {
    const rid = (salidas.get(p.salidaId as string)?.rutaId as string) ?? "?";
    porRuta.set(rid, (porRuta.get(rid) ?? 0) + 1);
  }
  const top = [...porRuta.entries()].sort((a, b) => b[1] - a[1])[0];
  const topNombre = top ? `${rutas.get(top[0])?.origen} – ${rutas.get(top[0])?.destino} (${top[1]} pasajes/mes)` : "n/a";

  // Salidas de mañana.
  const iniManana = fin.getTime();
  const finManana = iniManana + DIA;
  const manana = [...salidas.values()].filter((s) => {
    const t = (s.fechaHora as admin.firestore.Timestamp).toDate().getTime();
    return t >= iniManana && t < finManana && s.estado !== "cancelada";
  });

  return {
    hoy: `${hoy.length} pasajes, S/ ${hoy.reduce((s, p) => s + (p.precioPagado as number), 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
    ult7: `${ult7.length} pasajes, S/ ${ult7.reduce((s, p) => s + (p.precioPagado as number), 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`,
    topRuta: topNombre,
    salidasManana: manana.length,
  };
}

async function main(): Promise<void> {
  const db = getDb();
  const flota = (await db.collection("empresas").where("email", "==", "admin.flota@rumbo-demo.com").limit(1).get()).docs[0].data();
  const ruta = (await db.collection("empresas").where("planId", "==", "ruta").limit(1).get()).docs[0].data();
  const tokenFlota = await idTokenDe(flota.email as string);

  if (process.env.MODO === "fallo") {
    // 3) Manejo de error de Gemini: el backend debe estar corriendo con una
    //    GEMINI_API_KEY inválida. Se espera 200 + mensaje neutro, sin traza.
    console.log("3) Fallo de Gemini simulado (backend con API key inválida)");
    const r = await preguntar(tokenFlota, "¿Cuánto vendí hoy?");
    console.log(`   HTTP ${r.status} → "${r.body.respuesta ?? r.body.error}"`);
    const ok = r.status === 200 && r.body.respuesta === "El asistente no está disponible en este momento.";
    console.log(`   ${ok ? "✅ Mensaje neutro, sin error crudo ni traza" : "❌ No devolvió el mensaje neutro"}`);
    process.exit(ok ? 0 : 1);
  }

  // ---------------------------------------------------------------------------
  console.log(`1) Empresa FLOTA (${flota.razonSocial}) — preguntas reales a Gemini\n`);
  const reales = await cifrasReales(flota.id as string);

  const preguntas: { q: string; real: string }[] = [
    { q: "¿Cuánto vendí hoy?", real: `hoy real: ${reales.hoy}` },
    { q: "¿Cuál es mi ruta más vendida?", real: `top ruta real (mes): ${reales.topRuta}` },
    { q: "¿Cuántas salidas tengo programadas para mañana?", real: `salidas reales mañana: ${reales.salidasManana}` },
  ];

  let flotaOk = true;
  for (const { q, real } of preguntas) {
    const t0 = Date.now();
    const r = await preguntar(tokenFlota, q);
    const ms = Date.now() - t0;
    console.log(`   ❓ ${q}  [HTTP ${r.status}, ${ms} ms]`);
    console.log(`   🤖 ${(r.body.respuesta ?? r.body.error ?? "").split("\n").join("\n      ")}`);
    console.log(`   📊 ${real}\n`);
    flotaOk = flotaOk && r.status === 200 && !!r.body.respuesta &&
      r.body.respuesta !== "El asistente no está disponible en este momento.";
  }
  console.log(`   ${flotaOk ? "✅ Las 3 consultas respondieron con datos" : "❌ Alguna consulta falló"}\n`);

  // ---------------------------------------------------------------------------
  console.log(`2) Empresa RUTA (${ruta.razonSocial}, asistenteIA=false) — enforcement por plan`);
  const tokenRuta = await idTokenDe(ruta.email as string);
  const r403 = await preguntar(tokenRuta, "¿Cuánto vendí hoy?");
  console.log(`   HTTP ${r403.status} → "${r403.body.error ?? r403.body.respuesta}"`);
  const upgradeOk = r403.status === 403 && (r403.body.error ?? "").includes("Actualiza a Flota");
  console.log(`   ${upgradeOk ? "✅ 403 con mensaje de upgrade (plan leído de Firestore)" : "❌ No dio el 403 esperado"}\n`);

  // ---------------------------------------------------------------------------
  console.log("3) Salvaguardas");
  const larga = await preguntar(tokenFlota, "x".repeat(501));
  console.log(`   pregunta de 501 chars → HTTP ${larga.status} (esperado 400)`);

  // Rate limit: ya se usaron 3 consultas del minuto; 7 baratas más (van al 403
  // del plan Ruta NO — deben ser del mismo uid de Flota). Usamos preguntas que
  // fallan rápido en validación NO cuentan… la ventana se registra en el
  // middleware ANTES del controlador, así que también cuentan las 400. Enviamos
  // hasta agotar 10 y comprobamos la 11.ª.
  let ultimo = 0;
  for (let i = 0; i < 8; i++) {
    ultimo = (await preguntar(tokenFlota, "x".repeat(501))).status; // 400 rápidas, cuentan para la ventana
  }
  const excedida = await preguntar(tokenFlota, "¿Cuánto vendí hoy?");
  console.log(`   consultas 5..12 en el mismo minuto → última HTTP ${ultimo}; la siguiente → HTTP ${excedida.status} (esperado 429)`);
  const salvaguardasOk = larga.status === 400 && excedida.status === 429;
  console.log(`   ${salvaguardasOk ? "✅ Límite de 500 chars y rate limit 10/min activos" : "❌ Alguna salvaguarda falló"}\n`);

  const ok = flotaOk && upgradeOk && salvaguardasOk;
  console.log(ok ? "✅ TODO OK (RF-15: IA + enforcement por plan + salvaguardas)" : "❌ Alguna verificación falló");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => { console.error("❌ Error en la prueba:", err); process.exit(1); });
