/**
 * Prueba real del Día 5: mapa de asientos en tiempo real + aislamiento a nivel
 * de REGLAS de Firestore. Script de verificación manual, no runtime.
 *
 * Usa el MISMO onSnapshot que la UI (SDK cliente de Firebase en Node), para que
 * la prueba sea fiel a lo que hace el navegador. Requiere las reglas del Anexo C
 * publicadas.
 *
 * Demuestra:
 *   1. Empresa Flota: se suscribe a los pasajes de una salida real de hoy →
 *      primer snapshot 0 ocupados (todo libre); reporta numAsientos del bus.
 *   2. Se inserta un pasaje de prueba (Admin SDK) → el listener se dispara solo
 *      y el asiento pasa a ocupado SIN volver a consultar (0 → 1 por evento).
 *   3. AISLAMIENTO POR REGLAS (prueba negativa): autenticado como empresa Ruta,
 *      intentar suscribirse a los pasajes de la salida de Flota debe fallar con
 *      permission-denied (no devolver vacío).
 *
 * IMPORTANTE (lección aprendida): el SDK cliente sirve resultados de su CACHÉ
 * local antes de ir al servidor. Para que la prueba negativa mida al servidor
 * (las reglas) y no la caché, el "atacante" usa una instancia de app separada
 * (caché limpia) e ignora los snapshots con metadata.fromCache.
 *
 * Uso: npm run test:mapa   (no necesita el backend; habla directo con Firestore)
 */
import "dotenv/config";
import admin from "firebase-admin";
import { getAuth as getAdminAuth, getDb } from "../src/config/firebase.js";
import { initializeApp } from "firebase/app";
import {
  getAuth as getClientAuth,
  signInWithCustomToken,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  type FirestoreError,
} from "firebase/firestore";

const WEB_CONFIG = {
  apiKey: "AIzaSyD2KSC_e2aDrLrLPuzE--fH_Hb1G33qaDU",
  authDomain: "rumboapp-264ca.firebaseapp.com",
  projectId: "rumboapp-264ca",
};

// App del dueño (Flota) y app separada para el "atacante" (Ruta) → cachés
// independientes, para que la prueba negativa mida al servidor, no a la caché.
const ownerApp = initializeApp(WEB_CONFIG, "mapa-owner");
const ownerAuth = getClientAuth(ownerApp);
const ownerDb = getFirestore(ownerApp);

const attackerApp = initializeApp(WEB_CONFIG, "mapa-attacker");
const attackerAuth = getClientAuth(attackerApp);
const attackerDb = getFirestore(attackerApp);

interface Empresa {
  empresaId: string;
  email: string;
}

async function empresaPorPlan(planId: string): Promise<Empresa> {
  const snap = await getDb().collection("empresas").where("planId", "==", planId).limit(1).get();
  if (snap.empty) throw new Error(`No hay empresa con plan ${planId}. Corre antes test:limites.`);
  const e = snap.docs[0].data();
  return { empresaId: e.id as string, email: e.email as string };
}

/** Inicia sesión en un SDK cliente como el admin de una empresa (sin password). */
async function loginComo(authInstance: Auth, email: string): Promise<void> {
  const uid = (await getAdminAuth().getUserByEmail(email)).uid;
  const customToken = await getAdminAuth().createCustomToken(uid);
  await signInWithCustomToken(authInstance, customToken);
}

