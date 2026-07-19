/**
 * Prueba real del módulo de encomiendas (RF-17..RF-20). Verificación manual.
 *
 * Cubre: enforcement por plan (403 en Ruta), registro con guía correlativa,
 * DOS registros en paralelo → códigos distintos (contador transaccional),
 * manifiesto de carga, ciclo de estados (despacho → llegada → entrega),
 * anulación (solo desde registrada), aislamiento cruzado entre tenants, y el
 * desglose de encomiendas en el reporte del día.
 *
 * Requiere el backend corriendo en http://localhost:4000.
 * Uso: npx tsx scripts/test-encomiendas.ts
 */
import "dotenv/config";
import { getAuth, getDb } from "../src/config/firebase.js";

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
  if (!data.idToken) throw new Error(`No se pudo obtener idToken de ${email}`);
  return data.idToken;
}

interface ApiRes { status: number; body: any }
async function api(method: string, path: string, token: string, body?: unknown): Promise<ApiRes> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function ok(cond: boolean, msg: string): boolean {
  console.log(`   ${cond ? "✅" : "❌"} ${msg}`);
  return cond;
}

function encomiendaBase(salidaId: string, sufijo: string) {
  return {
    salidaId,
    remitenteNombre: `Remitente ${sufijo}`,
    remitenteDoc: "40011122",
    destinatarioNombre: `Destinatario ${sufijo}`,
    destinatarioDoc: "45099988",
    descripcion: "Caja sellada, documentos",
    pesoKg: 3.5,
    precio: 25,
  };
}

