/**
 * Prueba real del Día 3: enforcement de límites (RF-03) y aislamiento
 * multi-tenant (§4.2). Script de verificación manual, no runtime.
 *
 * Estrategia sin contraseñas: para cada empresa se obtiene un ID token vía
 * createCustomToken (Admin SDK) → signInWithCustomToken (REST). El token
 * arrastra los custom claims reales (empresaId, rol) del usuario.
 *
 * Demuestra:
 *   1. Empresa plan RUTA: crea 5 buses (OK) y el 6.º es RECHAZADO (403).
 *   2. Empresa plan FLOTA: crea 6 buses SIN problema (límite 25, leído del plan).
 *   3. Aislamiento: cada empresa ve solo sus buses y sus rutas, en ambos sentidos.
 *
 * Requiere el backend corriendo en http://localhost:4000.
 * Uso: npm run test:limites
 */
import "dotenv/config";
import { getAuth, getDb } from "../src/config/firebase.js";

const API = process.env.API_URL ?? "http://localhost:4000";
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY ?? "AIzaSyD2KSC_e2aDrLrLPuzE--fH_Hb1G33qaDU";

interface EmpresaCtx {
  empresaId: string;
  razonSocial: string;
  planId: string;
  email: string;
  token: string;
}

/** Obtiene un ID token para el admin de una empresa (sin contraseña). */
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
  const data = (await res.json()) as { idToken?: string; error?: unknown };
  if (!res.ok || !data.idToken) throw new Error(`No se pudo obtener token: ${JSON.stringify(data)}`);
  return data.idToken;
}

