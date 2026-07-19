/**
 * Prueba real del Día 9: cambio de plan (RF-04), panel superadmin (RF-16) y el
 * guion de demo completo del asistente. Script de verificación manual.
 *
 * Demuestra:
 *   1. GUION DE DEMO de corrido: empresa con plan Ruta pregunta al asistente →
 *      403 upgrade → cambia a Flota (PUT /api/empresa/plan) → pregunta de nuevo
 *      → el asistente RESPONDE. (Se revierte a ruta al final.)
 *   2. DOWNGRADE permisivo: Flota (18 buses) baja a Ruta → permitido CON avisos;
 *      crear un bus más → 403 por límite; vuelve a Flota.
 *   3. SUPERADMIN: lista empresas; un admin_empresa NO puede usar el panel
 *      (403); suspende un tenant → su admin queda bloqueado en TODA la API;
 *      reactiva → vuelve a operar. Prueba negativa por REGLAS (app cliente
 *      separada, ignorando caché): el SA no puede leer pasajes ni salidas de un
 *      tenant → permission-denied.
 *   4. AUDITORÍA: cambio_plan, suspension_empresa y reactivacion_empresa quedan
 *      registrados.
 *
 * Requiere: backend corriendo y `npm run seed:superadmin` ejecutado.
 * Uso: npm run test:dia9
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
  limit,
  onSnapshot,
  type FirestoreError,
} from "firebase/firestore";

const API = process.env.API_URL ?? "http://localhost:4000";
const WEB_API_KEY = "AIzaSyD2KSC_e2aDrLrLPuzE--fH_Hb1G33qaDU";

async function idTokenDe(email: string): Promise<string> {
  const uid = (await getAuth().getUserByEmail(email)).uid;
  const custom = await getAuth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }) }
  );
  const data = (await res.json()) as { idToken?: string };
  if (!data.idToken) throw new Error(`token para ${email}`);
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

async function main(): Promise<void> {
  const db = getDb();
  const selva = (await db.collection("empresas").where("email", "==", "admin.selvacentral@rumbo.pe").limit(1).get()).docs[0].data();
  const flota = (await db.collection("empresas").where("email", "==", "admin.flota@rumbo.pe").limit(1).get()).docs[0].data();

  const tokenSelva = await idTokenDe(selva.email as string);
  const tokenFlota = await idTokenDe(flota.email as string);
  const tokenSA = await idTokenDe("superadmin@rumbo.pe");

  // Marca para filtrar la auditoría nueva, con 2 min de margen: la auditoría
  // usa serverTimestamp y el reloj local puede ir adelantado (skew).
  const desde = admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 60_000);

  // ---------------------------------------------------------------------------
  console.log(`1) GUION DE DEMO — ${selva.razonSocial} (plan ${selva.planId})`);
  const q1 = await api("POST", "/api/ai/consulta", tokenSelva, { pregunta: "¿Cuánto vendí hoy?" });
  console.log(`   [plan ruta] pregunta al asistente → HTTP ${q1.status} "${q1.body.error ?? ""}"`);
  const paso403 = q1.status === 403 && String(q1.body.error).includes("Actualiza a Terminal");

  const cambio = await api("PUT", "/api/empresa/plan", tokenSelva, { planId: "terminal" });
  console.log(`   cambia a Terminal → HTTP ${cambio.status} (avisos: ${JSON.stringify(cambio.body.avisos)})`);

  const q2 = await api("POST", "/api/ai/consulta", tokenSelva, { pregunta: "¿Cuánto vendí hoy?" });
  const resp2 = String(q2.body.respuesta ?? q2.body.error ?? "");
  console.log(`   [ya en terminal] pregunta de nuevo → HTTP ${q2.status}`);
  console.log(`   🤖 ${resp2.split("\n")[0]}`);
  const pasoIA = q2.status === 200 && !!q2.body.respuesta && !resp2.includes("no está disponible");

  // Revierte para no alterar el dataset.
  const reverso = await api("PUT", "/api/empresa/plan", tokenSelva, { planId: "ruta" });
  console.log(`   revierte a ruta → HTTP ${reverso.status}`);
  const demoOk = paso403 && cambio.status === 200 && pasoIA && reverso.status === 200;
  console.log(`   ${demoOk ? "✅ Guion completo: 403 → upgrade → respuesta con datos" : "❌ Falló el guion"}\n`);

  // ---------------------------------------------------------------------------
  console.log(`2) DOWNGRADE — ${flota.razonSocial} baja de flota a ruta`);
  const nBuses = (await db.collection("buses").where("empresaId", "==", flota.id).count().get()).data().count;
  const down = await api("PUT", "/api/empresa/plan", tokenFlota, { planId: "ruta" });
  console.log(`   con ${nBuses} buses → HTTP ${down.status}`);
  for (const a of (down.body.avisos as string[]) ?? []) console.log(`   ⚠ ${a}`);
  const conAvisos = down.status === 200 && ((down.body.avisos as string[]) ?? []).length > 0;

  const busExtra = await api("POST", "/api/buses", tokenFlota, { placa: "ZZZ-999", numAsientos: 40 });
  console.log(`   intenta crear bus → HTTP ${busExtra.status} "${busExtra.body.error ?? ""}"`);
  const bloqueaCrear = busExtra.status === 403;

  const up = await api("PUT", "/api/empresa/plan", tokenFlota, { planId: "flota" });
  console.log(`   vuelve a flota → HTTP ${up.status}`);
  const downgradeOk = conAvisos && bloqueaCrear && up.status === 200;
  console.log(`   ${downgradeOk ? "✅ Downgrade permitido sin borrar nada; crear queda bloqueado" : "❌ Falló el downgrade"}\n`);

  // ---------------------------------------------------------------------------
  console.log("3) SUPERADMIN");
  const lista = await api("GET", "/api/superadmin/empresas", tokenSA);
  const filas = (lista.body.empresas as { razonSocial: string; planId: string; estado: string }[]) ?? [];
  console.log(`   GET /api/superadmin/empresas → HTTP ${lista.status}, ${filas.length} empresas:`);
  for (const f of filas) console.log(`     • ${f.razonSocial} [${f.planId}] ${f.estado}`);

  const intruso = await api("GET", "/api/superadmin/empresas", tokenFlota);
  console.log(`   admin_empresa intenta usar el panel → HTTP ${intruso.status} (esperado 403)`);

  console.log(`   suspendiendo a ${selva.razonSocial}…`);
  const susp = await api("PUT", `/api/superadmin/empresas/${selva.id}/estado`, tokenSA, { estado: "suspendida" });
  const bloqueado = await api("GET", "/api/rutas", tokenSelva);
  console.log(`   su admin llama GET /api/rutas → HTTP ${bloqueado.status} "${bloqueado.body.error ?? ""}"`);

  const react = await api("PUT", `/api/superadmin/empresas/${selva.id}/estado`, tokenSA, { estado: "activa" });
  const desbloqueado = await api("GET", "/api/rutas", tokenSelva);
  console.log(`   reactivada → GET /api/rutas → HTTP ${desbloqueado.status}`);
  // Nota: seed dejó a Selva Central en estado "prueba"; la reactivación la deja "activa" (válido).

  const suspensionOk =
    lista.status === 200 && filas.length >= 6 && intruso.status === 403 &&
    susp.status === 200 && bloqueado.status === 403 &&
    react.status === 200 && desbloqueado.status === 200;
  console.log(`   ${suspensionOk ? "✅ Suspensión bloquea toda la API; reactivación restaura" : "❌ Falló suspensión/reactivación"}`);

  // Prueba negativa por REGLAS: el SA no lee colecciones operativas de tenants.
  console.log("   Prueba negativa por reglas: SA lee pasajes/salidas de un tenant…");
  const saApp = initializeApp({ apiKey: WEB_API_KEY, authDomain: "rumboapp-264ca.firebaseapp.com", projectId: "rumboapp-264ca" }, "dia9-sa");
  const saAuth = getClientAuth(saApp);
  const saDb = getFirestore(saApp);
  const saUid = (await getAuth().getUserByEmail("superadmin@rumbo.pe")).uid;
  await signInWithCustomToken(saAuth, await getAuth().createCustomToken(saUid, { isSuperAdmin: true }));

  const intentar = (col: string) =>
    new Promise<string>((resolve) => {
      const q = query(collection(saDb, col), where("empresaId", "==", flota.id), limit(1));
      const timeout = setTimeout(() => resolve("timeout"), 15000);
      const unsub = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snap) => {
          if (snap.metadata.fromCache) return; // solo cuenta el SERVIDOR (Día 5)
          clearTimeout(timeout);
          unsub();
          resolve(`snapshot-servidor-size-${snap.size}`);
        },
        (err: FirestoreError) => {
          clearTimeout(timeout);
          resolve(`error-${err.code}`);
        }
      );
    });

  const rPasajes = await intentar("pasajes");
  const rSalidas = await intentar("salidas");
  console.log(`     pasajes → ${rPasajes} | salidas → ${rSalidas}`);
  const reglasOk = rPasajes === "error-permission-denied" && rSalidas === "error-permission-denied";
  console.log(`   ${reglasOk ? "✅ Firestore RECHAZA al SA en colecciones operativas (permission-denied)" : "❌ El SA pudo leer datos operativos"}\n`);

  // ---------------------------------------------------------------------------
  console.log("4) AUDITORÍA (eventos desde el inicio de esta prueba)");
  const audit = await db.collection("auditoria").where("timestamp", ">=", desde).get();
  const eventos = audit.docs.map((d) => d.data().evento as string);
  const cuenta = (e: string) => eventos.filter((x) => x === e).length;
  console.log(`   cambio_plan=${cuenta("cambio_plan")} suspension_empresa=${cuenta("suspension_empresa")} reactivacion_empresa=${cuenta("reactivacion_empresa")} consulta_ia=${cuenta("consulta_ia")}`);
  const auditOk = cuenta("cambio_plan") >= 4 && cuenta("suspension_empresa") >= 1 && cuenta("reactivacion_empresa") >= 1;
  console.log(`   ${auditOk ? "✅ Todos los eventos quedaron en auditoría" : "❌ Falta algún evento"}\n`);

  const ok = demoOk && downgradeOk && suspensionOk && reglasOk && auditOk;
  console.log(ok ? "✅ TODO OK (RF-04 + RF-16 + guion de demo)" : "❌ Alguna verificación falló");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => { console.error("❌ Error en la prueba:", err); process.exit(1); });
