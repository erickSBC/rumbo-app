/**
 * Prueba real del Día 4: programación de salidas (RF-09), listado del día y
 * aislamiento multi-tenant. Script de verificación manual, no runtime.
 *
 * Demuestra:
 *   1. Programa 2 salidas HOY (una con precio por defecto de la ruta, otra con
 *      precio explícito) y 1 salida en OTRA fecha, con la ruta y bus reales de
 *      la empresa Flota.
 *   2. GET /api/salidas/hoy muestra solo las 2 de hoy (la de otra fecha no).
 *   3. Aislamiento: programar en Flota usando la rutaId — y luego el busId — de
 *      la empresa Ruta es RECHAZADO.
 *
 * Requiere el backend corriendo en http://localhost:4000.
 * Uso: npm run test:salidas
 */
import "dotenv/config";
import { getAuth, getDb } from "../src/config/firebase.js";

const API = process.env.API_URL ?? "http://localhost:4000";
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY ?? "AIzaSyD2KSC_e2aDrLrLPuzE--fH_Hb1G33qaDU";

interface Ctx {
  empresaId: string;
  razonSocial: string;
  email: string;
  token: string;
}

async function idTokenParaEmpresa(email: string): Promise<string> {
  const uid = (await getAuth().getUserByEmail(email)).uid;
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
  if (!res.ok || !data.idToken) throw new Error(`No se pudo obtener token: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function ctxPorPlan(planId: string): Promise<Ctx> {
  const snap = await getDb().collection("empresas").where("planId", "==", planId).limit(1).get();
  if (snap.empty) throw new Error(`No hay empresa con plan ${planId}. Corre antes test:limites.`);
  const e = snap.docs[0].data();
  return {
    empresaId: e.id as string,
    razonSocial: e.razonSocial as string,
    email: e.email as string,
    token: await idTokenParaEmpresa(e.email as string),
  };
}

/** Primer id de una colección para el tenant (ruta o bus). */
async function primerId(coleccion: string, empresaId: string): Promise<string> {
  const snap = await getDb().collection(coleccion).where("empresaId", "==", empresaId).limit(1).get();
  if (snap.empty) throw new Error(`La empresa ${empresaId} no tiene ${coleccion}.`);
  return snap.docs[0].id;
}

async function limpiarSalidas(empresaId: string): Promise<void> {
  const snap = await getDb().collection("salidas").where("empresaId", "==", empresaId).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function programar(ctx: Ctx, body: Record<string, unknown>) {
  const res = await fetch(`${API}/api/salidas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { salida?: unknown; error?: string } };
}

async function listarHoy(ctx: Ctx) {
  const res = await fetch(`${API}/api/salidas/hoy`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
  });
  return (await res.json()) as {
    salidas: { id: string; precio: number; rutaOrigen: string; rutaDestino: string; busPlaca: string; fechaHora: string }[];
  };
}

function fechaHoraLima(fecha: string, hora: string): string {
  // El backend asume Lima si no hay offset; enviamos el estilo datetime-local.
  return `${fecha}T${hora}`;
}

async function main(): Promise<void> {
  const flota = await ctxPorPlan("flota");
  const ruta = await ctxPorPlan("ruta");
  console.log(`Empresa de prueba: ${flota.razonSocial} (${flota.empresaId})`);
  console.log(`Otra empresa (para aislamiento): ${ruta.razonSocial} (${ruta.empresaId})\n`);

  const rutaFlota = await primerId("rutas", flota.empresaId);
  const busFlota = await primerId("buses", flota.empresaId);
  const rutaAjena = await primerId("rutas", ruta.empresaId);
  const busAjeno = await primerId("buses", ruta.empresaId);

  await limpiarSalidas(flota.empresaId);

  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  const otraFecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  );

  // 1) Programar salidas.
  console.log("1) Programar 2 salidas hoy + 1 en otra fecha (empresa Flota)");
  const s1 = await programar(flota, {
    rutaId: rutaFlota,
    busId: busFlota,
    fechaHora: fechaHoraLima(hoy, "08:00"),
    choferNombre: "Juan Pérez",
    // sin precio → toma precioBase de la ruta
  });
  const s2 = await programar(flota, {
    rutaId: rutaFlota,
    busId: busFlota,
    fechaHora: fechaHoraLima(hoy, "22:30"),
    choferNombre: "María Gómez",
    precio: 95,
  });
  const s3 = await programar(flota, {
    rutaId: rutaFlota,
    busId: busFlota,
    fechaHora: fechaHoraLima(otraFecha, "09:00"),
    choferNombre: "Otro Día",
  });
  console.log(`   hoy 08:00  → HTTP ${s1.status} (precio por defecto de la ruta)`);
  console.log(`   hoy 22:30  → HTTP ${s2.status} (precio explícito 95)`);
  console.log(`   ${otraFecha} 09:00 → HTTP ${s3.status} (otra fecha)\n`);

  // 2) Listado de hoy.
  console.log("2) GET /api/salidas/hoy");
  const hoyList = await listarHoy(flota);
  for (const s of hoyList.salidas) {
    console.log(
      `   • ${new Date(s.fechaHora).toLocaleString("es-PE", { timeZone: "America/Lima" })} · ` +
        `${s.rutaOrigen}→${s.rutaDestino} · bus ${s.busPlaca} · S/ ${s.precio}`
    );
  }
  const soloDosHoy = hoyList.salidas.length === 2;
  console.log(`   ${soloDosHoy ? "✅ Hoy muestra exactamente 2 (la de otra fecha no aparece)" : "❌ Debía haber 2 salidas hoy"}\n`);

  // 3) Aislamiento: recursos de otro tenant.
  console.log("3) Aislamiento: programar en Flota con recursos de la empresa Ruta");
  const conRutaAjena = await programar(flota, {
    rutaId: rutaAjena,
    busId: busFlota,
    fechaHora: fechaHoraLima(hoy, "12:00"),
    choferNombre: "Intruso",
  });
  const conBusAjeno = await programar(flota, {
    rutaId: rutaFlota,
    busId: busAjeno,
    fechaHora: fechaHoraLima(hoy, "13:00"),
    choferNombre: "Intruso",
  });
  console.log(`   ruta ajena → HTTP ${conRutaAjena.status} "${conRutaAjena.body.error ?? ""}"`);
  console.log(`   bus ajeno  → HTTP ${conBusAjeno.status} "${conBusAjeno.body.error ?? ""}"`);
  const aislado = conRutaAjena.status === 400 && conBusAjeno.status === 400;
  console.log(`   ${aislado ? "✅ Ambos rechazados (aislamiento correcto)" : "❌ No se rechazó"}\n`);

  const ok = s1.status === 201 && s2.status === 201 && s3.status === 201 && soloDosHoy && aislado;
  console.log(ok ? "✅ TODO OK (RF-09 + aislamiento)" : "❌ Alguna verificación falló");
  if (!ok) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error en la prueba:", err);
    process.exit(1);
  });