/** Localiza una empresa por plan; si no existe, la crea vía el registro. */
async function obtenerEmpresaPorPlan(planId: string, demo: {
  ruc: string;
  razonSocial: string;
  email: string;
}): Promise<EmpresaCtx> {
  const db = getDb();
  let snap = await db.collection("empresas").where("planId", "==", planId).limit(1).get();

  if (snap.empty) {
    console.log(`   (no había empresa ${planId}; creando demo ${demo.email}…)`);
    const reg = await fetch(`${API}/api/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...demo, password: "demo123456", planId }),
    });
    if (!reg.ok) throw new Error(`No se pudo crear la empresa demo ${planId}: ${JSON.stringify(await reg.json())}`);
    snap = await db.collection("empresas").where("planId", "==", planId).limit(1).get();
  }

  const empresa = snap.docs[0].data();
  const token = await idTokenParaEmpresa(empresa.email as string);
  return {
    empresaId: empresa.id as string,
    razonSocial: empresa.razonSocial as string,
    planId: empresa.planId as string,
    email: empresa.email as string,
    token,
  };
}

/** Borra todos los buses del tenant para que el conteo arranque en 0. */
async function limpiarBuses(empresaId: string): Promise<void> {
  const snap = await getDb().collection("buses").where("empresaId", "==", empresaId).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function crearBus(ctx: EmpresaCtx, placa: string) {
  const res = await fetch(`${API}/api/buses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.token}` },
    body: JSON.stringify({ placa, numAsientos: 40 }),
  });
  return { status: res.status, body: await res.json() };
}

async function listarBuses(ctx: EmpresaCtx) {
  const res = await fetch(`${API}/api/buses`, { headers: { Authorization: `Bearer ${ctx.token}` } });
  return (await res.json()) as { buses: { id: string; empresaId: string; placa: string }[]; uso: { actual: number; max: number } };
}

async function crearRuta(ctx: EmpresaCtx, origen: string, destino: string) {
  await fetch(`${API}/api/rutas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.token}` },
    body: JSON.stringify({ origen, destino, duracionMin: 300, precioBase: 60 }),
  });
}

async function listarRutas(ctx: EmpresaCtx) {
  const res = await fetch(`${API}/api/rutas`, { headers: { Authorization: `Bearer ${ctx.token}` } });
  return (await res.json()) as { rutas: { id: string; empresaId: string; origen: string; destino: string }[] };
}

async function main(): Promise<void> {
  console.log("Localizando empresas Ruta y Flota…");
  const ruta = await obtenerEmpresaPorPlan("ruta", {
    ruc: "20487654321",
    razonSocial: "Expreso Valle Sagrado S.A.C.",
    email: "admin.ruta@rumbo.pe",
  });
  const flota = await obtenerEmpresaPorPlan("flota", {
    ruc: "20512345678",
    razonSocial: "Transportes Cruz del Valle S.A.C.",
    email: "admin.flota@rumbo.pe",
  });
  console.log(`   RUTA  → ${ruta.razonSocial} (${ruta.empresaId})`);
  console.log(`   FLOTA → ${flota.razonSocial} (${flota.empresaId})\n`);

  // Estado limpio de buses en ambos tenants.
  await limpiarBuses(ruta.empresaId);
  await limpiarBuses(flota.empresaId);

  // ---------------------------------------------------------------------------
  console.log("1) Empresa RUTA (maxBuses = 5): crear 5 buses y luego el 6.º");
  for (let i = 1; i <= 5; i++) {
    const r = await crearBus(ruta, `RUTA-00${i}`);
    console.log(`   bus ${i}: HTTP ${r.status}`);
  }
  const sexto = await crearBus(ruta, "RUTA-006");
  console.log(`   bus 6: HTTP ${sexto.status} → "${(sexto.body as { error?: string }).error ?? ""}"`);
  const rutaRechazado = sexto.status === 403;
  console.log(`   ${rutaRechazado ? "✅ 6.º bus RECHAZADO como se esperaba" : "❌ debió rechazarse"}\n`);

  // ---------------------------------------------------------------------------
  console.log("2) Empresa FLOTA (maxBuses = 25): crear 6 buses (pasar de 5)");
  for (let i = 1; i <= 6; i++) {
    const r = await crearBus(flota, `FLOT-00${i}`);
    process.stdout.write(`   bus ${i}: HTTP ${r.status}  `);
  }
  const flotaLista = await listarBuses(flota);
  console.log(`\n   uso Flota: ${flotaLista.uso.actual} de ${flotaLista.uso.max}`);
  const flotaPasa = flotaLista.uso.actual === 6;
  console.log(`   ${flotaPasa ? "✅ Flota superó los 5 buses sin problema" : "❌ Flota no llegó a 6"}\n`);

  // ---------------------------------------------------------------------------
  console.log("3) Aislamiento multi-tenant (buses y rutas)");
  // Crea una ruta distinta en cada empresa.
  await crearRuta(ruta, "Lima", "Trujillo");
  await crearRuta(flota, "Lima", "Cusco");

  const busesRuta = await listarBuses(ruta);
  const busesFlota = await listarBuses(flota);
  const rutasRuta = await listarRutas(ruta);
  const rutasFlota = await listarRutas(flota);

  const busesRutaAjenos = busesRuta.buses.filter((b) => b.empresaId !== ruta.empresaId);
  const busesFlotaAjenos = busesFlota.buses.filter((b) => b.empresaId !== flota.empresaId);
  const rutasRutaAjenas = rutasRuta.rutas.filter((r) => r.empresaId !== ruta.empresaId);
  const rutasFlotaAjenas = rutasFlota.rutas.filter((r) => r.empresaId !== flota.empresaId);

  console.log(`   RUTA ve ${busesRuta.buses.length} buses y ${rutasRuta.rutas.length} ruta(s); ajenos: ${busesRutaAjenos.length} buses, ${rutasRutaAjenas.length} rutas`);
  console.log(`   FLOTA ve ${busesFlota.buses.length} buses y ${rutasFlota.rutas.length} ruta(s); ajenos: ${busesFlotaAjenos.length} buses, ${rutasFlotaAjenas.length} rutas`);
  // Comprobación explícita de que ninguna ve la ruta de la otra.
  const rutaNoVeCusco = !rutasRuta.rutas.some((r) => r.destino === "Cusco");
  const flotaNoVeTrujillo = !rutasFlota.rutas.some((r) => r.destino === "Trujillo");
  const aislado =
    busesRutaAjenos.length === 0 &&
    busesFlotaAjenos.length === 0 &&
    rutasRutaAjenas.length === 0 &&
    rutasFlotaAjenas.length === 0 &&
    rutaNoVeCusco &&
    flotaNoVeTrujillo;
  console.log(`   RUTA no ve la ruta "Cusco" de Flota: ${rutaNoVeCusco}; FLOTA no ve "Trujillo" de Ruta: ${flotaNoVeTrujillo}`);
  console.log(`   ${aislado ? "✅ Aislamiento correcto en ambos sentidos" : "❌ Fuga entre tenants"}\n`);

  const ok = rutaRechazado && flotaPasa && aislado;
  console.log(ok ? "✅ TODO OK (RF-03 + aislamiento)" : "❌ Alguna verificación falló");
  if (!ok) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error en la prueba:", err);
    process.exit(1);
  });