/** Busca una salida para la empresa; si no hay, la crea (Admin SDK). */
async function salidaDePrueba(empresaId: string): Promise<{ salidaId: string; numAsientos: number }> {
  const db = getDb();
  const rutaSnap = await db.collection("rutas").where("empresaId", "==", empresaId).limit(1).get();
  const busSnap = await db.collection("buses").where("empresaId", "==", empresaId).limit(1).get();
  if (rutaSnap.empty || busSnap.empty) throw new Error("La empresa no tiene ruta o bus.");
  const bus = busSnap.docs[0].data();

  const salidasSnap = await db.collection("salidas").where("empresaId", "==", empresaId).limit(1).get();
  let salidaId: string;
  if (!salidasSnap.empty) {
    salidaId = salidasSnap.docs[0].id;
  } else {
    const ref = db.collection("salidas").doc();
    await ref.set({
      id: ref.id,
      empresaId,
      rutaId: rutaSnap.docs[0].id,
      busId: busSnap.docs[0].id,
      fechaHora: admin.firestore.Timestamp.now(),
      precio: 60,
      choferNombre: "Chofer Demo",
      estado: "programada",
    });
    salidaId = ref.id;
  }
  return { salidaId, numAsientos: bus.numAsientos as number };
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const flota = await empresaPorPlan("flota");
  const ruta = await empresaPorPlan("ruta");
  const { salidaId, numAsientos } = await salidaDePrueba(flota.empresaId);

  console.log(`Empresa Flota: ${flota.empresaId}`);
  console.log(`Salida de prueba: ${salidaId} (bus de ${numAsientos} asientos)\n`);

  // Limpieza de cualquier pasaje de prueba previo.
  const previos = await getDb().collection("pasajes")
    .where("empresaId", "==", flota.empresaId)
    .where("salidaId", "==", salidaId)
    .get();
  await Promise.all(previos.docs.map((d) => d.ref.delete()));

  // ---------------------------------------------------------------------------
  // 1 y 2) Tiempo real como Flota (dueña de la salida).
  console.log("1) Suscripción en tiempo real (empresa Flota, la dueña)");
  await loginComo(ownerAuth, flota.email);

  const conteos: number[] = [];
  const seVioOcupado = new Promise<boolean>((resolve, reject) => {
    const q = query(
      collection(ownerDb, "pasajes"),
      where("empresaId", "==", flota.empresaId),
      where("salidaId", "==", salidaId),
      where("estado", "==", "vendido")
    );
    const timeout = setTimeout(() => reject(new Error("El listener no se disparó a tiempo.")), 15000);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const asientos = snap.docs.map((d) => d.data().numAsiento);
        conteos.push(snap.size);
        console.log(`   [snapshot] ocupados=${snap.size} asientos=[${asientos.join(",")}]`);
        if (snap.size === 1 && asientos.includes(12)) {
          clearTimeout(timeout);
          unsub();
          resolve(true);
        }
      },
      (err: FirestoreError) => {
        clearTimeout(timeout);
        reject(err);
      }
    );
  });

  await espera(1500); // dejar llegar el primer snapshot (esperado: 0)
  console.log("   → primer snapshot recibido (todo libre).");

  console.log("2) Insertando pasaje de prueba (Admin SDK): asiento 12 vendido…");
  const pasajeRef = getDb().collection("pasajes").doc();
  await pasajeRef.set({
    id: pasajeRef.id,
    empresaId: flota.empresaId,
    salidaId,
    numAsiento: 12,
    pasajeroNombre: "Pasajero Prueba",
    pasajeroDoc: "00000000",
    vendedorId: "test",
    fechaVenta: admin.firestore.Timestamp.now(),
    precioPagado: 60,
    estado: "vendido",
  });

  await seVioOcupado;
  const tiempoRealOk = conteos[0] === 0 && conteos.includes(1);
  console.log(`   ${tiempoRealOk ? "✅ El asiento 12 pasó a OCUPADO por evento (0 → 1), sin recargar" : "❌ No se observó la transición"}\n`);

  // Deja el pasaje para que se vea "ocupado" mientras corre la prueba negativa;
  // se limpia al final.

  // ---------------------------------------------------------------------------
  // 3) Prueba negativa de aislamiento A NIVEL DE REGLAS (app/caché separada).
  console.log("3) Aislamiento por reglas (prueba negativa): Ruta intenta leer pasajes de Flota");
  await loginComo(attackerAuth, ruta.email);

  const resultado = await new Promise<string>((resolve) => {
    const q = query(
      collection(attackerDb, "pasajes"),
      where("empresaId", "==", flota.empresaId), // ¡empresa AJENA!
      where("salidaId", "==", salidaId),
      where("estado", "==", "vendido")
    );
    const timeout = setTimeout(() => resolve("timeout"), 15000);
    const unsub = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        // Ignora la caché local: solo cuenta la respuesta del SERVIDOR (reglas).
        if (snap.metadata.fromCache) return;
        clearTimeout(timeout);
        unsub();
        resolve(`snapshot-servidor-size-${snap.size}`); // NO debería ocurrir
      },
      (err: FirestoreError) => {
        clearTimeout(timeout);
        resolve(`error-${err.code}`);
      }
    );
  });

  console.log(`   resultado de la suscripción ajena: ${resultado}`);
  const bloqueado = resultado === "error-permission-denied";
  console.log(
    `   ${bloqueado ? "✅ Firestore RECHAZÓ la lectura (permission-denied), no devolvió vacío" : "❌ No fue permission-denied — revisar reglas"}\n`
  );

  // Limpieza del pasaje de prueba.
  await pasajeRef.delete();

  const ok = tiempoRealOk && bloqueado;
  console.log(ok ? "✅ TODO OK (tiempo real + aislamiento por reglas)" : "❌ Alguna verificación falló");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Error en la prueba:", err);
  process.exit(1);
});