async function main(): Promise<void> {
  const db = getDb();
  const flota = (await db.collection("empresas").where("email", "==", "admin.flota@rumbo.pe").limit(1).get()).docs[0].data();
  const andino = (await db.collection("empresas").where("email", "==", "admin.andino@rumbo.pe").limit(1).get()).docs[0].data();
  const selva = (await db.collection("empresas").where("email", "==", "admin.selvacentral@rumbo.pe").limit(1).get()).docs[0].data();

  const tFlota = await idTokenDe(flota.email as string);
  const tAndino = await idTokenDe(andino.email as string);
  const tSelva = await idTokenDe(selva.email as string);

  let todo = true;

  // --- Preparación: una salida PROGRAMADA de la empresa Flota ---------------
  const rutas = (await api("GET", "/api/rutas", tFlota)).body.rutas as any[];
  const buses = (await api("GET", "/api/buses", tFlota)).body.buses as any[];
  const manana = new Date(Date.now() + 24 * 3600_000);
  const fechaHora = `${manana.toISOString().slice(0, 10)}T09:30`;
  const crearSal = await api("POST", "/api/salidas", tFlota, {
    rutaId: rutas[0].id, busId: buses[0].id, fechaHora, choferNombre: "Chofer de prueba", precio: 70,
  });
  const salidaId = crearSal.body.salida.id as string;
  console.log(`Salida de prueba (Flota): ${salidaId}\n`);

  // --- 1) Enforcement por plan: Ruta (sin encomiendas) → 403 ----------------
  console.log(`1) ENFORCEMENT — ${selva.razonSocial} (plan ${selva.planId})`);
  const salSelva = (await db.collection("salidas").where("empresaId", "==", selva.id).where("estado", "==", "programada").limit(1).get()).docs[0]?.id ?? salidaId;
  const r403 = await api("POST", "/api/encomiendas", tSelva, encomiendaBase(salSelva, "X"));
  todo = ok(r403.status === 403 && String(r403.body.error).includes("Actualiza a Flota"), `403 con "Actualiza a Flota" → "${r403.body.error}"`) && todo;

  // --- 2) Registro + dos en paralelo → códigos distintos --------------------
  console.log(`\n2) REGISTRO Y CONTADOR — dos registros en paralelo`);
  const [a, b] = await Promise.all([
    api("POST", "/api/encomiendas", tFlota, encomiendaBase(salidaId, "A")),
    api("POST", "/api/encomiendas", tFlota, encomiendaBase(salidaId, "B")),
  ]);
  const codA = a.body.codigo as string, codB = b.body.codigo as string;
  todo = ok(a.status === 201 && b.status === 201, `ambos registrados (201): ${codA}, ${codB}`) && todo;
  todo = ok(!!codA && !!codB && codA !== codB, `códigos correlativos DISTINTOS (sin colisión de guía)`) && todo;
  todo = ok(/^ENC-\d{6}$/.test(codA) && /^ENC-\d{6}$/.test(codB), `formato ENC-###### correcto`) && todo;

  // --- 3) Manifiesto de carga (RF-19) ---------------------------------------
  console.log(`\n3) MANIFIESTO DE CARGA`);
  const man = await api("GET", `/api/salidas/${salidaId}/manifiesto`, tFlota);
  const codsManifiesto = (man.body.manifiesto.encomiendas as any[]).map((e) => e.codigo);
  todo = ok(codsManifiesto.includes(codA) && codsManifiesto.includes(codB), `el manifiesto lista ambas encomiendas a bordo`) && todo;
  todo = ok(man.body.manifiesto.totalBultos >= 2 && man.body.manifiesto.pesoTotal >= 7, `totales: ${man.body.manifiesto.totalBultos} bultos, ${man.body.manifiesto.pesoTotal} kg`) && todo;

  // --- 4) Ciclo de estados: despacho → llegada → entrega --------------------
  console.log(`\n4) CICLO DE ESTADOS`);
  const desp = await api("POST", `/api/encomiendas/salida/${salidaId}/despachar`, tFlota);
  todo = ok(desp.status === 200 && desp.body.cantidad >= 2, `despacho (registrada→en_viaje): ${desp.body.cantidad} movidas`) && todo;

  // Entregar antes de llegada debe permitirse desde en_viaje también:
  const lleg = await api("POST", `/api/encomiendas/salida/${salidaId}/llegada`, tFlota);
  todo = ok(lleg.status === 200 && lleg.body.cantidad >= 2, `llegada (en_viaje→en_destino): ${lleg.body.cantidad} movidas`) && todo;

  const entrega = await api("PUT", `/api/encomiendas/${a.body.id}/entregar`, tFlota, { entregadaA: "48800011" });
  todo = ok(entrega.status === 200 && entrega.body.estado === "entregada", `entrega con documento del receptor → ${entrega.body.estado}`) && todo;

  // Reintentar entrega sobre una ya entregada → 400 (transición inválida).
  const reEntrega = await api("PUT", `/api/encomiendas/${a.body.id}/entregar`, tFlota, { entregadaA: "48800011" });
  todo = ok(reEntrega.status === 400, `re-entregar una ya entregada → rechazado (${reEntrega.status})`) && todo;

  // Pendientes: debe incluir B (en_destino) y NO A (entregada).
  const pend = await api("GET", "/api/encomiendas/pendientes", tFlota);
  const idsPend = (pend.body.encomiendas as any[]).map((e) => e.id);
  todo = ok(idsPend.includes(b.body.id) && !idsPend.includes(a.body.id), `pendientes incluye B (en_destino) y excluye A (entregada)`) && todo;

  // --- 5) Anulación (solo desde registrada) ---------------------------------
  console.log(`\n5) ANULACIÓN`);
  const c = await api("POST", "/api/encomiendas", tFlota, encomiendaBase(salidaId, "C"));
  const anul = await api("PUT", `/api/encomiendas/${c.body.id}/anular`, tFlota);
  todo = ok(anul.status === 200 && anul.body.estado === "anulada", `anular una registrada → ${anul.body.estado}`) && todo;
  const anul2 = await api("PUT", `/api/encomiendas/${a.body.id}/anular`, tFlota);
  todo = ok(anul2.status === 400, `anular una ya entregada → rechazado (${anul2.status})`) && todo;

  // --- 6) Aislamiento cruzado entre tenants ---------------------------------
  console.log(`\n6) AISLAMIENTO MULTI-TENANT`);
  const salAndino = (await db.collection("salidas").where("empresaId", "==", andino.id).where("estado", "==", "programada").limit(1).get()).docs[0]?.id;
  if (salAndino) {
    const encAndino = await api("POST", "/api/encomiendas", tAndino, encomiendaBase(salAndino, "AND"));
    const cruzado = await api("PUT", `/api/encomiendas/${encAndino.body.id}/anular`, tFlota);
    todo = ok(cruzado.status === 404, `Flota NO puede anular una encomienda de ${andino.razonSocial} → ${cruzado.status}`) && todo;
    // Los códigos son correlativos POR tenant, así que ENC-000001 existe en cada
    // empresa. La búsqueda está scoped por empresaId: Flota nunca debe obtener el
    // documento de Andino (a lo sumo su propia guía con el mismo número, o 404).
    const cruzadoBuscar = await api("GET", `/api/encomiendas/buscar?codigo=${encAndino.body.codigo}`, tFlota);
    const noEsDeAndino = cruzadoBuscar.status === 404 || cruzadoBuscar.body?.encomienda?.id !== encAndino.body.id;
    todo = ok(noEsDeAndino, `la búsqueda por código nunca devuelve la guía de otro tenant`) && todo;
  } else {
    console.log("   (sin salida programada en Andino; se omite el cruce)");
  }

  // --- 7) Reporte del día con desglose de encomiendas -----------------------
  console.log(`\n7) REPORTE DEL DÍA`);
  const rep = await api("GET", "/api/reportes/dia", tFlota);
  // A y B cuentan (registradas hoy); C se anuló y NO cuenta (como los pasajes
  // anulados). Por eso registradasHoy = 2 y monto = 2×25 = 50.
  const enc = rep.body.encomiendas;
  todo = ok(!!enc && enc.registradasHoy >= 2 && enc.montoEncomiendas >= 50, `reporte incluye encomiendas: registradasHoy=${enc?.registradasHoy}, monto=${enc?.montoEncomiendas}, pendientes=${enc?.pendientesEntrega}`) && todo;

  console.log(`\n${todo ? "✅ TODO OK (RF-17..RF-20: registro + contador + ciclo + aislamiento + reporte)" : "❌ Alguna verificación falló"}`);
  process.exit(todo ? 0 : 1);
}

main().catch((err) => { console.error("❌ Error en la prueba:", err); process.exit(1); });
